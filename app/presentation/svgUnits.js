import { HEX_SIZE } from '../geometry/hex.js';
import { selectTerrainLod } from '../render/terrainAssets.js';
import { CUE_PROFILES, EFFECT_LOD } from './motion.js';
const NS = 'http://www.w3.org/2000/svg';
const corners = 'M-28 -18V-28H-18 M18 -28H28V-18 M28 18V28H18 M-18 28H-28V18';
/** Clones carry artwork only. Neither the ghost nor any descendant is a hit target. */
function inertClone(source) {
    const clone = source.cloneNode(true);
    for (const node of [clone, ...Array.from(clone.querySelectorAll('*'))]) {
        for (const { name } of Array.from(node.attributes)) {
            if (name === 'id' || name === 'role' || name === 'tabindex' || name.startsWith('aria-') || (name.startsWith('data-') && name !== 'data-damage') || name.startsWith('on'))
                node.removeAttribute(name);
        }
        node.setAttribute('pointer-events', 'none');
    }
    clone.setAttribute('aria-hidden', 'true');
    return clone;
}
/** One bind per DOM remount; frames touch only active counter/effect attributes.
 * Ghost capture occurs after accepted Core results, before the canonical DOM remount.
 * No Core queries, map markup rebuilds, layout measurements or terrain work in paint. */
export class SvgUnitPresentation {
    bindings = new Map();
    ghosts = new Map();
    touched = new Set();
    root = null;
    layer = null;
    fallbackLod = 'medium';
    fittedHexWidth = 0;
    prepare(events) {
        for (const event of events) {
            if (event.kind !== 'destroyed' || this.ghosts.has(event.unitId))
                continue;
            const binding = this.bindings.get(event.unitId);
            if (!binding)
                continue;
            binding.effect?.remove();
            delete binding.effect;
            const clone = inertClone(binding.counter);
            clone.setAttribute('data-presentation-ghost', event.unitId);
            this.ghosts.set(event.unitId, { ...binding, counter: clone, hit: undefined });
            // Core already removed this unit. Its old DOM must stop receiving input immediately.
            binding.counter.remove();
            binding.hit?.remove();
            this.bindings.delete(event.unitId);
            this.touched.delete(event.unitId);
            this.layer?.appendChild(clone);
        }
    }
    lifecycle(event, lifecycle) {
        if (event.kind === 'destroyed' && lifecycle !== 'started') {
            this.ghosts.get(event.unitId)?.counter.remove();
            this.ghosts.delete(event.unitId);
        }
    }
    bind(root) {
        this.clear();
        this.bindings.clear();
        this.root = root;
        this.layer = null;
        if (!root)
            return;
        const svg = root.querySelector('#eastfront-map');
        this.layer = root.querySelector('#counter-layer');
        this.fallbackLod = svg?.getAttribute('data-lod') ?? 'medium';
        const width = Number(svg?.getAttribute('viewBox')?.split(/\s+/)[2]);
        this.fittedHexWidth = width && svg?.clientWidth ? svg.clientWidth * Math.sqrt(3) * HEX_SIZE / width : 0;
        const hits = new Map(Array.from(root.querySelectorAll('[data-hit-unit-id]')).map(el => [el.getAttribute('data-hit-unit-id'), el]));
        for (const counter of Array.from(root.querySelectorAll('[data-unit-id]'))) {
            const id = counter.getAttribute('data-unit-id');
            if (!id)
                continue;
            this.bindings.set(id, this.binding(counter, hits.get(id)));
        }
        for (const [id, ghost] of this.ghosts) {
            const stale = this.bindings.get(id);
            stale?.counter.remove();
            stale?.hit?.remove();
            this.bindings.delete(id);
            this.layer?.appendChild(ghost.counter);
        }
    }
    paint(states) {
        for (const id of this.touched)
            if (!states.has(id))
                this.restore(id);
        this.touched.clear();
        // Camera already writes this scalar. Reading it cannot force layout or move the camera.
        const zoom = Number(this.root?.getAttribute?.('data-zoom')) || 1;
        const lod = this.fittedHexWidth ? selectTerrainLod(this.fittedHexWidth * zoom) : this.fallbackLod;
        const weight = EFFECT_LOD[lod];
        for (const [id, state] of states) {
            const binding = this.ghosts.get(id) ?? this.bindings.get(id);
            if (!binding)
                continue;
            const { x, y } = state.currentVisualPosition, dx = state.motionOffset.x * weight, dy = state.motionOffset.y * weight;
            const scale = 1 + (state.scale - 1) * weight;
            const accent = dx || dy || scale !== 1 ? ` translate(${dx} ${dy}) scale(${scale})` : '';
            binding.counter.setAttribute('transform', `translate(${x} ${y})${accent}`);
            binding.counter.setAttribute('opacity', String(state.visible ? state.opacity : 0));
            binding.counter.setAttribute('data-animation-phase', state.phase);
            binding.hit?.setAttribute('transform', `translate(${state.currentCanonicalPosition.x - binding.anchorX} ${state.currentCanonicalPosition.y - binding.anchorY})`);
            this.effect(binding, state, weight, lod);
            this.touched.add(id);
        }
    }
    clear() { for (const id of this.touched)
        this.restore(id); this.touched.clear(); }
    dispose() {
        this.clear();
        for (const ghost of this.ghosts.values())
            ghost.counter.remove();
        this.ghosts.clear();
        this.bindings.clear();
        this.layer = null;
        this.root = null;
    }
    binding(counter, hit) {
        return { counter, hit, transform: counter.getAttribute('transform') ?? '', hitTransform: hit?.getAttribute('transform') ?? null,
            opacity: counter.getAttribute('opacity'), anchorX: Number(counter.getAttribute('data-anchor-x')), anchorY: Number(counter.getAttribute('data-anchor-y')) };
    }
    effect(binding, state, weight, lod) {
        if (state.effect <= 0 || state.phase === 'idle') {
            if (binding.effect)
                binding.effect.setAttribute('opacity', '0');
            return;
        }
        let effect = binding.effect;
        if (!effect) {
            effect = binding.counter.ownerDocument.createElementNS(NS, 'path');
            effect.setAttribute('data-presentation-effect', '');
            effect.setAttribute('pointer-events', 'none');
            effect.setAttribute('aria-hidden', 'true');
            effect.setAttribute('fill', 'none');
            effect.setAttribute('stroke-linecap', 'round');
            effect.setAttribute('stroke-linejoin', 'round');
            binding.counter.appendChild(effect);
            binding.effect = effect;
        }
        const phase = state.phase, travel = ['moving', 'retreating', 'advancing', 'breakthrough'].includes(phase);
        const angle = Math.atan2(state.direction.y, state.direction.x) * 180 / Math.PI;
        const reach = CUE_PROFILES[state.character].reach;
        let path = corners, rotation = 0, color = '#dbc68d', stroke = 1.6;
        if (phase === 'firing') {
            path = lod === 'far' ? 'M25 -3L28 0L25 3' : `M25 -4L${25 + reach} 0L25 4 M27 -8L30 -10 M27 8L30 10`;
            rotation = angle;
            color = '#fff0bd';
            stroke = 2;
        }
        else if (phase === 'hit' || phase === 'destroyed') {
            color = '#e3a08a';
            stroke = 2;
        }
        else if (travel) {
            path = phase === 'retreating' ? 'M-27 -8L-30 0L-27 8' : phase === 'breakthrough' ? 'M25 -7L29 0L25 7 M30 -5L33 0L30 5' : phase === 'advancing' ? 'M25 -6L28 0L25 6' : 'M-17 28Q0 32 17 28';
            rotation = phase === 'moving' ? 0 : angle;
            stroke = phase === 'moving' ? 3 : 1.5;
            if (phase === 'moving')
                color = '#07121d';
            if (phase === 'moving')
                color = '#07121d';
        }
        effect.setAttribute('d', path);
        effect.setAttribute('transform', `rotate(${rotation})`);
        effect.setAttribute('stroke', color);
        effect.setAttribute('stroke-width', String(stroke));
        effect.setAttribute('opacity', String(state.effect * weight));
    }
    restore(id) {
        const binding = this.ghosts.get(id) ?? this.bindings.get(id);
        if (!binding)
            return;
        binding.effect?.remove();
        delete binding.effect;
        binding.counter.setAttribute('transform', binding.transform);
        binding.counter.removeAttribute('data-animation-phase');
        if (binding.opacity === null)
            binding.counter.removeAttribute('opacity');
        else
            binding.counter.setAttribute('opacity', binding.opacity);
        if (binding.hit) {
            if (binding.hitTransform === null)
                binding.hit.removeAttribute('transform');
            else
                binding.hit.setAttribute('transform', binding.hitTransform);
        }
    }
}

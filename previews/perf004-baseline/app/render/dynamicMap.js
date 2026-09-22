import {perf4} from '../perf004Trace.js';
import { coreSvgDynamicMarkup, coreSvgOverlayMarkup, renderCounter, renderCounterHit } from './coreSvg.js';
import { getLocale } from '../localization/index.js';
/** Camera never enters here. UI drafts patch overlays/adornments. Deployment
 * snapshots reconcile authorized counters; other view changes remount canonically. */
export class DynamicMapRenderer {
    layer = null;
    previous = null;
    locale = '';
    debug = false;
    deploymentOverlays = null;
    adopt(layer, model, options) { this.layer = layer; this.previous = model; this.locale = getLocale(); this.debug = options.debug; this.deploymentOverlays = model.deployment ? coreSvgOverlayMarkup(model, options) : null; }
    update(layer, model, options) {const __p4end=perf4.begin("render/dynamicMap.js:DynamicMapRenderer.update");try{
        const previous = this.previous, locale = getLocale();
        const deployment = this.layer === layer && previous?.deployment && model.deployment && previous.phase === model.phase && previous.playerView.viewer === model.playerView.viewer && previous.viewerControllerId === model.viewerControllerId && this.locale === locale && !this.debug && !options.debug;
        const full = this.layer !== layer || !previous || previous.playerView !== model.playerView || this.locale !== locale || this.debug !== options.debug;
        this.layer = layer;
        this.previous = model;
        this.locale = locale;
        this.debug = options.debug;
        if (deployment)
            return this.updateDeployment(layer, previous, model, options);
        this.deploymentOverlays = null;
        if (full) {
            layer.innerHTML = coreSvgDynamicMarkup(model, options);
            return { full: true, units: model.counters.length };
        }
        const overlays = layer.querySelector('#interaction-overlays');
        if (overlays)
            overlays.innerHTML = coreSvgOverlayMarkup(model, options);
        const old = new Map(previous.counters.map(c => [c.id, c]));
        let units = 0;
        const groups = new Map();
        for (const c of model.counters) {
            const key = `${c.hex.q},${c.hex.r}`, group = groups.get(key) ?? [];
            group.push(c);
            groups.set(key, group);
        }
        const elements = new Map(Array.from(layer.querySelectorAll('[data-unit-id]')).map(el => [el.getAttribute('data-unit-id'), el]));
        for (const group of groups.values()) {
            group.sort((a, b) => a.id.localeCompare(b.id));
            for (const [index, c] of group.entries()) {
                const before = old.get(c.id);
                if (before?.selected === c.selected && before?.combatRole === c.combatRole)
                    continue;
                const current = elements.get(c.id);
                if (!current)
                    continue;
                // Render only affected identity with the canonical Counter builder, then copy
                // its UI attributes. Never disturb travel transforms, proxy identity or artwork.
                const fragment = layer.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'g');
                fragment.innerHTML = renderCounter(c, index, group.length);
                const next = fragment.firstElementChild;
                for (const name of ['class', 'aria-label', 'aria-pressed'])
                    current.setAttribute(name, next.getAttribute(name));
                const title = current.querySelector('title');
                if (title)
                    title.textContent = next.querySelector('title')?.textContent ?? '';
                for (const [selector, attributes] of [['.counter-face', ['transform']], ['.counter-body', ['stroke', 'stroke-width']]]) {
                    const target = current.querySelector(selector), source = next.querySelector(selector);
                    if (target && source)
                        for (const name of attributes)
                            target.setAttribute(name, source.getAttribute(name));
                }
                units++;
            }
        }
        return { full: false, units };
    }finally{__p4end();}}
    /** During deployment a new authorized view usually adds a single counter.
     * Compare canonical inputs, retain unchanged Counter identities, and
     * still remove every identity absent from the new authorized model. */
    updateDeployment(layer, previous, model, options) {const __p4end=perf4.begin("render/dynamicMap.js:DynamicMapRenderer.updateDeployment");try{
        const overlays = layer.querySelector('#interaction-overlays'), markup = coreSvgOverlayMarkup(model, options);
        if (overlays && this.deploymentOverlays !== markup)
            overlays.innerHTML = markup;
        this.deploymentOverlays = markup;
        const placements = (m) => {
            const groups = new Map();
            for (const c of m.counters) {
                const key = `${c.hex.q},${c.hex.r}`, group = groups.get(key) ?? [];
                group.push(c);
                groups.set(key, group);
            }
            return [...groups.values()].flatMap(group => group.sort((a, b) => a.id.localeCompare(b.id)).map((c, index) => ({ c, index, count: group.length, key: JSON.stringify([c, index, group.length]) })));
        };
        const before = new Map(placements(previous).map(p => [p.c.id, p.key]));
        const counters = layer.querySelector('#counter-layer'), hits = layer.querySelector('#counter-hit-layer');
        const current = new Map(Array.from(counters.querySelectorAll('[data-unit-id]')).map(n => [n.getAttribute('data-unit-id'), n]));
        const hitNodes = new Map(Array.from(hits.querySelectorAll('[data-hit-unit-id]')).map(n => [n.getAttribute('data-hit-unit-id'), n]));
        const authorized = new Set(model.counters.map(c => c.id));
        for (const [id, node] of current)
            if (!authorized.has(id)) {
                node.remove();
                hitNodes.get(id)?.remove();
            }
        let units = 0;
        const ordered = placements(model);
        for (const p of ordered) {
            if (before.get(p.c.id) === p.key && current.has(p.c.id))
                continue;
            const fragment = layer.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'g');
            fragment.innerHTML = renderCounter(p.c, p.index, p.count);
            const node = fragment.firstElementChild;
            const old = current.get(p.c.id);
            if (old)
                old.replaceWith(node);
            else
                counters.appendChild(node);
            current.set(p.c.id, node);
            fragment.innerHTML = renderCounterHit(p.c);
            const hit = fragment.firstElementChild;
            const oldHit = hitNodes.get(p.c.id);
            if (oldHit)
                oldHit.replaceWith(hit);
            else
                hits.appendChild(hit);
            hitNodes.set(p.c.id, hit);
            units++;
        }
        // Preserve canonical stacking/z order without remounting unchanged nodes.
        for (const [parent, nodes] of [[counters, current], [hits, hitNodes]]) {
            let next = parent.firstElementChild;
            for (const p of ordered) {
                const node = nodes.get(p.c.id);
                if (node !== next)
                    parent.insertBefore(node, next);
                next = node.nextElementSibling;
            }
        }
        return { full: false, units };
    }finally{__p4end();}}
}

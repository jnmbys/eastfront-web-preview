import { deriveFogPlan, rasterizeFog, FOG_STYLE } from './surface.js';
function encode(raster) {
    const canvas = document.createElement('canvas');
    canvas.width = raster.width;
    canvas.height = raster.height;
    const ctx = canvas.getContext('2d');
    if (!ctx)
        throw new Error('Fog canvas unavailable');
    const data = ctx.createImageData(raster.width, raster.height);
    data.data.set(raster.rgba);
    ctx.putImageData(data, 0, 0);
    return canvas.toDataURL('image/png');
}
/** Bounded images and one active CSS transition. No RAF, terrain build, or authoritative inputs. */
export class FogRuntime {
    encoder;
    cache = new Map();
    masks = new Map();
    current = null;
    layer = null;
    cleanup = () => { };
    builds = 0;
    constructor(encoder = encode) {
        this.encoder = encoder;
    }
    get buildCount() { return this.builds; }
    settle() { this.cleanup(); this.cleanup = () => { }; }
    clear() { this.settle(); this.layer?.replaceChildren(); this.layer = null; this.current = null; this.cache.clear(); this.masks.clear(); }
    sync(svg, view, selectedUnitId = null, instant = false) {
        if (!svg || !view) {
            this.clear();
            return;
        }
        const layer = svg.querySelector('#fog-surface-layer');
        if (!layer)
            return;
        const plan = deriveFogPlan(view, selectedUnitId), previous = this.current;
        const sameViewer = previous?.plan.viewer === plan.viewer;
        // Never crossfade a former viewer's observation footprint or retain it in cache.
        if (!sameViewer) {
            this.clear();
        }
        if (this.layer === layer && this.current?.plan.key === plan.key) {
            if (instant)
                this.settle();
            return;
        }
        this.settle();
        this.layer = layer;
        layer.replaceChildren();
        let entry = this.cache.get(plan.key);
        if (!entry) {
            let fog = this.masks.get(plan.maskKey);
            if (fog === undefined) {
                fog = plan.viewer === 'OBSERVER' ? '' : this.encoder(rasterizeFog(plan));
                if (plan.viewer !== 'OBSERVER')
                    this.builds++;
                this.masks.set(plan.maskKey, fog);
                while (this.masks.size > 3)
                    this.masks.delete(this.masks.keys().next().value);
            }
            entry = { plan, fog, recon: plan.recon.length ? this.encoder(rasterizeFog(plan, 'recon')) : null };
            this.cache.set(plan.key, entry);
            while (this.cache.size > 3)
                this.cache.delete(this.cache.keys().next().value);
        }
        const node = (url, role) => { const image = svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'image'); const b = plan.bounds; for (const [key, value] of Object.entries({ x: b.minX, y: b.minY, width: b.width, height: b.height, href: url, 'data-fog-role': role, 'preserveAspectRatio': 'none' }))
            image.setAttribute(key, String(value)); layer.appendChild(image); return image; };
        this.current = entry;
        layer.setAttribute('data-fog-viewer', plan.viewer);
        layer.setAttribute('data-fog-builds', String(this.builds));
        if (!entry.fog)
            return;
        const animate = sameViewer && previous && previous.plan.maskKey !== plan.maskKey && !instant;
        const old = animate && previous.fog ? node(previous.fog, 'previous') : null;
        const current = node(entry.fog, 'current');
        if (entry.recon)
            node(entry.recon, 'recon');
        if (old) {
            old.setAttribute('style', `animation:fog-leave ${FOG_STYLE.transitionMs}ms ease-out both`);
            current.setAttribute('style', `animation:fog-enter ${FOG_STYLE.transitionMs}ms ease-out both`);
            const done = () => { old.remove(); current.removeAttribute('style'); current.removeEventListener('animationend', done); };
            current.addEventListener('animationend', done);
            this.cleanup = done;
        }
    }
}

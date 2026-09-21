import { coreSvgDynamicMarkup, coreSvgOverlayMarkup, renderCounter } from './coreSvg.js';
import { getLocale } from '../localization/index.js';
/** Invalidation boundary: camera never enters here; UI drafts patch overlays and
 * changed unit adornments. A new authorized view or locale requires canonical markup. */
export class DynamicMapRenderer {
    layer = null;
    previous = null;
    locale = '';
    debug = false;
    adopt(layer, model, options) { this.layer = layer; this.previous = model; this.locale = getLocale(); this.debug = options.debug; }
    update(layer, model, options) {
        const previous = this.previous, locale = getLocale();
        const full = this.layer !== layer || !previous || previous.playerView !== model.playerView || this.locale !== locale || this.debug !== options.debug;
        this.layer = layer;
        this.previous = model;
        this.locale = locale;
        this.debug = options.debug;
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
    }
}

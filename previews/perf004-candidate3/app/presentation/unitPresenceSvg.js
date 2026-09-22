import {perf4} from '../perf004Trace.js';
const NS = 'http://www.w3.org/2000/svg';
export function presenceNode(doc, tag, attrs, parent) {
    const node = doc.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs))
        node.setAttribute(key, String(value));
    node.setAttribute('pointer-events', 'none');
    parent?.appendChild(node);
    return node;
}
// Original vector miniatures. Shared once per mounted map; no bitmap/loader dependency.
// Coordinates are local artwork dimensions, never hex or stack geometry.
const formation = [[-18, 0], [0, -5], [19, 2]];
const artwork = {
    infantry: {
        side: formation.map(([x, y]) => `M${x - 5} ${y - 8}l4-3 5 2 2 8-3 2 1 7h-4l-2-7-2 7h-4l2-10-2-2Z M${x + 3} ${y - 5}l4-2 1-7-2-1-2 7-4 1Z`).join(' '),
        top: formation.map(([x, y]) => `M${x - 4} ${y - 13}a4 3 0 1 1 8 0l-1 2-6 0Z M${x - 4} ${y - 8}l4-2 4 2-1 7-7-1Z`).join(' '),
        facet: formation.map(([x, y]) => `M${x + 1} ${y - 8}l3 1-1 6-3-1Z`).join(' '),
        detail: formation.map(([x, y]) => `M${x - 3} ${y - 14}l4-1 M${x - 2} ${y - 7}v4 M${x - 4} ${y + 6}h3 M${x + 1} ${y + 6}h2`).join(' '),
    },
    armor: {
        side: 'M-24-3L-13-10 18-7 24 0 21 8-12 10-24 4Z M-24 0l11 5 33-2v5l-33 3-11-5Z M-20-8l9-6 29 3 3 4-31 0Z',
        top: 'M-22-5L-11-12 18-9 23-2 11 4-12 3Z M-9-11L-1-18 11-15 13-8 4-3-9-6Z M9-14L29-17 30-13 11-9Z',
        facet: 'M-9-6L4-3 13-8 11-12 3-7Z M-12 3l23 1 12-6-1 4-10 5-24-1Z',
        detail: 'M-21 2l9 5 31-2 M-17 4v3 M-10 7v2 M-3 7v2 M4 6v2 M11 6v2 M18 5v2 M-7-12l7-4 8 2 M-3-12l4-2 4 1-3 2Z M14-14l12-2 M-17-6l-1 3 M-13-8l-1 3',
    },
    motorized: {
        side: 'M-21-2L-14-8 15-6 21 0 19 6-15 7-21 3Z M-16 4v5h5V5 M10 4v5h5V4',
        top: 'M-21-3L-14-10 6-8 6 0-14 3Z M7-8L14-9 21-2 15 2 7 0Z M24 4l1-6 3 1 2 6Z',
        detail: 'M-18-3l5-4 16 2 M9-6l5-1 4 4-8 2Z M-13 4h-2 M12 4h2 M25-3l2-1',
    },
    artillery: {
        side: 'M-21 6L-5-4 0 0-16 11-22 10Z M-2 0L16 7 15 11-5 4Z M-13-5a5 7 0 1 1 1 13 5 7 0 1 1-1-13Z M3-7a4 6 0 1 1 1 12 4 6 0 1 1-1-12Z',
        top: 'M-13-7L-3-14 8-10 5-3-6 0Z M1-12L25-20 27-15 5-6Z M-21 6L-5-4-2-1-17 9Z M-2-1l18 8-3 2-17-7Z',
        facet: 'M-6 0L5-3 8-10 4-10 1-5-7-3Z',
        detail: 'M-13-1a2 4 0 1 1 0 6 2 4 0 1 1 0-6Z M-15 2h5 M-13 0v6 M5-13l18-6 M-4-9l6-2 M-19 8l4-1 M11 7l3 1',
    },
    'anti-tank': {
        side: 'M-17 4L-6-2 1 0 14 6 12 9-16 8Z M-9-3v8h5V0 M5-3v8h5V0',
        top: 'M-12-5L-5-9 9-6 12-2 4 1-10-1Z M2-7L24-10 25-8 4-4Z M-9 2L-18 6-15 7-5 3Z',
        detail: 'M-9-4l5-2 10 2 M8-7l13-2 M3 3l9 4',
    },
    engineer: {
        side: 'M-17 1L-7-5 10-3 15 3 10 9-13 8Z M-20 5L-12 2-7 6-8 10-20 9Z',
        top: 'M-17 0L-7-8 10-5 15 1 6 5-13 4Z M-7-7L-1-11 7-8 7-2 0 1-7-2Z M-20 4l8-3 4 3-9 3Z',
        detail: 'M-12 6l18 1 M10-5l8-3 4 3 M-4-4l5-3 M0-7l4 6',
    },
    recon: {
        side: 'M-16 0L-6-6 10-4 17 2 11 7-12 7Z M-12 4v5h4V5 M8 4v5h4V4',
        top: 'M-16-1L-6-8 10-5 17 1 8 4-12 3Z M-4-7L2-10 8-7 7-2 0 0-4-3Z',
        detail: 'M-8 1l14 1 M0-6l5-2 M-2-5l-3-9 M10-3l5 3',
    },
    headquarters: {
        side: 'M-15 5V-3L-2-9 15-2v8L0 10Z',
        top: 'M-15-4L-2-12 15-3 1 3Z M1 3l14-6v8L1 9Z',
        detail: 'M-2-10V-17l9 2-9 2 M-12-3L-2-9 11-3 M-2 3v5',
    },
};
export function createPresenceDefinitions(doc) {const __p4end=perf4.begin("presentation/unitPresenceSvg.js:createPresenceDefinitions");try{
    const defs = presenceNode(doc, 'defs', { 'data-presence-definitions': '' });
    for (const [family, art] of Object.entries(artwork)) {
        const body = presenceNode(doc, 'g', { id: `presence-${family}` }, defs);
        // A narrow neutral under-edge separates dark silhouettes from both forest and stone.
        // Shared vector paths only: no filter, bitmap, glow or terrain sampling.
        presenceNode(doc, 'path', { d: art.side + ' ' + art.top, fill: 'none', stroke: '#c1b79a', 'stroke-opacity': .55, 'stroke-width': 2.6, 'stroke-linejoin': 'round' }, body);
        presenceNode(doc, 'path', { d: art.side, fill: '#202a2b', stroke: '#1a2527', 'stroke-width': 1.1, 'stroke-linejoin': 'round' }, body);
        presenceNode(doc, 'path', { d: art.top, fill: 'currentColor', stroke: '#253133', 'stroke-width': .8, 'stroke-linejoin': 'round' }, body);
        if (art.facet)
            presenceNode(doc, 'path', { d: art.facet, fill: '#1a2426', 'fill-opacity': .43 }, body);
        const detail = presenceNode(doc, 'g', { id: `presence-${family}-detail` }, defs);
        presenceNode(doc, 'path', { d: art.detail, fill: 'none', stroke: '#eee2c7', 'stroke-opacity': .78, 'stroke-width': .85, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, detail);
    }
    return defs;
}finally{__p4end();}}

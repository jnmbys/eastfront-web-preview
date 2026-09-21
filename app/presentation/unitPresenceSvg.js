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
const artwork = {
    infantry: {
        side: 'M-16 5l2-9h5l2 9h-3l-2-5-1 5Z M-3 1l2-9h5l2 9H3L2-4 0 1Z M9 7l2-9h5l2 9h-3l-2-5-1 5Z',
        top: 'M-15-5l2-2 4 1 1 3-5 1Z M-2-9l2-2 4 1 1 3-5 1Z M10-3l2-2 4 1 1 3-5 1Z',
        detail: 'M-13-2l4 2 5-2 M0-6l4 2 5-2 M12 0l4 2 5-2 M-15 5l4 1 M-2 1l4 1 M10 7l4 1',
    },
    armor: {
        side: 'M-20-3L-11-9 14-6 21 1 18 7-10 9-20 4Z',
        top: 'M-19-4L-10-10 14-7 20-1 11 4-12 3Z M-7-9L0-13 9-10 9-5 2-2-7-5Z M6-10L25-13 26-10 8-6Z',
        detail: 'M-16 1l5 3 27-1 M-16 5l4 2 M-6 6h3 M2 6h3 M10 5h3 M-8-8l8-3 7 2 M-13-5l-2 3 M-5-2l8 1',
    },
    motorized: {
        side: 'M-21-2L-14-8 15-6 21 0 19 6-15 7-21 3Z M-16 4v5h5V5 M10 4v5h5V4',
        top: 'M-21-3L-14-10 6-8 6 0-14 3Z M7-8L14-9 21-2 15 2 7 0Z M24 4l1-6 3 1 2 6Z',
        detail: 'M-18-3l5-4 16 2 M9-6l5-1 4 4-8 2Z M-13 4h-2 M12 4h2 M25-3l2-1',
    },
    artillery: {
        side: 'M-17 4L-5-4 1 0-12 9Z M-1 0L15 8 12 11-5 3Z M-9-5l6-3 7 6-1 8-7 2-5-6Z',
        top: 'M-9-6L-1-11 7-7 3 0-4 2Z M1-9L23-15 25-11 4-3Z M-16 4L-5-4-2-2-13 7Z',
        detail: 'M-6-3l5 2-1 6 M-4 1l6-2 M7-9l14-4 M4 3l9 5 M-11 5l4-4',
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
export function createPresenceDefinitions(doc) {
    const defs = presenceNode(doc, 'defs', { 'data-presence-definitions': '' });
    for (const [family, art] of Object.entries(artwork)) {
        const body = presenceNode(doc, 'g', { id: `presence-${family}` }, defs);
        presenceNode(doc, 'path', { d: art.side, fill: '#172129', stroke: '#172129', 'stroke-width': 1.1, 'stroke-linejoin': 'round' }, body);
        presenceNode(doc, 'path', { d: art.top, fill: 'currentColor', stroke: '#d9d5bf', 'stroke-opacity': .48, 'stroke-width': .55, 'stroke-linejoin': 'round' }, body);
        const detail = presenceNode(doc, 'g', { id: `presence-${family}-detail` }, defs);
        presenceNode(doc, 'path', { d: art.detail, fill: 'none', stroke: '#eee2c7', 'stroke-opacity': .65, 'stroke-width': .7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, detail);
    }
    return defs;
}

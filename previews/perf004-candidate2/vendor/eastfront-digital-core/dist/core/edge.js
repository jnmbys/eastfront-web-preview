import { hexKey, sameHex } from './hex.js';
export function canonicalEdgeKey(a, b) {
    const ak = hexKey(a);
    const bk = hexKey(b);
    return ak < bk ? `${ak}|${bk}` : `${bk}|${ak}`;
}
export function makeEdge(a, b, partial = {}) {
    if (sameHex(a, b))
        throw new Error('A HexEdge requires two distinct hexes.');
    return {
        key: canonicalEdgeKey(a, b),
        a: { ...a },
        b: { ...b },
        road: partial.road ?? false,
        railway: partial.railway ?? null,
        river: partial.river ?? null,
        bridge: partial.bridge ?? null
    };
}
export function getEdge(edges, a, b) {
    return edges[canonicalEdgeKey(a, b)];
}

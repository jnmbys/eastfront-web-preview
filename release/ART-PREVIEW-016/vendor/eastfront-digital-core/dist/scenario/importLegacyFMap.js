import { makeEdge, canonicalEdgeKey } from '../core/edge.js';
import { paperToAxial, hexKey } from '../core/hex.js';
const terrainMap = {
    plain: 'PLAIN', forest: 'FOREST', hill: 'HILL', marsh: 'MARSH', rough: 'ROUGH', lake: 'LAKE',
    city: 'CITY', maincity: 'MAIN_CITY', outercity: 'OUTER_CITY'
};
function legacyCellToAxial(cell) {
    const [column, row] = cell;
    let n = column;
    let label = '';
    while (n > 0) {
        n -= 1;
        label = String.fromCharCode(65 + n % 26) + label;
        n = Math.floor(n / 26);
    }
    return paperToAxial(label, row);
}
/**
 * Converts the current Python/map-generator JSON into the new single-edge registry.
 * Current legacy maps imply a bridge whenever road/rail and river share an edge.
 * That inference is isolated here so the future scenario format can store bridges explicitly.
 */
export function importLegacyMap(raw) {
    const hexes = [];
    for (const [k, v] of Object.entries(raw.terrain)) {
        const [column, row] = k.split(',').map(Number);
        const coord = legacyCellToAxial([column, row]);
        const terrain = terrainMap[v];
        if (!terrain)
            throw new Error(`Unknown legacy terrain: ${v}`);
        hexes.push({ coord, terrain, control: null });
    }
    const edgeMap = new Map();
    const ensure = (a, b) => {
        const aa = legacyCellToAxial(a), bb = legacyCellToAxial(b), key = canonicalEdgeKey(aa, bb);
        const existing = edgeMap.get(key) ?? makeEdge(aa, bb);
        edgeMap.set(key, existing);
        return existing;
    };
    for (const [a, b] of raw.roads)
        ensure(a, b).road = true;
    for (const [a, b] of raw.rails)
        ensure(a, b).railway = { present: true, repairedBy: null, destroyed: false };
    for (const rv of raw.rivers)
        ensure(rv.a, rv.b).river = rv.kind === 'main' ? 'MAJOR' : 'MINOR';
    for (const edge of edgeMap.values()) {
        if (edge.river && (edge.road || edge.railway)) {
            edge.bridge = { kind: edge.road && edge.railway ? 'BOTH' : edge.road ? 'ROAD' : 'RAILWAY', destroyed: false };
        }
    }
    // Ensure hex keys are unique and deterministic during import debugging.
    if (new Set(hexes.map(h => hexKey(h.coord))).size !== hexes.length)
        throw new Error('Duplicate imported hex coordinate.');
    return { hexes, edges: [...edgeMap.values()] };
}

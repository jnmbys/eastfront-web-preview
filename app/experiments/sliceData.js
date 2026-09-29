import { importLegacyMap, paperToAxial, axialToPaper, defaultRules } from '../../vendor/eastfront-digital-core/dist/index.js';
import { hexKey, hexPolygon, hexToPixel, sharedHexEdge } from '../geometry/hex.js';
export const SLICE_BOUNDS = { firstColumn: 20, lastColumn: 26, firstRow: 12, lastRow: 16 };
export function createSlice(raw) {
    const full = importLegacyMap(raw), b = SLICE_BOUNDS;
    const hexes = full.hexes.filter(h => { const p = axialToPaper(h.coord); return h.coord.q + 1 >= b.firstColumn && h.coord.q + 1 <= b.lastColumn && p.row >= b.firstRow && p.row <= b.lastRow; });
    const keys = new Set(hexes.map(h => hexKey(h.coord)));
    // Include crossing edges and clip them to the union. Never infer a new endpoint/bridge in the slice.
    const edges = full.edges.filter(e => keys.has(hexKey(e.a)) || keys.has(hexKey(e.b)));
    const fixtures = [['G-01', 'GERMAN', 'PANZER', 'W', 12, 0], ['G-02', 'GERMAN', 'INFANTRY', 'X', 13, 0], ['G-03', 'GERMAN', 'ENGINEER', 'X', 13, 1], ['S-01', 'SOVIET', 'INFANTRY', 'Y', 14, 1]];
    const counters = fixtures.map(([id, side, type, col, row, step]) => {
        const template = Object.values(defaultRules.unitTemplates).find(t => t.side === side && t.type === type);
        return { id, side, type, step, stats: template.steps[step], hex: paperToAxial(col, row), supplyState: 'SUPPLIED', controllerId: side, selected: false, entrenched: false };
    });
    return { hexes, edges, counters };
}
export const label = (h) => axialToPaper(h).label;
export function inside(p, polygon) {
    let result = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i], b = polygon[j];
        if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)
            result = !result;
    }
    return result;
}
export function segmentDistance(p, a, b) {
    const x = b.x - a.x, y = b.y - a.y, t = Math.max(0, Math.min(1, ((p.x - a.x) * x + (p.y - a.y) * y) / (x * x + y * y || 1)));
    return Math.hypot(p.x - a.x - t * x, p.y - a.y - t * y);
}
export function corridors(data) {
    return data.edges.flatMap(e => {
        const paths = [];
        if (e.road || e.railway?.present)
            paths.push({ a: hexToPixel(e.a), b: hexToPixel(e.b), width: 5, kind: 'transport', key: e.key });
        if (e.river) {
            const p = sharedHexEdge(e.a, e.b);
            paths.push({ a: p[0], b: p[1], width: e.river === 'MAJOR' ? 7 : 5, kind: 'river', key: e.key });
        }
        return paths;
    });
}
export function semanticAudit(data) {
    return {
        bounds: SLICE_BOUNDS, cells: data.hexes.map(h => ({ label: label(h.coord), coord: h.coord, terrain: h.terrain, polygon: hexPolygon(h.coord) })),
        edges: data.edges.map(e => ({ key: e.key, a: label(e.a), b: label(e.b), road: !!e.road, rail: !!e.railway?.present, river: e.river ?? null, bridge: e.bridge ?? null, roadLine: (e.road || e.railway?.present) ? [hexToPixel(e.a), hexToPixel(e.b)] : null, riverLine: e.river ? sharedHexEdge(e.a, e.b) : null })),
        fixtureNotice: 'Four public display fixtures. Not a live game/PlayerView; no movement/combat or hidden state queried.'
    };
}

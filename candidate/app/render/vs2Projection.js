import { hexToPixel, hexPolygon, hexNeighbors, sharedHexEdge } from '../geometry/hex.js';
import { viewBoxForHexes } from './coreSvg.js';
import { createVS2RegionField, vs2Region } from './vs2WorldField.js';
export function vs2SegmentDistance(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, length2 = dx * dx + dy * dy;
    const t = length2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2)) : 0;
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
/** Distance to a full, axis-aligned sprite rectangle; includes shadows and transparent margins. */
export function vs2RectangleSegmentDistance(p, halfWidth, halfHeight, a, b) {
    let lo = 0, hi = 1;
    for (const [start, delta, min, max] of [[a.x, b.x - a.x, p.x - halfWidth, p.x + halfWidth], [a.y, b.y - a.y, p.y - halfHeight, p.y + halfHeight]]) {
        if (delta === 0) {
            if (start < min || start > max) {
                lo = 2;
                break;
            }
        }
        else {
            const t0 = (min - start) / delta, t1 = (max - start) / delta;
            lo = Math.max(lo, Math.min(t0, t1));
            hi = Math.min(hi, Math.max(t0, t1));
        }
    }
    if (lo <= hi)
        return 0;
    const pointRect = (q) => Math.hypot(Math.max(Math.abs(q.x - p.x) - halfWidth, 0), Math.max(Math.abs(q.y - p.y) - halfHeight, 0));
    let distance = Math.min(pointRect(a), pointRect(b));
    for (const dx of [-halfWidth, halfWidth])
        for (const dy of [-halfHeight, halfHeight])
            distance = Math.min(distance, vs2SegmentDistance({ x: p.x + dx, y: p.y + dy }, a, b));
    return distance;
}
/** Projection only: canonical coordinates and topology remain the sole source. */
export function projectVS2Terrain(model, pixelSize = 2) {
    if (!Number.isFinite(pixelSize) || pixelSize <= 0)
        throw new Error('Invalid VS2 projection resolution');
    const viewBox = viewBoxForHexes(model.hexes), field = createVS2RegionField(model.hexes);
    // Snap to a fixed world lattice, not the viewBox/camera origin.
    const minX = Math.floor(viewBox.minX / pixelSize) * pixelSize, minY = Math.floor(viewBox.minY / pixelSize) * pixelSize;
    const width = Math.ceil((viewBox.minX + viewBox.width - minX) / pixelSize) * pixelSize;
    const height = Math.ceil((viewBox.minY + viewBox.height - minY) / pixelSize) * pixelSize;
    const cityCells = model.hexes.filter(h => vs2Region(h.terrain) === 'city').sort((a, b) => a.coord.q - b.coord.q || a.coord.r - b.coord.r);
    const cityKeys = new Set(cityCells.map(h => `${h.coord.q},${h.coord.r}`));
    const cityBoundary = [];
    for (const cell of cityCells)
        for (const n of hexNeighbors(cell.coord)) {
            if (!cityKeys.has(`${n.q},${n.r}`))
                cityBoundary.push(sharedHexEdge(cell.coord, n));
        }
    const corridors = [];
    for (const edge of [...model.edges].sort((a, b) => a.key.localeCompare(b.key))) {
        const a = hexToPixel(edge.a), b = hexToPixel(edge.b);
        // Conservative envelopes cover all existing P5R1 overlay widths, including close LOD.
        if (edge.road)
            corridors.push({ key: edge.key, kind: 'road', a, b, radius: 6 });
        if (edge.railway?.present)
            corridors.push({ key: edge.key, kind: 'rail', a, b, radius: 6 });
        if (edge.river) {
            const bank = sharedHexEdge(edge.a, edge.b);
            if (!bank)
                throw new Error(`Non-adjacent canonical river: ${edge.key}`);
            corridors.push({ key: edge.key, kind: 'river', a: bank[0], b: bank[1], radius: edge.river === 'MAJOR' ? 9 : 8.5 });
        }
        if (edge.bridge && !edge.bridge.destroyed) {
            const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            corridors.push({ key: edge.key, kind: 'bridge', a: center, b: center, radius: Math.hypot(27, 14) });
        }
    }
    return {
        viewBox, rasterBounds: { minX, minY, width, height }, pixelSize, field, corridors,
        cityCells: cityCells.map(h => ({ coord: h.coord, polygon: hexPolygon(h.coord) })),
        worldToRaster: (p) => ({ x: (p.x - minX) / pixelSize, y: (p.y - minY) / pixelSize }),
        rasterToWorld: (p) => ({ x: minX + p.x * pixelSize, y: minY + p.y * pixelSize }),
        canPlaceCity(p, width, height) {
            if (field.regionAt(p.x, p.y) !== 'city')
                return false;
            if (cityBoundary.some(([a, b]) => vs2RectangleSegmentDistance(p, width / 2, height / 2, a, b) === 0))
                return false;
            return !corridors.some(edge => vs2RectangleSegmentDistance(p, width / 2, height / 2, edge.a, edge.b) <= edge.radius + 1);
        },
    };
}

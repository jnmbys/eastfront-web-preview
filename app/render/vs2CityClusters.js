import { VS2_WORLD_H, vs2VisualValue } from './vs2WorldField.js';
import { vs2AssetCatalog } from './vs2Assets.js';
/** World-lattice candidates span the city union. Reject whole footprints: no roof clipping. */
export function planVS2CityClusters(projection, seed, lod = 'medium', assets = vs2AssetCatalog) {
    const entries = assets.byFamily('city').filter(e => (e.semanticRole === 'buildingStamp' || e.semanticRole === 'localDecoration') && e.LOD.includes(lod) && e.rotationAllowed.degrees?.includes(0));
    if (!entries.length)
        return [];
    const step = VS2_WORLD_H * 0.10, candidates = new Set();
    for (const city of projection.cityCells) {
        const xs = city.polygon.map(p => p.x), ys = city.polygon.map(p => p.y);
        for (let iy = Math.floor(Math.min(...ys) / step); iy <= Math.ceil(Math.max(...ys) / step); iy++) {
            for (let ix = Math.floor(Math.min(...xs) / step); ix <= Math.ceil(Math.max(...xs) / step); ix++)
                candidates.add(`${ix},${iy}`);
        }
    }
    const positions = [...candidates].map(k => k.split(',').map(Number)).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    const placed = [];
    for (const [ix, iy] of positions) {
        const random = (purpose) => vs2VisualValue(seed, `city:${purpose}`, ix, iy);
        const preferred = Math.floor(random('asset') * entries.length);
        const ordered = [entries[preferred], ...entries.filter(e => e.semanticRole === 'localDecoration')];
        const x = (ix + 0.5 + (random('x') - 0.5) * 0.45) * step, y = (iy + 0.5 + (random('y') - 0.5) * 0.45) * step;
        for (const entry of ordered) {
            const range = entry.recommendedWorldScale.width;
            const width = (range[0] + (range[1] - range[0]) * random('scale') * 0.15) * VS2_WORLD_H;
            const height = width * entry.sourceSize[1] / entry.sourceSize[0];
            const radius = Math.hypot(width, height) / 2;
            if (!projection.canPlaceCity({ x, y }, width, height))
                continue;
            if (placed.some(p => Math.abs(p.x - x) < (p.width + width) / 2 + 1 && Math.abs(p.y - y) < (p.height + height) / 2 + 1))
                continue;
            placed.push({ id: `city:${ix},${iy}`, assetId: entry.id, x, y, width, height, radius,
                opacity: entry.opacityRange[1], rotation: 0, mirror: false });
            break;
        }
    }
    return placed;
}

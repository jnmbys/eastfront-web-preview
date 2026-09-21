import { selectTerrainLod } from '../render/terrainAssets.js';
export const PRESENCE_FAMILY = Object.freeze({
    INFANTRY: 'infantry', JAGER: 'infantry', ELITE_INFANTRY: 'infantry',
    PANZER: 'armor', TANK: 'armor', HEAVY_TANK: 'armor', MOTORIZED: 'motorized',
    ARTILLERY: 'artillery', ANTI_TANK: 'anti-tank', ENGINEER: 'engineer', RECON: 'recon', HQ: 'headquarters',
});
export const PRESENCE_PALETTE = Object.freeze({
    GERMAN: { body: '#718996', accent: '#bdcbd0' },
    SOVIET: { body: '#956a5f', accent: '#d1a393' },
});
export const PRESENCE_LOD = Object.freeze({ far: { scale: .64, opacity: 0 }, medium: { scale: .78, opacity: .92 }, close: { scale: 1, opacity: 1 } });
/** Two screen pixels of hysteresis prevent detail flicker during a slow pinch.
 * Thresholds still come from the existing LOD selector; Camera/terrain are untouched. */
export function selectPresenceLod(width, previous) {
    const next = selectTerrainLod(width);
    if (!previous || next === previous)
        return next;
    const order = { far: 0, medium: 1, close: 2 };
    return selectTerrainLod(width + (order[next] > order[previous] ? -2 : 2)) === next ? next : previous;
}

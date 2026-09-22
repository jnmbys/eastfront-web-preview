import type { HexEdge, HexState } from '../core/types.js';
export interface LegacyMapData {
    rows: number;
    cols: number;
    terrain: Record<string, string>;
    roads: Array<[[number, number], [number, number]]>;
    rails: Array<[[number, number], [number, number]]>;
    rivers: Array<{
        a: [number, number];
        b: [number, number];
        kind: 'small' | 'main';
    }>;
}
/**
 * Converts the current Python/map-generator JSON into the new single-edge registry.
 * Current legacy maps imply a bridge whenever road/rail and river share an edge.
 * That inference is isolated here so the future scenario format can store bridges explicitly.
 */
export declare function importLegacyMap(raw: LegacyMapData): {
    hexes: HexState[];
    edges: HexEdge[];
};

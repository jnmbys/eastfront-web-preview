import type { HexCoord, HexEdge } from './types.js';
export declare function canonicalEdgeKey(a: HexCoord, b: HexCoord): string;
export declare function makeEdge(a: HexCoord, b: HexCoord, partial?: Omit<Partial<HexEdge>, 'key' | 'a' | 'b'>): HexEdge;
export declare function getEdge(edges: Record<string, HexEdge>, a: HexCoord, b: HexCoord): HexEdge | undefined;

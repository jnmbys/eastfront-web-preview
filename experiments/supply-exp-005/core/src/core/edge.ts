import { hexKey, sameHex } from './hex.js';
import type { HexCoord, HexEdge } from './types.js';

export function canonicalEdgeKey(a: HexCoord, b: HexCoord): string {
  const ak = hexKey(a);
  const bk = hexKey(b);
  return ak < bk ? `${ak}|${bk}` : `${bk}|${ak}`;
}

export function makeEdge(a: HexCoord, b: HexCoord, partial: Omit<Partial<HexEdge>, 'key' | 'a' | 'b'> = {}): HexEdge {
  if (sameHex(a, b)) throw new Error('A HexEdge requires two distinct hexes.');
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

export function getEdge(edges: Record<string, HexEdge>, a: HexCoord, b: HexCoord): HexEdge | undefined {
  return edges[canonicalEdgeKey(a, b)];
}

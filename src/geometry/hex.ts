export type HexCoord = Readonly<{ q: number; r: number }>;
export type Point = Readonly<{ x: number; y: number }>;
export type HexEdge = readonly [Point, Point];

export const HEX_SIZE = 42;
export const SQRT3 = Math.sqrt(3);
export const EPSILON = 1e-7;

export function hexKey(hex: HexCoord): string {
  return `${hex.q},${hex.r}`;
}

export function hexEqual(a: HexCoord, b: HexCoord): boolean {
  return a.q === b.q && a.r === b.r;
}

export function hexToPixel(hex: HexCoord, size = HEX_SIZE): Point {
  return {
    x: size * SQRT3 * (hex.q + hex.r / 2),
    y: size * 1.5 * hex.r,
  };
}

export function hexPolygon(hex: HexCoord, size = HEX_SIZE): Point[] {
  const center = hexToPixel(hex, size);
  return Array.from({ length: 6 }, (_, i) => {
    const angle = ((60 * i) + 30) * Math.PI / 180;
    return {
      x: center.x + size * Math.cos(angle),
      y: center.y + size * Math.sin(angle),
    };
  });
}

export const AXIAL_DIRECTIONS: readonly HexCoord[] = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
];

export function hexNeighbors(hex: HexCoord): HexCoord[] {
  return AXIAL_DIRECTIONS.map((d) => ({ q: hex.q + d.q, r: hex.r + d.r }));
}

export function hexDistance(a: HexCoord, b: HexCoord): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}

function pointNear(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) < EPSILON;
}

export function sharedHexEdge(a: HexCoord, b: HexCoord, size = HEX_SIZE): HexEdge | null {
  if (hexDistance(a, b) !== 1) return null;
  const ap = hexPolygon(a, size);
  const bp = hexPolygon(b, size);
  const shared = ap.filter((pointA) => bp.some((pointB) => pointNear(pointA, pointB)));
  if (shared.length !== 2) {
    throw new Error(`Adjacent hexes ${hexKey(a)} and ${hexKey(b)} did not resolve one shared edge.`);
  }
  return [shared[0]!, shared[1]!];
}

export function midpoint(edge: HexEdge): Point {
  return { x: (edge[0].x + edge[1].x) / 2, y: (edge[0].y + edge[1].y) / 2 };
}

export function offsetToAxial(col: number, row: number): HexCoord {
  // odd-r horizontal layout converted into canonical axial coordinates.
  return { q: col - ((row - (row & 1)) / 2), r: row };
}

export function axialToOffset(hex: HexCoord): { col: number; row: number } {
  return { col: hex.q + ((hex.r - (hex.r & 1)) / 2), row: hex.r };
}

export function pointString(point: Point, decimals = 3): string {
  return `${point.x.toFixed(decimals)},${point.y.toFixed(decimals)}`;
}

export function polygonPointsString(hex: HexCoord, size = HEX_SIZE, decimals = 3): string {
  return hexPolygon(hex, size).map((p) => pointString(p, decimals)).join(' ');
}

function axialToCube(hex: HexCoord): { x: number; y: number; z: number } {
  return { x: hex.q, z: hex.r, y: -hex.q - hex.r };
}

function cubeRound(x: number, y: number, z: number): HexCoord {
  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);
  const xDiff = Math.abs(rx - x);
  const yDiff = Math.abs(ry - y);
  const zDiff = Math.abs(rz - z);
  if (xDiff > yDiff && xDiff > zDiff) rx = -ry - rz;
  else if (yDiff > zDiff) ry = -rx - rz;
  else rz = -rx - ry;
  void ry;
  return { q: rx, r: rz };
}

export function hexLine(a: HexCoord, b: HexCoord): HexCoord[] {
  const n = hexDistance(a, b);
  if (n === 0) return [a];
  const ac = axialToCube(a);
  const bc = axialToCube(b);
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    return cubeRound(
      ac.x + (bc.x - ac.x) * t,
      ac.y + (bc.y - ac.y) * t,
      ac.z + (bc.z - ac.z) * t,
    );
  });
}

export function assertAdjacentPath(path: readonly HexCoord[]): void {
  for (let i = 1; i < path.length; i += 1) {
    if (hexDistance(path[i - 1]!, path[i]!) !== 1) {
      throw new Error(`Path segment ${i - 1}→${i} is not adjacent.`);
    }
  }
}

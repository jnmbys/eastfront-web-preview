import type { TerrainType } from '../core-adapter/core.js';
import { HEX_SIZE, SQRT3, hexPolygon, hexToPixel, hexNeighbors, sharedHexEdge, type Point } from '../geometry/hex.js';
import type { BrowserRenderModel } from './coreModel.js';

export const VS2_WORLD_H = HEX_SIZE * SQRT3;
export const VS2_REGIONS = ['plain', 'forest', 'hill', 'rough', 'marsh', 'city', 'lake'] as const;
export type VS2Region = typeof VS2_REGIONS[number];
export interface VS2RegionSample { readonly weights: readonly number[]; readonly coverage: number; }
export interface VS2RegionField { sample(x: number, y: number): VS2RegionSample; readonly boundaryCount: number; }
type Cell = { region: number; polygon: readonly Point[] };
type Boundary = { a: Point; b: Point; left: number; right: number };
const key = (x: number, y: number) => `${x},${y}`;
const smooth = (t: number) => { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c); };
export function vs2Region(terrain: TerrainType): VS2Region {
  switch (terrain) {
    case 'PLAIN': return 'plain'; case 'FOREST': return 'forest';
    case 'HILL': return 'hill'; case 'ROUGH': return 'rough';
    case 'MARSH': return 'marsh'; case 'LAKE': return 'lake';
    case 'CITY': case 'MAIN_CITY': case 'OUTER_CITY': return 'city';
  }
}
function contains(polygon: readonly Point[], x: number, y: number): boolean {
  let positive = false, negative = false;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!, b = polygon[(i + 1) % polygon.length]!;
    const cross = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
    positive ||= cross > 1e-7; negative ||= cross < -1e-7;
  }
  return !(positive && negative);
}
function distance(edge: Boundary, x: number, y: number): number {
  const dx = edge.b.x - edge.a.x, dy = edge.b.y - edge.a.y;
  const t = Math.max(0, Math.min(1, ((x - edge.a.x) * dx + (y - edge.a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - edge.a.x - t * dx, y - edge.a.y - t * dy);
}

/** Union boundaries omit edges shared by equal terrain. Geometry is read only. */
export function createVS2RegionField(hexes: BrowserRenderModel['hexes']): VS2RegionField {
  const feather = VS2_WORLD_H * 0.22, buckets = new Map<string, Cell[]>(), edges = new Map<string, Boundary[]>();
  const sorted = [...hexes].sort((a, b) => a.coord.q - b.coord.q || a.coord.r - b.coord.r);
  const terrain = new Map(sorted.map(h => [key(h.coord.q, h.coord.r), VS2_REGIONS.indexOf(vs2Region(h.terrain))]));
  let boundaryCount = 0;
  for (const hex of sorted) {
    const center = hexToPixel(hex.coord), region = terrain.get(key(hex.coord.q, hex.coord.r))!;
    const cell = { region, polygon: hexPolygon(hex.coord) };
    for (let by = Math.floor((center.y - HEX_SIZE) / VS2_WORLD_H); by <= Math.floor((center.y + HEX_SIZE) / VS2_WORLD_H); by++) {
      for (let bx = Math.floor((center.x - HEX_SIZE) / VS2_WORLD_H); bx <= Math.floor((center.x + HEX_SIZE) / VS2_WORLD_H); bx++) {
        const k = key(bx, by), list = buckets.get(k) ?? []; list.push(cell); buckets.set(k, list);
      }
    }
    for (const neighbor of hexNeighbors(hex.coord)) {
      const right = terrain.get(key(neighbor.q, neighbor.r)) ?? -1;
      if (right === region || (right !== -1 && (hex.coord.q > neighbor.q || (hex.coord.q === neighbor.q && hex.coord.r > neighbor.r)))) continue;
      const segment = sharedHexEdge(hex.coord, neighbor)!;
      const edge = { a: segment[0], b: segment[1], left: region, right }; boundaryCount++;
      for (let by = Math.floor((Math.min(edge.a.y, edge.b.y) - feather) / VS2_WORLD_H); by <= Math.floor((Math.max(edge.a.y, edge.b.y) + feather) / VS2_WORLD_H); by++) {
        for (let bx = Math.floor((Math.min(edge.a.x, edge.b.x) - feather) / VS2_WORLD_H); bx <= Math.floor((Math.max(edge.a.x, edge.b.x) + feather) / VS2_WORLD_H); bx++) {
          const k = key(bx, by), list = edges.get(k) ?? []; list.push(edge); edges.set(k, list);
        }
      }
    }
  }
  return {
    boundaryCount,
    sample(x, y) {
      const k = key(Math.floor(x / VS2_WORLD_H), Math.floor(y / VS2_WORLD_H));
      const owner = (buckets.get(k) ?? []).find(cell => contains(cell.polygon, x, y))?.region ?? -1;
      const weights: number[] = VS2_REGIONS.map((_, i) => i === owner ? 1 : 0);
      let coverage = owner < 0 ? 0 : 1;
      for (const edge of edges.get(k) ?? []) {
        const d = distance(edge, x, y); if (d >= feather) continue;
        const outside = 1 - smooth((d + feather) / (2 * feather));
        for (const region of [edge.left, edge.right]) {
          if (region < 0) continue;
          weights[region] = region === owner ? Math.min(weights[region]!, 1 - outside) : Math.max(weights[region]!, outside);
        }
        if (edge.right < 0) coverage = owner < 0 ? Math.max(coverage, outside) : Math.min(coverage, 1 - outside);
      }
      const total = weights.reduce((a, b) => a + b, 0);
      return { weights: total ? weights.map(w => w / total) : weights, coverage };
    },
  };
}

/** Stateless, layer-separated visual hashing. Never consumes gameplay RNG. */
export function vs2VisualValue(seed: number, layer: string, x: number, y: number): number {
  const text = `${seed}|VS2|${layer}|${x}|${y}`;
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}
export function vs2WorldNoise(seed: number, layer: string, x: number, y: number, period: number): number {
  const u = x / period, v = y / period, ix = Math.floor(u), iy = Math.floor(v), fx = smooth(u - ix), fy = smooth(v - iy);
  const a = vs2VisualValue(seed, layer, ix, iy), b = vs2VisualValue(seed, layer, ix + 1, iy);
  const c = vs2VisualValue(seed, layer, ix, iy + 1), d = vs2VisualValue(seed, layer, ix + 1, iy + 1);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}

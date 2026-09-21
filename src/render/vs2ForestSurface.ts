import { reportTerrainLoad } from './terrainLoadProgress.js';
import type { VS2TerrainProjection } from './vs2Projection.js';
import { vs2SegmentDistance } from './vs2Projection.js';
import { VS2_WORLD_H, vs2VisualValue } from './vs2WorldField.js';
import { vs2AssetCatalog, type VS2AssetCatalog } from './vs2Assets.js';
import { loadTerrainImage, terrainSurfaceCapabilities } from './terrainSurface.js';
import type { TerrainLod } from './terrainAssets.js';

export function planVS2Forest(projection: VS2TerrainProjection, seed: number, assets: VS2AssetCatalog = vs2AssetCatalog) {
  const entries = assets.byFamily('forest').filter(e => e.semanticRole === 'canopyStamp' && e.LOD.includes('far') && e.LOD.includes('medium') && e.LOD.includes('close'));
  const step = VS2_WORLD_H * 0.8, bounds = projection.viewBox, result: { id: string; assetId: string; x: number; y: number; width: number; height: number }[] = [];
  if (!entries.length) return result;
  for (let iy = Math.floor(bounds.minY / step); iy <= Math.ceil((bounds.minY + bounds.height) / step); iy++) {
    for (let ix = Math.floor(bounds.minX / step); ix <= Math.ceil((bounds.minX + bounds.width) / step); ix++) {
      const random = (purpose: string) => vs2VisualValue(seed, `forest:${purpose}`, ix, iy);
      const x = (ix + 0.5 + (random('x') - 0.5) * 0.45) * step, y = (iy + 0.5 + (random('y') - 0.5) * 0.45) * step;
      if (projection.field.sample(x, y).weights[1]! < 0.15) continue;
      const entry = entries[Math.floor(random('asset') * entries.length)]!;
      const width = VS2_WORLD_H * (1.5 + random('scale') * 0.35);
      result.push({ id: `forest:${ix},${iy}`, assetId: entry.id, x, y, width, height: width * entry.sourceSize[1]! / entry.sourceSize[0]! });
    }
  }
  return result;
}

/** Union coverage once after canopy composition; no per-Hex clip or local mass. */
export function createVS2ForestCoverage(projection: VS2TerrainProjection) {
  const buckets = new Map<string, typeof projection.corridors>();
  for (const edge of projection.corridors) {
    const padding = edge.radius + 3;
    for (let y = Math.floor((Math.min(edge.a.y, edge.b.y) - padding) / VS2_WORLD_H); y <= Math.floor((Math.max(edge.a.y, edge.b.y) + padding) / VS2_WORLD_H); y++) {
      for (let x = Math.floor((Math.min(edge.a.x, edge.b.x) - padding) / VS2_WORLD_H); x <= Math.floor((Math.max(edge.a.x, edge.b.x) + padding) / VS2_WORLD_H); x++) {
        const key = `${x},${y}`, list = buckets.get(key) ?? []; list.push(edge); buckets.set(key, list);
      }
    }
  }
  return (x: number, y: number) => {
    let coverage = projection.field.sample(x, y).weights[1]!;
    if (!coverage) return 0;
    for (const edge of buckets.get(`${Math.floor(x / VS2_WORLD_H)},${Math.floor(y / VS2_WORLD_H)}`) ?? []) {
      coverage *= Math.max(0, Math.min(1, (vs2SegmentDistance({ x, y }, edge.a, edge.b) - edge.radius - 1) / 2));
    }
    return coverage;
  };
}
export async function paintVS2Forest(ctx: CanvasRenderingContext2D, projection: VS2TerrainProjection, seed: number, lod: TerrainLod, assets: VS2AssetCatalog = vs2AssetCatalog) {
  const plan = planVS2Forest(projection, seed, assets);
  if (!plan.length) return { imageDraws: 0, uniqueAssets: 0 };
  const bounds = projection.rasterBounds, pixel = projection.pixelSize, layer = document.createElement('canvas');
  layer.width = bounds.width / pixel; layer.height = bounds.height / pixel;
  const target = layer.getContext('2d', { willReadFrequently: true });
  if (!target) throw new Error('VS2 canopy Canvas 2D unavailable');
  const ids = [...new Set(plan.map(p => p.assetId))].sort(), capabilities = terrainSurfaceCapabilities();
  reportTerrainLoad({ kind: 'assets', total: ids.length });
  try {
    for (const id of ids) {
      const entry = assets.byId(id)!;
      if (!entry.LOD.includes(lod) || !entry.rotationAllowed.degrees?.includes(0)) throw new Error(`VS2 canopy transform/LOD mismatch: ${id}`);
      const image = await loadTerrainImage({ id, family: entry.family, file: entry.file, sourceSize: [entry.sourceSize[0]!, entry.sourceSize[1]!] }, 'p5', capabilities, new URL(assets.url(entry), document.baseURI).href);
      try {
        for (const p of plan.filter(p => p.assetId === id)) target.drawImage(image.source, (p.x - p.width * entry.anchor[0]! - bounds.minX) / pixel, (p.y - p.height * entry.anchor[1]! - bounds.minY) / pixel, p.width / pixel, p.height / pixel);
      } finally { image.release?.(); }
    }
    reportTerrainLoad({ kind: 'building' });
    const image = target.getImageData(0, 0, layer.width, layer.height), coverage = createVS2ForestCoverage(projection);
    for (let y = 0; y < layer.height; y++) for (let x = 0; x < layer.width; x++) {
      const i = (y * layer.width + x) * 4 + 3;
      if (image.data[i]) {
        image.data[i] = image.data[i]! * coverage(bounds.minX + (x + 0.5) * pixel, bounds.minY + (y + 0.5) * pixel);
        // Broad woodland warmth varies through the continuous crown layer, not per Hex.
        const wx = bounds.minX + (x + 0.5) * pixel, wy = bounds.minY + (y + 0.5) * pixel;
        const warmth = 0.5 + Math.sin(wx / 125 + Math.sin(wy / 165)) * 0.5;
        image.data[i - 3] = (image.data[i - 3]! - 105) * 1.08 + 105;
        image.data[i - 3] = image.data[i - 3]! * (0.80 + warmth * 0.18);
        image.data[i - 2] = (image.data[i - 2]! - 95) * 1.08 + 108;
        image.data[i - 1] = image.data[i - 1]! * (0.78 + warmth * 0.08);
      }
    }
    target.putImageData(image, 0, 0);
    ctx.drawImage(layer, bounds.minX, bounds.minY, bounds.width, bounds.height);
  } finally { layer.width = 0; layer.height = 0; }
  return { imageDraws: plan.length + 1, uniqueAssets: ids.length };
}

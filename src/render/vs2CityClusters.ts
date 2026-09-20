import { VS2_WORLD_H, vs2VisualValue } from './vs2WorldField.js';
import { vs2SegmentDistance, type VS2TerrainProjection } from './vs2Projection.js';
import { vs2AssetCatalog, type VS2AssetCatalog } from './vs2Assets.js';
import type { TerrainLod } from './terrainAssets.js';

export interface VS2CityPlacement {
  readonly id: string; readonly assetId: string;
  readonly x: number; readonly y: number; readonly width: number; readonly height: number;
  readonly radius: number; readonly opacity: number; readonly rotation: 0; readonly mirror: false;
}
/** World-lattice candidates span the city union. Reject whole footprints: no roof clipping. */
export function planVS2CityClusters(projection: VS2TerrainProjection, seed: number, lod: TerrainLod = 'medium', assets: VS2AssetCatalog = vs2AssetCatalog): readonly VS2CityPlacement[] {
  const entries = assets.byFamily('city').filter(e => (e.semanticRole === 'buildingStamp' || e.semanticRole === 'localDecoration') && e.LOD.includes(lod) && e.rotationAllowed.degrees?.includes(0));
  if (!entries.length) return [];
  const step = VS2_WORLD_H * 0.10, candidates = new Set<string>();
  for (const city of projection.cityCells) {
    const xs = city.polygon.map(p => p.x), ys = city.polygon.map(p => p.y);
    for (let iy = Math.floor(Math.min(...ys) / step); iy <= Math.ceil(Math.max(...ys) / step); iy++) {
      for (let ix = Math.floor(Math.min(...xs) / step); ix <= Math.ceil(Math.max(...xs) / step); ix++) candidates.add(`${ix},${iy}`);
    }
  }
  const centers = projection.cityCells.map(c => ({ x: c.polygon.reduce((s, p) => s + p.x, 0) / 6, y: c.polygon.reduce((s, p) => s + p.y, 0) / 6 }));
  const centrality = (p: number[]) => Math.min(...centers.map(c => Math.hypot((p[0]! + 0.5) * step - c.x, (p[1]! + 0.5) * step - c.y)));
  const positions = [...candidates].map(k => k.split(',').map(Number) as [number, number]).sort((a, b) => centrality(a) - centrality(b) || a[1] - b[1] || a[0] - b[0]);
  const placed: VS2CityPlacement[] = [];
  for (const [ix, iy] of positions) {
    const random = (purpose: string) => vs2VisualValue(seed, `city:${purpose}`, ix, iy);
    const buildings = entries.filter(e => e.semanticRole === 'buildingStamp');
    const preferred = Math.floor(random('asset') * buildings.length);
    const ordered = [...(buildings.length ? [buildings[preferred]!, ...buildings] : []), ...entries.filter(e => e.semanticRole === 'localDecoration').sort((a, b) => vs2VisualValue(seed, a.id, ix, iy) - vs2VisualValue(seed, b.id, ix, iy))];
    const x = (ix + 0.5 + (random('x') - 0.5) * 0.45) * step, y = (iy + 0.5 + (random('y') - 0.5) * 0.45) * step;
    for (const entry of ordered) {
      const range = entry.recommendedWorldScale.width;
      const width = (range[0]! + (range[1]! - range[0]!) * (entry.semanticRole === 'localDecoration' ? 0.22 + random('scale') * 0.22 : random('scale') * 0.15)) * VS2_WORLD_H;
      const height = width * entry.sourceSize[1]! / entry.sourceSize[0]!;
      const radius = Math.hypot(width, height) / 2;
      if (!projection.canPlaceCity({ x, y }, width, height)) continue;
      if (placed.some(p => Math.abs(p.x - x) < (p.width + width) / 2 + 1 && Math.abs(p.y - y) < (p.height + height) / 2 + 1)) continue;
      placed.push({ id: `city:${ix},${iy}`, assetId: entry.id, x, y, width, height, radius,
        opacity: entry.opacityRange[1]!, rotation: 0, mirror: false });
      break;
    }
  }
  return placed;
}

export interface VS2UrbanBlock {
  readonly x: number; readonly y: number;
  /** Axis-aligned extent of the rotated roof; validation includes a 1-unit apron. */
  readonly width: number; readonly height: number;
  readonly roofWidth: number; readonly roofHeight: number; readonly angle: number;
  readonly density: number; readonly warm: boolean; readonly industrial: boolean; readonly landmark: boolean;
}

/** Group touching canonical city cells into one settlement: never reset density per Hex. */
function cityDistricts(p: VS2TerrainProjection) {
  const centers = p.cityCells.map(c => ({ x: c.polygon.reduce((s, v) => s + v.x, 0) / 6, y: c.polygon.reduce((s, v) => s + v.y, 0) / 6 }));
  const unseen = new Set(centers), districts: { x: number; y: number; radius: number }[] = [];
  for (const start of centers) {
    if (!unseen.delete(start)) continue;
    const group = [start];
    for (let i = 0; i < group.length; i++) for (const c of unseen) {
      if (Math.hypot(c.x - group[i]!.x, c.y - group[i]!.y) < VS2_WORLD_H * 1.05) { unseen.delete(c); group.push(c); }
    }
    const x = group.reduce((s, c) => s + c.x, 0) / group.length, y = group.reduce((s, c) => s + c.y, 0) / group.length;
    districts.push({ x, y, radius: VS2_WORLD_H * 0.62 + Math.max(...group.map(c => Math.hypot(c.x - x, c.y - y))) });
  }
  return districts;
}

/** Same city footprint and canonical corridor rejection as F. Density and roof orientation
 * follow district centers and existing transport, using only stateless presentation hashes. */
export function planVS2CityBlocks(projection: VS2TerrainProjection, seed: number): VS2UrbanBlock[] {
  const step = 7, seen = new Set<string>(), blocks: VS2UrbanBlock[] = [], districts = cityDistricts(projection);
  const transport = projection.corridors.filter(c => c.kind === 'road' || c.kind === 'rail');
  for (const c of projection.cityCells) {
    const xs = c.polygon.map(p => p.x), ys = c.polygon.map(p => p.y);
    for (let iy = Math.floor(Math.min(...ys) / step); iy <= Math.ceil(Math.max(...ys) / step); iy++) {
      for (let ix = Math.floor(Math.min(...xs) / step); ix <= Math.ceil(Math.max(...xs) / step); ix++) {
        const key = `${ix},${iy}`; if (seen.has(key)) continue; seen.add(key);
        const random = (tag: string) => vs2VisualValue(seed, `F1-urban:${tag}`, ix, iy), r = random('density');
        const x = (ix + 0.5) * step + (random('x') - 0.5) * 2, y = (iy + 0.5) * step + (random('y') - 0.5) * 2;
        const density = Math.max(...districts.map(d => Math.max(0, 1 - Math.hypot(x - d.x, y - d.y) / d.radius)));
        if (r < 0.06 + (1 - density) * 0.22) continue;
        const nearest = transport.reduce<typeof transport[number] | undefined>((best, e) => !best || vs2SegmentDistance({ x, y }, e.a, e.b) < vs2SegmentDistance({ x, y }, best.a, best.b) ? e : best, undefined);
        const industrial = nearest?.kind === 'rail' && random('industry') > 0.80;
        const angle = (nearest ? Math.atan2(nearest.b.y - nearest.a.y, nearest.b.x - nearest.a.x) : 0) + (random('angle') - 0.5) * 0.12;
        let roofWidth = (industrial ? 6.5 : 5.0) + density * 2.8 + random('size') * 1.3;
        let roofHeight = (industrial ? 3.8 : 3.2) + density * 1.2;
        let width = Math.abs(Math.cos(angle)) * roofWidth + Math.abs(Math.sin(angle)) * roofHeight;
        let height = Math.abs(Math.sin(angle)) * roofWidth + Math.abs(Math.cos(angle)) * roofHeight;
        if (!projection.canPlaceCity({ x, y }, width + 2, height + 2) && density < 0.6) {
          roofWidth *= 0.78; roofHeight *= 0.78; width *= 0.78; height *= 0.78;
        }
        if (!projection.canPlaceCity({ x, y }, width + 2, height + 2)) continue;
        blocks.push({ x, y, width, height, roofWidth, roofHeight, angle, density, warm: random('roof') > 0.37, industrial: Boolean(industrial), landmark: false });
      }
    }
  }
  // Give the larger inner blocks priority over small perimeter candidates.
  const packed: VS2UrbanBlock[] = [];
  for (const b of blocks.sort((a, b) => b.density - a.density || a.y - b.y || a.x - b.x)) {
    if (!packed.some(p => Math.abs(p.x - b.x) < (p.width + b.width) / 2 + 1 && Math.abs(p.y - b.y) < (p.height + b.height) / 2 + 1)) packed.push(b);
  }
  blocks.splice(0, blocks.length, ...packed);
  // Consolidate a few existing core roofs into one readable civic mass. No extra
  // buildings: expanded silhouettes replace overlapping local roofs, within the
  // same city union and original transport clearances. Every city retains coverage.
  const cellCenters = projection.cityCells.map(c => ({ x: c.polygon.reduce((s, v) => s + v.x, 0) / 6, y: c.polygon.reduce((s, v) => s + v.y, 0) / 6 }));
  for (const d of districts) {
    const local = blocks.filter(b => Math.hypot(b.x - d.x, b.y - d.y) < d.radius)
      .sort((a, b) => b.density - a.density || a.y - b.y || a.x - b.x);
    let consolidated = false;
    coreSearch: for (const [scaleWidth, scaleHeight] of [[2.1, 2.35], [1.65, 1.85]] as const) {
      for (const focus of local) {
        if (focus.density < 0.38) continue;
        const roofWidth = focus.roofWidth * scaleWidth, roofHeight = focus.roofHeight * scaleHeight;
        const width = Math.abs(Math.cos(focus.angle)) * roofWidth + Math.abs(Math.sin(focus.angle)) * roofHeight;
        const height = Math.abs(Math.sin(focus.angle)) * roofWidth + Math.abs(Math.cos(focus.angle)) * roofHeight;
        if (!projection.canPlaceCity(focus, width + 2, height + 2)) continue;
        const conflicts = blocks.filter(b => b !== focus && Math.abs(b.x - focus.x) < (b.width + width) / 2 + 1 && Math.abs(b.y - focus.y) < (b.height + height) / 2 + 1);
        if (conflicts.length > 3 || conflicts.some(b => b.landmark)) continue;
        const remaining = blocks.filter(b => !conflicts.includes(b));
        if (cellCenters.some(c => remaining.filter(b => Math.hypot(b.x - c.x, b.y - c.y) < 35).length < 5)) continue;
        remaining[remaining.indexOf(focus)] = { ...focus, width, height, roofWidth, roofHeight, landmark: true };
        blocks.splice(0, blocks.length, ...remaining); consolidated = true; break coreSearch;
      }
    }
    if (!consolidated && local[0]) blocks[blocks.indexOf(local[0])] = { ...local[0], landmark: true };
  }
  return blocks.sort((a, b) => a.y - b.y || a.x - b.x);
}

/** Local paved courts tie existing dense blocks into a legible core. These are
 * decorative yards, never canonical road edges. Reject their complete stroke bounds. */
export function planVS2CityCourts(p: VS2TerrainProjection, blocks: readonly VS2UrbanBlock[]) {
  const courts: { a: VS2UrbanBlock; b: VS2UrbanBlock; width: number }[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const a = blocks[i]!; if (a.density < 0.3) continue;
    for (const b of blocks.slice(i + 1)) {
      if (b.density < 0.3 || Math.hypot(a.x - b.x, a.y - b.y) > 18) continue;
      const width = 5 + Math.min(a.density, b.density) * 4;
      const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (p.canPlaceCity(center, Math.abs(a.x - b.x) + width + 2, Math.abs(a.y - b.y) + width + 2)) courts.push({ a, b, width });
    }
  }
  return courts;
}
export function paintVS2CityCourts(ctx: CanvasRenderingContext2D, courts: ReturnType<typeof planVS2CityCourts>) {
  ctx.save();
  try {
    ctx.lineCap = 'round';
    for (const { a, b, width } of courts) {
      ctx.globalAlpha = 0.56; ctx.strokeStyle = '#666149'; ctx.lineWidth = width + 1.2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.globalAlpha = 0.7; ctx.strokeStyle = '#b1a07c'; ctx.lineWidth = width * 0.52; ctx.stroke();
    }
  } finally { ctx.restore(); }
}

export function paintVS2CityMassing(ctx: CanvasRenderingContext2D, blocks: readonly VS2UrbanBlock[]) {
  ctx.save();
  try {
    for (const b of blocks) {
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.angle);
      const w = b.roofWidth, h = b.roofHeight, x = -w / 2, y = -h / 2;
      // Apron follows the street-facing roof instead of stamping a square underneath.
      ctx.globalAlpha = 0.65; ctx.fillStyle = '#c5ab7d'; ctx.fillRect(x - 0.7, y - 0.7, w + 1.4, h + 1.4);
      ctx.globalAlpha = 0.88; ctx.fillStyle = '#393e34'; ctx.fillRect(x + 0.5, y + 0.5, w, h);
      ctx.globalAlpha = 1; ctx.fillStyle = b.density > 0.45 ? '#eee0bb' : '#ded1ae'; ctx.fillRect(x, y + h * 0.35, w, h * 0.65);
      const upper = b.landmark ? '#eed6a3' : b.industrial ? '#bec3b8' : b.warm ? '#c69369' : '#a4b3a7';
      const lower = b.landmark ? '#68503a' : b.industrial ? '#465956' : b.warm ? '#67452f' : '#344e4b';
      ctx.fillStyle = upper; ctx.beginPath(); ctx.moveTo(x, y + h * 0.48); ctx.lineTo(x + w * 0.15, y); ctx.lineTo(x + w * 0.85, y); ctx.lineTo(x + w, y + h * 0.48); ctx.closePath(); ctx.fill();
      ctx.fillStyle = lower; ctx.beginPath(); ctx.moveTo(x, y + h * 0.48); ctx.lineTo(x + w, y + h * 0.48); ctx.lineTo(x + w * 0.85, y + h * 0.87); ctx.lineTo(x + w * 0.15, y + h * 0.87); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e6d2a9'; ctx.fillRect(x + w * 0.17, y + h * 0.45, w * 0.66, 0.28);
      if (b.industrial) { ctx.fillStyle = '#76604a'; ctx.fillRect(x + w * 0.68, y + h * 0.08, 0.85, h * 0.55); }
      if (b.landmark) { ctx.fillStyle = '#354f49'; ctx.beginPath(); ctx.moveTo(-w * 0.16, h * 0.12); ctx.lineTo(-w * 0.16, -h * 0.23); ctx.lineTo(0, -h * 0.48); ctx.lineTo(w * 0.16, -h * 0.23); ctx.lineTo(w * 0.16, h * 0.12); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#f0ddb0'; ctx.fillRect(-w * 0.1, -h * 0.04, w * 0.2, h * 0.28); }
      ctx.restore();
    }
  } finally { ctx.restore(); }
}

import { vs2AssetCatalog, type VS2AssetEntry } from './vs2Assets.js';
import { VS2_WORLD_H, vs2VisualValue, vs2WorldNoise, type VS2RegionField } from './vs2WorldField.js';
import type { ViewBoxSpec } from './coreSvg.js';

export interface VS2Texture { readonly width: number; readonly height: number; readonly data: Uint8ClampedArray; }
export interface VS2WorldRaster { readonly width: number; readonly height: number; readonly data: Uint8ClampedArray; }
export const VS2_WORLD_MATERIAL_IDS = [
  'VS2_GROUND_GRASS', 'VS2_GROUND_DRY_SOIL', 'VS2_GROUND_MOIST_SOIL',
  'VS2_RELIEF_SLOPE_MATERIAL', 'VS2_ROUGH_BROKEN_SOIL',
  'VS2_MARSH_WET_GROUND', 'VS2_CITY_SETTLEMENT_GROUND',
  'VS2_GROUND_MACRO_VALUE', 'VS2_RELIEF_GENTLE_SHADE',
] as const;
interface Sampler { texture: VS2Texture; periodX: number; periodY: number; offsetX: number; offsetY: number; }
function sampler(entry: VS2AssetEntry, texture: VS2Texture, seed: number): Sampler {
  if (!entry.tileableX || !entry.tileableY || !entry.rotationAllowed.degrees?.includes(0)) throw new Error(`VS2 material is not world-repeat eligible: ${entry.id}`);
  const range = entry.recommendedWorldScale.width;
  const periodX = (range[0]! + range[1]!) * 0.5 * VS2_WORLD_H;
  return { texture, periodX, periodY: periodX * texture.height / texture.width,
    offsetX: vs2VisualValue(seed, `${entry.id}:uv-x`, 0, 0) * periodX,
    offsetY: vs2VisualValue(seed, `${entry.id}:uv-y`, 0, 0) * periodX };
}
const mod = (x: number, size: number) => ((x % size) + size) % size;
// Bilinear repeat in world coordinates; no reset at Hex or viewport boundaries.
function channel(s: Sampler, x: number, y: number, c: number): number {
  const { texture: t } = s;
  const u = (x + s.offsetX) / s.periodX * t.width - 0.5, v = (y + s.offsetY) / s.periodY * t.height - 0.5;
  const ix = Math.floor(u), iy = Math.floor(v), fx = u - ix, fy = v - iy;
  const x0 = mod(ix, t.width), x1 = mod(ix + 1, t.width), y0 = mod(iy, t.height), y1 = mod(iy + 1, t.height);
  const a = t.data[(y0 * t.width + x0) * 4 + c]!, b = t.data[(y0 * t.width + x1) * 4 + c]!;
  const d = t.data[(y1 * t.width + x0) * 4 + c]!, e = t.data[(y1 * t.width + x1) * 4 + c]!;
  return (a + (b - a) * fx) * (1 - fy) + (d + (e - d) * fx) * fy;
}
function luminance(s: Sampler, x: number, y: number): number {
  // Data masks use linear luminance, never the opaque alpha channel.
  return (0.2126 * channel(s, x, y, 0) + 0.7152 * channel(s, x, y, 1) + 0.0722 * channel(s, x, y, 2)) / 255;
}

/** Pure CPU prototype. Fixed world resolution is independent of zoom and camera. */
export function rasterizeVS2WorldSurface(
  field: VS2RegionField, textures: ReadonlyMap<string, VS2Texture>, seed: number,
  bounds: ViewBoxSpec, pixelSize = 2,
): VS2WorldRaster {
  if (!Number.isFinite(pixelSize) || pixelSize <= 0 || !Number.isFinite(bounds.width) || !Number.isFinite(bounds.height) || bounds.width <= 0 || bounds.height <= 0) throw new Error('Invalid VS2 raster bounds/resolution');
  const samples = VS2_WORLD_MATERIAL_IDS.map(id => {
    const entry = vs2AssetCatalog.byId(id), texture = textures.get(id);
    if (!entry || !texture || texture.width <= 0 || texture.height <= 0 || texture.data.length !== texture.width * texture.height * 4) throw new Error(`Missing or invalid VS2 texture: ${id}`);
    return sampler(entry, texture, seed);
  });
  const width = Math.ceil(bounds.width / pixelSize), height = Math.ceil(bounds.height / pixelSize), data = new Uint8ClampedArray(width * height * 4);
  const regionMaterials = [0, 2, 3, 4, 5, 6];
  const lake = [105, 143, 149], background = [187, 179, 147];
  for (let row = 0; row < height; row++) {
    const y = bounds.minY + (row + 0.5) * pixelSize;
    for (let col = 0; col < width; col++) {
      const x = bounds.minX + (col + 0.5) * pixelSize, index = (row * width + col) * 4;
      const { weights, coverage } = field.sample(x, y);
      const dry = vs2WorldNoise(seed, 'dryness', x, y, VS2_WORLD_H * 4) * 0.48;
      const macro = 1 + (luminance(samples[7]!, x, y) - 0.5) * 0.16;
      const relief = 1 + (luminance(samples[8]!, x, y) - 0.5) * 0.08;
      for (let c = 0; c < 3; c++) {
        let value = weights[6]! * lake[c]!;
        for (let region = 0; region < regionMaterials.length; region++) {
          const weight = weights[region]!; if (!weight) continue;
          let material = channel(samples[regionMaterials[region]!]!, x, y, c);
          if (region === 0) material = material * (1 - dry) + channel(samples[1]!, x, y, c) * dry;
          // Ground-only woodland tone; canopy/stamp composition is a later stage.
          if (region === 1) material *= [0.68, 0.80, 0.64][c]!;
          if (region === 2 || region === 3) material *= relief;
          value += weight * material;
        }
        data[index + c] = value * macro * coverage + background[c]! * (1 - coverage);
      }
      data[index + 3] = 255;
    }
  }
  return { width, height, data };
}

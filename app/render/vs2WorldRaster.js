import { vs2AssetCatalog } from './vs2Assets.js';
import { VS2_WORLD_H, vs2VisualValue, vs2WorldNoise } from './vs2WorldField.js';
import { vs2ReliefLight, vs2MarshEnvironment } from './vs2TerrainDetail.js';
export const VS2_WORLD_MATERIAL_IDS = [
    'VS2_GROUND_GRASS', 'VS2_GROUND_DRY_SOIL', 'VS2_GROUND_MOIST_SOIL',
    'VS2_RELIEF_SLOPE_MATERIAL', 'VS2_ROUGH_BROKEN_SOIL',
    'VS2_MARSH_WET_GROUND', 'VS2_CITY_SETTLEMENT_GROUND',
    'VS2_GROUND_MACRO_VALUE', 'VS2_RELIEF_GENTLE_SHADE',
];
function sampler(entry, texture, seed) {
    if (!entry.tileableX || !entry.tileableY || !entry.rotationAllowed.degrees?.includes(0))
        throw new Error(`VS2 material is not world-repeat eligible: ${entry.id}`);
    const range = entry.recommendedWorldScale.width;
    const periodX = (range[0] + range[1]) * 0.5 * VS2_WORLD_H;
    return { texture, periodX, periodY: periodX * texture.height / texture.width,
        offsetX: vs2VisualValue(seed, `${entry.id}:uv-x`, 0, 0) * periodX,
        offsetY: vs2VisualValue(seed, `${entry.id}:uv-y`, 0, 0) * periodX };
}
const mod = (x, size) => ((x % size) + size) % size;
// Bilinear repeat in world coordinates; no reset at Hex or viewport boundaries.
function channel(s, x, y, c) {
    const { texture: t } = s;
    const u = (x + s.offsetX) / s.periodX * t.width - 0.5, v = (y + s.offsetY) / s.periodY * t.height - 0.5;
    const ix = Math.floor(u), iy = Math.floor(v), fx = u - ix, fy = v - iy;
    const x0 = mod(ix, t.width), x1 = mod(ix + 1, t.width), y0 = mod(iy, t.height), y1 = mod(iy + 1, t.height);
    const a = t.data[(y0 * t.width + x0) * 4 + c], b = t.data[(y0 * t.width + x1) * 4 + c];
    const d = t.data[(y1 * t.width + x0) * 4 + c], e = t.data[(y1 * t.width + x1) * 4 + c];
    return (a + (b - a) * fx) * (1 - fy) + (d + (e - d) * fx) * fy;
}
function luminance(s, x, y) {
    // Data masks use linear luminance, never the opaque alpha channel.
    return (0.2126 * channel(s, x, y, 0) + 0.7152 * channel(s, x, y, 1) + 0.0722 * channel(s, x, y, 2)) / 255;
}
/** Pure CPU prototype. Fixed world resolution is independent of zoom and camera. */
export function rasterizeVS2WorldSurface(field, textures, seed, bounds, pixelSize = 2) {
    if (!Number.isFinite(pixelSize) || pixelSize <= 0 || !Number.isFinite(bounds.width) || !Number.isFinite(bounds.height) || bounds.width <= 0 || bounds.height <= 0)
        throw new Error('Invalid VS2 raster bounds/resolution');
    const samples = VS2_WORLD_MATERIAL_IDS.map(id => {
        const entry = vs2AssetCatalog.byId(id), texture = textures.get(id);
        if (!entry || !texture || texture.width <= 0 || texture.height <= 0 || texture.data.length !== texture.width * texture.height * 4)
            throw new Error(`Missing or invalid VS2 texture: ${id}`);
        return sampler(entry, texture, seed);
    });
    const width = Math.ceil(bounds.width / pixelSize), height = Math.ceil(bounds.height / pixelSize), data = new Uint8ClampedArray(width * height * 4);
    const regionMaterials = [0, 2, 3, 4, 5, 6];
    const lake = [67, 123, 140], background = [187, 179, 147];
    for (let row = 0; row < height; row++) {
        const y = bounds.minY + (row + 0.5) * pixelSize;
        for (let col = 0; col < width; col++) {
            const x = bounds.minX + (col + 0.5) * pixelSize, index = (row * width + col) * 4;
            const { weights, coverage } = field.sample(x, y);
            const dry = vs2WorldNoise(seed, 'dryness', x, y, VS2_WORLD_H * 4) * 0.48;
            const macro = 1 + (luminance(samples[7], x, y) - 0.5) * 0.16;
            const relief = 1 + (luminance(samples[8], x, y) - 0.5) * 0.08;
            // Broad value groups carry terrain identity; source microtexture stays secondary.
            // Everything is sampled in world space, never in a Hex-local UV domain.
            const meadow = vs2WorldNoise(seed, 'F-meadow', x, y, VS2_WORLD_H * 1.7);
            const hillLight = weights[2] > 0 ? vs2ReliefLight(seed, x, y, false) : 0;
            const roughLight = weights[3] > 0 ? vs2ReliefLight(seed, x, y, true) : 0;
            const { water: pool, mud } = weights[4] > 0 ? vs2MarshEnvironment(seed, x, y) : { water: 0, mud: 0 };
            const marshInterior = Math.max(0, Math.min(1, (weights[4] - 0.3) / 0.65));
            const marshBlend = marshInterior * marshInterior * (3 - 2 * marshInterior);
            const palette = [
                [148 + dry * 65 + meadow * 14, 170 + meadow * 14 - dry * 17, 95 + meadow * 12],
                [90 + meadow * 25, 115 + meadow * 24, 56 + meadow * 9],
                [180 + hillLight, 154 + hillLight * 0.93, 105 + hillLight * 0.76],
                [155 + roughLight, 143 + roughLight * 0.95, 114 + roughLight * 0.85],
                [132 - pool * 54 - mud * 12, 153 - pool * 11 - mud * 18, 91 + pool * 44 - mud * 7], [177, 161, 130],
            ];
            for (let c = 0; c < 3; c++) {
                let value = weights[6] * lake[c];
                for (let region = 0; region < regionMaterials.length; region++) {
                    const weight = weights[region];
                    if (!weight)
                        continue;
                    let material = channel(samples[regionMaterials[region]], x, y, c);
                    if (region === 0)
                        material = material * (1 - dry) + channel(samples[1], x, y, c) * dry;
                    // Ground colour under the continuous canopy pass.
                    if (region === 1)
                        material *= [0.68, 0.80, 0.64][c];
                    if (region === 4) {
                        const wet = 0.14 + pool * 0.45;
                        material = material * (1 - wet) + [82, 137, 141][c] * wet;
                    }
                    if (region === 2 || region === 3)
                        material *= relief;
                    material = material * (region === 3 ? 0.36 : 0.22) + palette[region][c] * (region === 3 ? 0.64 : 0.78);
                    // Dry grassy rim -> moist sediment -> interior pools, inside the existing mask.
                    // The canonical region field and all semantic ownership remain untouched.
                    if (region === 4) {
                        const fringe = palette[0][c] * 0.55 + [145, 144, 92][c] * 0.45;
                        material = fringe * (1 - marshBlend) + material * marshBlend;
                    }
                    value += weight * material;
                }
                data[index + c] = value * macro * coverage + background[c] * (1 - coverage);
            }
            data[index + 3] = 255;
        }
    }
    return { width, height, data };
}

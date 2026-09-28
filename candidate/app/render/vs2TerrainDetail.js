import { VS2_WORLD_H, vs2WorldNoise, vs2VisualValue } from './vs2WorldField.js';
const smooth = (a, b, v) => {
    const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
};
/** Smooth value-noise derivatives give non-periodic slopes with a consistent light.
 * Derivatives are visual values only; no canonical elevation is read or written. */
function slope(seed, layer, u, v) {
    const ix = Math.floor(u), iy = Math.floor(v), x = u - ix, y = v - iy;
    const sx = x * x * (3 - 2 * x), sy = y * y * (3 - 2 * y);
    const a = vs2VisualValue(seed, layer, ix, iy), b = vs2VisualValue(seed, layer, ix + 1, iy);
    const c = vs2VisualValue(seed, layer, ix, iy + 1), d = vs2VisualValue(seed, layer, ix + 1, iy + 1);
    return { dx: ((b - a) * (1 - sy) + (d - c) * sy) * 6 * x * (1 - x),
        dy: ((c - a) * (1 - sx) + (d - b) * sx) * 6 * y * (1 - y),
        value: (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy };
}
export function vs2ReliefLight(seed, x, y, rough) {
    const broad = slope(seed, 'F3-slope', (x * 0.8 + y * 0.6) / (VS2_WORLD_H * 0.82), (-x * 0.6 + y * 0.8) / (VS2_WORLD_H * 0.82));
    const fine = slope(seed, 'F3-rock-soil', (x * 0.95 - y * 0.31) / (VS2_WORLD_H * 0.33), (x * 0.31 + y * 0.95) / (VS2_WORLD_H * 0.33));
    // Both rotated domains project the same north-west lighting vector.
    const light = -(broad.dx * 0.99 + broad.dy * 0.14) * 46
        - (fine.dx * 0.44 + fine.dy * 0.9) * (rough ? 21 : 11);
    return Math.max(-46, Math.min(46, light + (broad.value - 0.5) * 13 + (fine.value - 0.5) * (rough ? 18 : 8)));
}
/** The reed pass and ground share exactly the same world-space wetness.
 * Anisotropic fine variation breaks up pools without stamping each marsh Hex. */
export function vs2MarshEnvironment(seed, x, y) {
    const broad = vs2WorldNoise(seed, 'marsh-moisture', x, y, VS2_WORLD_H * 1.8);
    const inlets = vs2WorldNoise(seed, 'F2-marsh-inlets', x * 0.65, y * 1.35, VS2_WORLD_H * 0.43);
    const wetness = broad * 0.42 + inlets * 0.58;
    const channels = vs2WorldNoise(seed, 'F2-shallow-channels', x * 0.8, y * 1.4, VS2_WORLD_H * 0.18);
    const water = smooth(0.49, 0.70, wetness) * (0.25 + smooth(0.35, 0.76, channels) * 0.6);
    const mud = smooth(0.29, 0.48, wetness) * (1 - smooth(0.51, 0.66, wetness));
    const reeds = (1 - water) * (0.3 + inlets * 0.7);
    return { water, mud, reeds };
}

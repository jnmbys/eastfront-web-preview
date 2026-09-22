import {perf4} from '../perf004Trace.js';
import { hexToPixel, HEX_SIZE } from '../geometry/hex.js';
import { getNeighbors } from '../core-adapter/core.js';
import { SPOTTING } from '../player-view/playerView.js';
import { viewBoxForHexes } from '../render/coreSvg.js';
/** Presentation-only constants, deliberately independent from gameplay RNG. */
export const FOG_STYLE = Object.freeze({ pixelPitch: 6, maxDimension: 640, clearRadius: HEX_SIZE * 1.03, feather: 48, edgeVariation: 14, opacity: .47, transitionMs: 220 });
const hexKey = (h) => `${h.q},${h.r}`;
/** No session, enemy roster, authoritative state or animation facts are accepted. */
export function deriveFogPlan(view, selectedUnitId = null) {const __p4end=perf4.begin("fog/surface.js:deriveFogPlan");try{
    const hexes = [...view.hexes].sort((a, b) => hexKey(a.coord).localeCompare(hexKey(b.coord)));
    const map = new Map(hexes.map(h => [hexKey(h.coord), h.coord]));
    const keys = view.viewer === 'OBSERVER' ? [] : [...new Set(view.contactHexKeys)].filter(k => map.has(k)).sort();
    const selected = view.units.find(u => u.id === selectedUnitId && u.side === view.viewer && u.type === 'RECON');
    const reconKeys = new Set();
    if (selected) {
        let frontier = [selected.hex];
        for (let n = 0; n <= SPOTTING.reconContact; n++) {
            const next = frontier.flatMap(getNeighbors);
            for (const h of frontier)
                if (keys.includes(hexKey(h)))
                    reconKeys.add(hexKey(h));
            frontier = next.filter(h => !reconKeys.has(hexKey(h)));
        }
    }
    const recon = [...reconKeys].sort();
    const maskKey = JSON.stringify([view.viewer, hexes.map(h => hexKey(h.coord)), keys]);
    return { key: JSON.stringify([maskKey, recon]), maskKey, viewer: view.viewer, bounds: viewBoxForHexes(hexes), map: hexes.map(h => hexToPixel(h.coord)), visible: keys.map(k => hexToPixel(map.get(k))), recon: recon.map(k => hexToPixel(map.get(k))) };
}finally{__p4end();}}
const smooth = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
function hash(x, y) { let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ 0x51af31; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295; }
function noise(x, y, scale) { const a = x / scale, b = y / scale, ix = Math.floor(a), iy = Math.floor(b), u = smooth(a - ix), v = smooth(b - iy); return (hash(ix, iy) * (1 - u) + hash(ix + 1, iy) * u) * (1 - v) + (hash(ix, iy + 1) * (1 - u) + hash(ix + 1, iy + 1) * u) * v; }
/** Local spatial bins bound raster work; no per-Hex DOM/filter instances. */
function nearest(points) {
    const size = 128, bins = new Map();
    for (const p of points) {
        const key = `${Math.floor(p.x / size)},${Math.floor(p.y / size)}`;
        const list = bins.get(key) ?? [];
        list.push(p);
        bins.set(key, list);
    }
    return (x, y) => { let best = Infinity; const q = Math.floor(x / size), r = Math.floor(y / size); for (let a = q - 1; a <= q + 1; a++)
        for (let b = r - 1; b <= r + 1; b++)
            for (const p of bins.get(`${a},${b}`) ?? [])
                best = Math.min(best, (p.x - x) ** 2 + (p.y - y) ** 2); return Math.sqrt(best); };
}
let fogGround = null;
/** One world-sized cache, bounded independently of number of viewers/actions. */
function groundFor(plan, width, height) {const __p4end=perf4.begin("fog/surface.js:groundFor");try{
    const key = JSON.stringify([plan.bounds, width, height, plan.map]);
    if (fogGround?.key === key)
        return fogGround;
    const ground = { key, coverage: new Float64Array(width * height), broad: new Float64Array(width * height), fine: new Float64Array(width * height) };
    const board = nearest(plan.map);
    for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
            const wx = plan.bounds.minX + (x + .5) * plan.bounds.width / width, wy = plan.bounds.minY + (y + .5) * plan.bounds.height / height, i = y * width + x;
            ground.coverage[i] = 1 - smooth((board(wx, wy) - HEX_SIZE * .97) / 9);
            if (ground.coverage[i] > 0) {
                ground.broad[i] = noise(wx, wy, 156);
                ground.fine[i] = noise(wx + 29, wy - 47, 61);
            }
        }
    fogGround = ground;
    return ground;
}finally{__p4end();}}
/** One low-resolution, world-space RGBA veil. Flat neutral colour reduces saturation/contrast by alpha compositing. */
export function rasterizeFog(plan, kind = 'fog') {const __p4end=perf4.begin("fog/surface.js:rasterizeFog");try{
    const pitch = Math.max(FOG_STYLE.pixelPitch, Math.max(plan.bounds.width, plan.bounds.height) / FOG_STYLE.maxDimension);
    const width = Math.ceil(plan.bounds.width / pitch), height = Math.ceil(plan.bounds.height / pitch), rgba = new Uint8ClampedArray(width * height * 4);
    if (plan.viewer === 'OBSERVER' || (kind === 'recon' && !plan.recon.length))
        return { width, height, rgba };
    const visible = nearest(kind === 'recon' ? plan.recon : plan.visible), ground = groundFor(plan, width, height);
    for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
            const wx = plan.bounds.minX + (x + .5) * plan.bounds.width / width, wy = plan.bounds.minY + (y + .5) * plan.bounds.height / height;
            const coverage = ground.coverage[y * width + x];
            if (coverage <= 0)
                continue;
            const broad = ground.broad[y * width + x], fine = ground.fine[y * width + x], dist = visible(wx, wy);
            const amount = smooth((dist - FOG_STYLE.clearRadius + (broad - .5) * FOG_STYLE.edgeVariation + (fine - .5) * 5) / FOG_STYLE.feather);
            const i = (y * width + x) * 4;
            if (kind === 'recon') {
                rgba[i] = 193;
                rgba[i + 1] = 172;
                rgba[i + 2] = 123;
                rgba[i + 3] = Math.round(255 * coverage * .22 * 4 * amount * (1 - amount));
            }
            else {
                rgba[i] = Math.round(83 + broad * 10);
                rgba[i + 1] = Math.round(101 + broad * 9);
                rgba[i + 2] = Math.round(118 + broad * 7);
                rgba[i + 3] = Math.round(255 * coverage * amount * (FOG_STYLE.opacity + (fine - .5) * .025));
            }
        }
    return { width, height, rgba };
}finally{__p4end();}}

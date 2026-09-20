import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createVS2RegionField, VS2_WORLD_H, vs2WorldNoise } from '../dist/app/render/vs2WorldField.js';
import { rasterizeVS2WorldSurface, VS2_WORLD_MATERIAL_IDS } from '../dist/app/render/vs2WorldRaster.js';
import { createVS2TerrainSurfaceHooks } from '../dist/app/render/vs2TerrainSurface.js';
import { buildCachedTerrainSurface } from '../dist/app/render/terrainSurface.js';
import { hexToPixel, sharedHexEdge } from '../dist/app/geometry/hex.js';
import { createFreshProductionSession } from '../dist/app/web/preview.js';
import { createPresentationState } from '../dist/app/state/presentation.js';
import { deriveBrowserRenderModel } from '../dist/app/render/coreModel.js';
import { coreSvgMarkup } from '../dist/app/render/coreSvg.js';

const hex = (q, r, terrain) => ({ coord: { q, r }, terrain });
const hash = data => createHash('sha256').update(data).digest('hex');
function textures(mask = 128) {
  return new Map(VS2_WORLD_MATERIAL_IDS.map((id, i) => {
    const data = new Uint8ClampedArray(8 * 8 * 4);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const p = (y * 8 + x) * 4;
      for (let c = 0; c < 3; c++) data[p + c] = i >= 7 ? mask : 75 + i * 10 + x * 8 + y * 3 + c * 4;
      data[p + 3] = 255;
    }
    return [id, { width: 8, height: 8, data }];
  }));
}
const fullPlain = { sample: () => ({ weights: [1, 0, 0, 0, 0, 0, 0], coverage: 1 }) };

test('VS2 masks union same-terrain cells without a seam on their shared edge', () => {
  const a = hex(0, 0, 'FOREST'), b = hex(1, 0, 'FOREST');
  const field = createVS2RegionField([a, b]);
  assert.equal(field.boundaryCount, 10);
  const x = VS2_WORLD_H / 2;
  for (const dx of [-0.001, 0, 0.001]) {
    assert.deepEqual(field.sample(x + dx, 0), { weights: [0, 1, 0, 0, 0, 0, 0], coverage: 1 });
  }
});

test('VS2 region transitions are continuous, normalized, and retain semantic centers', () => {
  const a = hex(0, 0, 'PLAIN'), b = hex(1, 0, 'MARSH'), field = createVS2RegionField([a, b]);
  assert.equal(field.sample(0, 0).weights[0], 1);
  assert.equal(field.sample(VS2_WORLD_H, 0).weights[4], 1);
  const left = field.sample(VS2_WORLD_H / 2 - 0.0001, 0), right = field.sample(VS2_WORLD_H / 2 + 0.0001, 0);
  assert(Math.abs(left.weights[0] - right.weights[0]) < 0.0001);
  assert(Math.abs(left.weights[0] - 0.5) < 0.0001);
  for (let x = -100; x < 200; x += 2.7) {
    const sample = field.sample(x, 0), total = sample.weights.reduce((a, b) => a + b, 0);
    assert(sample.weights.every(w => w >= 0 && w <= 1));
    assert(total === 0 || Math.abs(total - 1) < 1e-10);
    assert(sample.coverage >= 0 && sample.coverage <= 1);
  }
  assert.equal(field.sample(-1000, -1000).coverage, 0);
});

test('VS2 exterior feathering preserves holes and is independent of input order', () => {
  const cells = [hex(-1, 0, 'HILL'), hex(1, 0, 'ROUGH'), hex(0, 2, 'CITY')];
  const a = createVS2RegionField(cells), b = createVS2RegionField([...cells].reverse());
  assert.equal(a.sample(0, 0).coverage, 0);
  for (let x = -150; x < 150; x += 7) for (let y = -100; y < 200; y += 7) assert.deepEqual(a.sample(x, y), b.sample(x, y));
});

test('VS2 raster has deterministic seed-separated pixels and uninterrupted world UV across crops', () => {
  const input = textures(), bounds = { minX: -32, minY: -16, width: 64, height: 32 };
  const all = rasterizeVS2WorldSurface(fullPlain, input, 17, bounds);
  assert.equal(hash(all.data), hash(rasterizeVS2WorldSurface(fullPlain, input, 17, bounds).data));
  assert.notEqual(hash(all.data), hash(rasterizeVS2WorldSurface(fullPlain, input, 18, bounds).data));
  const crop = rasterizeVS2WorldSurface(fullPlain, input, 17, { ...bounds, minX: 0, width: 32 });
  for (let row = 0; row < crop.height; row++) {
    assert.deepEqual(crop.data.slice(row * crop.width * 4, (row + 1) * crop.width * 4),
      all.data.slice((row * all.width + 16) * 4, (row * all.width + 32) * 4));
  }
  const before = vs2WorldNoise(17, 'dryness', -2, 4, 100);
  vs2WorldNoise(17, 'future-layer', 19, 75, 60);
  assert.equal(vs2WorldNoise(17, 'dryness', -2, 4, 100), before);
});

test('VS2 scalar masks use luminance rather than opaque alpha and bound value modulation', () => {
  const bounds = { minX: 0, minY: 0, width: 2, height: 2 };
  const dark = rasterizeVS2WorldSurface(fullPlain, textures(0), 17, bounds).data;
  const light = rasterizeVS2WorldSurface(fullPlain, textures(255), 17, bounds).data;
  assert(light[0] > dark[0]);
  assert(light[0] / dark[0] < 1.20);
  assert.equal(dark[3], 255); assert.equal(light[3], 255);
  assert.throws(() => rasterizeVS2WorldSurface(fullPlain, new Map(), 17, bounds), /Missing or invalid/);
  assert.throws(() => rasterizeVS2WorldSurface(fullPlain, textures(), 17, bounds, 0), /Invalid/);
});

const raw = JSON.parse(await readFile(new URL('../vendor/eastfront-digital-core/reference/strategic-reset-f-map.json', import.meta.url), 'utf8'));
function production() {
  const session = createFreshProductionSession(raw, 17), presentation = createPresentationState(false, false);
  return { session, model: deriveBrowserRenderModel(session, presentation) };
}
test('VS2 canonical map semantics, RNG, geometry and live grid remain unchanged', () => {
  const { session, model } = production(), snapshot = JSON.stringify({ session, model });
  const options = { debug: false, rendererMode: 'production', assetSet: 'p5', lod: 'medium', scenarioSeed: 17, staticTerrainSurface: true };
  const svg = coreSvgMarkup(model, options), field = createVS2RegionField(model.hexes);
  for (const cell of model.hexes) {
    const center = hexToPixel(cell.coord), sample = field.sample(center.x, center.y);
    assert.equal(sample.coverage, 1);
    assert.equal(sample.weights.filter(w => w === 1).length, 1);
  }
  assert.equal(JSON.stringify({ session, model }), snapshot);
  assert.equal(coreSvgMarkup(model, options), svg);
  assert(svg.includes('id="production-grid-layer"'));
  assert(svg.includes('id="deployment-zone-layer"'));
  assert(svg.includes('id="counter-layer"'));
  assert(!svg.includes('<image '));
});

test('VS2 production cache invokes one world pass and preserves existing infrastructure/city loading', async () => {
  const { model } = production();
  // Exercise composition/lifecycle with a fake Canvas adapter, not a browser.
  const oldDocument = globalThis.document, oldImage = globalThis.Image;
  const urls = [], methods = new Set(), ctx = new Proxy({}, { get: (o, k) => o[k] ?? ((..._args) => { methods.add(k); }) });
  class FakeImage {
    naturalWidth = 8; naturalHeight = 8; width = 8; height = 8;
    set src(value) { if (value) { urls.push(value); queueMicrotask(() => this.onload?.()); } }
  }
  globalThis.Image = FakeImage;
  globalThis.document = { baseURI: 'https://example.test/game/', createElement: () => ({ dataset: {}, getContext: () => ctx, setAttribute() {} }) };
  let paints = 0;
  try {
    const surface = await buildCachedTerrainSurface(model, 17, 'p5', 'medium', {
      id: 'test-world', async paint() { paints++; assert.equal(urls.length, 0); return { imageDraws: 1, uniqueAssets: 9 }; },
    });
    assert.equal(paints, 1); assert.equal(surface.canvas.dataset.worldSurface, 'test-world');
    for (const category of ['City', 'Road', 'Railway', 'River', 'Bridge']) assert(surface.stats.categories[category] > 0);
    assert(urls.some(url => url.includes('/city/')));
    assert(urls.some(url => url.includes('/railway/')));
    assert(urls.some(url => url.includes('/river/')));
    assert(urls.every(url => !url.includes('/plain/') && !url.includes('/forest/') && !url.includes('/marsh/')));
    assert(methods.has('drawImage'));
  } finally { globalThis.document = oldDocument; globalThis.Image = oldImage; }
});

test('VS2 world pass loads exactly the selected namespace materials sequentially and releases scratch canvases', async () => {
  const oldDocument = globalThis.document, oldImage = globalThis.Image, urls = [], canvases = [];
  let active = 0, peak = 0, draws = 0;
  class FakeImage {
    naturalWidth = 8; naturalHeight = 8; width = 8; height = 8;
    set src(value) { if (value) { urls.push(value); active++; peak = Math.max(peak, active); queueMicrotask(() => { active--; this.onload?.(); }); } }
  }
  const fixture = textures().get('VS2_GROUND_GRASS');
  globalThis.Image = FakeImage;
  globalThis.document = { baseURI: 'https://example.test/game/', createElement() {
    const canvas = { width: 0, height: 0, getContext: () => ({
      drawImage() {}, getImageData: () => ({ data: fixture.data }),
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {},
    }) }; canvases.push(canvas); return canvas;
  } };
  try {
    const hooks = createVS2TerrainSurfaceHooks();
    assert.equal(hooks.renderAvailable, true);
    assert.equal(hooks.lookupAsset('unknown'), undefined);
    const result = await hooks.worldBase.paint(new Proxy({ drawImage() { draws++; } }, { get: (o, k) => o[k] ?? (() => {}) }), { hexes: [hex(0, 0, 'PLAIN')], edges: [] }, 17);
    assert.equal(result.uniqueAssets, 9); assert.equal(draws, 1); assert.equal(peak, 1);
    assert.equal(urls.length, VS2_WORLD_MATERIAL_IDS.length);
    assert(urls.every(url => url.startsWith('https://example.test/game/assets/terrain/vs2-002/assets/')));
    assert(canvases.every(c => c.width === 0 && c.height === 0));
  } finally { globalThis.document = oldDocument; globalThis.Image = oldImage; }
});

test('F2 hill, rough and marsh materials remain crop-invariant and seed-separated', () => {
 const bounds={minX:-64,minY:-32,width:128,height:64};
 for(const region of [2,3,4]){
  const field={sample:()=>({weights:Array.from({length:7},(_,i)=>Number(i===region)),coverage:1})};
  const all=rasterizeVS2WorldSurface(field,textures(),17,bounds);
  const crop=rasterizeVS2WorldSurface(field,textures(),17,{...bounds,minX:0,width:64});
  for(let row=0;row<crop.height;row++)assert.deepEqual(crop.data.slice(row*crop.width*4,(row+1)*crop.width*4),all.data.slice((row*all.width+32)*4,(row*all.width+64)*4));
  assert.notEqual(hash(all.data),hash(rasterizeVS2WorldSurface(field,textures(),18,bounds).data));
 }
});

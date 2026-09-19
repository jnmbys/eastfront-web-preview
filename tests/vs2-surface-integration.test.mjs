import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFreshProductionSession } from '../dist/app/web/preview.js';
import { createPresentationState } from '../dist/app/state/presentation.js';
import { deriveBrowserRenderModel } from '../dist/app/render/coreModel.js';
import { hexToPixel, sharedHexEdge } from '../dist/app/geometry/hex.js';
import { coreSvgMarkup, viewBoxForHexes } from '../dist/app/render/coreSvg.js';
import { projectVS2Terrain, vs2RectangleSegmentDistance } from '../dist/app/render/vs2Projection.js';
import { planVS2CityClusters } from '../dist/app/render/vs2CityClusters.js';
import { createVS2TerrainSurfaceHooks } from '../dist/app/render/vs2TerrainSurface.js';
import { buildCachedTerrainSurface } from '../dist/app/render/terrainSurface.js';
import { vs2AssetCatalog } from '../dist/app/render/vs2Assets.js';
import { vs2Region } from '../dist/app/render/vs2WorldField.js';
const raw = JSON.parse(await readFile(new URL('../vendor/eastfront-digital-core/reference/strategic-reset-f-map.json', import.meta.url), 'utf8'));
function realMap() {
  const session = createFreshProductionSession(raw, 17);
  return { session, model: deriveBrowserRenderModel(session, createPresentationState(false, false)) };
}

test('C projects all 640 real-map centers and vertices onto a fixed world raster without shifting hex geometry', () => {
  const { model } = realMap(), p = projectVS2Terrain(model);
  assert.equal(model.hexes.length, 640);
  assert.deepEqual(p.viewBox, viewBoxForHexes(model.hexes));
  assert.equal(Math.abs(p.rasterBounds.minX % p.pixelSize), 0);
  assert.equal(Math.abs(p.rasterBounds.minY % p.pixelSize), 0);
  assert(p.rasterBounds.minX <= p.viewBox.minX);
  assert(p.rasterBounds.minX + p.rasterBounds.width >= p.viewBox.minX + p.viewBox.width);
  for (const h of model.hexes) {
    const center = hexToPixel(h.coord), roundTrip = p.rasterToWorld(p.worldToRaster(center));
    assert(Math.abs(roundTrip.x - center.x) < 1e-9);
    assert(Math.abs(roundTrip.y - center.y) < 1e-9);
    assert.equal(p.field.regionAt(center.x, center.y), vs2Region(h.terrain));
  }
  for (const city of p.cityCells) for (const vertex of city.polygon) {
    const back = p.rasterToWorld(p.worldToRaster(vertex));
    assert(Math.hypot(back.x - vertex.x, back.y - vertex.y) < 1e-9);
  }
});

test('C infrastructure envelopes exactly follow canonical Road/Rail centers and River shared edges', () => {
  const { model } = realMap(), p = projectVS2Terrain(model);
  assert.deepEqual(Object.fromEntries(['road', 'rail', 'river', 'bridge'].map(k => [k, p.corridors.filter(c => c.kind === k).length])), { road: 60, rail: 132, river: 108, bridge: 6 });
  for (const c of p.corridors) {
    const edge = model.edges.find(e => e.key === c.key);
    assert(edge);
    if (c.kind === 'road' || c.kind === 'rail') {
      assert.deepEqual(c.a, hexToPixel(edge.a)); assert.deepEqual(c.b, hexToPixel(edge.b));
    } else if (c.kind === 'river') assert.deepEqual([c.a, c.b], sharedHexEdge(edge.a, edge.b));
    else assert(edge.bridge && !edge.bridge.destroyed);
  }
});

test('C rectangle clearance catches crossing segments, endpoints, and degenerate bridge envelopes', () => {
  const p = { x: 0, y: 0 };
  assert.equal(vs2RectangleSegmentDistance(p, 2, 3, { x: -5, y: 0 }, { x: 5, y: 0 }), 0);
  assert.equal(vs2RectangleSegmentDistance(p, 2, 3, { x: 4, y: -5 }, { x: 4, y: 5 }), 2);
  assert.equal(vs2RectangleSegmentDistance(p, 2, 3, { x: 0, y: 0 }, { x: 0, y: 0 }), 0);
  assert.equal(vs2RectangleSegmentDistance(p, 2, 3, { x: 5, y: 7 }, { x: 5, y: 7 }), 5);
});

test('C city groups cover every real city and reject entire footprints over infrastructure or non-city terrain', () => {
  const { model } = realMap(), p = projectVS2Terrain(model), placements = planVS2CityClusters(p, 17);
  assert.equal(p.cityCells.length, 9); assert(placements.length >= 18);
  for (const c of p.cityCells) {
    const center = hexToPixel(c.coord);
    assert(placements.filter(b => Math.hypot(b.x - center.x, b.y - center.y) < 42).length >= 2);
  }
  for (const b of placements) {
    assert(p.canPlaceCity(b, b.width, b.height));
    for (const edge of p.corridors) assert(vs2RectangleSegmentDistance(b, b.width / 2, b.height / 2, edge.a, edge.b) > edge.radius + 1);
    for (const dx of [-0.5, 0, 0.5]) for (const dy of [-0.5, 0, 0.5]) assert.equal(p.field.regionAt(b.x + dx * b.width, b.y + dy * b.height), 'city');
    const asset = vs2AssetCatalog.byId(b.assetId);
    assert(asset.rotationAllowed.degrees.includes(b.rotation)); assert.equal(b.mirror, false);
    assert(b.width >= asset.recommendedWorldScale.width[0] * 42 * Math.sqrt(3));
    assert(b.width <= asset.recommendedWorldScale.width[1] * 42 * Math.sqrt(3));
    assert(asset.LOD.includes('medium'));
  }
  for (let i = 0; i < placements.length; i++) for (const b of placements.slice(i + 1)) {
    const a = placements[i];
    assert(Math.abs(a.x - b.x) >= (a.width + b.width) / 2 + 1 || Math.abs(a.y - b.y) >= (a.height + b.height) / 2 + 1);
  }
});

test('C city plans are order-independent, seed-dependent, and leave scenario/RNG/live SVG untouched', () => {
  const { session, model } = realMap(), snapshot = JSON.stringify({ session, model });
  const options = { debug: false, rendererMode: 'production', assetSet: 'p5', lod: 'medium', scenarioSeed: 17, staticTerrainSurface: true };
  const svg = coreSvgMarkup(model, options), p = projectVS2Terrain(model), plan = planVS2CityClusters(p, 17);
  const reordered = projectVS2Terrain({ ...model, hexes: [...model.hexes].reverse(), edges: [...model.edges].reverse() });
  assert.deepEqual(planVS2CityClusters(reordered, 17), plan);
  assert.notDeepEqual(planVS2CityClusters(p, 18), plan);
  for (const placement of planVS2CityClusters(p, 17, 'far')) assert(vs2AssetCatalog.byId(placement.assetId).LOD.includes('far'));
  assert.equal(JSON.stringify({ session, model }), snapshot);
  assert.equal(coreSvgMarkup(model, options), svg);
});

test('C real-map cache draws projected raster, VS2 city components, then existing infrastructure without legacy city duplication', async () => {
  const { model } = realMap(), p = projectVS2Terrain(model);
  const oldDocument = globalThis.document, oldImage = globalThis.Image;
  const calls = [], urls = [];
  const sourcePixels = new Uint8ClampedArray(8 * 8 * 4).fill(128);
  for (let i = 3; i < sourcePixels.length; i += 4) sourcePixels[i] = 255;
  class FakeImage {
    naturalWidth = 8; naturalHeight = 8; width = 8; height = 8;
    set src(v) { this.url = v; if (v) { urls.push(v); queueMicrotask(() => this.onload?.()); } }
  }
  const ctx = new Proxy({
    drawImage(source, ...args) { calls.push({ source, args }); },
    getImageData: () => ({ data: sourcePixels }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  }, { get: (o, k) => o[k] ?? (() => {}) });
  globalThis.Image = FakeImage;
  globalThis.document = { baseURI: 'https://example.test/map/', createElement: () => ({ dataset: {}, getContext: () => ctx, setAttribute() {} }) };
  try {
    const surface = await buildCachedTerrainSurface(model, 17, 'p5', 'medium', createVS2TerrainSurfaceHooks().worldBase);
    assert.deepEqual(surface.viewBox, p.viewBox);
    assert.equal(surface.canvas.dataset.worldSurface, 'vs2-002-surface-integration');
    const rasterIndex = calls.findIndex(c => c.args.length === 4 && c.args[0] === p.rasterBounds.minX && c.args[1] === p.rasterBounds.minY && c.args[2] === p.rasterBounds.width && c.args[3] === p.rasterBounds.height);
    assert(rasterIndex >= 0);
    const cityIndex = calls.findIndex(c => c.args.length === 4 && c.source.url?.includes('/vs2-002/assets/city/'));
    const infrastructureIndex = calls.findIndex(c => c.source.url?.includes('/p4r3/'));
    assert(cityIndex > rasterIndex); assert(infrastructureIndex > cityIndex);
    assert(!urls.some(url => url.includes('/p4r3/city/')));
    for (const part of ['/road/', '/railway/', '/river/', '/bridge/']) assert(urls.some(url => url.includes(part)));
  } finally { globalThis.document = oldDocument; globalThis.Image = oldImage; }
});

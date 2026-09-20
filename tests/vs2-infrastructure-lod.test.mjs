import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { paperToAxial } from '../vendor/eastfront-digital-core/dist/core/hex.js';
import { createFreshProductionSession } from '../dist/app/web/preview.js';
import { createPresentationState } from '../dist/app/state/presentation.js';
import { deriveBrowserRenderModel } from '../dist/app/render/coreModel.js';
import { hexToPixel, hexNeighbors, sharedHexEdge } from '../dist/app/geometry/hex.js';
import { coreSvgMarkup } from '../dist/app/render/coreSvg.js';
import { chainVS2Edges, planVS2Infrastructure, paintVS2Infrastructure } from '../dist/app/render/vs2Infrastructure.js';
import { projectVS2Terrain } from '../dist/app/render/vs2Projection.js';
import { planVS2CityClusters } from '../dist/app/render/vs2CityClusters.js';
import { planVS2Forest, createVS2ForestCoverage } from '../dist/app/render/vs2ForestSurface.js';
import { VS2_PRESENTATION } from '../dist/app/render/vs2Presentation.js';
import { createVS2TerrainSurfaceHooks } from '../dist/app/render/vs2TerrainSurface.js';
import { buildCachedTerrainSurface } from '../dist/app/render/terrainSurface.js';
import { rasterizeVS2WorldSurface, VS2_WORLD_MATERIAL_IDS } from '../dist/app/render/vs2WorldRaster.js';
import { vs2AssetCatalog } from '../dist/app/render/vs2Assets.js';
const raw = JSON.parse(await readFile(new URL('../vendor/eastfront-digital-core/reference/strategic-reset-f-map.json', import.meta.url), 'utf8'));
function map() { const session = createFreshProductionSession(raw, 17); return { session, model: deriveBrowserRenderModel(session, createPresentationState(false, false)) }; }

test('D canonical chains cover every real-map infrastructure edge once with uninterrupted arc length', () => {
  const { model } = map(), snapshot = JSON.stringify(model), plan = planVS2Infrastructure(model);
  const expected = { road: 60, rail: 132, river: 108 };
  for (const kind of ['road', 'rail', 'river']) {
    const chains = plan.chains.filter(c => c.kind === kind), segments = chains.flatMap(c => c.segments);
    assert.equal(segments.length, expected[kind]); assert.equal(new Set(segments.map(s => s.key)).size, expected[kind]);
    for (const chain of chains) {
      let length = 0;
      for (const s of chain.segments) {
        assert.equal(s.offset, length); length += s.length;
        const edge = model.edges.find(e => e.key === s.key);
        const ends = kind === 'river' ? sharedHexEdge(edge.a, edge.b) : [hexToPixel(edge.a), hexToPixel(edge.b)];
        assert(ends.some(p => Math.hypot(p.x - s.a.x, p.y - s.a.y) < 1e-7));
        assert(ends.some(p => Math.hypot(p.x - s.b.x, p.y - s.b.y) < 1e-7));
      }
    }
  }
  assert.equal(plan.bridges.length, 6);
  assert.deepEqual(planVS2Infrastructure({ ...model, edges: [...model.edges].reverse() }), plan);
  assert.equal(JSON.stringify(model), snapshot);
});

test('D chain extraction handles closed loops and branches deterministically', () => {
  const a = { x: 0, y: 0 }, b = { x: 10, y: 0 }, c = { x: 5, y: 10 }, d = { x: -10, y: 0 };
  const loop = [{ key: 'ab', a, b }, { key: 'bc', a: b, b: c }, { key: 'ca', a: c, b: a }];
  assert.equal(chainVS2Edges(loop, 'road').length, 1);
  const branch = [...loop, { key: 'ad', a, b: d }], plan = chainVS2Edges(branch, 'rail');
  assert.equal(plan.flatMap(c => c.segments).length, 4);
  assert.deepEqual(chainVS2Edges(branch.reverse(), 'rail'), plan);
});

test('D forest union remains continuous across same-terrain shared edges and clears all infrastructure', () => {
  const { model } = map(), p = projectVS2Terrain(model), coverage = createVS2ForestCoverage(p);
  const terrain = new Map(model.hexes.map(h => [`${h.coord.q},${h.coord.r}`, h.terrain]));
  let checked = 0;
  for (const h of model.hexes.filter(h => h.terrain === 'FOREST')) for (const n of hexNeighbors(h.coord)) {
    if (terrain.get(`${n.q},${n.r}`) !== 'FOREST') continue;
    const edge = sharedHexEdge(h.coord, n), x = (edge[0].x + edge[1].x) / 2, y = (edge[0].y + edge[1].y) / 2;
    assert.equal(p.field.sample(x, y).weights[1], 1);
    assert(Math.abs(coverage(x - 1e-5, y) - coverage(x + 1e-5, y)) < 1e-4); checked++;
  }
  assert(checked > 0, 'must exercise adjacent canonical forest cells');
  for (const edge of p.corridors) assert.equal(coverage((edge.a.x + edge.b.x) / 2, (edge.a.y + edge.b.y) / 2), 0);
  const plans = ['far', 'medium', 'close'].map(lod => planVS2Forest(projectVS2Terrain(model, VS2_PRESENTATION[lod].pixelSize), 17));
  assert(plans[0].length > 0); assert.deepEqual(plans[0], plans[1]); assert.deepEqual(plans[1], plans[2]);
});

test('D marsh maintains a distinct wet colour at player scale without darkening forest or using hex-local pools', () => {
  const textures = new Map(VS2_WORLD_MATERIAL_IDS.map(id => [id, { width: 2, height: 2, data: new Uint8ClampedArray([150, 150, 150, 255, 150, 150, 150, 255, 150, 150, 150, 255, 150, 150, 150, 255]) }]));
  const render = region => rasterizeVS2WorldSurface({ sample: () => ({ weights: [0, 1, 2, 3, 4, 5, 6].map(i => i === region ? 1 : 0), coverage: 1 }) }, textures, 17, { minX: -80, minY: -80, width: 160, height: 160 }, 4).data;
  const marsh = render(4), forest = render(1), plain = render(0);
  let mr = 0, mg = 0, mb = 0, fg = 0, pr = 0;
  for (let i = 0; i < marsh.length; i += 4) { mr += marsh[i]; mg += marsh[i + 1]; mb += marsh[i + 2]; fg += forest[i + 1]; pr += plain[i]; }
  const pixels = marsh.length / 4;
  assert((mg - mr) / pixels > 14); assert((mb - mr) / pixels > 14);
  assert((mg - fg) / pixels > 10); assert((pr - mr) / pixels > 20);
});

function fakeCanvasEnvironment() {
  const previous = { document: globalThis.document, Image: globalThis.Image }, calls = [], urls = [], contexts = [];
  class Image {
    naturalWidth = 8; naturalHeight = 8; width = 8; height = 8;
    set src(url) { this.url = url; if (url) { urls.push(url); queueMicrotask(() => this.onload?.()); } }
  }
  globalThis.Image = Image;
  globalThis.document = { baseURI: 'https://test.invalid/map/', createElement() {
    const canvas = { width: 0, height: 0, dataset: {}, setAttribute() {} };
    const context = new Proxy({
      drawImage(source, ...args) { calls.push({ canvas, source, args, alpha: this.globalAlpha }); },
      fillRect(...args) { calls.push({ canvas, fill: true, args }); },
      getImageData(_x, _y, w, h) {
        const data = new Uint8ClampedArray(w * h * 4);
        // Small texture fixtures are opaque; large canopy buffers are transparent.
        if (w === 8 && h === 8) data.fill(150);
        return { data };
      },
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    }, { get: (o, k) => o[k] ?? (() => {}) });
    canvas.getContext = () => context; contexts.push(context); return canvas;
  } };
  return { calls, urls, contexts, restore() { globalThis.document = previous.document; globalThis.Image = previous.Image; } };
}

test('D all LODs render the complete 20×32 map with cities, canopy, canonical paths and an unchanged live SVG', async () => {
  const { session, model } = map(), snapshot = JSON.stringify({ session, model });
  assert.equal(model.hexes.length, 640);
  assert.equal(raw.rows, 20); assert.equal(raw.cols, 32);
  const actual = new Set(model.hexes.map(h => `${h.coord.q},${h.coord.r}`));
  for (let col = 1; col <= 32; col++) for (let row = 1; row <= 20; row++) { const label = col <= 26 ? String.fromCharCode(64 + col) : 'A' + String.fromCharCode(64 + col - 26); const h = paperToAxial(label, row); assert(actual.has(`${h.q},${h.r}`)); }
  const env = fakeCanvasEnvironment();
  try {
    for (const lod of ['far', 'medium', 'close']) {
      const start = env.urls.length, callStart = env.calls.length;
      const svg = coreSvgMarkup(model, { debug: false, rendererMode: 'production', staticTerrainSurface: true, lod });
      const surface = await buildCachedTerrainSurface(model, 17, 'p5', lod, createVS2TerrainSurfaceHooks().worldBase);
      assert.equal(surface.lod, lod); assert(surface.stats.imageDraws > 300);
      const urls = env.urls.slice(start);
      assert(urls.every(url => url.includes('/vs2-002/')));
      for (const url of urls) {
        const entry = vs2AssetCatalog.manifest.assets.find(a => url.endsWith(`/vs2-002/${a.file}`));
        assert(entry); assert(entry.LOD.includes(lod), `${entry.id}/${lod}`);
      }
      const projection = projectVS2Terrain(model, VS2_PRESENTATION[lod].pixelSize);
      const cityPlan = planVS2CityClusters(projection, 17, 'medium');
      assert.equal(cityPlan.length, 40);
      if (lod === 'far') {
        const summaries = env.calls.slice(callStart).filter(c => c.fill && c.canvas === surface.canvas).slice(1);
        assert.equal(summaries.length, cityPlan.length);
        assert(!urls.some(url => url.includes('/city/reuse_')));
      } else assert(urls.some(url => url.includes('/city/reuse_')));
      for (const part of ['/forest/', '/road/', '/rail/', '/river/', '/bridge/']) assert(urls.some(url => url.includes(part)));
      assert.equal(coreSvgMarkup(model, { debug: false, rendererMode: 'production', staticTerrainSurface: true, lod }), svg);
      assert(svg.includes('id="production-grid-layer"') && svg.includes('id="counter-layer"'));
    }
    assert.equal(JSON.stringify({ session, model }), snapshot);
  } finally { env.restore(); }
});

test('D rail dominance is reduced within manifest limits and bridge decks precede restored road/rail surfaces', async () => {
  const { model } = map(), env = fakeCanvasEnvironment();
  try {
    const ctx = globalThis.document.createElement('canvas').getContext('2d');
    for (const lod of ['far', 'medium', 'close']) {
      const before = env.calls.length; await paintVS2Infrastructure(ctx, model, lod);
      const calls = env.calls.slice(before).filter(c => c.source?.url);
      const rails = calls.filter(c => c.source.url.endsWith('reuse_BALLAST_01.png'));
      assert(rails.length > 0);
      for (const c of rails) { assert(c.args.at(-1) <= 4.2); assert(c.alpha >= 0.7 && c.alpha <= 0.8); }
      const deck = calls.findIndex(c => c.source.url.endsWith('/bridge/deck_material.webp'));
      assert(deck >= 0); assert(calls.slice(deck).every(c => !c.source.url.includes('/river/')));
      assert(calls.slice(deck + 1).some(c => c.source.url.includes('/road/') || c.source.url.includes('/rail/')));
    }
  } finally { env.restore(); }
});

test('D production mounts cached Far/Medium/Close surfaces without rebuilding on interaction', async () => {
  const main = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert(main.includes("for(const lod of ['far','medium','close'] as const)"));
  assert(main.includes('cachedTerrainSurfaces.set(lod,cachedTerrainSurface)'));
  assert(main.includes('cachedTerrainSurfaces.get(svg.dataset.lod as TerrainLod)'));
  assert(main.includes('if(previous&&previous!==canvas)previous.remove()'));
  assert.equal((main.match(/buildCachedTerrainSurface\(/g) ?? []).length, 1);
  assert(!main.slice(main.indexOf('function applyMapViewport'), main.indexOf('async function boot')).includes('buildCachedTerrainSurface('));
});

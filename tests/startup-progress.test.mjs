import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { StartupProgress, STARTUP_MILESTONES } from '../dist/app/web/startupProgress.js';
import { startupLoadingMarkup, updateStartupLoading } from '../dist/app/web/startupView.js';
import { observeTerrainLoad, reportTerrainLoad } from '../dist/app/render/terrainLoadProgress.js';
import { loadTerrainImage, buildCachedTerrainSurface, TerrainSurfaceResourceError } from '../dist/app/render/terrainSurface.js';
import { createVS2TerrainSurfaceHooks } from '../dist/app/render/vs2TerrainSurface.js';
import { VS2_WORLD_MATERIAL_IDS } from '../dist/app/render/vs2WorldRaster.js';
import { setLocale, catalogs } from '../dist/app/localization/index.js';
import { loadingMarkup, fatalMarkup, responsiveProfile } from '../dist/app/web/preview.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const main = read('dist/app/main.js');
const boot = main.slice(main.indexOf('async function boot()'), main.indexOf("window.addEventListener('resize'"));
const render = main.slice(main.indexOf('function render()'), main.indexOf('function bind()'));
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject}; };
function bootHarness(overrides = {}) {
  const progress = new StartupProgress(), calls = [], frames = [], snapshots = [];
  progress.subscribe(s => snapshots.push(s));
  const root = { innerHTML: '' };
  const context = { startupProgress: progress, observeTerrainLoad, root, appStatus: 'LOADING', session: null,
    productionMap: null, cachedTerrainSurface: null, cachedTerrainSurfaces: new Map(), TERRAIN_VISUAL_SEED: 17,
    loadProductionMapFromUrl: async () => { calls.push('map'); return { map: true }; },
    loadProductionRuntimeManifest: async () => { calls.push('manifest'); return {}; },
    createFreshProductionSession: (_map, seed) => { calls.push(`seed:${seed}`); return {}; },
    createPresentationState: () => ({}), deriveBrowserRenderModel: () => ({}),
    loadVS2TerrainSurfaceHooks: async () => { calls.push('hooks'); return {worldBase:{}}; },
    buildCachedTerrainSurface: async (_model,_seed,_set,lod) => { calls.push(lod); return {lod,stats:{}}; },
    console: {info(){},error(){}}, fatalMessage: '', formatTerrainSurfaceFailure: e => e.message,
    terrainSurfaceCapabilities: () => ({}), msg: (_key,{detail}) => detail, fatalMarkup, loadingMarkup,
    responsiveProfile, window: {innerWidth:1280,innerHeight:800}, homeMarkup: () => {calls.push('interface');return '<home/>';},
    bind() {calls.push('bind');}, requestAnimationFrame: callback => {frames.push(callback);return frames.length;},
    ...overrides };
  vm.createContext(context); vm.runInContext(render + '\n' + boot, context);
  return {context,progress,calls,frames,snapshots,root,run:()=>context.boot()};
}

test('startup feedback exists in HTML before modules and before pending map/assets', async () => {
  const html = read('dist/index.html');
  assert(html.indexOf('role="progressbar"') < html.indexOf('src="./app/main.js"'));
  assert.match(html, /正在初始化游戏/);
  const gate = deferred(), h = bootHarness({loadProductionMapFromUrl: () => gate.promise});
  const running = h.run();
  assert.match(h.root.innerHTML, /data-preview-state="loading"/);
  assert.equal(h.progress.snapshot.completedSteps, 0);
  assert(!h.calls.includes('far'));
  gate.resolve({}); await running;
});

test('startup progress is monotonic across asset batches and LOD milestones', () => {
  const p = new StartupProgress(), seen = [p.snapshot];p.subscribe(s=>seen.push(s));
  for (const step of STARTUP_MILESTONES) {
    p.observe({kind:'assets',total:2});p.observe({kind:'asset-complete'});p.observe({kind:'asset-complete'});
    p.building();p.complete(step);p.complete(step);
  }
  p.finish();
  for (let i=1;i<seen.length;i++) {
    assert(seen[i].completedSteps >= seen[i-1].completedSteps);
    assert(seen[i].completedAssets >= seen[i-1].completedAssets);
  }
  assert.equal(p.snapshot.completedAssets, STARTUP_MILESTONES.length*2);
  assert.equal(p.snapshot.completedSteps,p.snapshot.totalSteps);
});

test('100 percent is gated by all required caches and successfully prepared home markup', async () => {
  const gate = deferred(), h = bootHarness({buildCachedTerrainSurface: async (_m,_s,_a,lod) => lod==='close'?gate.promise:{lod,stats:{}}});
  const running = h.run();await new Promise(setImmediate);
  h.progress.finish();assert.notEqual(h.progress.snapshot.stage,'ready');
  assert(!startupLoadingMarkup(h.progress.snapshot).includes('100%'));
  gate.resolve({lod:'close',stats:{}});await running;
  assert.equal(h.progress.snapshot.stage,'ready');assert(h.calls.includes('interface'));
  assert(startupLoadingMarkup(h.progress.snapshot).includes('100%'));
  assert.match(h.root.innerHTML,/data-preview-state="loading"/);
  h.frames.shift()();h.frames.shift()();assert.equal(h.root.innerHTML,'<home/>');
});

test('startup failure retains fatal diagnostics and never emits success', async () => {
  for (const overrides of [
    {loadProductionMapFromUrl: async()=>{throw new Error('map failed');}},
    {buildCachedTerrainSurface: async()=>{throw new Error('surface failed');}},
    {homeMarkup: ()=>{throw new Error('interface failed');}},
  ]) {
    const h=bootHarness(overrides);await h.run();
    assert.equal(h.context.appStatus,'FATAL');assert.equal(h.progress.snapshot.stage,'failed');
    assert(!h.snapshots.some(s=>s.stage==='ready'));assert.match(h.root.innerHTML,/data-preview-state="fatal"/);
    assert.match(h.root.innerHTML,/failed/);assert.equal(h.frames.length,0);
  }
});

test('startup retains resource concurrency, LOD order, fixed terrain seed and cleanup', async () => {
  const h=bootHarness();await h.run();
  assert.deepEqual(h.calls.filter(x=>x!=='bind'),['map','manifest','seed:17','hooks','far','medium','close','interface']);
  assert.equal(h.context.cachedTerrainSurface.lod,'medium');assert.equal(h.context.session,null);
  const before=h.progress.snapshot;reportTerrainLoad({kind:'asset-complete'});assert.equal(h.progress.snapshot,before);
  const failed=bootHarness({buildCachedTerrainSurface:async()=>{throw new Error('bad');}});await failed.run();
  const failedBefore=failed.progress.snapshot;reportTerrainLoad({kind:'assets',total:1});assert.equal(failed.progress.snapshot,failedBefore);
});

const caps={createImageBitmap:false,offscreenCanvas:false,htmlImageDecode:false,canvas2d:true};
const entry={id:'fixture',family:'ground',file:'fixture.png'};
function imageEnvironment(mode) {
  const previous={Image:globalThis.Image,document:globalThis.document,fetch:globalThis.fetch,createImageBitmap:globalThis.createImageBitmap},trace=[];
  class Image {
    width=8;height=8;naturalWidth=8;naturalHeight=8;
    set src(url) {this.url=url;if(!url)return;trace.push(url.startsWith('blob:')?'blob-image':'direct-image');queueMicrotask(()=>mode==='direct'||url.startsWith('blob:')?this.onload?.():this.onerror?.());}
  }
  globalThis.Image=Image;globalThis.document={baseURI:'https://test.invalid/'};
  globalThis.fetch=async()=>{trace.push('fetch');return {ok:mode!=='failure',status:503,blob:async()=>new Blob(['fixture'])};};
  return {trace,restore(){Object.assign(globalThis,previous);}};
}
test('Huawei direct-image path is still first and observer exceptions cannot trigger fallback', async()=>{
  const env=imageEnvironment('direct'),p=new StartupProgress(),off=observeTerrainLoad(p.observe),bad=observeTerrainLoad(()=>{throw new Error('UI failure');});
  try {p.observe({kind:'assets',total:1});const image=await loadTerrainImage(entry,'p5',caps);
    assert.equal(image.width,8);assert.deepEqual(env.trace,['direct-image']);assert.equal(p.snapshot.batchCompleted,1);
  } finally {off();bad();env.restore();}
});
test('fetch/blob fallback success counts exactly once after the original path succeeds', async()=>{
  const env=imageEnvironment('fallback'),p=new StartupProgress(),off=observeTerrainLoad(p.observe);
  try {p.observe({kind:'assets',total:1});await loadTerrainImage(entry,'p5',caps);
    assert.deepEqual(env.trace,['direct-image','fetch','blob-image']);assert.equal(p.snapshot.completedAssets,1);assert.equal(p.snapshot.batchCompleted,1);
  } finally {off();env.restore();}
});
test('failed image does not increment completion or change resource error semantics', async()=>{
  const env=imageEnvironment('failure'),p=new StartupProgress(),off=observeTerrainLoad(p.observe);
  try {await assert.rejects(loadTerrainImage(entry,'p5',caps),e=>e instanceof TerrainSurfaceResourceError&&e.details.httpStatus===503&&e.details.stage==='http');
    assert.equal(p.snapshot.completedAssets,0);assert.deepEqual(env.trace,['direct-image','fetch']);
  } finally {off();env.restore();}
});
test('bitmap fallback completion preserves release and skips the blob-image branch', async()=>{
  const env=imageEnvironment('fallback'),p=new StartupProgress(),off=observeTerrainLoad(p.observe);let released=0;
  globalThis.createImageBitmap=async()=>{env.trace.push('bitmap');return {width:8,height:8,close(){released++;}};};
  try {const image=await loadTerrainImage(entry,'p5',{...caps,createImageBitmap:true});
    assert.deepEqual(env.trace,['direct-image','fetch','bitmap']);assert.equal(p.snapshot.completedAssets,1);
    image.release();assert.equal(released,1);
  } finally {off();env.restore();}
});

function canvasEnvironment() {
  const env=imageEnvironment('direct'),calls=[],canvases=[];
  globalThis.document.createElement=()=>{
    const id=canvases.length,canvas={width:0,height:0,dataset:{},setAttribute(){}};canvases.push(canvas);
    const ctx=new Proxy({
      drawImage(source,...args){calls.push(['draw',id,source.url??canvases.indexOf(source),...args]);},
      getImageData(_x,_y,w,h){return {data:new Uint8ClampedArray(w*h*4).fill(w===8&&h===8?150:0)};},
      createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
      putImageData(image){calls.push(['pixels',id,createHash('sha256').update(image.data).digest('hex')]);},
    },{get:(o,k)=>o[k]??((...args)=>calls.push([k,id,...args]))});
    canvas.getContext=()=>ctx;return canvas;
  };
  return {...env,calls};
}
test('actual VS2 asset batch totals come from the selected material list and actual completions', async()=>{
  const env=canvasEnvironment(),p=new StartupProgress(),seen=[],off=observeTerrainLoad(e=>{seen.push(e);p.observe(e);});
  try {await buildCachedTerrainSurface({hexes:[{coord:{q:0,r:0},terrain:'PLAIN'}],edges:[]},17,'p5','far',createVS2TerrainSurfaceHooks().worldBase);
    assert.deepEqual(seen[0],{kind:'assets',total:VS2_WORLD_MATERIAL_IDS.length});
    assert.equal(p.snapshot.completedAssets,env.trace.length);
    assert.equal(p.snapshot.completedAssets,VS2_WORLD_MATERIAL_IDS.length);
    assert(seen.some(e=>e.kind==='assets'&&e.total===null),'unknown infrastructure total is explicitly unknown');
  } finally {off();env.restore();}
});
test('VS2 observer on/off produces identical draw trace, pixels, resource order and stats', async()=>{
  const model={hexes:[{coord:{q:0,r:0},terrain:'FOREST'},{coord:{q:1,r:0},terrain:'PLAIN'}],edges:[]},before=JSON.stringify(model),runs=[];
  for(const observed of [false,true]) {
    const env=canvasEnvironment(),p=new StartupProgress(),off=observed?observeTerrainLoad(p.observe):()=>{};
    try {const surface=await buildCachedTerrainSurface(model,17,'p5','medium',createVS2TerrainSurfaceHooks().worldBase);runs.push({calls:env.calls,loads:env.trace,stats:surface.stats});}
    finally {off();env.restore();}
  }
  assert.deepEqual(runs[0],runs[1]);assert.equal(JSON.stringify(model),before);
});

const baseline=JSON.parse(read('tests/fixtures/startup-baseline-sha256.json'));
function withoutObservation(source) {
  return source.replace(/^import \{ report(?:TerrainLoad|LoadedTerrainImage) \} from '\.\/terrainLoadProgress.js';\n/m,'')
    .replace(/^\s*reportTerrainLoad\([^\n]+\);\n/gm,'')
    .replace(/^  \/\/ Draw calls depend on actual path\/bridge branches; no invented total\.\n/m,'')
    .replace(/return reportLoadedTerrainImage\((await imageFromUrl\([^;]+?\))\);/g,'return $1;')
    .replace('return reportLoadedTerrainImage({source:bitmap,width:bitmap.width,height:bitmap.height,release:()=>bitmap.close()});','return {source:bitmap,width:bitmap.width,height:bitmap.height,release:()=>bitmap.close()};');
}
test('baseline loader strategy, timeout, cache and VS2 semantics differ only by observation',()=>{
  for(const [path,expected] of Object.entries(baseline).filter(([path])=>path.startsWith('src/render/'))) {
    assert.equal(createHash('sha256').update(withoutObservation(read(path))).digest('hex'),expected,path);
  }
});
test('UA-001 transition boundary and fresh-game session adapter remain byte-identical',()=>{
  for(const [path,expected] of Object.entries(baseline).filter(([path])=>path==='src/core-adapter/session.ts'||path==='src/presentation/transitionBus.ts')) {
    assert.equal(createHash('sha256').update(read(path)).digest('hex'),expected,path);
  }
});
test('loading stages and counters are complete in zh-CN/en-US and language changes retain progress',()=>{
  const p=new StartupProgress();p.complete('resources');p.observe({kind:'assets',total:11});p.observe({kind:'asset-complete'});
  const before=JSON.stringify(p.snapshot);
  for(const locale of ['zh-CN','en-US']) {
    setLocale(locale);const markup=startupLoadingMarkup(p.snapshot);assert.match(markup,/1 \/ 11/);
    for(const key of Object.keys(catalogs['en-US']).filter(k=>k.startsWith('startup.')))assert(catalogs[locale][key],`${locale}/${key}`);
    assert.match(markup,locale==='zh-CN'?/正在加载地图素材/:/Loading map assets/);
    assert.equal(JSON.stringify(p.snapshot),before);
  }
  setLocale('zh-CN');
});
test('unknown totals never imply an asset percentage, and updates touch only loading DOM nodes',()=>{
  const p=new StartupProgress();p.observe({kind:'assets',total:null});p.observe({kind:'asset-complete'});
  assert.doesNotMatch(startupLoadingMarkup(p.snapshot),/\d+%/);
  const nodes=new Map(['.startup-track','.startup-fill','.startup-steps','.startup-stage','.startup-items'].map(k=>[k,{style:{},textContent:'',setAttribute(){}}]));
  const view={dataset:{},querySelector:s=>nodes.get(s)};
  updateStartupLoading({querySelector:s=>{assert.equal(s,'.startup-progress');return view;}},p.snapshot);
  assert.equal(nodes.get('.startup-fill').style.transform,'scaleX(0)');
  assert.match(nodes.get('.startup-items').textContent,/1/);
});
test('loading interpolation never runs a timer and respects reduced motion',()=>{
  for(const path of ['src/web/startupProgress.ts','src/web/startupView.ts','src/web/startupShell.ts'])assert.doesNotMatch(read(path),/setTimeout|setInterval|Math\.random|createGameplaySeed|UnitAnimationRuntime/);
  const css=read('styles.css');assert.match(css,/transition:transform 180ms ease-out/);assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\.startup-fill\{transition:none\}/);
});

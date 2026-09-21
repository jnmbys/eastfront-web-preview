import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createFreshProductionSession} from '../dist/app/web/preview.js';
import {createPresentationState} from '../dist/app/state/presentation.js';
import {deriveBrowserRenderModel} from '../dist/app/render/coreModel.js';
import {coreSvgMarkup} from '../dist/app/render/coreSvg.js';
import {terrainSurfacePlan} from '../dist/app/render/terrainSurface.js';

const raw=JSON.parse(await readFile(new URL('../vendor/eastfront-digital-core/reference/strategic-reset-f-map.json',import.meta.url),'utf8'));
const mainSource=await readFile(new URL('../src/main.ts',import.meta.url),'utf8');
const surfaceSource=await readFile(new URL('../src/render/terrainSurface.ts',import.meta.url),'utf8');
const css=await readFile(new URL('../styles.css',import.meta.url),'utf8');
function model(){const s=createFreshProductionSession(raw,17),p=createPresentationState(false,false);return {s,p,m:deriveBrowserRenderModel(s,p)};}

test('UI009R2 Strategic Reset F cached terrain plan covers every release-critical static category',()=>{
  const {m}=model(),plan=terrainSurfacePlan(m,17,'medium');
  for(const key of ['Ground','Plain','Forest','City','Marsh','Hill/Rough','River','Road','Railway','Bridge']) assert((plan.categories[key]??0)>0,`${key} missing from cached terrain plan`);
  assert(plan.assetIds.length>20,'expected real P5R1 asset plan');
  assert(plan.assetFiles.every(file=>!file.startsWith('/')&&!file.includes('dev-assets')));
});

test('UI009R2 static terrain plan is deterministic for the same canonical map and visual seed',()=>{
  const {m}=model();
  assert.deepEqual(terrainSurfacePlan(m,17,'medium'),terrainSurfacePlan(m,17,'medium'));
});

test('UI009R2 production live SVG removes raster terrain while retaining grid and interactive deployment layer',()=>{
  const {s,m}=model();
  const svg=coreSvgMarkup(m,{debug:false,rendererMode:'production',assetSet:'p5',lod:'medium',scenarioSeed:s.state.random.seed,staticTerrainSurface:true});
  assert.equal(svg.includes('<image '),false);
  assert(svg.includes('id="production-grid-layer"'));
  assert(svg.includes('id="deployment-zone-layer"'));
  assert(svg.includes('id="counter-layer"'));
});

test('UI009R2 terrain surface is created only during boot, never by selection/deployment/combat render paths',()=>{
  const calls=[...mainSource.matchAll(/buildCachedTerrainSurface\s*\(/g)];
  assert.equal(calls.length,1,'cached terrain builder must have exactly one runtime call');
  const boot=mainSource.slice(mainSource.indexOf('async function boot()'));
  assert(boot.includes('buildCachedTerrainSurface'));
  const sections=[
    ['function refreshDynamicView():void','function render():void'],
    ['function render():void','function bind():void'],
    ['function bindDynamic(model?:BrowserRenderModel):void','async function boot():Promise<void>'],
  ];
  for(const [name,next] of sections){const start=mainSource.indexOf(name),end=mainSource.indexOf(next,start+1);assert(start>=0&&end>start,name);assert.equal(mainSource.slice(start,end).includes('buildCachedTerrainSurface('),false,`${name} must not rebuild terrain`);}
});

test('UI009R2 pan and zoom transform the same cached canvas without mutating/repainting it',()=>{
  assert(mainSource.includes("document.querySelector<HTMLCanvasElement>('#terrain-surface')"));
  assert(mainSource.includes('terrain.style.transform=transform'));
  assert(mainSource.includes('svg.style.transform=transform'));
  assert(surfaceSource.includes("canvas.dataset.buildCount=String(++terrainSurfaceBuildCount)"));
  assert(css.includes('.terrain-surface{')&&css.includes('pointer-events:none')&&css.includes('object-fit:contain'));
});

test('UI009R2 terrain cache avoids all-at-once preload and bounds decoded-image residency',()=>{
  assert.equal(surfaceSource.includes('preloadPlannedAssets'),false);
  assert(surfaceSource.includes('MAX_RETAINED_TERRAIN_IMAGES=16'));
  assert(surfaceSource.includes('victim?.release?.()'));
  assert(surfaceSource.includes('cache.releaseAll()'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createFreshProductionSession} from '../dist/app/web/preview.js';
import {createPresentationState} from '../dist/app/state/presentation.js';
import {deriveBrowserRenderModel} from '../dist/app/render/coreModel.js';
import {projectVS2Terrain} from '../dist/app/render/vs2Projection.js';
import {planVS2CityBlocks,planVS2CityCourts} from '../dist/app/render/vs2CityClusters.js';
import {hexToPixel} from '../dist/app/geometry/hex.js';
const raw = JSON.parse(await readFile(new URL('../vendor/eastfront-digital-core/reference/strategic-reset-f-map.json', import.meta.url),'utf8'));
test('F urban mass stays inside all nine real city cells and clear of every transport/river corridor at all LODs', () => {
 const session=createFreshProductionSession(raw,17),model=deriveBrowserRenderModel(session,createPresentationState(false,false));
 const snapshot=JSON.stringify({session,model}),p=projectVS2Terrain(model),blocks=planVS2CityBlocks(p,17);
 assert(blocks.length>=70 && blocks.length<=209); // F1 uses fewer, larger grouped roofs than F.
 for(const b of blocks) assert(p.canPlaceCity(b,b.width+2,b.height+2));
 for(const cell of p.cityCells){const c=hexToPixel(cell.coord);assert(blocks.filter(b=>Math.hypot(b.x-c.x,b.y-c.y)<35).length>=5);}
 for(const pixel of [1,2,4]) assert.deepEqual(planVS2CityBlocks(projectVS2Terrain(model,pixel),17),blocks);
 assert.deepEqual(planVS2CityBlocks(projectVS2Terrain({...model,hexes:[...model.hexes].reverse(),edges:[...model.edges].reverse()}),17),blocks);
 assert.notDeepEqual(planVS2CityBlocks(p,18),blocks);
 assert.equal(JSON.stringify({session,model}),snapshot);
});

test('F1 settlements have deterministic focus, size gradients and non-overlapping road-oriented roofs', () => {
 const model=deriveBrowserRenderModel(createFreshProductionSession(raw,17),createPresentationState(false,false));
 const blocks=planVS2CityBlocks(projectVS2Terrain(model),17);
 const inner=blocks.filter(b=>b.density>0.5), outer=blocks.filter(b=>b.density<0.3);
 assert(inner.length>0 && outer.length>0);
 const meanArea=list=>list.reduce((s,b)=>s+b.roofWidth*b.roofHeight,0)/list.length;
 assert(meanArea(inner)>meanArea(outer)*1.2);
 assert.equal(blocks.filter(b=>b.landmark).length,7); // 9 canonical cells form 7 connected settlements.
 assert(blocks.some(b=>b.industrial));
 assert(blocks.some(b=>Math.abs(Math.sin(b.angle))>0.5));
 assert(blocks.length<=209,'F1 must not solve city focus simply by exceeding F roof count');
 for(let i=0;i<blocks.length;i++) for(const b of blocks.slice(i+1)){
  const a=blocks[i];assert(Math.abs(a.x-b.x)>=(a.width+b.width)/2+1 || Math.abs(a.y-b.y)>=(a.height+b.height)/2+1);
 }
});


test('F2 core courts preserve canonical city unions and infrastructure clearances', () => {
 const model=deriveBrowserRenderModel(createFreshProductionSession(raw,17),createPresentationState(false,false));
 const snapshot=JSON.stringify(model),p=projectVS2Terrain(model),blocks=planVS2CityBlocks(p,17);
 const courts=planVS2CityCourts(p,blocks);
 assert(courts.length>0);
 assert(blocks.length<=142,'F3 consolidation must not increase the F2 building count');
 for(const {a,b,width} of courts){
  assert(p.canPlaceCity({x:(a.x+b.x)/2,y:(a.y+b.y)/2},Math.abs(a.x-b.x)+width+2,Math.abs(a.y-b.y)+width+2));
 }
 for(const pixel of [1,2,4])assert.deepEqual(planVS2CityCourts(projectVS2Terrain(model,pixel),blocks),courts);
 assert.equal(JSON.stringify(model),snapshot);
});


test('F3 civic silhouettes gain mass without expanding city or corridor footprints', () => {
 const model=deriveBrowserRenderModel(createFreshProductionSession(raw,17),createPresentationState(false,false));
 const p=projectVS2Terrain(model),blocks=planVS2CityBlocks(p,17);
 const civic=blocks.filter(b=>b.landmark),ordinary=blocks.filter(b=>!b.landmark);
 assert.equal(civic.length,7);
 assert(civic.every(b=>b.roofWidth*b.roofHeight>65),'all seven settlement cores must have a readable consolidated mass, including constrained city cells');
 const meanArea=a=>a.reduce((sum,b)=>sum+b.roofWidth*b.roofHeight,0)/a.length;
 assert(meanArea(civic)>meanArea(ordinary)*2);
 for(const b of civic)assert(p.canPlaceCity(b,b.width+2,b.height+2));
 assert(blocks.length<=142);
});

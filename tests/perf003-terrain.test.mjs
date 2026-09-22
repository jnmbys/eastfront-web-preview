import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {ProgressiveTerrain} from '../dist/app/render/progressiveTerrain.js';
import {runTerrainWork,observeTerrainBuild} from '../dist/app/render/terrainWork.js';
import {rasterizeVS2WorldSurface,rasterizeVS2WorldSurfaceAsync,VS2_WORLD_MATERIAL_IDS} from '../dist/app/render/vs2WorldRaster.js';
import {projectVS2Terrain} from '../dist/app/render/vs2Projection.js';
import * as city from '../dist/app/render/vs2CityClusters.js';
const tick=()=>new Promise(r=>setTimeout(r,10));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const hash=x=>createHash('sha256').update(x).digest('hex');
test('PERF003 duplicate requests and reprioritization keep one builder and one complete surface per LOD',async()=>{
 const gate=deferred(),builds=[],released=[];let concurrent=0,max=0;
 const p=new ProgressiveTerrain(async lod=>{max=Math.max(max,++concurrent);builds.push(lod);if(lod==='far')await gate.promise;concurrent--;return {lod};},()=>{},x=>released.push(x.lod));
 const a=p.request('far'),b=p.request('far');p.continueAll();p.prioritize('close');assert.equal(p.best('close'),undefined);
 gate.resolve();assert.equal(await a,await b);assert.equal(p.best('close').lod,'far');
 await p.request('close');await p.request('medium');assert.deepEqual(builds,['far','close','medium']);assert.equal(max,1);assert.equal(p.ready.size,3);
 const same=await p.request('far');assert.equal(same,await a);p.dispose();assert.equal(p.ready.size,0);assert.equal(released.length,3);
});
test('PERF003 paused background work resumes without duplicate work; disposal prevents stale completion',async()=>{
 let work=0;const events=[],released=[];
 const p=new ProgressiveTerrain(async(lod,control)=>{await runTerrainWork('pause', (function*(){for(let i=0;i<20;i++){work++;yield;}})(),control);return {lod};},lod=>events.push(lod),x=>released.push(x));
 p.pause();const pending=p.request('close');await tick();assert.equal(work,0);p.resume();await pending;assert.equal(work,20);
 const gate=deferred();const old=new ProgressiveTerrain(async()=>{await gate.promise;return 'old';},()=>events.push('stale'),x=>released.push(x));
 const rejected=assert.rejects(old.request('far'),/disposed/);await tick();old.dispose();gate.resolve();await rejected;await tick();assert(!events.includes('stale'));assert(released.includes('old'));
 p.dispose();
});
test('PERF003 failure remains explicit and bounded until deliberate retry; completed fallback retained',async()=>{
 let attempts=0;const p=new ProgressiveTerrain(async lod=>{if(lod==='close'&&++attempts===1)throw Error('fixture failure');return {lod};},()=>{},()=>{});
 await p.request('far');await assert.rejects(p.request('close'),/fixture failure/);p.continueAll();p.prioritize('close');await tick();assert.equal(attempts,1);assert.equal(p.best('close').lod,'medium');
 p.retry();await p.request('close');assert.equal(attempts,2);p.dispose();
});
test('PERF003 CPU work gives real timer/input opportunities and preserves iterator order/finally',async()=>{
 const marks=[];let timer=0,closed=false;const off=observeTerrainBuild(t=>marks.push(t));
 const interval=setInterval(()=>timer++,1);
 try {const value=await runTerrainWork('fixture',(function*(){try{let total=0;for(let i=0;i<20;i++){const end=performance.now()+1;while(performance.now()<end){}total+=i;yield;}return total;}finally{closed=true;}})());assert.equal(value,190);assert(timer>=2);assert(closed);assert(marks[0].yields>=2);}finally{clearInterval(interval);off();}
});
const model={hexes:['PLAIN','FOREST','HILL','ROUGH','MARSH','CITY','LAKE'].map((terrain,q)=>({coord:{q,r:0},terrain})),edges:[]};
const textures=new Map(VS2_WORLD_MATERIAL_IDS.map((id,i)=>[id,{width:4,height:4,data:Uint8ClampedArray.from({length:64},(_,n)=>(n*13+i*27)%256)}]));
const references=JSON.parse(readFileSync('tests/fixtures/perf003-terrain-reference.json'));
test('PERF003 chunked raster bytes match original baseline at every LOD and visual seed; no input mutation',async()=>{
 const before=JSON.stringify(model);for(const pixel of [4,2,1]){const p=projectVS2Terrain(model,pixel),bounds={minX:-20,minY:-20,width:210,height:60};for(const seed of [17,8726]){
 const sync=rasterizeVS2WorldSurface(p.field,textures,seed,bounds,pixel),asyncResult=await rasterizeVS2WorldSurfaceAsync(p.field,textures,seed,bounds,pixel);
 assert.equal(hash(sync.data),references.rasters[`${pixel}:${seed}`]);assert.deepEqual(asyncResult,sync);
 }}assert.equal(JSON.stringify(model),before);
});
test('PERF003 city order, visual seed, footprints and courts match the baseline after chunking and cached centrality',async()=>{
 const p=projectVS2Terrain(model,2),blocks=await city.planVS2CityBlocksAsync(p,17),clusters=await city.planVS2CityClustersAsync(p,17),courts=await city.planVS2CityCourtsAsync(p,blocks);
 assert.deepEqual(blocks,city.planVS2CityBlocks(p,17));assert.deepEqual(clusters,city.planVS2CityClusters(p,17));assert.deepEqual(courts,city.planVS2CityCourts(p,blocks));
 for(const [key,value] of Object.entries({blocks,clusters,courts}))assert.equal(hash(JSON.stringify(value)),references[key]);
});

test('PERF003 decorative planning yields without touching the final Canvas; atomic replay exactly matches original draw stream and releases buffer',async()=>{
 const {planVS2DetailDraws,paintVS2PlainTraces,paintVS2MarshReeds,paintVS2RiverbankDetails}=await import('../dist/app/render/vs2PlainTraces.js');
 const {recordTerrainDraws}=await import('../dist/app/render/terrainDrawCommands.js');
 const trace=()=>{const rows=[];return {rows,ctx:new Proxy({},{get:(_,key)=>(...args)=>rows.push([key,args]),set:(_,key,value)=>{rows.push([key,value]);return true;}})};};
 const p=projectVS2Terrain(model,1),expected=trace();
 paintVS2PlainTraces(expected.ctx,p,17);paintVS2MarshReeds(expected.ctx,p,17);paintVS2RiverbankDetails(expected.ctx,p,17);
 const draws=await planVS2DetailDraws(p,17);assert(draws.commandCount>0&&draws.commandCount<100000);
 const actual=trace();assert.equal(actual.rows.length,0);draws.paint(actual.ctx);assert.deepEqual(actual.rows,expected.rows);assert.equal(hash(JSON.stringify(actual.rows)),references.detailDraws);assert.equal(draws.commandCount,0);
 const bad=recordTerrainDraws();bad.context.save();assert.throws(()=>bad.paint({save(){throw Error('draw failure')}}),/draw failure/);assert.equal(bad.commandCount,0);
});

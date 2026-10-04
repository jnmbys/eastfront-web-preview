import test from 'node:test';import assert from 'node:assert/strict';
import {mapMaxZoom,zoomMapAt,pinchMapViewport} from '../dist/app/web/mapInteraction.js';
import {selectTerrainLod} from '../dist/app/render/terrainAssets.js';
import {ProgressiveTerrain} from '../dist/app/render/progressiveTerrain.js';
import {runTerrainWork} from '../dist/app/render/terrainWork.js';
import {terrainBuildDiagnosticReport} from '../dist/app/render/terrainBuildDiagnostics.js';
const width=2540.568603515625,hex=Math.sqrt(3)*42,tick=()=>new Promise(r=>setTimeout(r,10));
test('004 dimensions: original cap cannot reach close, adaptive cap does without changing LOD thresholds',()=>{
 for(const panelWidth of [24,280]){const usable=1302-panelWidth;assert.equal(selectTerrainLod(usable*hex/width*2.5),'medium');const max=mapMaxZoom(usable,width,hex);assert.equal(selectTerrainLod(usable*hex/width*max),'close');assert.equal(zoomMapAt({zoom:1,panX:0,panY:0},100,{x:0,y:0},max).zoom,max);}
 for(const viewport of [320,607,1302,1400,1920])for(const panel of [24,280]){const usable=Math.max(560,viewport-panel),max=mapMaxZoom(usable,width,hex);assert(max>=2.5&&max<=6.1);assert.equal(selectTerrainLod(usable*hex/width*max),'close');}
 assert.equal(mapMaxZoom(1920-24,width,hex),2.5);assert.equal(mapMaxZoom(NaN,width,hex),2.5);
});
test('new cap preserves off-centre pinch focus; resource readiness is not an input to camera limits',()=>{
 const v={zoom:2.5,panX:35,panY:-20},max=mapMaxZoom(1278,width,hex),a={x:50,y:30},b={x:150,y:30};
 const next=pinchMapViewport(v,a,b,{x:20,y:60},{x:320,y:60},max);assert.equal(next.zoom,2.7);assert(Math.abs((170-next.panX)/next.zoom-(100-v.panX)/v.zoom)<1e-12);
});
test('live diagnostics distinguish paused checkpoint from progressing CPU and retain no unfinished completion',async()=>{
 let units=0;const p=new ProgressiveTerrain(async(lod,control)=>{await runTerrainWork('005-live',(function*(){for(let i=0;i<30;i++){const end=performance.now()+1;while(performance.now()<end){}units++;yield;}})(),control);return lod;},()=>{},()=>{});
 const result=p.request('close');await tick();p.pause();await tick();
 const a=terrainBuildDiagnosticReport(),n=units;assert.equal(a.pipeline.active,false);assert.equal(a.pipeline.running,'close');assert.equal(a.pipeline.lods.close.status,'building');assert(a.active.some(w=>w.stage==='005-live'&&w.lod==='close'&&w.state==='checkpoint'));
 await tick();assert.equal(units,n);assert.equal(terrainBuildDiagnosticReport().active.find(w=>w.stage==='005-live').steps,a.active.find(w=>w.stage==='005-live').steps);
 p.resume();assert.equal(await result,'close');assert.equal(units,30);const done=terrainBuildDiagnosticReport();assert.deepEqual(done.pipeline.ready,['close']);assert.equal(done.pipeline.lods.close.status,'complete');assert(!done.active.some(w=>w.stage==='005-live'));p.dispose();assert(done.pipeline.lods.close.startedAt>=done.pipeline.lods.close.queuedAt);
});
test('diagnostics remain bounded and cancellation records failure without holding a surface',async()=>{
 for(let i=0;i<20;i++)await runTerrainWork('005-bounded',(function*(){yield;return 1;})());assert.equal(terrainBuildDiagnosticReport().recent.length,12);
 let released=0;const p=new ProgressiveTerrain(async(lod,control)=>{await runTerrainWork('005-cancel',(function*(){for(let i=0;i<1000;i++){const end=performance.now()+.5;while(performance.now()<end){}yield;}})(),control);return lod;},()=>{},()=>released++);
 const result=p.request('far');await tick();p.dispose();await assert.rejects(result,/disposed/);await tick();const d=terrainBuildDiagnosticReport();assert.equal(d.pipeline.disposed,true);assert.equal(d.active.length,0);assert(d.recent.some(w=>w.stage==='005-cancel'&&w.state==='failed-or-cancelled'));assert.equal(released,0);
});

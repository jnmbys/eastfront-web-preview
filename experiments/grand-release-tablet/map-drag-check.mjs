// Real viewport binding + gesture math in a deterministic event/clock adapter.
// This checks work scheduling and inputs, NOT browser compositing FPS or tablet hardware.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {execFileSync} from 'node:child_process';

const current=fs.readFileSync('src/main.ts','utf8');
const old=execFileSync('git',['show','41717e8:src/main.ts'],{encoding:'utf8'});
const compile=s=>ts.transpileModule(s.replaceAll('export ',''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
function harness(source){
 let now=0,seq=0;const jobs=new Map(),listeners=new Map(),captures=new Set();
 const counts={city:0,battle:0,industry:0,terrain:0,statePaint:0,commands:0,transforms:0,layoutReads:0};
 const later=(fn,delay=0)=>{const id=++seq;jobs.set(id,{fn,time:now+delay});return id;};
 const advance=ms=>{const end=now+ms;let n=0;while(true){const next=[...jobs].sort((a,b)=>a[1].time-b[1].time||a[0]-b[0])[0];if(!next||next[1].time>end)break;assert.ok(n++<10000,'No scheduling loop');now=next[1].time;jobs.delete(next[0]);next[1].fn();}now=end;};
 const style=()=>{let transform='';return {setProperty(){},get transform(){return transform;},set transform(v){if(v!==transform)counts.transforms++;transform=v;}};};
 const svg={style:style()},terrain={style:style()},wrap={style:style(),dataset:{},classList:{toggle(){}},getBoundingClientRect(){counts.layoutReads++;return {left:0,top:0,width:1024,height:768};},addEventListener(k,f){listeners.set(k,[...(listeners.get(k)??[]),f]);},setPointerCapture(id){captures.add(id);},hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id)};
 const windowEvents=new Map();const context=vm.createContext({window:{addEventListener:(k,f)=>windowEvents.set(k,f),removeEventListener:k=>windowEvents.delete(k)},document:{querySelector:s=>({'#map-wrap':wrap,'#eastfront-map':svg,'#terrain-surface':terrain}[s]??null)},mapViewport:{panX:0,panY:0,zoom:2},grandArt:true,grandPort:{continuous:true,data:{continuous:{map:{}}}},grandPaintPending:false,grandPressedPointers:new Set(),
 setTimeout:later,clearTimeout:id=>jobs.delete(id),requestAnimationFrame:fn=>later(fn,16),cancelAnimationFrame:id=>jobs.delete(id),ResizeObserver:class {observe(){} disconnect(){}},
 scheduleCityArt:()=>counts.city++,refreshBattleMapViewport:()=>counts.battle++,refreshIndustryViewport:()=>counts.industry++,mountCachedTerrainSurface:()=>counts.terrain++,setCityArtInteracting:()=>{},
 bindPlanDrawing:()=>{},refreshDynamicView:()=>counts.statePaint++,handleGrandMapCommand:()=>counts.commands++});
 vm.runInContext(compile(fs.readFileSync('src/interaction/viewportWork.ts','utf8'))+compile(fs.readFileSync('src/web/mapInteraction.ts','utf8').replace(/^import .*$/mg,''))+compile(source.slice(source.indexOf('function applyMapViewport()'),source.indexOf('function handleGrandMapCommand(')))+';bindMapViewport();',context);
 advance(250);for(const k of Object.keys(counts))counts[k]=0;
 const event=(kind,x,y,id=1)=>{const e={button:0,pointerId:id,clientX:x,clientY:y,deltaY:-1,preventDefault(){this.prevented=true;},stopPropagation(){},stopImmediatePropagation(){}};for(const f of listeners.get(kind)??[])f(e);return e;};
 return {context,counts,event,advance,wrap,svg,terrain,jobs,windowEvents};
}
function pan(source){const h=harness(source);h.event('pointerdown',200,200);for(let i=1;i<=120;i++){h.event('pointermove',200+i,200+i/2);h.advance(16);}const during={...h.counts};h.event('pointerup',320,260);h.advance(200);assert.equal(h.context.mapViewport.panX,120);assert.equal(h.context.mapViewport.panY,60);assert.equal(h.svg.style.transform,h.terrain.style.transform);assert.equal(h.event('click',320,260).prevented,true);assert.equal(h.counts.commands,0);return {during,after:{...h.counts}};}
const baseline=pan(old),candidate=pan(current);
assert.ok(baseline.during.battle>50);
assert.equal(candidate.during.city,0);assert.equal(candidate.during.battle,0);assert.equal(candidate.during.industry,0);assert.equal(candidate.during.layoutReads,0);
assert.equal(candidate.after.city,1);assert.equal(candidate.after.industry,1);assert.equal(candidate.after.battle,0,'Pure translation needs no battle/force regroup');

// Pinch events coalesce to one viewport application per animation frame; final
// endpoint is flushed before removing pointers. Pinch/drag cannot submit a tap.
const pinch=harness(current);pinch.event('pointerdown',200,200,1);pinch.event('pointerdown',300,200,2);
for(let i=1;i<=50;i++)pinch.event('pointermove',300+i,200,2);
assert.equal(pinch.counts.transforms,0);pinch.advance(16);assert.equal(pinch.counts.transforms,2);
pinch.event('pointerup',350,200,2);pinch.event('pointerup',200,200,1);pinch.advance(200);
assert.equal(pinch.context.mapViewport.zoom,3);assert.equal(pinch.counts.battle,1);assert.equal(pinch.counts.terrain,1);assert.equal(pinch.event('click',200,200).prevented,true);

// Wheel bursts postpone expensive work, preserve focus and converge to latest zoom.
const wheel=harness(current);for(let i=0;i<20;i++){wheel.event('wheel',500,300);wheel.advance(16);}
assert.equal(wheel.counts.battle,0);wheel.advance(200);assert.equal(wheel.counts.battle,1);

// A push arriving while held is not replayed step by step after release: one
// latest-state presentation supersedes deferred viewport painters.
const push=harness(current);push.event('pointerdown',100,100);push.event('pointermove',160,120);push.advance(16);push.context.grandPaintPending=true;push.event('pointerup',160,120);push.advance(200);assert.equal(push.counts.statePaint,1);assert.equal(push.counts.city,0);assert.equal(push.context.grandPaintPending,false);
const cancel=harness(current);cancel.event('pointerdown',100,100);cancel.event('pointermove',160,120);cancel.advance(16);cancel.event('pointercancel',160,120);cancel.advance(200);assert.equal(cancel.jobs.size,0);assert.equal(cancel.event('click',160,120).prevented,true);assert.equal(cancel.counts.commands,0);
const blur=harness(current);blur.event('pointerdown',100,100);blur.event('pointermove',160,120);blur.advance(16);blur.windowEvents.get('blur')();blur.advance(200);blur.event('pointerdown',200,200,3);blur.event('pointerup',200,200,3);blur.event('click',200,200,3);assert.equal(blur.counts.commands,1,'Lost window focus cannot leave a phantom pinch');
const tap=harness(current);tap.event('pointerdown',200,200);tap.event('pointerup',200,200);tap.event('click',200,200);tap.advance(200);assert.equal(tap.counts.commands,1);
const dispose=harness(current);dispose.event('wheel',500,300);vm.runInContext('releaseMapViewport()',dispose.context);dispose.advance(300);assert.equal(dispose.counts.city,0);assert.equal(dispose.jobs.size,0);

console.log(JSON.stringify({kind:'Deterministic event adapter; not browser FPS',baseline,candidate,checks:'pan, pinch coalescing, wheel idle, push coalescing, cancellation, click, dispose PASS'},null,2));

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as interaction from '../dist/app/web/mapInteraction.js';
const source=readFileSync(new URL('../dist/app/main.js',import.meta.url),'utf8');
function harness(initial={zoom:1.5,panX:70,panY:-40}) {
 const handlers={},frames=new Map(),captures=new Set();let serial=0;
 const wrap={dataset:{},getBoundingClientRect:()=>({left:0,top:0,width:800,height:600}),addEventListener:(t,f)=>handlers[t]=f,setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id)};
 const elements={'#map-wrap':wrap,'#eastfront-map':{style:{}},'#terrain-surface':{style:{}},'#zoom-readout':{}};
 const ctx=vm.createContext({...interaction,mapViewport:{...initial},document:{querySelector:s=>elements[s]},requestAnimationFrame:f=>{frames.set(++serial,f);return serial;},cancelAnimationFrame:id=>frames.delete(id)});
 vm.runInContext(source.slice(source.indexOf('function applyMapViewport()'),source.indexOf('function mapRenderOptions(')),ctx);
 ctx.bindMapViewport();
 const fire=(type,x=100,y=100,id=1,extra={})=>{const e={clientX:x,clientY:y,pointerId:id,button:0,preventDefault(){this.prevented=true;},stopPropagation(){},stopImmediatePropagation(){this.stopped=true;},...extra};handlers[type](e);return e;};
 return {ctx,elements,fire,captures,flush(){for(const f of frames.values())f();frames.clear();},view:()=>JSON.parse(JSON.stringify(ctx.mapViewport))};
}
test('remount and dynamic refresh preserve x/y/zoom and align surface with SVG',()=>{
 const h=harness(),before=h.view();
 for(let i=0;i<5;i++){h.elements['#eastfront-map']={style:{}};h.ctx.bindMapViewport();h.ctx.applyMapViewport();assert.deepEqual(h.view(),before);assert.equal(h.elements['#eastfront-map'].style.transform,h.elements['#terrain-surface'].style.transform);}
});
test('mouse and single touch pan preserve tap arbitration; next tap is not swallowed',()=>{
 for(const pointerType of ['mouse','touch']){
 const h=harness();h.fire('pointerdown',100,100,1,{pointerType});assert.equal(h.captures.size,0);
 h.fire('pointermove',104,100);h.fire('pointerup',104,100);assert.equal(h.fire('click').stopped,undefined);
 h.fire('pointerdown');h.fire('pointermove',140,120);h.flush();h.fire('pointerup',140,120);assert.deepEqual(h.view(),{zoom:1.5,panX:110,panY:-20});assert.equal(h.fire('click').stopped,true);
 h.fire('pointerdown');h.fire('pointerup');assert.equal(h.fire('click').stopped,undefined);
 }
});
test('pinch keeps its world focus beneath moving midpoint, suppresses counter click, and resumes pan',()=>{
 const h=harness({zoom:1,panX:0,panY:0});h.fire('pointerdown',400,300,1);h.fire('pointerdown',500,300,2);
 const move=h.fire('pointermove',600,300,2);assert.equal(move.prevented,true);assert.deepEqual(h.view(),{zoom:2,panX:0,panY:0});
 h.fire('pointerup',600,300,2);const before=h.view();h.fire('pointermove',420,310,1);h.flush();assert.equal(h.view().panX,before.panX+20);assert.equal(h.view().panY,before.panY+10);h.fire('pointerup',420,310,1);assert.equal(h.fire('click').stopped,true);
});
test('wheel zoom anchors at cursor without remount; zoom limits never reset translation',()=>{
 const h=harness(),before=h.view(),svg=h.elements['#eastfront-map'];const e=h.fire('wheel',600,400,1,{deltaY:-10});assert.equal(e.prevented,true);
 const after=h.view();assert(Math.abs((200-before.panX)/before.zoom-(200-after.panX)/after.zoom)<1e-9);assert.equal(h.elements['#eastfront-map'],svg);
 assert.deepEqual(interaction.zoomMapAt({zoom:1,panX:55,panY:20},.5,{x:90,y:40}),{zoom:1,panX:55,panY:20});
});
test('pinch cancellation and third finger removal leave no stale pointer or tap suppression',()=>{
 const h=harness();h.fire('pointerdown',100,100,1);h.fire('pointerdown',200,100,2);h.fire('pointerdown',300,100,3);h.fire('pointercancel',300,100,3);h.fire('pointercancel',200,100,2);h.fire('pointercancel',100,100,1);const view=h.view();h.fire('pointermove',800,800,2);assert.deepEqual(h.view(),view);assert.equal(h.captures.size,0);h.fire('pointerdown');h.fire('pointerup');assert.equal(h.fire('click').stopped,undefined);
});
test('off-centre pinch math preserves anchor at clamped zoom and handles coincident fingers',()=>{
 const v={zoom:2,panX:35,panY:-20},a={x:50,y:30},b={x:150,y:30};const next=interaction.pinchMapViewport(v,a,b,{x:20,y:60},{x:320,y:60});assert.equal(next.zoom,2.5);assert.equal((170-next.panX)/next.zoom,(100-v.panX)/v.zoom);assert.equal((60-next.panY)/next.zoom,(30-v.panY)/v.zoom);
 assert(Object.values(interaction.pinchMapViewport(v,a,a,a,a)).every(Number.isFinite));
});

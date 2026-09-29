import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function harness(){
 const listeners={},frames=[];let now=100;
 class Element{constructor(button=null,map=false){this.button=button;this.map=map;}closest(selector){return selector==='button'?(this.button?{id:this.button}:null):this.map?{}:null;}}
 const document={visibilityState:'visible',addEventListener:(type,fn)=>listeners[type]=fn};
 const context=vm.createContext({performance:{now:()=>now,timeOrigin:100000},document,Element,requestAnimationFrame:fn=>frames.push(fn),structuredClone});
 vm.runInContext(readFileSync('.ai003-dist/src/local-ai/performance.js','utf8').replace('export const perf006','const perf006')+'\nthis.probe=perf006',context);
 const p=context.probe;p.start(true);
 return {p,frames,document,setNow:n=>now=n,visibility:value=>{document.visibilityState=value;listeners.visibilitychange();},
  emit:(type,stamp=99,button='zoom-in',buttons=0,map=false)=>listeners[type]?.({target:new Element(button,map),timeStamp:stamp,isTrusted:true,buttons}),
  frame:(n)=>{now=n;frames.shift()(n-2);}};
}
test('PERF007 hover/up are not zoom intent; same-frame clicks keep separate event pairs',()=>{
 const h=harness();h.emit('pointermove');h.emit('pointerup');assert.equal(h.p.report().inputs.length,0);
 h.emit('click',98);h.setNow(105);h.emit('click',104);assert.equal(h.frames.length,1);h.frame(116);
 const [a,b]=h.p.report().inputs;assert.equal(a.timestampToCaptureMs,2);assert.equal(b.timestampToCaptureMs,1);
 assert.equal(a.captureToRafCallbackMs,16);assert.equal(b.captureToRafCallbackMs,11);assert.equal(a.rafTimeStamp,114);
 assert.equal(a.handlerCompletion,'unmeasured');assert.notEqual(a.id,b.id);
});
test('PERF007 1000ms delayed RAF remains callback evidence, including intervening hidden state',()=>{
 const h=harness();h.emit('click');h.visibility('hidden');h.visibility('visible');h.frame(1100);
 const s=h.p.report().inputs[0];assert.equal(s.captureToRafCallbackMs,1000);assert.equal(s.visibilityChanged,true);
 assert.equal(s.visibilityAtRAF,'visible');assert.equal(s.handlerCompletion,'unmeasured');assert(!('presentationMs' in s));
});
test('PERF007 timestamp-domain anomalies retained, map gestures separated from unrelated wheel/hover',()=>{
 const h=harness();h.emit('wheel',99,null,0,false);h.emit('pointermove',99,null,0,true);assert.equal(h.p.report().inputs.length,0);
 h.emit('wheel',100099,null,0,true);h.emit('pointermove',80,null,1,true);h.frame(120);
 const [wheel,drag]=h.p.report().inputs;assert.equal(wheel.timestampToCaptureMs,null);assert.equal(wheel.eventTimeStamp,100099);
 assert.equal(drag.name,'drag');assert.equal(drag.timestampToCaptureMs,20);
});
test('PERF007 bounded pending samples expose drops; stopped and old-generation callbacks cannot pollute restart',()=>{
 const h=harness();for(let i=0;i<40;i++)h.emit('click');assert.equal(h.p.report().inputs.length,32);assert.equal(h.p.report().droppedInputs,8);
 h.p.stop();assert(h.p.report().inputs.every(x=>x.status==='stopped'));const stopped=JSON.stringify(h.p.report());h.frame(1100);assert.equal(JSON.stringify(h.p.report()),stopped);
 h.p.start(true);h.emit('click');h.p.stop();h.p.start(true);h.emit('click');h.frame(1200);assert.equal(h.p.report().inputs[0].status,'pending');h.frame(1216);assert.equal(h.p.report().inputs[0].status,'raf');
 for(let i=0;i<150;i++){h.emit('click');h.frame(1300+i);}assert.equal(h.p.report().inputs.length,128);
 h.p.start(false);h.emit('click');assert.equal(h.p.report().inputs.length,0);assert.equal(h.frames.length,0);
});

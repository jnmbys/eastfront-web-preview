import test from 'node:test';
import assert from 'node:assert/strict';
import {consumeTerrainImages,TerrainImageReuse} from '../dist/app/render/terrainImagePipeline.js';
import {ProgressiveTerrain} from '../dist/app/render/progressiveTerrain.js';
import {loadTerrainImage,fetchTerrainBlobWithAbort} from '../dist/app/render/terrainSurface.js';
import {checkTerrainAbort} from '../dist/app/render/terrainWork.js';
const tick=()=>new Promise(r=>setTimeout(r,5));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
test('STARTUP003 cancellation accepts older AbortSignals without reason or throwIfAborted',()=>{
 checkTerrainAbort({aborted:false});assert.throws(()=>checkTerrainAbort({aborted:true}),{name:'AbortError'});
});

test('STARTUP003 slow head bounds started and resident images; consumption stays ordered',async()=>{
 const gates=[deferred(),deferred(),deferred(),deferred()],started=[],drawn=[],released=[];
 const run=consumeTerrainImages(['a','b','c','d'],id=>{started.push(id);return gates['abcd'.indexOf(id)].promise;},id=>drawn.push(id),undefined,2);
 const image=id=>({source:{},width:1,height:1,release:()=>released.push(id)});
 await tick();assert.deepEqual(started,['a','b']);gates[1].resolve(image('b'));await tick();assert.deepEqual(started,['a','b']);assert.deepEqual(drawn,[]);
 gates[0].resolve(image('a'));await tick();assert.deepEqual(drawn,['a','b']);assert.deepEqual(started,['a','b','c','d']);
 gates[3].resolve(image('d'));gates[2].resolve(image('c'));await run;assert.deepEqual(drawn,['a','b','c','d']);assert.deepEqual(released,drawn);
});
test('STARTUP003 rejected lookahead is handled and all completed images released on draw failure',async()=>{
 const released=[];
 await assert.rejects(consumeTerrainImages(['a','b'],async id=>({source:{},width:1,height:1,release:()=>released.push(id)}),()=>{throw Error('draw');},undefined,2),/draw/);
 assert.deepEqual(released.sort(),['a','b']);
 await assert.rejects(consumeTerrainImages(['a','b'],async id=>{if(id==='b')throw Error('fetch');await tick();return {source:{},width:1,height:1,release(){}};},()=>{},undefined,2),/fetch/);
});
test('STARTUP003 pause, cancellation, fresh rebuild and LOD switches release owned images',async()=>{
 let live=0,peak=0;const drawn=[],surfaces=[];
 const pipeline=()=>new ProgressiveTerrain(async(lod,control)=>{
  await consumeTerrainImages(['a','b','c'],(_id,signal)=>new Promise((resolve,reject)=>{
   const abort=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(signal.reason);};
   const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);peak=Math.max(peak,++live);resolve({source:{},width:1,height:1,release(){live--;}});},10);
   signal.addEventListener('abort',abort,{once:true});
  }),id=>drawn.push(lod+id),control,2);return {lod};
 },()=>{},s=>surfaces.push(s.lod));
 const old=pipeline();old.pause();const waiting=old.request('far');await tick();assert.equal(live,0);old.resume();await tick();const rejected=assert.rejects(waiting,/disposed/);old.dispose();await rejected;await tick();assert.equal(live,0);assert.equal(drawn.length,0);
 const fresh=pipeline();await fresh.request('far');await fresh.request('close');await fresh.request('medium');assert.equal(fresh.ready.size,3);assert.equal(live,0);assert(peak<=2);fresh.dispose();assert.equal(surfaces.length,3);
});
test('STARTUP003 infrastructure reuse evicts before loading and never retains a failure',async()=>{
 let live=0,peak=0,calls=0,fail=true;const cache=new TerrainImageReuse(async id=>{calls++;if(id==='bad'&&fail){fail=false;throw Error('retry');}peak=Math.max(peak,++live);return {source:{},width:1,height:1,release(){live--;}};});
 await cache.get('a');await cache.get('b');await cache.get('a');assert.equal(calls,2);await cache.get('c');await cache.get('d');assert.equal(peak,3);await assert.rejects(cache.get('bad'),/retry/);await cache.get('bad');cache.dispose();assert.equal(live,0);
});
const entry={id:'a',family:'ground',file:'a.webp'},caps={createImageBitmap:true,offscreenCanvas:false,htmlImageDecode:false,canvas2d:true};
test('STARTUP003 abort during direct image clears handlers/src and does not start recovery',async t=>{
 const previous={Image:globalThis.Image,fetch:globalThis.fetch};let image,fetches=0;
 globalThis.Image=class{constructor(){image=this;}set src(v){this.url=v;}get src(){return this.url;}};globalThis.fetch=async()=>{fetches++;throw Error('unexpected');};t.after(()=>Object.assign(globalThis,previous));
 const c=new AbortController(),job=loadTerrainImage(entry,'p5',caps,'https://example.test/a.webp',undefined,c.signal);const rejected=assert.rejects(job,{name:'AbortError'});c.abort();await rejected;assert.equal(image.src,'');assert.equal(image.onload,null);assert.equal(image.onerror,null);assert.equal(fetches,0);
});
test('STARTUP003 abort during ignored-abort fetch discards late headers/body',async t=>{
 const previous=globalThis.fetch,gate=deferred();let cancelled=0,body=0;globalThis.fetch=()=>gate.promise;t.after(()=>globalThis.fetch=previous);
 const c=new AbortController(),job=fetchTerrainBlobWithAbort('https://example.test/a.webp',entry,caps,10000,c.signal);const rejected=assert.rejects(job,{name:'AbortError'});c.abort();await rejected;gate.resolve({body:{cancel(){cancelled++;}},ok:true,blob(){body++;}});await tick();assert.equal(cancelled,1);assert.equal(body,0);
});
test('STARTUP003 abort during bitmap decode closes late bitmap without blob fallback',async t=>{
 const previous={Image:globalThis.Image,fetch:globalThis.fetch,createImageBitmap:globalThis.createImageBitmap};const gate=deferred();let bitmaps=0,closed=0,images=0;
 globalThis.Image=class{constructor(){images++;}set src(v){if(v)queueMicrotask(()=>this.onerror?.());}};
 globalThis.fetch=async()=>({ok:true,status:200,blob:async()=>new Blob(['x'])});globalThis.createImageBitmap=()=>{bitmaps++;return gate.promise;};t.after(()=>Object.assign(globalThis,previous));
 const c=new AbortController(),job=loadTerrainImage(entry,'p5',caps,'https://example.test/a.webp',undefined,c.signal);const rejected=assert.rejects(job,{name:'AbortError'});await tick();assert.equal(bitmaps,1);c.abort();await rejected;gate.resolve({width:1,height:1,close(){closed++;}});await tick();assert.equal(closed,1);assert.equal(images,1);
});
test('STARTUP003 timed-out native bitmaps keep their slots; blob fallback remains usable and late results close',async t=>{
 const previous={Image:globalThis.Image,fetch:globalThis.fetch,createImageBitmap:globalThis.createImageBitmap};const gates=[];let closed=0;
 globalThis.Image=class{naturalWidth=8;naturalHeight=8;set src(v){if(v)queueMicrotask(()=>v.startsWith('blob:')?this.onload?.():this.onerror?.());}};
 globalThis.fetch=async()=>({ok:true,status:200,blob:async()=>new Blob(['x'])});globalThis.createImageBitmap=()=>{const g=deferred();gates.push(g);return g.promise;};t.after(()=>Object.assign(globalThis,previous));
 const policy={resourceTimeoutMs:50,bitmapTimeoutMs:2,webkitFallback:false};
 for(let i=0;i<5;i++){const image=await loadTerrainImage(entry,'p5',caps,'https://example.test/a.webp',policy);image.release();}
 assert.equal(gates.length,2,'late native decodes cannot accumulate with later resource jobs');
 gates.forEach(g=>g.resolve({width:8,height:8,close(){closed++;}}));await tick();assert.equal(closed,2);
 globalThis.createImageBitmap=async()=>({width:8,height:8,close(){closed++;}});
 const next=await loadTerrainImage(entry,'p5',caps,'https://example.test/a.webp',policy);next.release();assert.equal(closed,3);
});

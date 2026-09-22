import test from 'node:test';
import assert from 'node:assert/strict';
import {imageFromUrl,loadTerrainImage,terrainImageLoadPolicy,TerrainSurfaceResourceError} from '../dist/app/render/terrainSurface.js';
import {observeTerrainLoad} from '../dist/app/render/terrainLoadProgress.js';

const entry={id:'VS2_MARSH_WET_GROUND',family:'marsh',file:'marsh.png'};
const caps={createImageBitmap:true,offscreenCanvas:false,htmlImageDecode:true,canvas2d:true};
const url='https://example.test/eastfront/marsh.png';
const safari=terrainImageLoadPolicy('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15');
const chrome=terrainImageLoadPolicy('Mozilla/5.0 AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36');
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};

function environment(t,{src,decode,fetch,bitmap,draw}={}){
  const previous=Object.fromEntries(['Image','document','fetch','createImageBitmap'].map(key=>[key,globalThis[key]]));
  const images=[],canvases=[],trace=[],events=[],revoked=[];
  class Image {
    naturalWidth=0;naturalHeight=0;width=0;height=0;complete=false;onload=null;onerror=null;decoding='';
    set src(value){this.url=value;if(!value)return;trace.push(value.startsWith('blob:')?'blob-image':'direct-image');src?.(this,value);}
    get src(){return this.url;}
    constructor(){images.push(this);}
    decode(){trace.push('decode');return decode?.(this)??new Promise(()=>{});}
  }
  globalThis.Image=Image;
  globalThis.document={baseURI:'https://example.test/eastfront/',createElement(tag){
    assert.equal(tag,'canvas');
    const canvas={width:0,height:0,getContext(){return {drawImage(image){trace.push('canvas');assert(image.naturalWidth>0);draw?.(image);}};}};
    canvases.push(canvas);return canvas;
  }};
  globalThis.fetch=async(...args)=>{trace.push('fetch');return fetch?fetch(...args):{ok:true,status:200,blob:async()=>new Blob(['pixels'])};};
  globalThis.createImageBitmap=(...args)=>{trace.push('bitmap');return bitmap?bitmap(...args):Promise.reject(new Error('bitmap unavailable'));};
  const revoke=URL.revokeObjectURL;
  URL.revokeObjectURL=value=>{revoked.push(value);revoke(value);};
  const off=observeTerrainLoad(event=>events.push(event));
  t.after(()=>{off();Object.assign(globalThis,previous);URL.revokeObjectURL=revoke;});
  return {images,canvases,trace,events,revoked};
}
function ready(image){image.naturalWidth=16;image.naturalHeight=8;image.complete=true;}
function loaded(image){ready(image);image.onload?.();}

test('Safari/iPad/WebKit policy is bounded; desktop Chrome/Android keep their existing budget',()=>{
  assert.deepEqual(chrome,{resourceTimeoutMs:15000,bitmapTimeoutMs:15000,webkitFallback:false});
  assert.deepEqual(safari,{resourceTimeoutMs:60000,bitmapTimeoutMs:1500,webkitFallback:true});
  for(const ua of [
    'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) AppleWebKit/605.1.15 CriOS/140.0 Mobile/15E148 Safari/604.1',
  ])assert.equal(terrainImageLoadPolicy(ua).webkitFallback,true);
  for(const ua of ['', 'Mozilla/5.0 Firefox/140', 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36'])assert.equal(terrainImageLoadPolicy(ua).webkitFallback,false);
});

test('Chrome success stays direct-image first: no decode/fetch/bitmap/Canvas fallback',async t=>{
  const env=environment(t,{src:image=>queueMicrotask(()=>loaded(image))});
  const image=await loadTerrainImage(entry,'p5',caps,url,chrome);
  assert.equal(image.source,env.images[0]);assert.deepEqual(env.trace,['direct-image']);
  assert.equal(env.events.filter(e=>e.kind==='asset-complete').length,1);
});

test('Safari decode can complete when no load event is delivered',async t=>{
  const env=environment(t,{decode:async image=>ready(image)});
  const image=await loadTerrainImage(entry,'p5',caps,url,safari);
  assert.equal(image.source,env.images[0]);assert.equal(image.width,16);
  assert.deepEqual(env.trace,['direct-image','decode']);
  image.release();assert.equal(env.images[0].src,'');
});

for(const mode of ['reject','hang','absent'])test(`Safari ${mode} decode still loads via onload/Canvas`,async t=>{
  const env=environment(t,{src:image=>setTimeout(()=>loaded(image),5),decode:()=>mode==='reject'?Promise.reject(new Error('EncodingError')):new Promise(()=>{})});
  const image=await loadTerrainImage(entry,'p5',{...caps,htmlImageDecode:mode!=='absent'},url,safari);
  assert.equal(image.source,env.canvases[0]);assert.equal(image.width,16);assert.equal(image.height,8);
  assert(!env.trace.includes('fetch'));assert(!env.trace.includes('bitmap'));
  assert.equal(env.images[0].src,'');image.release();assert.equal(env.canvases[0].width,0);
  assert.equal(env.events.filter(e=>e.kind==='asset-complete').length,1);
});

test('Safari cached complete image does not depend on another load event',async t=>{
  const env=environment(t,{src:ready});
  const image=await imageFromUrl(url,entry,'direct-image-load',caps,50,true);
  assert.equal(image.source,env.canvases[0]);image.release();
});

test('Safari slow first decode can pass 15 seconds without being misclassified as timeout',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  let finishDecode;
  const env=environment(t,{decode:()=>new Promise(resolve=>{finishDecode=resolve;})});
  let settled=false;
  const pending=imageFromUrl(url,entry,'direct-image-load',caps,safari.resourceTimeoutMs,true).then(image=>{settled=true;return image;});
  await flush();t.mock.timers.tick(15001);await flush();assert.equal(settled,false);
  t.mock.timers.tick(29999);ready(env.images[0]);finishDecode();
  const image=await pending;assert.equal(image.width,16);image.release();
  t.mock.timers.tick(60000);assert.equal(settled,true);
});

test('Safari deadline recovers complete pixels when both load and decode signals stall',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const env=environment(t);
  const pending=imageFromUrl(url,entry,'direct-image-load',caps,60,true);
  await flush();ready(env.images[0]);t.mock.timers.tick(60);
  const image=await pending;assert.equal(image.source,env.canvases[0]);image.release();
});

test('broken complete image is rejected, cancelled and cannot report a late success',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  let finishDecode;
  const env=environment(t,{src:image=>{image.complete=true;},decode:()=>new Promise(resolve=>{finishDecode=resolve;})});
  const pending=imageFromUrl(url,entry,'direct-image-load',caps,60,true);
  const rejected=assert.rejects(pending,error=>error instanceof TerrainSurfaceResourceError&&error.details.stage==='timeout'&&error.details.assetId===entry.id&&error.details.url===url);
  await flush();t.mock.timers.tick(60);await rejected;
  assert.equal(env.images[0].src,'');assert.equal(env.images[0].onload,null);assert.equal(env.images[0].onerror,null);
  ready(env.images[0]);finishDecode();await flush();assert.equal(env.canvases.length,0);
});

test('Safari Canvas failure can still resolve through decode without blank texture success',async t=>{
  let completeDecode;
  const env=environment(t,{src:image=>setTimeout(()=>loaded(image),1),decode:()=>new Promise(resolve=>{completeDecode=resolve;}),draw:()=>{throw new Error('Canvas unavailable');}});
  const pending=imageFromUrl(url,entry,'direct-image-load',caps,200,true);
  await new Promise(resolve=>setTimeout(resolve,10));completeDecode();
  const image=await pending;assert.equal(image.source,env.images[0]);assert.equal(env.canvases[0].width,0);image.release();
});

test('bitmap rejection falls back to blob image decode and revokes URL after use',async t=>{
  const env=environment(t,{src:(image,value)=>{if(!value.startsWith('blob:'))queueMicrotask(()=>image.onerror?.());},decode:async image=>{if(image.src.startsWith('blob:'))ready(image);else throw new Error('network failed');}});
  const image=await loadTerrainImage(entry,'p5',caps,url,safari);
  assert(env.trace.includes('bitmap'));assert(env.trace.includes('blob-image'));
  assert.equal(image.source,env.images[1]);assert.equal(env.revoked.length,1);
  assert.equal(env.events.filter(e=>e.kind==='asset-complete').length,1);image.release();
});

test('slow bitmap times out to blob/Canvas; a late bitmap is closed and never counted twice',async t=>{
  let resolveBitmap,closed=0;
  const env=environment(t,{src:(image,value)=>queueMicrotask(()=>value.startsWith('blob:')?loaded(image):image.onerror?.()),bitmap:()=>new Promise(resolve=>{resolveBitmap=resolve;})});
  const image=await loadTerrainImage(entry,'p5',caps,url,{...safari,resourceTimeoutMs:200,bitmapTimeoutMs:5});
  assert.equal(image.source,env.canvases[0]);assert.equal(env.revoked.length,1);
  resolveBitmap({width:16,height:8,close(){closed++;}});await flush();
  assert.equal(closed,1);assert.equal(env.events.filter(e=>e.kind==='asset-complete').length,1);image.release();
});

test('successful Chrome bitmap fallback preserves ownership and does not leave its deadline timer',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});let closed=0;
  const env=environment(t,{src:image=>queueMicrotask(()=>image.onerror?.()),bitmap:async()=>({width:16,height:8,close(){closed++;}})});
  const image=await loadTerrainImage(entry,'p5',caps,url,chrome);
  assert.deepEqual(env.trace,['direct-image','fetch','bitmap']);
  t.mock.timers.tick(15001);await flush();assert.equal(closed,0);
  image.release();assert.equal(closed,1);
});

test('Safari simultaneous preload requests run one at a time and failure does not poison queue',async t=>{
  let active=0,peak=0;
  const env=environment(t,{src:(image,value)=>{
    active++;peak=Math.max(peak,active);
    setTimeout(()=>{active--;if(value.endsWith('bad.png'))image.onerror?.();else loaded(image);},5);
  },fetch:async()=>({ok:false,status:404})});
  const result=await Promise.allSettled(['first.png','bad.png','last.png'].map(file=>loadTerrainImage({...entry,file},'p5',caps,`https://example.test/${file}`,safari)));
  assert.equal(peak,1);assert.equal(active,0);
  assert.deepEqual(result.map(r=>r.status),['fulfilled','rejected','fulfilled']);
  assert.equal(result[1].reason.details.httpStatus,404);assert.equal(result[1].reason.details.url,'https://example.test/bad.png');
  assert.equal(env.events.filter(e=>e.kind==='asset-complete').length,2);
  for(const r of result)if(r.status==='fulfilled')r.value.release();
});

test('Safari queued request budget begins after prior load, not at enqueue time',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const env=environment(t,{decode:()=>new Promise(()=>{})});
  const policy={...safari,resourceTimeoutMs:50};
  const first=loadTerrainImage(entry,'p5',caps,url,policy),second=loadTerrainImage(entry,'p5',caps,url,policy);
  await flush();t.mock.timers.tick(0);await flush();assert.equal(env.images.length,1);
  t.mock.timers.tick(40);loaded(env.images[0]);(await first).release();
  await flush();t.mock.timers.tick(0);await flush();assert.equal(env.images.length,2);
  t.mock.timers.tick(40);loaded(env.images[1]);(await second).release();
  assert.equal(env.events.filter(e=>e.kind==='asset-complete').length,2);
});

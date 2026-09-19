import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fetchTerrainBlobWithAbort,loadTerrainImage} from '../dist/app/render/terrainSurface.js';

const source=await readFile(new URL('../src/render/terrainSurface.ts',import.meta.url),'utf8');
const caps={createImageBitmap:false,offscreenCanvas:false,htmlImageDecode:false,canvas2d:true};
const entry={id:'M01',family:'marsh_wet',file:'marsh/wet/M01.png',minLod:'far',rotation:'none',mirror:false,tags:[]};

test('UI009R2D2 direct image URL is primary and succeeds without fetch',async()=>{
  const oldImage=globalThis.Image,oldDocument=globalThis.document,oldFetch=globalThis.fetch;
  let fetchCalls=0;
  class FakeImage{naturalWidth=64;naturalHeight=64;width=64;height=64;onload=null;onerror=null;decoding='';set src(v){this._src=v;if(v)queueMicrotask(()=>this.onload?.());}get src(){return this._src??'';}}
  globalThis.Image=FakeImage;globalThis.document={baseURI:'https://example.test/eastfront/'};globalThis.fetch=async()=>{fetchCalls++;throw new Error('fetch should not run');};
  try{const image=await loadTerrainImage(entry,'p5',caps);assert.equal(image.width,64);assert.equal(fetchCalls,0);}finally{globalThis.Image=oldImage;globalThis.document=oldDocument;globalThis.fetch=oldFetch;}
});

test('UI009R2D2 timed out fetch aborts underlying request before returning',async()=>{
  const oldFetch=globalThis.fetch;let active=0,aborted=0;
  globalThis.fetch=(_url,{signal}={})=>new Promise((_resolve,reject)=>{active++;const onAbort=()=>{aborted++;active--;const e=new Error('aborted');e.name='AbortError';reject(e);};signal?.addEventListener('abort',onAbort,{once:true});});
  try{let failure;try{await fetchTerrainBlobWithAbort('https://example.test/M01.png',entry,caps,5);}catch(error){failure=error;}assert(failure);assert.match(failure.details?.cause??'',/timed out after 5ms and was aborted/);assert.equal(aborted,1);assert.equal(active,0);}finally{globalThis.fetch=oldFetch;}
});

test('UI009R2D2 loader removes force-cache and only fetches after direct-image failure',()=>{
  assert.equal(source.includes("cache:'force-cache'"),false);
  assert(source.includes('new AbortController()'));
  assert(source.includes('controller.abort()'));
  const direct=source.indexOf("imageFromUrl(url,entry,'direct-image-load'");
  const secondary=source.indexOf('fetchTerrainBlobWithAbort(url,entry,capabilities)');
  assert(direct>=0&&secondary>direct,`direct=${direct} secondary=${secondary}`);
});

test('UI009R2D2 cached terrain surface lifecycle remains boot-time cached architecture',async()=>{
  const main=await readFile(new URL('../src/main.ts',import.meta.url),'utf8');
  assert.equal((main.match(/buildCachedTerrainSurface\(/g)||[]).length,1);
  assert(main.includes('staticTerrainSurface'));
});

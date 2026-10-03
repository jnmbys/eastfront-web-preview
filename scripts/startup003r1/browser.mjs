// Local, real-browser comparison of the production 640-hex terrain builder.
// No proxy, multiplayer server, external endpoint, or map-ready marker is used.
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const pw=require(process.env.PLAYWRIGHT_MODULE??'playwright');
const engine=process.argv[2]??'chromium';
const output=resolve(process.argv[3]??`evidence/startup-003-r1/${engine}.json`);
const baseline=resolve(process.env.STARTUP003_BASELINE??'../startup-003-load-pipeline/.startup003/baseline');
const pipeline=resolve(process.env.STARTUP003_PIPELINE??'../startup-003-load-pipeline/dist');
const candidate=resolve('dist');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const reports=[];let hits=[],active=0,peak=0,scenario='cold',root=baseline;
const instrument=code=>code.replace('const img = new Image();',`const img = new Image(); globalThis.__r1Event('image-create',{id:entry.id});`).replace('ctx.drawImage(img, 0, 0);',`ctx.drawImage(img, 0, 0); globalThis.__r1Event('canvas-copy',{id:entry.id,complete:img.complete,width:img.naturalWidth});`).replace('canvasFailure = error;',`canvasFailure = error; globalThis.__r1Event('canvas-reject',{id:entry.id,error:error.message});`).replace('img.onload = () => {',`img.onload = () => {globalThis.__r1Event('onload',{id:entry.id,complete:img.complete,width:img.naturalWidth});`).replace("img.src = '';",`globalThis.__r1Event('clear-src',{id:entry.id});img.src = '';`).replace('resolve(image);',`globalThis.__r1Event('image-ready',{id:entry.id,sourceKind:image.source.constructor.name});resolve(image);`).replace('export function loadTerrainImage(', 'function originalLoadTerrainImage(')+`
export async function loadTerrainImage(...args) {
 const t=globalThis.__terrainTrace, start=performance.now(),id=args[0].id;
 t.active++;t.peakActive=Math.max(t.peakActive,t.active);
 try {const image=await originalLoadTerrainImage(...args),loaded=performance.now();
  t.resident++;t.bytes+=image.width*image.height*4;t.peakResident=Math.max(t.peakResident,t.resident);t.peakBytes=Math.max(t.peakBytes,t.bytes);
  t.jobs.push({id,file:args[0].file,sourceKind:image.source.constructor.name,start,end:loaded,elapsedMs:loaded-start});const release=image.release;let released=false;
  image.release=()=>{if(released)throw Error('double release '+id);released=true;t.resident--;t.bytes-=image.width*image.height*4;release?.();};return image;
 }catch(e){t.failures++;throw e;}finally{t.active--;}
}
`;
const server=createServer(async(req,res)=>{
 try {
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/harness.html'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>STARTUP003 local terrain test</title><body></body>');return;}
  const path=resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!path.startsWith(root+sep))throw Error('path');
  let data=await readFile(path);const texture=/\/assets\/terrain\/vs2-002\/.*\.(webp|png)$/.test(url.pathname);
  if(texture){
   const hit={path:url.pathname,recovery:url.searchParams.has('terrain-recovery'),start:performance.now(),status:200};hits.push(hit);active++;peak=Math.max(peak,active);
   let finished=false;const finish=()=>{if(finished)return;finished=true;active--;hit.end=performance.now();};res.on('close',finish);res.on('finish',finish);
   await sleep(scenario==='cancel'?1000:scenario==='slow'||scenario==='uncached-slow'?250:scenario==='slow-head'?(url.pathname.endsWith('/grass.webp')?1800:80):0);
   if((scenario==='failure'||scenario==='blob-fallback')&&url.pathname.endsWith('/grass.webp')&&!hit.recovery){hit.status=503;res.writeHead(503);res.end('fixture direct failure');return;}
   if(scenario==='timeout'&&url.pathname.endsWith('/grass.webp')&&!hit.recovery)await sleep(15500);
  }
  if(url.pathname.endsWith('/render/terrainSurface.js'))data=instrument(data.toString());
  if(url.pathname.endsWith('/render/vs2TerrainSurface.js'))data=data.toString().replace('textures.set(id, {', 'globalThis.__r1Texture(textures,id, {');
  const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.webp':'image/webp','.png':'image/png'};
  res.writeHead(200,{'Content-Type':types[extname(path)]??'application/octet-stream','Cache-Control':texture&&scenario!=='uncached-slow'?'public,max-age=3600':'no-store'});res.end(data);
 }catch(e){res.writeHead(404);res.end('not found');}
});
await mkdir(resolve(output,'..'),{recursive:true});await writeFile(output,'{}\n',{flag:'wx'});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{args:['--disable-accelerated-2d-canvas','--disable-gpu'],...(process.env.STARTUP003_CHROMIUM?{executablePath:process.env.STARTUP003_CHROMIUM}:{})}:{})});
try {
 for(const label of (process.env.STARTUP003_LABELS?.split(',')??['original','pipeline','pipeline-serial','r1','r1-serial'])){
  root=label==='original'?baseline:label.startsWith('pipeline')?pipeline:candidate;
  for(const kind of (process.env.STARTUP003_SCENARIOS?.split(',')??['cold'])){
   for(let repeat=0;repeat<Number(process.env.STARTUP003_REPEATS??1);repeat++){
   scenario=kind;const context=await browser.newContext();const page=await context.newPage();page.setDefaultTimeout(180000);
   await page.goto(origin+'/harness.html'+(label.endsWith('serial')?'?terrainLoad=serial':''));
   await page.evaluate(async({blobFallback,forceCanvas})=>{
    if(forceCanvas)HTMLImageElement.prototype.decode=()=>Promise.reject(new Error('fixture decode rejection: exercise onload/Canvas'));
    globalThis.__r1Events=[];globalThis.__r1Event=(kind,details={})=>__r1Events.push({kind,at:performance.now(),...details});
    globalThis.__r1Texture=(textures,id,t)=>{let visible=0,hash=2166136261;for(let i=0;i<t.data.length;i++){hash=Math.imul(hash^t.data[i],16777619);if(i%4===3&&t.data[i])visible++;}__r1Event('texture-consumed',{id,visible,pixels:t.width*t.height,hash:hash>>>0});return textures.set(id,t);};
    const nativeDecode=HTMLImageElement.prototype.decode;HTMLImageElement.prototype.decode=function(){const file=this.src.split('/').at(-1);__r1Event('decode-start',{file});return nativeDecode.call(this).then(v=>{__r1Event('decode-resolve',{file});return v;},e=>{__r1Event('decode-reject',{file,error:e.name});throw e;});};
    globalThis.__terrainTrace={active:0,peakActive:0,resident:0,bytes:0,peakResident:0,peakBytes:0,jobs:[],failures:0};
    globalThis.__draw={calls:0,ms:0,readMs:0,bitmapMs:0,bitmapCalls:0};
    const draw=CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage=function(...args){const s=performance.now();try{return draw.apply(this,args);}finally{__draw.calls++;__draw.ms+=performance.now()-s;}};
    const get=CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData=function(...args){const s=performance.now();try{return get.apply(this,args);}finally{__draw.readMs+=performance.now()-s;}};
    const bitmap=globalThis.createImageBitmap;
    globalThis.createImageBitmap=async(...args)=>{const s=performance.now();__draw.bitmapCalls++;try{if(blobFallback)throw Error('fixture bitmap rejection');return await bitmap(...args);}finally{__draw.bitmapMs+=performance.now()-s;}};
    const [{createFreshProductionSession},{createPresentationState},{deriveBrowserRenderModel},terrain,vs2,work,progress,diagnostics]=await Promise.all([
     import('/app/web/preview.js'),import('/app/state/presentation.js'),import('/app/render/coreModel.js'),import('/app/render/terrainSurface.js'),import('/app/render/vs2TerrainSurface.js'),import('/app/render/terrainWork.js'),import('/app/render/progressiveTerrain.js'),import('/app/web/startupDiagnostics.js')]);
    const raw=await (await fetch('/vendor/eastfront-digital-core/reference/strategic-reset-f-map.json')).json();
    const full=deriveBrowserRenderModel(createFreshProductionSession(raw,17),createPresentationState(false,false));
    const model={hexes:full.hexes.map(({coord,terrain})=>({coord,terrain})),edges:full.edges};
    globalThis.__timings=[];work.observeTerrainBuild(t=>__timings.push(t));
    globalThis.__build=async(lod,control)=>terrain.buildCachedTerrainSurface(model,17,'p5',lod,vs2.createVS2TerrainSurfaceHooks(undefined,control).worldBase);
    globalThis.__ProgressiveTerrain=progress.ProgressiveTerrain;globalThis.__report=diagnostics.startupDiagnosticReport;
    globalThis.__modelHexes=model.hexes.length;
   },{blobFallback:kind==='blob-fallback',forceCanvas:process.env.STARTUP003_DECODE_CANVAS==='1'});
   for(const cache of (kind==='cold'?['cold','warm']:['cold'])){
    hits=[];peak=active;const start=performance.now();
    const result=await page.evaluate(async()=>{
     performance.clearResourceTimings();__r1Events=[];__terrainTrace={active:0,peakActive:0,resident:0,bytes:0,peakResident:0,peakBytes:0,jobs:[],failures:0};__draw={calls:0,ms:0,readMs:0,bitmapMs:0,bitmapCalls:0};__timings=[];
     const start=performance.now(),surface=await __build('medium'),wallMs=performance.now()-start;
     // Hash actual final RGBA, before releasing; instrumentation counters exclude this read.
     __r1Event('surface-fulfilled');
     const draw={...__draw};const data=surface.canvas.getContext('2d').getImageData(0,0,surface.canvas.width,surface.canvas.height).data;
     const rgbaSha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data))).map(v=>v.toString(16).padStart(2,'0')).join('');
     const resources=performance.getEntriesByType('resource').filter(r=>r.name.includes('/assets/terrain/vs2-002/')).map(r=>({path:new URL(r.name).pathname,start:r.startTime,responseEnd:r.responseEnd,duration:r.duration,transferSize:r.transferSize,encodedBodySize:r.encodedBodySize}));
     const row={events:structuredClone(__r1Events),wallMs,rgbaSha256,png:surface.canvas.toDataURL('image/png'),stats:surface.stats,hexes:__modelHexes,trace:structuredClone(__terrainTrace),draw,timings:__timings,resources,diagnostics:__report()};
     surface.canvas.width=0;surface.canvas.height=0;row.releasedSurface=surface.canvas.width===0;return row;
    });
    const imagePath=output.replace(/\.json$/,`-${label}-${repeat}-${kind}-${cache}.png`);await mkdir(resolve(output,'..'),{recursive:true});await writeFile(imagePath,Buffer.from(result.png.split(',')[1],'base64'));delete result.png;
    const row={label,repeat,scenario:kind,cache,engine,decodeCanvasFixture:process.env.STARTUP003_DECODE_CANVAS==='1',browserVersion:browser.version(),...result,server:{requests:hits.length,duplicates:hits.length-new Set(hits.map(h=>h.path)).size,recoveries:hits.filter(h=>h.recovery).length,peak,hits:[...hits]},hostWallMs:performance.now()-start};
    reports.push(row);await mkdir(resolve(output,'..'),{recursive:true});await writeFile(output,JSON.stringify({engine,reports},null,2)+'\n');
    assert.equal(result.trace.active,0);assert.equal(result.trace.resident,0);assert.equal(result.trace.bytes,0);assert.equal(result.hexes,640);
    assert(result.trace.peakActive<=(label!=='original'&&!label.endsWith('serial')&&engine==='chromium'?2:1));assert(result.trace.peakResident<=(label!=='original'&&!label.endsWith('serial')?3:1));
    console.log(JSON.stringify({label,repeat,kind,cache,ms:Math.round(result.wallMs),jobs:result.trace.jobs.length,requests:hits.length,peak:result.trace.peakActive,resident:result.trace.peakResident,hash:result.rgbaSha256}));
   }
   // Every LOD, including reuse of an already complete LOD and final cleanup.
   if(kind==='cold'&&process.env.STARTUP003_SKIP_LOD!=='1'){
    const lifecycle=await page.evaluate(async()=>{
     const released=[],builds=[],p=new __ProgressiveTerrain(async(lod,control)=>{builds.push(lod);return __build(lod,control);},()=>{},s=>{s.canvas.width=0;s.canvas.height=0;released.push(s.lod);});
     const hashes={};for(const lod of ['far','close','medium']){const s=await p.request(lod),data=s.canvas.getContext('2d').getImageData(0,0,s.canvas.width,s.canvas.height).data;hashes[lod]=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data))).map(v=>v.toString(16).padStart(2,'0')).join('');}
     await p.request('far');p.dispose();return {builds,released,ready:p.ready.size,resident:__terrainTrace.resident,hashes};
    });
    assert.deepEqual(lifecycle.builds,['far','close','medium']);assert.equal(lifecycle.released.length,3);assert.equal(lifecycle.ready,0);assert.equal(lifecycle.resident,0);reports.push({label,scenario:'LOD-lifecycle',engine,lifecycle});
   }
   if(kind==='slow'&&label==='r1'){
    // Fresh context above has loaded all medium assets. Use cache reload via a
    // page-level URL namespace for this cancellation-only fixture.
    scenario='cancel';
    const cleanup=await page.evaluate(async()=>{
     const NativeImage=globalThis.Image;
     globalThis.Image=class extends NativeImage {set src(value){super.src=value&&!value.startsWith('blob:')?value+'?cancel-fixture=1':value;}get src(){return super.src;}};
     const p=new __ProgressiveTerrain((lod,control)=>__build(lod,control),()=>{},s=>{s.canvas.width=0;s.canvas.height=0;});
     const rejected=p.request('far').then(()=>false,()=>true);await new Promise(r=>setTimeout(r,60));p.dispose();
     const wasRejected=await rejected;await new Promise(r=>setTimeout(r,60));globalThis.Image=NativeImage;
     const afterCancel={active:__terrainTrace.active,resident:__terrainTrace.resident,ready:p.ready.size};
     const rebuilt=await __build('far');rebuilt.canvas.width=0;rebuilt.canvas.height=0;
     return {wasRejected,afterCancel,afterRebuild:{active:__terrainTrace.active,resident:__terrainTrace.resident}};
    });
    assert(cleanup.wasRejected);assert.deepEqual(cleanup.afterCancel,{active:0,resident:0,ready:0});assert.deepEqual(cleanup.afterRebuild,{active:0,resident:0});reports.push({label,scenario:'cancel-rebuild',engine,cleanup});
   }
   await context.close();
   }
  }
 }
 const hashes=reports.filter(r=>r.rgbaSha256).map(r=>r.rgbaSha256);const pixelEquality=new Set(hashes).size===1;
 const fixed=reports.filter(r=>r.rgbaSha256&&r.label.startsWith('r1'));
 const referenceRows=process.env.STARTUP003_REFERENCE?JSON.parse(await readFile(process.env.STARTUP003_REFERENCE,'utf8')).reports:reports;
 const warm=referenceRows.find(r=>r.rgbaSha256&&r.cache==='warm'&&r.label==='original'&&r.engine===engine);
 if(fixed.length){assert(warm,'original warm reference required (include original/cold, or STARTUP003_REFERENCE)');assert.equal(warm.browserVersion,browser.version());for(const row of fixed)assert.equal(row.rgbaSha256,warm.rgbaSha256,`strict pixel gate: ${row.label}/${row.scenario}/${row.cache}`);}else if(engine!=='webkit')assert(pixelEquality,'same-engine final pixels changed');
 const lods=reports.filter(r=>r.lifecycle);for(const row of lods)assert.deepEqual(row.lifecycle.hashes,lods[0].lifecycle.hashes);
 await writeFile(output,JSON.stringify({engine,complete:true,pixelEquality,fixedPixelGate:fixed.length>0,reference: warm?{label:warm.label,cache:warm.cache,rgbaSha256:warm.rgbaSha256,browserVersion:warm.browserVersion}:null,reports},null,2)+'\n');
}finally{await browser.close();await new Promise(r=>server.close(r));}

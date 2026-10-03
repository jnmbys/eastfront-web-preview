// Final cold/warm check against an archived ORIGINAL warm reference. No loader,
// decode, drawImage, getImageData or served-module instrumentation in this run.
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
const pw=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE??'playwright');
const root=resolve('dist'),out=resolve(process.argv[2]??'evidence/startup-003-r1/webkit-unmodified.json');
const reference=JSON.parse(await readFile(process.env.STARTUP003_REFERENCE??'evidence/startup-003-r1/webkit-matrix.json','utf8')).reports.find(r=>r.label==='original'&&r.cache==='warm');
await mkdir(resolve(out,'..'),{recursive:true});await writeFile(out,'{}\n',{flag:'wx'});
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');if(url.pathname==='/harness.html'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Local uninstrumented terrain verification</title>');return;}
 const path=resolve(root,'.'+decodeURIComponent(url.pathname));if(!path.startsWith(root+sep))throw Error('path');
 const data=await readFile(path),types={'.js':'text/javascript','.json':'application/json','.webp':'image/webp','.png':'image/png'};
 res.writeHead(200,{'Content-Type':types[extname(path)]??'application/octet-stream','Cache-Control':path.includes('assets')?'public,max-age=3600':'no-store'});res.end(data);
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await pw.webkit.launch({headless:true}),rows=[];
try{
 assert.equal(browser.version(),reference.browserVersion);
 for(const serial of [false,true]){
  const context=await browser.newContext(),page=await context.newPage();page.setDefaultTimeout(180000);
  await page.goto(`http://127.0.0.1:${server.address().port}/harness.html${serial?'?terrainLoad=serial':''}`);
  for(const cache of ['cold','warm']){
   const row=await page.evaluate(async()=>{
    const [{createFreshProductionSession},{createPresentationState},{deriveBrowserRenderModel},terrain,vs2]=await Promise.all([
     import('/app/web/preview.js'),import('/app/state/presentation.js'),import('/app/render/coreModel.js'),import('/app/render/terrainSurface.js'),import('/app/render/vs2TerrainSurface.js')]);
    const raw=await(await fetch('/vendor/eastfront-digital-core/reference/strategic-reset-f-map.json')).json();
    const full=deriveBrowserRenderModel(createFreshProductionSession(raw,17),createPresentationState(false,false));
    const model={hexes:full.hexes.map(({coord,terrain})=>({coord,terrain})),edges:full.edges};
    const start=performance.now(),surface=await terrain.buildCachedTerrainSurface(model,17,'p5','medium',vs2.createVS2TerrainSurfaceHooks().worldBase);
    const wallMs=performance.now()-start,data=surface.canvas.getContext('2d').getImageData(0,0,surface.canvas.width,surface.canvas.height).data;
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data))).map(v=>v.toString(16).padStart(2,'0')).join('');
    const png=surface.canvas.toDataURL('image/png');surface.canvas.width=0;surface.canvas.height=0;return {wallMs,hash,png};
   });
   const png=out.replace(/\.json$/,`-${serial?'serial':'default'}-${cache}.png`);await writeFile(png,Buffer.from(row.png.split(',')[1],'base64'));delete row.png;
   rows.push({serial,cache,...row});await writeFile(out,JSON.stringify({browserVersion:browser.version(),rows},null,2)+'\n');
   assert.equal(row.hash,reference.rgbaSha256);console.log(JSON.stringify(rows.at(-1)));
  }await context.close();
 }
 await writeFile(out,JSON.stringify({complete:true,browserVersion:browser.version(),instrumentation:false,reference:reference.rgbaSha256,rows},null,2)+'\n');
}finally{await browser.close();await new Promise(r=>server.close(r));}

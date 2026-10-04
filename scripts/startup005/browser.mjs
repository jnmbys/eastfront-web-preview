// Loopback only. Exact 004 viewport/observer, actual production HOME -> local game.
import {createServer} from 'node:http';import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {resolve,extname,sep} from 'node:path';import {createRequire} from 'node:module';
const pw=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE??'playwright');
const root=resolve(process.argv[2]),out=resolve(process.argv[3]);if(existsSync(out))throw Error('Use a new evidence directory');mkdirSync(out,{recursive:true});
const files=[];function audit(dir,prefix=''){for(const e of readdirSync(dir,{withFileTypes:true})){const path=prefix+e.name;if(e.isDirectory())audit(resolve(dir,e.name),path+'/');else{const b=readFileSync(resolve(dir,e.name));files.push({path,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')});}}}audit(root);writeFileSync(out+'/input-files.json',JSON.stringify({root,files},null,2)+'\n');
const engine=process.argv[4]??'chromium';const rows=[],requests=[];
const owner=resolve('scripts/startup004/web');
const server=createServer((req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1');
 if(url.pathname==='/s004/config.json'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({sourceCommit:JSON.parse(readFileSync(root+'/diagnostics/transport/build.json')).sourceCommit,serialEnabled:true}));return;}
 const base=url.pathname.startsWith('/r1/')?root:owner,path=resolve(base,url.pathname.startsWith('/r1/')?url.pathname.slice(4):url.pathname==='/'?'index.html':url.pathname.slice(6));if(!path.startsWith(base+sep))throw Error('path');
 const b=readFileSync(path);res.writeHead(200,{'Content-Type':{'.html':'text/html;charset=utf-8','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp'}[extname(path)]??'application/octet-stream','Cache-Control':/\.(webp|png)$/.test(path)?'private,max-age=3600':'no-store'});res.end(b);
 if(url.pathname.includes('/assets/terrain/'))requests.push({path:url.pathname,recovery:url.searchParams.has('terrain-recovery'),at:Date.now()});
 }catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const lifecycle={pid:process.pid,host:'127.0.0.1',port:server.address().port,startedAt:new Date().toISOString(),browserClosed:false,serverClosed:false};
writeFileSync(out+'/lifecycle.json',JSON.stringify(lifecycle,null,2)+'\n');
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.STARTUP003_CHROMIUM,args:['--disable-accelerated-2d-canvas','--disable-gpu']}:{})});
try{for(const mode of ['default','serial']){
 requests.length=0;const context=await browser.newContext({viewport:{width:1302,height:740},deviceScaleFactor:2.125,hasTouch:true}),page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(180000);
 await page.addInitScript(()=>{window.addEventListener('message',e=>{if(e.data?.startup004==='snapshot')window.__snapshot=e.data.data;});});
 await page.goto(`http://127.0.0.1:${server.address().port}/${mode==='serial'?'?terrainLoad=serial':''}`);
 await page.locator('#device').fill('LOCAL viewport simulation, not Huawei');await page.locator('#network').fill('loopback, fresh context');await page.locator('#start').click();
 const game=page.frameLocator('#game');await game.locator('#eastfront-map').waitFor();
 const first=await page.evaluate(()=>window.__snapshot);
 const live=[];let ready=false;const waitStart=Date.now();
 while(Date.now()-waitStart<150000){
  await page.evaluate(()=>document.querySelector('#game').contentWindow.postMessage({startup004:'snapshot'},location.origin));
  await page.waitForTimeout(100);
  const state=await page.evaluate(()=>({progress:window.__snapshot?.progress,failed:window.__snapshot?.failed,build:window.__snapshot?.diagnostics?.terrainBuild}));
  if(state.build)live.push(state.build);
  if(state.progress?.stage==='ready'||state.failed){ready=true;break;}
  await page.waitForTimeout(4900);
 }
 if(await game.locator('#panel-toggle').getAttribute('aria-expanded')==='true')await game.locator('#panel-toggle').click();
 for(let i=0;i<30;i++)await game.locator('#zoom-in').click();
 await page.waitForTimeout(100);
 const frame=page.frames().find(f=>f.url().includes('/r1/index.html'));
 const geometry=await frame.evaluate(()=>{const svg=document.querySelector('#eastfront-map'),canvas=document.querySelector('#terrain-surface'),vb=svg.viewBox.baseVal,zoom=+document.querySelector('#map-wrap').dataset.zoom;
 return {innerWidth,innerHeight,dpr:devicePixelRatio,zoom,panelExpanded:document.querySelector('#panel-toggle').getAttribute('aria-expanded'),mountedLod:canvas.dataset.lod,svgClientWidth:svg.clientWidth,svgClientHeight:svg.clientHeight,viewBox:{width:vb.width,height:vb.height},fitScale:Math.min(svg.clientWidth/vb.width,svg.clientHeight/vb.height),estimatedLodScreenHexWidth:Math.max(560,innerWidth-24)*Math.sqrt(3)*42/vb.width*zoom};});
 const snapshot=await page.evaluate(()=>window.__snapshot);
 const diagnostic=await frame.evaluate(async()=> (await import('/r1/app/web/startupDiagnostics.js')).startupDiagnosticReport());
 await page.screenshot({path:out+'/'+mode+'-max.png',fullPage:true});
 const pixel=await frame.evaluate(async()=>{const c=document.querySelector('#terrain-surface'),data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return {lod:c.dataset.lod,rgbaSha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data))).map(x=>x.toString(16).padStart(2,'0')).join(''),png:c.toDataURL()};});
 writeFileSync(out+'/'+mode+'-terrain.png',Buffer.from(pixel.png.split(',')[1],'base64'));delete pixel.png;
 const row={mode,engine,browserVersion:browser.version(),simulationOnly:true,actualDevice:false,ready,first,snapshot,diagnostic,live,geometry,pixel,requests:[...requests],errors};rows.push(row);writeFileSync(out+'/result.json',JSON.stringify({complete:false,rows},null,2)+'\n');console.log(JSON.stringify({mode,ready,geometry,progress:snapshot.progress,terrainEvents:snapshot.events.filter(e=>e.kind==='terrain-complete'),imageJobs:snapshot.diagnostics.imageJobs,errors}));
 assert.equal(snapshot.progress.stage,'ready');assert.equal(snapshot.failed,false);assert.equal(geometry.mountedLod,existsSync(root+'/app/render/terrainBuildDiagnostics.js')?'close':'medium');assert.equal(errors.length,0);await context.close();
}writeFileSync(out+'/result.json',JSON.stringify({complete:true,rows},null,2)+'\n');}
finally{await browser.close();lifecycle.browserClosed=true;server.closeAllConnections();await new Promise(r=>server.close(r));lifecycle.serverClosed=true;lifecycle.closedAt=new Date().toISOString();writeFileSync(out+'/lifecycle.json',JSON.stringify(lifecycle,null,2)+'\n');}

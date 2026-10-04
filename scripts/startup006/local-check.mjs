import {createRequire} from 'node:module';
import {request} from 'node:http';
import {randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {ownerPreview} from '../mp011-r1/owner-preview.mjs';
import {verify,manifest,sha256,candidate} from './integrity.mjs';
import assert from 'node:assert/strict';
const pw=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE??'playwright');
const root=process.argv[2]??'evidence/startup-006/preflight',base='http://127.0.0.1:4300',config=verify(),rows=[];mkdirSync(root);
// Check the exact HTTP payloads, not only files on disk.
for(const f of manifest.files){const r=await fetch(base+'/r1/'+f.path);assert.equal(r.status,200,f.path);assert.equal(sha256(Buffer.from(await r.arrayBuffer())),f.sha256,f.path);}
const password=randomBytes(24).toString('base64url'),origin='https://startup006.invalid';
const auth=ownerPreview({origin,passwordSha256:sha256(Buffer.from(password)),upstreamPort:4300});
await new Promise(r=>auth.listen(0,'127.0.0.1',r));
const http=(path,headers={},body)=>new Promise((ok,fail)=>{const req=request({host:'127.0.0.1',port:auth.address().port,path,method:body?'POST':'GET',headers:{Host:'startup006.invalid',...headers}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>ok({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));});req.on('error',fail);req.end(body);});
const anonymous=[];
try{
 for(const path of ['/','/r1/index.html','/r1/app/main.js','/r1/assets/terrain/vs2-002/assets/ground/grass.webp','/s006/config.json','/s006/records']){const r=await http(path);assert.equal(r.status,303);assert.equal(r.headers.location,'/__mp010_login');assert.equal(r.body.length,0);anonymous.push({path,status:r.status,location:r.headers.location,bodyBytes:r.body.length});}
 const denied=await http('/__mp010_login',{'Origin':'https://wrong.invalid','Content-Type':'application/x-www-form-urlencoded'},'password=wrong');assert.equal(denied.status,403);
 const login=await http('/__mp010_login',{'Origin':origin,'Content-Type':'application/x-www-form-urlencoded'},new URLSearchParams({password}).toString());assert.equal(login.status,303);
 const cookie=login.headers['set-cookie'][0];for(const flag of ['Secure','HttpOnly','SameSite=Strict','Path=/'])assert(cookie.includes(flag));
 const allowed=await http('/r1/app/render/terrainSurface.js',{'Cookie':cookie.split(';')[0]});assert.equal(allowed.status,200);assert.equal(sha256(allowed.body),manifest.files.find(f=>f.path==='app/render/terrainSurface.js').sha256);
 writeFileSync(root+'/local-auth.json',JSON.stringify({anonymous,wrongOrigin:403,authorized:200,cookieFlagsVerified:true,authSource:'unchanged scripts/mp011-r1/owner-preview.mjs',cookiesExported:false,productionServer:false},null,2)+'\n',{flag:'wx'});
}finally{auth.closeAllConnections();await new Promise(r=>auth.close(r));}
const unopened=await fetch('http://127.0.0.1:4302/open',{method:'POST',headers:{Origin:'http://127.0.0.1:4302','Content-Type':'application/json'},body:'{}'});assert.equal(unopened.status,409);
assert.equal((await fetch(base+'/?terrainLoad=serial')).status,403);
const browser=await pw.chromium.launch({headless:true,executablePath:process.env.STARTUP003_CHROMIUM,args:['--disable-accelerated-2d-canvas','--disable-gpu']});
try{
 for(const scenario of ['normal','deadline-fixture','error-fixture']){
  const context=await browser.newContext({viewport:{width:1302,height:740},deviceScaleFactor:2.125,acceptDownloads:true}),page=await context.newPage();page.setDefaultTimeout(150000);const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(base+(scenario==='deadline-fixture'?'/?localBudgetMs=1500':''));await page.locator('#device').fill('Desktop Edge local '+scenario+'; NOT Huawei');await page.locator('#network').fill('loopback; fresh context; no artificial resource delays');await page.locator('#start').click();
  if(scenario==='normal'){
   const game=page.frameLocator('#game');await game.locator('#eastfront-map').waitFor();if(await game.locator('#panel-toggle').getAttribute('aria-expanded')==='true')await game.locator('#panel-toggle').click();for(let i=0;i<30;i++)await game.locator('#zoom-in').click();
   await page.waitForFunction(()=>document.querySelector('#receipt').textContent.includes('JSON 已实际保存')&&document.querySelector('#status').textContent.includes('实际画布 close'));
   await page.screenshot({path:root+'/desktop-close.png',fullPage:true});await page.locator('#checks > summary').click();await page.locator('#visual').check();await page.locator('#notes').fill('Desktop automated fixture: close canvas and diagnostics verified; not a Huawei visual observation.');await page.locator('#save').click();
  }
  if(scenario==='error-fixture'){
   await page.waitForFunction(()=>!document.querySelector('#failure').disabled);await page.waitForTimeout(500);
   const frame=page.frames().find(f=>f.url().includes('/r1/index.html'));await frame.evaluate(()=>window.dispatchEvent(new ErrorEvent('error',{message:'STARTUP006 synthetic observer error fixture; not a candidate defect'})));
  }
  await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('本次观察已停止'));assert.equal(await page.locator('#game').count(),0);
  const data=JSON.parse(await page.locator('#backup').inputValue());assert.equal(data.sourceCommit,config.sourceCommit);assert.equal(data.mode,'default');assert.equal(data.final,true);assert(data.samples.length<=40);assert.equal(data.events.filter(e=>e.kind==='local-start-request').length,1);
  if(scenario==='normal'){assert.equal(data.outcome,'observed-success');assert.equal(data.firstMap.current.zoom,'1.00');assert.equal(data.viewport.width,1302);assert.equal(data.viewport.height,607);assert.equal(data.diagnostics.terrainBuild.camera.zoom,2.7);assert(data.assessmentHints.A_reachedWhileCollapsed&&data.assessmentHints.B_readyMountedScreenshot);assert(data.screenshots.some(s=>s.lod==='close'&&s.readyClose&&s.withinBudget));assert.equal(errors.length,0);}
  if(scenario==='deadline-fixture'){assert.equal(data.stopReason,'budget-expired');assert.equal(data.budget.limitMs,1500);assert.equal(data.outcome,'incomplete');}
  if(scenario==='error-fixture'){assert.equal(data.stopReason,'detected-error');assert.equal(data.outcome,'failed');}
  if(!await page.locator('#checks').evaluate(e=>e.open))await page.locator('#checks > summary').click();
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#download').click()]);await download.saveAs(root+'/'+scenario+'-download.json');assert.deepEqual(JSON.parse(readFileSync(root+'/'+scenario+'-download.json')),data);
  for(const shot of data.screenshots){const bytes=readFileSync('evidence/startup-006/records/'+shot.id);assert.equal(sha256(bytes),shot.sha256);assert.equal(bytes.length,shot.bytes);}
  rows.push({scenario,browser:browser.version(),actualDevice:false,outcome:data.outcome,stopReason:data.stopReason,outerElapsedMs:data.budget.outerElapsedMs,samples:data.samples.length,screenshots:data.screenshots.map(s=>({id:s.id,lod:s.lod,sha256:s.sha256})),receipt:await page.locator('#receipt').textContent,frameDetached:true,downloadVerified:true});await context.close();
 }
 writeFileSync(root+'/local-desktop.json',JSON.stringify({pass:true,config,httpFilesVerified:manifest.files.length,scope:'DESKTOP_PREFLIGHT_ONLY',publicOpened:false,publicGateRequiresExplicitUserStart:true,serialDenied:true,rows},null,2)+'\n',{flag:'wx'});
 const ready=await fetch('http://127.0.0.1:4302/local-passed',{method:'POST',headers:{Origin:'http://127.0.0.1:4302'}});assert.equal(ready.status,200);
 const stillClosed=await fetch('http://127.0.0.1:4302/status').then(r=>r.json());assert.equal(stillClosed.origin,null);assert.equal(stillClosed.publicAuthorized,false);console.log(JSON.stringify({pass:true,rows:rows.map(r=>({scenario:r.scenario,outcome:r.outcome})),publicOpened:false}));
}catch(error){writeFileSync(root+'/failure.json',JSON.stringify({error:String(error),rows},null,2)+'\n',{flag:'wx'});throw error;}
finally{await browser.close();}

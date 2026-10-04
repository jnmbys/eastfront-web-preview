import {createRequire} from 'node:module';
import {request} from 'node:http';
import {randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {ownerPreview} from '../mp011-r1/owner-preview.mjs';
import {verify,manifest,sha256,candidate} from './integrity.mjs';
import assert from 'node:assert/strict';
const pw=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE??'playwright');
const root=process.argv[2]??'evidence/startup-004/preflight',base='http://127.0.0.1:4290',config=verify(),rows=[];mkdirSync(root);
// Check the exact HTTP payloads, not only files on disk.
for(const f of manifest.files){const r=await fetch(base+'/r1/'+f.path);assert.equal(r.status,200,f.path);assert.equal(sha256(Buffer.from(await r.arrayBuffer())),f.sha256,f.path);}
const password=randomBytes(24).toString('base64url'),origin='https://startup004.invalid';
const auth=ownerPreview({origin,passwordSha256:sha256(Buffer.from(password)),upstreamPort:4290});
await new Promise(r=>auth.listen(0,'127.0.0.1',r));
const http=(path,headers={},body)=>new Promise((ok,fail)=>{const req=request({host:'127.0.0.1',port:auth.address().port,path,method:body?'POST':'GET',headers:{Host:'startup004.invalid',...headers}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>ok({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));});req.on('error',fail);req.end(body);});
const anonymous=[];
try{
 for(const path of ['/','/r1/index.html','/r1/app/main.js','/r1/assets/terrain/vs2-002/assets/ground/grass.webp','/s004/config.json','/s004/records']){const r=await http(path);assert.equal(r.status,303);assert.equal(r.headers.location,'/__mp010_login');assert.equal(r.body.length,0);anonymous.push({path,status:r.status,location:r.headers.location,bodyBytes:r.body.length});}
 const denied=await http('/__mp010_login',{'Origin':'https://wrong.invalid','Content-Type':'application/x-www-form-urlencoded'},'password=wrong');assert.equal(denied.status,403);
 const login=await http('/__mp010_login',{'Origin':origin,'Content-Type':'application/x-www-form-urlencoded'},new URLSearchParams({password}).toString());assert.equal(login.status,303);
 const cookie=login.headers['set-cookie'][0];for(const flag of ['Secure','HttpOnly','SameSite=Strict','Path=/'])assert(cookie.includes(flag));
 const allowed=await http('/r1/app/render/terrainSurface.js',{'Cookie':cookie.split(';')[0]});assert.equal(allowed.status,200);assert.equal(sha256(allowed.body),manifest.files.find(f=>f.path==='app/render/terrainSurface.js').sha256);
 writeFileSync(root+'/local-auth.json',JSON.stringify({anonymous,wrongOrigin:403,authorized:200,cookieFlagsVerified:true,authSource:'unchanged scripts/mp011-r1/owner-preview.mjs',cookiesExported:false,productionServer:false},null,2)+'\n',{flag:'wx'});
}finally{auth.closeAllConnections();await new Promise(r=>auth.close(r));}
const browser=await pw.chromium.launch({headless:true,executablePath:process.env.STARTUP003_CHROMIUM,args:['--disable-accelerated-2d-canvas','--disable-gpu']});
try{
 for(const mode of ['default','serial']){
  const context=await browser.newContext({viewport:{width:1400,height:1000},acceptDownloads:true}),page=await context.newPage();
  page.setDefaultTimeout(180000);await page.goto(base+(mode==='serial'?'/?terrainLoad=serial':'/'));
  await page.locator('#device').fill('Desktop Edge headless local preflight (not Huawei)');await page.locator('#network').fill('127.0.0.1; no artificial delay; fresh browser context');
  await page.locator('#start').click();const frame=page.frameLocator('#game');
  await frame.locator('#eastfront-map').waitFor();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('far')&&document.querySelector('#status').textContent.includes('medium')&&document.querySelector('#status').textContent.includes('close'));
  if(await frame.locator('#panel-toggle').getAttribute('aria-expanded')==='true')await frame.locator('#panel-toggle').click();
  const lods=[];for(const [dir,times] of [['out',15],['in',12]]){for(let i=0;i<times;i++){await frame.locator('#zoom-'+dir).click();const lod=await frame.locator('#terrain-surface').getAttribute('data-lod');if(!lods.includes(lod))lods.push(lod);}}
  assert.deepEqual([...lods].sort(),['close','far','medium']);
  const wrap=frame.locator('#map-wrap'),box=await wrap.boundingBox();const before=await frame.locator('#eastfront-map').getAttribute('style');
  await page.mouse.move(box.x+box.width*.45,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.45+70,box.y+box.height*.5+35,{steps:8});await page.mouse.up();
  assert.notEqual(await frame.locator('#eastfront-map').getAttribute('style'),before);
  await frame.locator('#zoom-reset').click();await page.screenshot({path:root+`/desktop-${mode}.png`,fullPage:true});
  await page.locator('#checks > summary').click();
  for(const id of ['complete','drag','zoom','far','medium','close'])await page.locator('#'+id).check();
  await page.locator('#notes').fill('Automated local preflight: all LODs mounted, drag transform changed; screenshot retained for desktop review. Not a Huawei observation.');
  await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('已保存到本机并校验'));
  const data=JSON.parse(await page.locator('#backup').inputValue());assert.equal(data.diagnostics.build,config.sourceCommit);assert.equal(data.diagnostics.imageJobs.failed,0);assert.equal(data.diagnostics.imageJobs.active,0);assert.equal(data.outcome,'observed-success');assert.equal(data.failed,false);assert(data.events.some(e=>e.kind==='map-input'));
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#download').click()]);const dest=root+`/desktop-${mode}-download.json`;await download.saveAs(dest);assert.deepEqual(JSON.parse(readFileSync(dest)),data);
  rows.push({mode,browser:browser.version(),lods,marks:data.marks,diagnostics:data.diagnostics.imageJobs,downloadVerified:true,receipt:await page.locator('#status').textContent});await context.close();
 }
 writeFileSync(root+'/local-desktop.json',JSON.stringify({complete:true,config,all380HttpHashes:'PASS',kind:'DESKTOP_PREFLIGHT_NOT_HUAWEI',rows},null,2)+'\n',{flag:'wx'});
 const ready=await fetch('http://127.0.0.1:4292/local-passed',{method:'POST',headers:{Origin:'http://127.0.0.1:4292'}});assert.equal(ready.status,200);
}finally{await browser.close();}

// Actual frontend + real HTTP/016 transaction; only read faults are synthetic.
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const launch=new URL(process.env.INDUSTRY017_URL),origin=launch.origin;
const token=new URLSearchParams(launch.hash.slice(1)).get('session');
const rejected=process.env.R1_CASE==='rejected',label=rejected?'rejected':'committed';
const browser=await chromium.launch({channel:'msedge',headless:true});
const report={case:label,origin:'REAL_HTTP_AND_FRONTEND_WITH_SYNTHETIC_READ_FAULTS',checks:[],writes:[],pageErrors:[]};
const check=(name,details={})=>report.checks.push({name,passed:true,...details});
try{
 const context=await browser.newContext({viewport:{width:1400,height:1050}}),page=await context.newPage();
 page.on('pageerror',e=>report.pageErrors.push(e.message));
 page.on('request',r=>{if(r.method()==='POST')report.writes.push(r.postDataJSON());});
 const actual=async()=>{const r=await context.request.get(origin+'/api/state',{headers:{'X-Local-Session':token}});assert.equal(r.status(),200);return r.json();};
 const marker=()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('industry017.pending.v1')));
 const snapshot=()=>page.evaluate(()=>({message:document.querySelector('#message').textContent,balance:document.querySelector('#freeI').textContent,version:document.querySelector('#version').textContent,pending:JSON.parse(sessionStorage.getItem('industry017.pending.v1')),floor:JSON.parse(sessionStorage.getItem('industry017.view-floor.v1')),locked:['care','next','recover'].every(id=>document.getElementById(id).disabled)}));
 const known=async()=>{await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('账本尚未刷新'));const s=await snapshot();assert(s.locked);assert(s.pending.confirmation);assert(!/结果待确认|正式结果已更新/.test(s.message));assert.match(s.message,rejected?/已确认拒绝/:/已确认提交/);assert(await page.locator('#retry').isHidden());return s;};
 await page.goto(launch.href);await page.waitForFunction(()=>!document.querySelector('#care').disabled);
 const old=await actual();assert.equal(old.version,37);let mode='fail',reads=0;
 await page.route('**/api/state',async route=>{
  reads++;
  if(mode==='fail')return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'SYNTHETIC_STATE_READ_FAILURE'})});
  if(mode==='old')return route.fulfill({json:old});
  if(mode==='foreign')return route.fulfill({json:{...old,instanceId:'synthetic-foreign-instance',version:999}});
  return route.continue();
 });
 await page.locator('#care').click();const pendingView=await known();
 const id=pendingView.pending.requestId,expectedVersion=rejected?37:38;
 const backend=await actual();assert.equal(backend.version,expectedVersion);assert.equal(backend.equipmentBudget.freeI,rejected?5:4);
 assert.equal(pendingView.balance,'5 I');assert.equal(report.writes.length,1);
 check('terminal_receipt_persisted_before_failed_state_read',{view:pendingView,backendVersion:backend.version,backendFreeI:backend.equipmentBudget.freeI});
 for(let i=0;i<2;i++){
  const n=reads;await page.locator('#check').click();await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('SYNTHETIC_STATE_READ_FAILURE'));await known();assert(reads>n);
 }
 for(const button of ['care','next','recover','retry'])await page.locator('#'+button).dispatchEvent('click');
 await known();assert.equal(report.writes.length,1);check('consecutive_read_failures_and_forced_clicks_cannot_submit');
 await page.reload();await known();assert.equal((await marker()).requestId,id);assert.equal(report.writes.length,1);
 check('reload_preserves_terminal_receipt_and_business_lock');
 await mkdir(new URL('./screenshots/',import.meta.url),{recursive:true});
 await page.screenshot({path:new URL('./screenshots/'+label+'-waiting.png',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'),fullPage:true});
 if(!rejected){
  mode='old';await page.locator('#check').click();await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('旧账本版本'));await known();assert.equal((await marker()).requestId,id);
  check('below_receipt_version_does_not_unlock_or_clear');
 }
 mode='foreign';await page.locator('#check').click();await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('服务实例不符'));await known();
 check('foreign_instance_cannot_replace_confirmed_ledger');
 mode='live';await page.locator('#check').click();await page.waitForFunction(()=>!sessionStorage.getItem('industry017.pending.v1'));
 assert.equal(await page.locator('#freeI').innerText(),(rejected?5:4)+' I');
 assert.match(await page.locator('#message').innerText(),rejected?/已确认拒绝.*正式账本已刷新/:/已确认提交，正式结果已更新/);
 assert.equal(await page.locator('#care').isDisabled(),!rejected);assert.equal(await page.locator('#next').isDisabled(),false);
 assert.equal(report.writes.length,1);check('only_valid_ledger_clears_marker_and_releases_appropriate_buttons');
 if(!rejected){
  // Two reads race: an explicitly synthetic old response arrives after a valid one.
  await page.unroute('**/api/state');let release,seen;
  const held=new Promise(r=>release=r),captured=new Promise(r=>seen=r);let first=true;
  await page.route('**/api/state',async route=>{if(first){first=false;seen();await held;await route.fulfill({json:old});}else await route.continue();});
  await page.locator('#check').click();await captured;await page.locator('#check').click();
  await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('已读取后端正式状态'));
  release();await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('旧账本版本'));
  assert.equal(await page.locator('#freeI').innerText(),'4 I');assert.match(await page.locator('#version').innerText(),/^根 38 /);
  assert(await page.locator('#care').isDisabled());check('late_old_read_cannot_overwrite_new_ledger_after_marker_cleanup');
  await page.unroute('**/api/state');await page.route('**/api/state',route=>route.fulfill({json:old}));
  await page.reload();await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('旧账本版本'));
  assert((await snapshot()).locked);assert.equal((await snapshot()).pending,null);check('persisted_version_floor_survives_reload_after_cleanup');
  await page.unroute('**/api/state');await page.locator('#check').click();await page.waitForFunction(()=>document.querySelector('#freeI').textContent==='4 I');
 }
 assert.deepEqual(await actual(),backend);assert.equal(report.writes.length,1);assert.deepEqual(report.pageErrors,[]);
 report.finalView=await snapshot();report.actualFinal=await actual();report.readFaultsAreSynthetic=true;
 await page.screenshot({path:new URL('./screenshots/'+label+'-recovered.png',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'),fullPage:true});
 await writeFile(new URL('./'+label+'.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({case:label,checks:report.checks.length,writes:report.writes.length,status:'PASS'}));
}finally{await browser.close();}

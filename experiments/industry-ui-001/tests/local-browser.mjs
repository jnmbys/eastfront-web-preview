// Adapted from pinned 017-R1 browser assertions; evidence relocated; UI mode checks added.
// Real page -> real HTTP -> unchanged 016 owner. Network faults are explicitly synthetic.
import {createRequire} from 'node:module';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const evidence=pathToFileURL(process.env.UI005_EVIDENCE.replaceAll('\\','/')+'/');
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const launch=new URL(process.env.INDUSTRY017_URL),token=new URLSearchParams(launch.hash.slice(1)).get('session'),origin=launch.origin;
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
const report={origin:'REAL_BROWSER_AND_HTTP_WITH_LABELLED_SYNTHETIC_NETWORK_FAULTS',checks:[],writes:[],pageErrors:[],externalRequests:[]};
const check=(name,details={})=>report.checks.push({name,passed:true,...details});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1100}}),page=await context.newPage();
 page.on('pageerror',e=>report.pageErrors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(origin))report.externalRequests.push(r.url());if(r.method()==='POST')report.writes.push(r.postDataJSON());});
 await page.goto(launch.href);await page.waitForFunction(()=>!document.querySelector('#care').disabled);
 const state=async()=>{const r=await context.request.get(origin+'/api/state',{headers:{'X-Local-Session':token}});assert.equal(r.status(),200);return r.json();};
 const waitVersion=async v=>{await page.waitForFunction(v=>document.querySelector('#version').textContent.startsWith('根 '+v+' /'),v);await page.waitForFunction(()=>!sessionStorage.getItem('industry017.pending.v1'));};
 const start=await state();assert.equal(start.version,37);assert.equal(start.gameRevision,142);assert.equal(start.equipmentBudget.freeI,5);check('initial_real_T8_same_full_owner');
 await mkdir(new URL('./screenshots/',evidence),{recursive:true});await page.screenshot({path:new URL('./screenshots/start.png',evidence).pathname.replace(/^\/(\w:)/,'$1'),fullPage:true});
 let release;const barrier=new Promise(r=>release=r);let intercepted=false;
 await page.route('**/api/operations',async route=>{if(!intercepted){intercepted=true;await barrier;}await route.continue();});
 await page.locator('#care').click();await page.locator('#care').dispatchEvent('click');
 assert.match(await page.locator('#message').innerText(),/处理中/);assert.equal(await page.locator('#freeI').innerText(),'5 I');
 assert(await page.locator('#care').isDisabled());assert.equal(report.writes.length,1);check('double_click_single_request_and_no_optimistic_success',{synthetic:'Delayed request dispatch'});
 release();await waitVersion(38);await page.unroute('**/api/operations');assert.equal((await state()).equipmentBudget.freeI,4);
 const careBody=report.writes[0];await page.reload();await waitVersion(38);assert.equal((await state()).instanceId,start.instanceId);check('refresh_preserves_instance_no_grant_reset');
 for(let i=0;i<6;i++){const v=(await state()).version;assert(!(await page.locator('#next').isDisabled()));await page.locator('#next').click();await waitVersion(v+1);}
 assert.equal((await state()).gameRevision,148);
 // E8 commits, then the browser loses its POST response and first receipt query.
 let dropped=false;await page.route('**/api/requests/*',route=>route.abort('failed'));
 await page.route('**/api/operations',async route=>{
  const response=await route.fetch(),result=await response.json();assert.equal(result.operation,'NEXT');
  for(let i=0;i<20;i++){
   const receipt=await context.request.get(origin+'/api/requests/'+result.requestId,{headers:{'X-Local-Session':token}});
   const data=await receipt.json();if(data.status==='COMMITTED'){dropped=true;await route.abort('failed');return;}
   await new Promise(r=>setTimeout(r,100));
  }throw Error('E8 did not commit');
 });
 await page.locator('#next').click();await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('结果待确认'));
 assert(dropped);const pending=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('industry017.pending.v1')));assert(pending);
 assert.equal((await state()).gameRevision,149);assert.equal(await page.locator('#materials').innerText().then(x=>x.includes('C10前线仓')),false);
 const writes=report.writes.length;await page.unroute('**/api/operations');await page.unroute('**/api/requests/*');await page.reload();await waitVersion(45);
 assert.equal(report.writes.length,writes);assert.match(await page.locator('#arrival').innerText(),/E8到账，T9可用/);check('E8_committed_response_lost_refresh_reconciles_same_request_without_POST',{synthetic:'Drop committed POST response and receipt query',requestId:pending.requestId});
 for(let i=0;i<3;i++){const v=(await state()).version;await page.locator('#next').click();await waitVersion(v+1);}
 assert.equal((await state()).gameRevision,152);await page.locator('#recover').click();await waitVersion(49);
 const end=await state();assert.equal(end.target.step,0);assert.equal(end.gameRevision,153);assert.equal(end.target.recoveryCount,1);assert.equal(end.materials.P.quantity,0);assert.equal(end.materials['E2:L'].quantity,0);
 assert.deepEqual(end.target.RP,{GERMAN:8,SOVIET:12});assert.equal(report.writes.length,12);check('all_12_buttons_call_real_HTTP_and_recover_T9');

 // Same-origin workbench modes never import the transaction client or submit historical data.
 const beforeModeWrites=report.writes.length;
 for(const mode of ['records','personnel','forward','demo']){
  await page.locator('#workbench-mode').selectOption(mode);
  await page.waitForURL(origin+'/');
  await page.waitForFunction(mode=>document.querySelector('#mode').value===mode,mode);
  assert.equal(await page.locator('#care').count(),0);
  assert.equal(await page.locator('script[src="/local-client.mjs"]').count(),0);
  if(mode==='forward'){
   await page.locator('#forward-branch').selectOption('synthetic');
   await page.locator('#forward-checkpoint').selectOption('held');
   assert.match(await page.locator('#f016-origin').innerText(),/SYNTHETIC/);
  }
  if(mode==='demo'){
   await page.locator('#primary-action').click();
   await page.waitForFunction(()=>document.querySelector('#status').textContent==='生产中');
  }
  assert.equal(report.writes.length,beforeModeWrites);
  assert.deepEqual(await state(),end);
  await page.locator('#mode').selectOption('local');await waitVersion(49);
 }
 check('all_archive_modes_and_demo_isolated_from_live_transactions');
 const retry=await context.request.post(origin+'/api/operations',{headers:{Origin:origin,'X-Local-Session':token,'Content-Type':'application/json'},data:careBody});
 assert.equal((await retry.json()).status,'COMMITTED');assert.deepEqual(await state(),end);check('late_care_retry_does_not_repay_or_revert_T9');
 for(const[width,height]of[[1440,1100],[820,1180],[1024,768]]){
  await page.setViewportSize({width,height});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.match(await page.locator('#recovery').innerText(),/步损 1 → 0/);
  await page.screenshot({path:new URL('./screenshots/recovered-'+width+'.png',evidence).pathname.replace(/^\/(\w:)/,'$1'),fullPage:true});
  check('live_page_layout_'+width,{horizontalOverflow:false});
 }
 await page.reload();await waitVersion(49);assert.deepEqual(await state(),end);check('completed_refresh_stays_same_instance_and_consumed_stock');
 assert.deepEqual(report.pageErrors,[]);assert.deepEqual(report.externalRequests,[]);report.finalState=end;report.browser=await browser.version();
 await writeFile(new URL('./BROWSER.json',evidence),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',checks:report.checks.length,realWrites:report.writes.length,finalGameRevision:end.gameRevision}));
}finally{await browser.close();}

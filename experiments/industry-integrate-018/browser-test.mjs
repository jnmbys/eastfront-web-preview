import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const launch=new URL(process.env.INDUSTRY018_URL),origin=launch.origin,token=new URLSearchParams(launch.hash.slice(1)).get('session');
const browser=await chromium.launch({channel:'msedge',headless:true});
const report={origin:'REAL_BROWSER_HTTP_CHAIN_WITH_LABELLED_SYNTHETIC_NETWORK_FAULTS',checks:[],writes:[],views:[],pageErrors:[]};
const check=(name,details={})=>report.checks.push({name,passed:true,...details});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1200}}),page=await context.newPage();
 page.on('pageerror',e=>report.pageErrors.push(e.message));page.on('request',r=>{if(r.method()==='POST')report.writes.push(r.postDataJSON());});
 const state=async()=>{const r=await context.request.get(origin+'/api/state',{headers:{'X-Local-Session':token}});assert.equal(r.status(),200);return r.json();};
 const settled=async version=>{await page.waitForFunction(v=>document.querySelector('#version').textContent.startsWith('根 '+v+' /')&&!sessionStorage.getItem('industry018.pending.v1'),version);};
 await page.goto(launch.href);await page.waitForFunction(()=>!document.querySelector('#allocate').disabled);
 let s=await state();assert.equal(s.gameRevision,109);assert.equal(s.version,0);assert.equal(s.equipmentBudget.granted,0);assert.equal(s.materials.P.quantity,0);assert.equal(s.materials['E2:L'].quantity,0);report.views.push(s);
 const instance=s.instanceId;
 await mkdir(new URL('./screenshots/',import.meta.url),{recursive:true});
 await page.screenshot({path:new URL('./screenshots/T5-before-order.png',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'),fullPage:true});
 let unknownTested=false,confirmedTested=false;
 for(let n=0;n<55;n++){
  s=await state();if(s.recovery)break;
  const op=['ALLOCATE_I','PLACE_ORDER','ACTIVATE_PERSONNEL','APPLY_PERSONNEL','CARE','RECOVER'].find(k=>s.operations[k].enabled)||'NEXT';
  const button={ALLOCATE_I:'allocate',PLACE_ORDER:'order',ACTIVATE_PERSONNEL:'activate',APPLY_PERSONNEL:'apply',CARE:'care',RECOVER:'recover',NEXT:'next'}[op];
  assert(s.operations[op].enabled);const next=s.version+1;
  if(op==='PLACE_ORDER'){
   // Real payment commits; only the browser's response and receipt read are lost.
   await page.route('**/api/requests/*',r=>r.abort('failed'));
   await page.route('**/api/operations',async route=>{
    const r=await route.fetch(),data=await r.json();
    for(let i=0;i<30;i++){
     const rec=await context.request.get(origin+'/api/requests/'+data.requestId,{headers:{'X-Local-Session':token}});
     if((await rec.json()).status==='COMMITTED'){await route.abort('failed');return;}
     await new Promise(r=>setTimeout(r,100));
    }throw Error('ORDER_NOT_COMMITTED');
   });
  }
  if(op==='CARE')await page.route('**/api/state',r=>r.fulfill({status:503,json:{error:'SYNTHETIC_CONFIRMED_READ_FAILURE'}}));
  await page.locator('#'+button).click();await page.locator('#'+button).dispatchEvent('click');
  if(op==='PLACE_ORDER'){
   await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('结果待确认'));
   const count=report.writes.length;assert.equal((await state()).equipmentBudget.productionSpent,3);
   await page.unroute('**/api/operations');await page.unroute('**/api/requests/*');await page.reload();await settled(next);
   assert.equal(report.writes.length,count);unknownTested=true;check('order_reply_lost_reload_queries_original_ID_no_double_order',{synthetic:'Browser drops response and receipt read'});
  }else if(op==='CARE'){
   await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('已确认提交')&&document.querySelector('#message').textContent.includes('账本尚未刷新'));
   const count=report.writes.length;assert.equal((await state()).equipmentBudget.freeI,4);
   await page.reload();await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('账本尚未刷新'));
   for(const id of ['allocate','order','activate','apply','care','next','recover'])assert(await page.locator('#'+id).isDisabled());
   await page.locator('#retry').dispatchEvent('click');assert.equal(report.writes.length,count);
   await page.unroute('**/api/state');await page.locator('#check').click();await settled(next);assert.equal(report.writes.length,count);
   confirmedTested=true;check('R1_confirmed_care_read_failure_reload_keeps_all_seven_buttons_locked',{synthetic:'503 read after actual commit'});
  }else await settled(next);
  const now=await state();assert.equal(now.instanceId,instance);report.views.push(now);
 }
 s=await state();assert(unknownTested&&confirmedTested);assert.equal(s.version,49);assert.equal(s.gameRevision,153);assert.equal(s.target.step,0);assert.equal(s.target.recoveryCount,1);
 assert.deepEqual(s.target.RP,{GERMAN:8,SOVIET:12});assert.equal(s.equipmentBudget.freeI,4);assert.equal(s.personnelBudget.carriageSpentI,1);assert.equal(s.materials.P.quantity,0);assert.equal(s.materials['E2:L'].quantity,0);assert.equal(report.writes.length,49);
 const bodies=report.writes.slice();for(const body of [bodies[0],bodies[1],bodies[22],bodies[23],bodies[44],bodies[48]]){
  const r=await context.request.post(origin+'/api/operations',{headers:{'X-Local-Session':token,Origin:origin},data:body});assert.equal((await r.json()).status,'COMMITTED');assert.deepEqual(await state(),s);
 }
 check('49_real_operations_one_instance_and_late_cross_stage_retries_no_regrant_production_payment_or_recovery');
 await page.reload();await settled(49);assert.deepEqual(await state(),s);check('completed_reload_same_instance_and_actual_ledger');
 for(const [width,height]of[[1440,1200],[820,1180]]){
  await page.setViewportSize({width,height});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:new URL('./screenshots/T9-recovered-'+width+'.png',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'),fullPage:true});
 }
 assert.deepEqual(report.pageErrors,[]);report.finalState=s;report.browser=await browser.version();
 await writeFile(new URL('./BROWSER.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({browser:'PASS',writes:report.writes.length,checks:report.checks.length}));
}finally{await browser.close();}

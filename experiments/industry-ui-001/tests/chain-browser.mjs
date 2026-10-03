// Real UI clicks and unchanged 018 transactions; read/network faults explicitly SYNTHETIC.
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const launch=new URL(process.env.INDUSTRY018_URL),origin=launch.origin,token=new URLSearchParams(launch.hash.slice(1)).get('session');
const out=process.env.UI006_EVIDENCE,ids={ALLOCATE_I:'allocate',PLACE_ORDER:'order',ACTIVATE_PERSONNEL:'activate',APPLY_PERSONNEL:'apply',CARE:'care',RECOVER:'recover',NEXT:'next'};
const browser=await chromium.launch({channel:'msedge',headless:true});
const report={origin:'REAL_BROWSER_HTTP_CHAIN_WITH_LABELLED_SYNTHETIC_NETWORK_FAULTS',checks:[],writes:[],views:[],pageErrors:[],externalRequests:[],viewports:[]};
const check=(name,details={})=>report.checks.push({name,passed:true,...details});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1100}}),page=await context.newPage();
 page.on('pageerror',e=>report.pageErrors.push(e.message));page.on('request',r=>{if(r.method()==='POST')report.writes.push(r.postDataJSON());if(new URL(r.url()).origin!==origin)report.externalRequests.push(r.url());});
 const state=async()=>{const r=await context.request.get(origin+'/api/state',{headers:{'X-Local-Session':token}});assert.equal(r.status(),200);return r.json();};
 const settled=async v=>page.waitForFunction(v=>document.querySelector('#version')?.textContent.startsWith('根 '+v+' /')&&!sessionStorage.getItem('industry018.pending.v1'),v);
 const known=async()=>{await page.waitForFunction(()=>document.querySelector('#live-status').textContent==='已提交、账本待刷新');for(const id of Object.values(ids))assert(await page.locator('#'+id).isDisabled());assert(await page.locator('#retry').isHidden());};
 const marker=()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('industry018.pending.v1')));
 const shot=async name=>{await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,'screenshots',name),fullPage:true});};
 await mkdir(path.join(out,'screenshots'),{recursive:true});await page.goto(launch.href);await page.waitForFunction(()=>!document.querySelector('#allocate')?.disabled);
 let s=await state();const instance=s.instanceId;assert.equal(s.version,0);assert.equal(s.gameRevision,109);report.views.push(s);
 assert.match(await page.locator('#freeI').innerText(),/尚未领取/);assert.match(await page.locator('#finance').innerText(),/尚未启用.*未到账/s);
 assert(await page.locator('#version').isHidden());assert(await page.locator('#raw-state').isHidden());assert.match(await page.locator('#next-hint').innerText(),/先领取原拨款并下单/);
 await shot('T5-start-desktop.png');
 const faulted=new Set();
 for(let n=0;n<55;n++){
  s=await state();if(s.recovery)break;
  const op=['ALLOCATE_I','PLACE_ORDER','ACTIVATE_PERSONNEL','APPLY_PERSONNEL','CARE','RECOVER'].find(k=>s.operations[k].enabled)||'NEXT';
  assert(s.operations[op].enabled);const next=s.version+1,inject=!faulted.has(op),beforeWrites=report.writes.length;
  for(const [key,id]of Object.entries(ids))assert.equal(await page.locator('#'+id).isDisabled(),!s.operations[key].enabled);
  const beforeView=await page.locator('#freeI').innerText();
  if(inject)await page.route('**/api/state',r=>r.fulfill({status:503,json:{error:'SYNTHETIC_CONFIRMED_READ_FAILURE'}}));
  if(op==='PLACE_ORDER'){
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
  await page.locator('#'+ids[op]).click();await page.locator('#'+ids[op]).dispatchEvent('click');
  if(op==='PLACE_ORDER'){
   await page.waitForFunction(()=>document.querySelector('#live-status').textContent.includes('结果未知'));
   assert.equal(await page.locator('#freeI').innerText(),beforeView);const original=await marker();
   assert.equal(report.writes.length,beforeWrites+1);await page.reload();
   await page.waitForFunction(()=>document.querySelector('#live-status').textContent.includes('结果未知'));
   assert.equal(report.writes.length,beforeWrites+1);assert.equal((await marker()).requestId,original.requestId);
   await page.unroute('**/api/operations');await page.unroute('**/api/requests/*');await page.locator('#retry').click();
   await known();assert.deepEqual(report.writes.at(-1),report.writes.at(-2));
   check('unknown_order_reload_and_identical_original_retry',{synthetic:'Dropped committed POST response and receipt GET',uniqueOrder:1});
  }
  if(inject){
   await known();assert.equal((await state()).version,next);const original=await marker(),count=report.writes.length;
   for(const id of [...Object.values(ids),'retry'])await page.locator('#'+id).dispatchEvent('click');
   await known();assert.equal(report.writes.length,count);
   await page.reload();await known();assert.equal((await marker()).requestId,original.requestId);
   if(op==='CARE'){
    await page.setViewportSize({width:820,height:1180});await shot('T8-committed-waiting-tablet.png');
    await page.locator('#workbench-mode').selectOption('forward');await page.waitForURL(origin+'/');
    await page.locator('#forward-branch').selectOption('synthetic');await page.locator('#forward-checkpoint').selectOption('held');
    assert.equal(await page.locator('#care').count(),0);assert.equal((await marker()).requestId,original.requestId);
    await page.locator('#mode').selectOption('local');await known();assert.equal(report.writes.length,count);
    await page.unroute('**/api/state');await page.route('**/api/state',r=>r.fulfill({json:s}));await page.locator('#check').click();
    await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('旧账本版本'));await known();
    await page.unroute('**/api/state');await page.route('**/api/state',r=>r.fulfill({json:{...s,instanceId:'SYNTHETIC-FOREIGN',version:999}}));
    await page.goto(origin+'/operate/#session=SYNTHETIC-NEW-CREDENTIAL');await known();
    assert.equal((await marker()).requestId,original.requestId);assert.equal(report.writes.length,count);
    await page.goto(launch.href);await known();check('mode_switch_foreign_instance_and_new_token_cannot_clear_confirmed_lock',{synthetic:'Foreign state and replacement credential'});
   }
   await page.unroute('**/api/state');await page.locator('#check').click();await settled(next);
   assert.equal(report.writes.length,count);faulted.add(op);
   check('confirmed_read_failure_'+op,{synthetic:'503 after actual commit',allSevenLocked:true,reloadPreservesReceipt:true,readOnlyRecovery:true});
  }else await settled(next);
  const now=await state();assert.equal(now.instanceId,instance);report.views.push(now);
  if([9,19,22,23,24,34,37,45,48].includes(now.version)){
   const writes=report.writes.length;await page.reload();await settled(now.version);assert.deepEqual(await state(),now);assert.equal(report.writes.length,writes);
   check('critical_checkpoint_refresh_'+now.version,{turn:now.turn,phase:now.phase});
  }
  if(now.version===9){assert.match(await page.locator('#chain-order').innerText(),/1\/2/);await page.setViewportSize({width:820,height:1180});await shot('E5-production-tablet.png');}
  if(now.version===19){assert.match(await page.locator('#equipment-arrival').innerText(),/E6到账，T7可用/);assert.match(await page.locator('#equipment-capacity').innerText(),/结算已关闭/);}
  if(now.version===22)assert.match(await page.locator('#chain-personnel').innerText(),/尚未启用/);
  if(now.version===23){assert.match(await page.locator('#chain-personnel').innerText(),/已启用.*尚未申请/);assert.match(await page.locator('#finance').innerText(),/2 I/);}
  if(now.version===34)assert.match(await page.locator('#personnel-arrival').innerText(),/E7到账，T8可用/);
  if(now.version===37)assert.match(await page.locator('#personnel-expiry').innerText(),/E8结束.*隔离/);
  if(now.version===38){assert.match(await page.locator('#personnel-expiry').innerText(),/E9结束/);assert.match(await page.locator('#personnel-capacity').innerText(),/已用4.*剩余0.*不刷新/);}
  if(now.version===45)assert.match(await page.locator('#arrival').innerText(),/E8到账，T9可用/);
 }
 s=await state();assert.equal(faulted.size,7);assert.equal(s.version,49);assert.equal(s.gameRevision,153);assert.equal(s.target.step,0);
 assert.deepEqual(s.target.RP,{GERMAN:8,SOVIET:12});assert.equal(s.equipmentBudget.freeI,4);assert.equal(s.materials.P.quantity,0);assert.equal(s.materials['E2:L'].quantity,0);
 const unique=[...new Map(report.writes.map(b=>[b.requestId,b])).values()];assert.equal(unique.length,49);assert.equal(report.writes.length,50);
 for(const body of [unique[0],unique[1],unique[22],unique[23],unique[37],unique[44],unique[48]]){
  const r=await context.request.post(origin+'/api/operations',{headers:{'X-Local-Session':token,Origin:origin},data:body});assert.equal((await r.json()).status,'COMMITTED');assert.deepEqual(await state(),s);
 }
 check('49_real_operations_and_cross_stage_late_retries_preserve_final_ledger');
 // An old GET is deliberately held until a newer GET has completed and cleaned pending state.
 let release,seen,first=true;const held=new Promise(r=>release=r),captured=new Promise(r=>seen=r);
 await page.route('**/api/state',async route=>{if(first){first=false;seen();await held;return route.fulfill({json:report.views[1]});}return route.continue();});
 await page.locator('#check').click();await captured;await page.locator('#check').click();
 await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('已读取后端正式状态'));
 release();await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('旧账本版本'));assert.equal(await page.locator('#freeI').innerText(),'4 I');
 await page.unroute('**/api/state');await page.route('**/api/state',r=>r.fulfill({json:report.views[1]}));await page.reload();
 await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('旧账本版本'));for(const id of Object.values(ids))assert(await page.locator('#'+id).isDisabled());
 await page.unroute('**/api/state');await page.locator('#check').click();await settled(49);check('late_old_read_and_persisted_floor_after_cleanup');
 for(const [width,height]of[[1440,1100],[820,1180],[1024,768]]){
  await page.setViewportSize({width,height});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.match(await page.locator('#recovery').innerText(),/步损 1 → 0/);
  for(const mode of ['records','personnel','forward','demo']){
   await page.locator('#workbench-mode').selectOption(mode);await page.waitForURL(origin+'/');await page.waitForFunction(m=>document.querySelector('#mode').value===m,mode);
   if(mode==='demo'){await page.locator('#primary-action').click();await page.waitForFunction(()=>document.querySelector('#status').textContent==='生产中');}
   assert.equal(report.writes.length,50);assert.deepEqual(await state(),s);await page.locator('#mode').selectOption('local');await settled(49);
  }
  await shot('T9-recovered-'+width+'.png');report.viewports.push({width,height,modeNavigation:'PASS',horizontalOverflow:false,notPhysicalDeviceAcceptance:true});
 }
 assert.deepEqual(report.pageErrors,[]);assert.deepEqual(report.externalRequests,[]);report.finalState=s;report.browser=await browser.version();
 await writeFile(path.join(out,'BROWSER.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:'PASS',checks:report.checks.length,realUniqueOperations:49,browserPOSTs:50,viewports:3}));
}finally{await browser.close();}

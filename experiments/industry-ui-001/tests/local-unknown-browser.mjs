import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const launch=new URL(process.env.INDUSTRY017_URL),origin=launch.origin;
const token=new URLSearchParams(launch.hash.slice(1)).get('session');
const browser=await chromium.launch({channel:'msedge',headless:true});
const report={origin:'REAL_TRANSACTION_WITH_SYNTHETIC_LOST_RESPONSE',checks:[],writes:[],pageErrors:[]};
try{
 const context=await browser.newContext({viewport:{width:1024,height:768}}),page=await context.newPage();
 page.on('pageerror',e=>report.pageErrors.push(e.message));
 page.on('request',r=>{if(r.method()==='POST')report.writes.push(r.postDataJSON());});
 const actual=async()=>{const r=await context.request.get(origin+'/api/state',{headers:{'X-Local-Session':token}});return r.json();};
 await page.goto(launch.href);await page.waitForFunction(()=>!document.querySelector('#care').disabled);
 let dropped=false;
 await page.route('**/api/requests/*',r=>r.abort('failed'));
 await page.route('**/api/operations',async route=>{
  const r=await route.fetch(),rec=await r.json();
  for(let i=0;i<30;i++){
   const reply=await context.request.get(origin+'/api/requests/'+rec.requestId,{headers:{'X-Local-Session':token}});
   if((await reply.json()).status==='COMMITTED'){dropped=true;return route.abort('failed');}
   await new Promise(r=>setTimeout(r,100));
  }
  throw Error('Expected real committed transaction');
 });
 await page.locator('#care').click();
 await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('结果待确认'));
 assert(dropped);assert.equal((await actual()).equipmentBudget.freeI,4);
 assert.equal(await page.locator('#freeI').innerText(),'5 I');
 const pending=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('industry017.pending.v1')));
 assert.equal(pending.confirmation,undefined);
 for(const b of ['care','next','recover'])assert(await page.locator('#'+b).isDisabled());
 await page.reload();await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('结果待确认'));
 assert.equal(report.writes.length,1);
 await page.unroute('**/api/operations');await page.unroute('**/api/requests/*');
 await page.locator('#retry').click();
 await page.waitForFunction(()=>!sessionStorage.getItem('industry017.pending.v1'));
 assert.equal(report.writes.length,2);assert.deepEqual(report.writes[0],report.writes[1]);
 assert.equal(report.writes[1].requestId,pending.requestId);
 assert.equal((await actual()).version,38);assert.equal((await actual()).equipmentBudget.freeI,4);
 assert.equal(await page.locator('#freeI').innerText(),'4 I');assert(await page.locator('#care').isDisabled());
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(report.pageErrors,[]);
 report.checks=['unknown_result_keeps_preconfirmation_display','refresh_keeps_pending_without_POST','retry_sends_identical_four_fields','committed_retry_charges_once','tablet_landscape_no_overflow'];
 report.finalState=await actual();
 await writeFile(path.join(process.env.UI005_EVIDENCE,'unknown.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({case:'unknown_retry',checks:report.checks.length,writes:2,uniqueRequests:1,status:'PASS'}));
}finally{await browser.close();}

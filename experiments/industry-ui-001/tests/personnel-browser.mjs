import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {RECORDS_013 as archive} from '../records-013.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
const results=[],errors=[],external=[],writes=[];
try{
  for(const [width,height] of [[1440,1100],[820,1180],[1024,768]]){
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>{
      const req=r.request();if(req.method()!=='GET')writes.push(req.url());
      if(new URL(req.url()).hostname!=='127.0.0.1'){external.push(req.url());return r.abort();}
      return r.continue();
    });
    await page.goto('http://127.0.0.1:4173');
    await page.locator('#primary-action').click();await page.waitForFunction(()=>document.getElementById('status').textContent==='生产中');
    const demoBalance=await page.locator('#free').innerText();
    await page.locator('#mode').selectOption('personnel');
    const text=id=>page.locator('#p013-'+id).innerText();
    const choose=id=>page.locator('#personnel-checkpoint').selectOption(id);
    async function shot(name){
      if(process.env.PERSONNEL_SCREENSHOT_DIR){
        await mkdir(process.env.PERSONNEL_SCREENSHOT_DIR,{recursive:true});
        await page.evaluate(()=>scrollTo(0,0));
        await page.screenshot({path:path.join(process.env.PERSONNEL_SCREENSHOT_DIR,name),fullPage:true});
      }
    }
    assert.equal(await page.locator('#personnel-checkpoint option').count(),25);
    assert(await page.locator('#demo-content').isHidden());assert(await page.locator('#records-content').isHidden());
    assert.equal(await page.locator('#personnel-content button').count(),0);
    assert.match(await page.locator('#mode-banner').innerText(),/013.*只读静态数据，非实时连接/);
    for(const r of archive.records){
      await choose(r.id);
      assert(await page.locator('#p013-error').isHidden(),r.id);
      const v=r.view,w=v.warehouse,p=v.personnelBudget,e=v.equipment012Budget;
      assert.equal(await text('source'),archive.sourceCommit);assert.equal(await text('schema'),v.schema);
      assert.equal(await text('source-label'),r.sourceLabel);assert.equal(await text('origin'),v.origin);
      assert.equal(await text('phase'),'T'+v.turn+' / '+v.phase);
      assert.equal(await text('resident'),w.residentP+' P');assert.equal(await text('available'),w.availableP+' P');
      assert.equal(await text('quarantine'),w.quarantinedResidentP+' P');assert.equal(await text('incoming'),w.incomingHeldP+' P');
      assert.equal(await text('equipment'),'2 E2');
      assert.equal(await text('p-granted'),p.grantedI+' I');assert.equal(await text('p-free'),p.availableI+' I');
      assert.equal(await text('p-escrow'),p.escrowI+' I');assert.equal(await text('care-paid'),p.acceptanceCareSpentI+' I');
      assert.equal(await text('carriage-paid'),p.carriageSpentI+' I');
      assert.equal(await text('p-spent'),(p.acceptanceCareSpentI+p.carriageSpentI)+' I');
      assert.equal(await text('e-granted'),e.granted+' I');assert.equal(await text('e-free'),'5 I');assert.equal(await text('e-spent'),'5 I');
      assert.match(await text('training'),/无实际训练回执/);assert.match(await text('permissions'),/false/);
      assert.equal(await page.locator('#p013-ids dd').count(),7);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width+' '+r.id);
      if(v.origin!=='REAL')assert.match(await text('boundary'),/不是真实推进证明/);
      if(r.id==='checkpoint:E7'){
        assert.equal(await text('available'),'1 P');assert.match(await text('boundary'),/真实 E7.*T8/);
        assert.match(await text('quota-detail'),/4 \/ 0 \/ 0 LQ.*已用尽/);assert.match(await text('expiry'),/E8 结束后/);
        if(width===1440)await shot('ui003-desktop-e7-t8.png');
      }
      if(r.label==='end_T8_rear_care_expired'){
        assert.equal(await text('resident'),'1 P');assert.equal(await text('quarantine'),'1 P');assert.equal(await text('available'),'0 P');
        assert.match(await text('occupancy'),/1 \/ 1 P/);assert.match(await text('care-note'),/合成.*隔离仍占仓容/);
        if(width===820)await shot('ui003-tablet-portrait-expiry.png');
      }
      if(r.label.startsWith('failure_')){
        assert.match(await text('failure'),/失败前已提交账本/);assert.match(await text('failure'),new RegExp(v.lastRequestError.detail));
        assert.equal(await text('p-escrow'),'1 I');assert.equal(await text('carriage-paid'),'0 I');assert.equal(await text('resident'),'0 P');
        if(width===1024&&r.label==='failure_after_receipt')await shot('ui003-tablet-landscape-failure.png');
      }
      if(r.label.startsWith('early_terminal_'))assert.match(await text('status'),/终局样例/);
    }
    for(const fault of ['schema','field','account','subset']){
      await page.evaluate(async fault=>{
        const {RECORDS_013:a}=await import('/records-013.mjs');
        const {mapPersonnelRecord:m}=await import('/personnel-adapter.mjs');
        const {renderPersonnel:r}=await import('/personnel-view.mjs');
        const item=structuredClone(a.records.find(x=>x.id==='checkpoint:T8'));
        if(fault==='schema')item.view.schema='unknown';else if(fault==='field')delete item.view.warehouse.capacityP;
        else if(fault==='account'){item.view.personnelBudget.availableI++;item.view.equipment012Budget.freeI--;}
        else item.view.warehouse.quarantinedResidentP++;
        r(m(item,a.sourceCommit),a);
      },fault);
      assert(await page.locator('#p013-data').isHidden());assert(await page.locator('#p013-error').isVisible());
      assert.match(await text('error'),fault==='schema'?/schema 未知/:fault==='field'?/capacityP 未提供/:fault==='account'?/人员账户不守恒.*装备账户不守恒/:/不是实物子集/);
    }
    await choose('checkpoint:T8');assert.equal(await text('resident'),'1 P');assert(await page.locator('#p013-error').isHidden());
    await page.locator('#reset').dispatchEvent('click');await page.locator('#primary-action').dispatchEvent('click');
    await page.locator('#mode').selectOption('records');await page.locator('#checkpoint').selectOption('T7');
    assert.equal(await page.locator('#record-personnel').innerText(),'0 P');assert.equal(await page.locator('#record-rear').innerText(),'2 E2');
    await page.locator('#mode').selectOption('personnel');assert.equal(await text('resident'),'1 P');assert.equal(await text('equipment'),'2 E2');
    await page.locator('#mode').selectOption('demo');assert.equal(await page.locator('#free').innerText(),demoBalance);
    assert.equal(await page.locator('#clock').innerText(),'T5');assert.equal(await page.locator('#status').innerText(),'生产中');
    await page.locator('#primary-action').click();assert.equal(await page.locator('#clock').innerText(),'E5');
    await page.locator('#mode').selectOption('personnel');assert.equal(await text('available'),'1 P');
    await page.locator('.personnel-evidence summary').click();
    assert.equal(await page.locator('#p013-hashes dd').count(),9);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert(await page.locator('button,select,summary').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length>0).every(n=>n.getBoundingClientRect().height>=44)));
    results.push({viewport:width+'x'+height,records:25,originalSamples:18,sourceAndFieldMapping:'PASS',independentAccounts:'PASS',
      singleWarehouseNoDoubleCount:'PASS',quarantineSubsetCapacity:'PASS',expiryProvenance:'PASS',failurePrecommitLedger:'PASS',
      unknownSchemaAndMissingFields:'PASS',invalidAccountAndSubset:'PASS',threeModeIsolation:'PASS',noPersonnelActionButtons:'PASS',horizontalOverflow:false});
    await context.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(writes,[]);
  const report={task:'INDUSTRY-UI-003',uiBaseCommit:archive.uiBaseCommit,sourceCommit:archive.sourceCommit,
    kind:'Browser viewport checks only; not physical device acceptance',browser:await browser.version(),results,pageErrors:errors,externalRequests:external,writeRequests:writes};
  await writeFile(new URL('../UI003-VALIDATION.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}


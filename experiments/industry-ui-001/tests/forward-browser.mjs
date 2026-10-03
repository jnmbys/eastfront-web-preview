import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {RECORDS_016 as a} from '../records-016.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
const results=[],errors=[],external=[],writes=[];
try{
  for(const [width,height] of [[1440,1100],[820,1180],[1024,768]]){
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>{const req=r.request();if(req.method()!=='GET')writes.push(req.url());if(new URL(req.url()).hostname!=='127.0.0.1'){external.push(req.url());return r.abort();}return r.continue();});
    await page.goto('http://127.0.0.1:4173');
    await page.locator('#primary-action').click();await page.waitForFunction(()=>document.getElementById('status').textContent==='生产中');
    const balance=await page.locator('#free').innerText();
    await page.locator('#mode').selectOption('forward');
    const text=id=>page.locator('#f016-'+id).innerText();
    const select=async id=>{const r=a.records.find(r=>r.id===id);await page.locator('#forward-branch').selectOption(r.branch);await page.locator('#forward-checkpoint').selectOption(id);};
    const cells=async(id,index)=>page.locator('#f016-'+id+' tr').nth(index).locator('td').allInnerTexts();
    const shot=async name=>{if(process.env.FORWARD_SCREENSHOT_DIR){await mkdir(process.env.FORWARD_SCREENSHOT_DIR,{recursive:true});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(process.env.FORWARD_SCREENSHOT_DIR,name),fullPage:true});}};
    assert.equal(await page.locator('#forward-content button').count(),0);
    assert(await page.locator('#demo-content').isHidden());assert(await page.locator('#records-content').isHidden());assert(await page.locator('#personnel-content').isHidden());
    for(const r of a.records){
      await select(r.id);assert(await page.locator('#f016-error').isHidden(),r.id);
      assert.equal(await text('source'),a.sourceCommit);assert.equal(await text('schema'),r.view.schema);
      assert.equal(await text('origin'),r.origin);assert.equal(await text('source-origin'),r.sourceOrigin);
      assert.equal(await text('time'),'T'+r.view.turn+' / '+r.view.phase);
      assert.match(await text('label'),new RegExp(r.sourceLabel));
      const options=await page.locator('#forward-checkpoint option').evaluateAll(nodes=>nodes.map(n=>n.value));
      assert.deepEqual(options,a.records.filter(x=>x.branch===r.branch).map(x=>x.id));
      for(const [i,key] of ['P','E2:L'].entries()){
        const row=await cells('materials',i),m=r.view.materials[key],quantity=key==='P'?m.quantityP:m.quantityE2;
        assert.equal(Number(row[2]),quantity);
        assert.equal(Number(row[4]),m.custody.includes('QUARANTINED')?quantity:0);
        assert.equal(Number(row[5]),m.custody==='CONSUMED'?(key==='P'?m.consumedP016:m.consumedE2016):0);
      }
      const finance=await cells('finance',0);assert.equal(finance[2],r.view.equipmentBudget.freeI+' I');
      assert.match(await text('global'),/保留 35 项，关闭 0 项/);
      assert.match(await text('personnel-source'),/实验假定.*无实际训练回执.*不代表训练系统已完成/);
      if(r.id==='received'){
        assert.equal(await text('time'),'T9 / GERMAN_SUPPLY_RAIL');
        assert.equal(await text('route'),'A10 → B10 → C10');
        assert.match(await text('shipment'),/E8 发运.*E8 到账.*T9/);
        assert.equal(await text('revision'),'149 / 45 / 1');
      }
      if(r.id==='preRecovery')assert.equal(await text('revision'),'152 / 48 / 1');
      if(r.id==='recovered'){
        assert.match(await text('recovery'),/G-I-01 步损 1 → 0/);assert.match(await text('payment'),/消费 1 P \+ 2 E2；RP 0，新增W 0/);
        assert.equal(await text('rp-change'),'德 8 / 苏 12 → 德 8 / 苏 12（不变）');
        assert.match(await text('finance-note'),/5 → 4 I.*不是新增收入/);
        const transport=await cells('transport',3);assert.deepEqual(transport,['W:GH2','96','88','8','0','0','8']);
        assert.match(await text('terminal'),/8W仅计一次/);
        assert.deepEqual(await cells('impact',0),['G-I-01','1 → 1 SP','0 → 0','2 → 3 SP','+1 SP']);
        assert.deepEqual(await cells('impact',1),['G-PZ-01','2 → 2 SP','0 → 0','6 → 5.5 SP','-0.5 SP']);
        assert.deepEqual(await cells('impact',2),['G-REC-02','0.5 → 0 SP','2 → 2.5','0 → 0 SP','0 SP']);
        if(width===1440)await shot('ui004-desktop-recovered.png');
      }
      if(r.id==='controlExpired'){
        assert.match(await text('branch-note'),/未付照管、未发运.*不是主线/);
        assert.equal((await cells('materials',0))[4],'1');assert.equal((await cells('materials',1))[4],'0');
        assert(await page.locator('#f016-impact-panel').isHidden());assert(await page.locator('#f016-e9-panel').isHidden());
      }
      if(r.id==='unusedExpired'){
        assert.match(await text('branch-note'),/跳过恢复.*不是已恢复主线/);
        assert.match(await text('time'),/^T10/);assert.match(await text('capacity'),/C10实物 1 P \+ 2 E2/);
        assert(await page.locator('#f016-e9-panel').isVisible());assert.match(await text('e9-panel'),/没有同期E9无货运对照.*不能把以下全部损失归因/);
        assert.match(await text('e9-maintenance'),/68 q = 17 SP.*128 q = 32 SP/);
        assert.equal(await page.locator('#f016-e9-losses li').count(),5);
        if(width===820)await shot('ui004-tablet-unused-e9.png');
      }
      if(r.origin==='SYNTHETIC'){
        assert.match(await text('branch-note'),/不属于真实主线/);assert(await page.locator('#f016-impact-panel').isHidden());assert(await page.locator('#f016-e9-panel').isHidden());
        if(r.requestError)assert.match(await text('request-error'),/已回滚.*失败前已提交账本/);
        if(r.id==='held'){
          assert.match(await text('shipment'),/未到账/);assert.match(await text('capacity'),/入库预留 1 P \+ 2 E2/);
          if(width===1024)await shot('ui004-tablet-synthetic-held.png');
        }
        if(r.id==='heldExpired')assert.match(await text('capacity'),/入库预留 0 P \+ 0 E2/);
      }
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),r.id+' overflow '+width);
    }
    for(const fault of ['schema','field']){
      await page.evaluate(async fault=>{
        const {RECORDS_016:a}=await import('/records-016.mjs'),{mapForwardRecord:m}=await import('/forward-adapter.mjs'),{renderForward:r}=await import('/forward-view.mjs');
        const item=structuredClone(a.records.find(x=>x.id==='recovered'));if(fault==='schema')item.view.schema='unknown';else delete item.view.care.spentI;r(m(item,a),a);
      },fault);
      assert(await page.locator('#f016-data').isHidden());assert(await page.locator('#f016-error').isVisible());
      assert.match(await text('error'),fault==='schema'?/schema 未知/:/care.spentI 未提供/);
    }
    await select('recovered');assert(await page.locator('#f016-error').isHidden());
    await page.locator('#reset').dispatchEvent('click');await page.locator('#primary-action').dispatchEvent('click');
    await page.locator('#mode').selectOption('records');await page.locator('#checkpoint').selectOption('T7');
    assert.equal(await page.locator('#record-rear').innerText(),'2 E2');assert.equal(await page.locator('#record-personnel').innerText(),'0 P');
    await page.locator('#mode').selectOption('personnel');await page.locator('#personnel-checkpoint').selectOption('checkpoint:T8');
    assert.equal(await page.locator('#p013-resident').innerText(),'1 P');assert.equal(await page.locator('#p013-equipment').innerText(),'2 E2');
    await page.locator('#mode').selectOption('forward');assert.equal((await cells('materials',0))[2],'0');assert.equal((await cells('materials',1))[2],'0');
    await page.locator('#mode').selectOption('demo');assert.equal(await page.locator('#free').innerText(),balance);assert.equal(await page.locator('#clock').innerText(),'T5');
    await page.locator('#primary-action').click();assert.equal(await page.locator('#clock').innerText(),'E5');
    await page.locator('#mode').selectOption('forward');
    await page.locator('#forward-content details').last().locator('summary').click();
    assert.equal(await page.locator('#f016-hashes dd').count(),10);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert(await page.locator('button,select,summary').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).every(n=>n.getBoundingClientRect().height>=44)));
    results.push({viewport:width+'x'+height,realCheckpoints:7,syntheticSamples:5,branchIsolation:'PASS',arrivalVsRecoveryTime:'PASS',moneyAndInternalTransfer:'PASS',materialAndQuarantineSubsets:'PASS',capacityAndSingleWCharge:'PASS',RPAndStepRecovery:'PASS',E8Costs:'PASS',E9AttributionLimit:'PASS',rollbackAndRefusal:'PASS',schemaAndMissingField:'PASS',fourModeIsolation:'PASS',noWriteButtons:true,horizontalOverflow:false});
    await context.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(writes,[]);
  const report={task:'INDUSTRY-UI-004',uiBaseCommit:a.uiBaseCommit,sourceCommit:a.sourceCommit,kind:'Browser viewport checks only; not physical device acceptance',browser:await browser.version(),results,pageErrors:errors,externalRequests:external,writeRequests:writes};
  await writeFile(new URL('../UI004-VALIDATION.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}


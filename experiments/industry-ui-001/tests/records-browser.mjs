import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
const results=[],errors=[],external=[],writes=[];
try {
  for(const [width,height] of [[1440,1100],[820,1180],[1024,768]]){
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>{const request=r.request();if(request.method()!=='GET')writes.push(request.url());
      if(new URL(request.url()).hostname!=='127.0.0.1'){external.push(request.url());return r.abort();}return r.continue();});
    await page.goto('http://127.0.0.1:4173');
    await page.locator('#primary-action').click();await page.waitForFunction(()=>document.getElementById('status').textContent==='生产中');
    const demoBudget=await page.locator('#free').innerText();
    await page.locator('#mode').selectOption('records');
    const t=id=>page.locator('#'+id).innerText();
    const choose=label=>page.locator('#checkpoint').selectOption(label);
    async function checkLayout(){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width}`);}
    async function shot(name){if(process.env.RECORD_SCREENSHOT_DIR){await mkdir(process.env.RECORD_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.RECORD_SCREENSHOT_DIR,name),fullPage:true});}}
    assert(await page.locator('#demo-content').isHidden()); assert.equal(await page.locator('.readonly-actions button:disabled').count(),3);
    assert.match(await t('mode-banner'),/只读静态数据，非实时连接/);
    assert.equal(await t('record-source'),'e64c0e11fb16b05cfe725240193e8590b4eefd88');
    assert.equal(await page.locator('#checkpoint option').count(),16);
    for(const checkpoint of ['initial','funded','accepted','E5','E6','T7']){
      await choose(checkpoint);assert.equal(await t('record-origin'),'REAL');assert(await page.locator('#record-error').isHidden());
      if(checkpoint==='initial'){assert.equal(await t('record-granted'),'0 I');assert.equal(await t('record-free'),'0 I');}
      if(checkpoint==='funded')assert.equal(await t('record-free'),'10 I');
      if(checkpoint==='accepted'){assert.equal(await t('record-production-hold'),'2 E2');assert.equal(await t('record-produced'),'0 E2:L');}
      if(checkpoint==='E5'){
        assert.equal(await t('record-turn'),'T6');assert.match(await t('record-progress'),/^1 \/ 2/);
        const cells=await page.locator('#record-capacity tr').first().locator('td').allInnerTexts();
        assert.equal(cells[5],'4');assert.match(cells[6],/已关闭.*可用 0.*不结转/);
      }
      if(checkpoint==='E6'){
        assert.equal(await t('record-turn'),'T7');assert.equal(await t('record-phase'),'GERMAN_SUPPLY_RAIL');
        assert.equal(await t('record-available'),'2 E2');assert.match(await t('record-boundary-note'),/未导出真实/);
        if(width===1440)await shot('ui002-desktop-e6-t7.png');
      }
      if(checkpoint==='T7')assert.equal(await t('record-phase'),'GERMAN_RECOVERY');
      await checkLayout();
    }
    for(const label of ['blocked_used_capacity','blocked_reserved_capacity','blocked_both_capacity','blocked_warehouse_hold','blocked_dispatch','blocked_receipt']){
      await choose(label);assert.equal(await t('record-origin'),'SYNTHETIC_FIXTURE');assert.equal(await t('record-rear'),'0 E2');assert.equal(await t('record-available'),'0 E2');
      assert.match(await t('record-blockers'),/SERVICE_WINDOW_EXPIRED_NO_AUTOMATIC_RETRY/);
      if(label==='blocked_receipt'){
        assert.equal(await t('record-transit'),'2 E2');assert.equal(await t('record-incoming-hold'),'2 E2');assert.equal(await t('record-escrow'),'0 I');assert.equal(await t('record-spent'),'5 I');
        if(width===820)await shot('ui002-tablet-held.png');
      }else{assert.equal(await t('record-buffer'),'2 E2');assert.equal(await t('record-escrow'),'2 I');}
      if(label==='blocked_warehouse_hold')assert.equal(await t('record-incoming-hold'),'1 E2');
      await checkLayout();
    }
    for(const label of ['failure_after_output','failure_after_dispatch','failure_after_receipt','failure_before_commit']){
      await choose(label);assert.equal(await t('record-origin'),'SYNTHETIC_FAULT_ON_REAL_REPLAY');
      assert.equal(await t('record-turn'),'T6');assert.equal(await t('record-phase'),'SOVIET_ENTRENCHMENT');
      assert.equal(await t('record-escrow'),'2 I');assert.equal(await t('record-spent'),'3 I');assert.equal(await t('record-produced'),'0 E2:L');
      assert.match(await t('record-error-detail'),/REJECTED_NO_DOMAIN_COMMIT/);assert.match(await t('record-progress'),/^1 \/ 2/);
    }
    assert.equal((await page.locator('#record-unprovided dd').allInnerTexts()).filter(x=>x==='未提供').length,4);
    for(const fault of ['schema','field']){
      await page.evaluate(async fault=>{
        const {RECORDS_012}=await import('/records-012.mjs');const {mapRecord}=await import('/record-adapter.mjs');const {renderRecord}=await import('/record-view.mjs');
        const r=structuredClone(RECORDS_012.records.find(r=>r.label==='T7'));
        if(fault==='schema')r.view.schema='unknown-schema';else delete r.view.budget.escrowI;
        renderRecord(mapRecord(r,RECORDS_012.sourceCommit));
      },fault);
      assert(await page.locator('#record-data').isHidden());assert(await page.locator('#record-error').isVisible());
      assert.match(await t('record-error'),fault==='schema'?/schema 未知/:/escrowI 未提供/);
      assert.equal(await page.locator('.readonly-actions button:disabled').count(),3);
    }
    await choose('E6');assert(await page.locator('#record-error').isHidden());assert.equal(await t('record-available'),'2 E2');
    // Hidden demo event handlers are also mode-gated, so synthetic dispatchEvent cannot mutate it.
    await page.locator('#reset').dispatchEvent('click');await page.locator('#primary-action').dispatchEvent('click');
    await page.locator('#mode').selectOption('demo');assert.equal(await t('free'),demoBudget);assert.equal(await t('clock'),'T5');assert.equal(await t('status'),'生产中');
    await page.locator('#primary-action').click();assert.equal(await t('clock'),'E5');
    await page.locator('#mode').selectOption('records');assert.equal(await t('record-available'),'2 E2');
    await checkLayout();
    assert(await page.locator('button,select').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length>0).every(n=>n.getBoundingClientRect().height>=44)));
    results.push({viewport:`${width}x${height}`,checkpoints:6,syntheticCases:10,closedCapacity:'PASS',failureRollbackBalances:'PASS',missingQuoteCapacityPermissions:'PASS',unknownSchema:'PASS',missingField:'PASS',readonlyMode:'PASS',modeIsolation:'PASS',horizontalOverflow:false});
    await context.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(writes,[]);
  const report={task:'INDUSTRY-UI-002',sourceCommit:'e64c0e11fb16b05cfe725240193e8590b4eefd88',uiBaseCommit:'00a97635d882509675fe4d5f6e789cdbc791fdc0',kind:'Browser viewport checks, not physical device acceptance',browser:await browser.version(),results,pageErrors:errors,externalRequests:external,writeRequests:writes};
  await writeFile(new URL('../UI002-VALIDATION.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}

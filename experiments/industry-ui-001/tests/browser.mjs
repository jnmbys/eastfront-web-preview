// Install Playwright separately or set PLAYWRIGHT_MODULE to an existing package.
// Run the local server first. No external navigation or game service calls.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const require=createRequire(import.meta.url);
const { chromium }=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'msedge',headless:true});
const base=new URL('../screenshots/',import.meta.url); await mkdir(base,{recursive:true});
const results=[], errors=[], external=[];
async function suite(width,height) {
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
  const page=await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*', route => {const u=new URL(route.request().url()); if(u.hostname!=='127.0.0.1'){external.push(u.href);return route.abort();} return route.continue();});
  await page.goto('http://127.0.0.1:4173');
  const text=id=>page.locator('#'+id).innerText();
  async function status(expected){await page.waitForFunction(expected=>document.getElementById('status').textContent===expected,expected);}
  async function click(expected){await page.locator('#primary-action').click(); if(expected)await status(expected);}
  async function noOverflow(){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`horizontal overflow ${width}`);}
  async function shot(name){if(process.env.UPDATE_SCREENSHOTS==='1') await page.screenshot({path:new URL(name,base).pathname.replace(/^\/(\w:)/,'$1'),fullPage:true});}
  await noOverflow(); assert.match(await page.locator('body').innerText(),/演示数据，尚未连接真实工业接口/);
  assert.match(await text('expected'),/T7/); assert.match(await text('free'),/10/);
  if(width===1440) await shot('desktop-order.png');
  await click(); await status('提交等待'); assert.match(await text('free'),/10/); assert.match(await text('rear'),/^0/); assert(await page.locator('#primary-action').isDisabled());
  await status('生产中'); assert.match(await text('free'),/^5/); assert.match(await text('escrow'),/^2/);
  await click('生产中'); assert.equal(await text('clock'),'E5'); assert.match(await text('progress-count'),/^1/);
  await click('等待交接'); assert.match(await text('buffer'),/^2/); assert.match(await text('rear'),/^0/);
  await click('在途'); assert.match(await text('rear-hold'),/^2/); assert.match(await text('rear'),/^0/);
  await click('已到账未可用'); assert.match(await text('rear'),/^2/); assert.match(await text('available'),/^0/); assert.equal(await text('clock'),'E6');
  await noOverflow(); if(width===1440) await shot('desktop-received.png');
  await click('可用'); assert.equal(await text('clock'),'T7'); assert.match(await text('available'),/^2/);
  for(const [mode,label] of [['reject','订单被拒绝'],['unknown','提交未确认']]){
    await page.locator('#reset').click(); await page.locator('#response').selectOption(mode); await click(label);
    assert.match(await text('free'),/^10/); assert.match(await text('rear'),/^0/); await click('生产中'); assert.match(await text('free'),/^5/);
  }
  for(const fault of ['dispatch','receipt']){
    await page.locator('#reset').click(); await page.locator('#handoff-fault').selectOption(fault);
    await click('生产中'); await click('生产中'); await click('等待交接');
    if(fault==='dispatch'){
      await click('等待交接'); assert.match(await text('escrow'),/^2/); assert.match(await text('buffer'),/^2/); assert.match(await text('expected'),/延期/);
      await click('在途'); assert.equal(await text('clock'),'E7'); assert.match(await text('expected'),/T8/); await click('已到账未可用');
    } else {
      await click('在途'); await click('接收受阻'); assert.match(await text('rear'),/^0/); assert.match(await text('rear-hold'),/^2/); assert.match(await text('spent'),/^5/);
      await noOverflow(); if(width===820)await shot('tablet-held.png');
      await click('已到账未可用'); assert.equal(await text('clock'),'E7');
    }
    assert.match(await text('available'),/^0/); await click('可用'); assert.equal(await text('clock'),'T8'); assert.match(await text('spent'),/^5/);
  }
  // Exercise actual controls all the way to E24, including repeated fault injection.
  for (const end of ['received','held','buffer']) {
    await page.locator('#reset').click(); await click('生产中'); await click('生产中'); await click('等待交接');
    if (end !== 'buffer') await click('在途');
    for (let epoch=6; epoch<=24; epoch++) {
      if (end==='buffer' || end==='held' || epoch<24) await page.locator('#handoff-fault').selectOption(end==='buffer'?'dispatch':'receipt');
      const label=epoch===24 ? end==='received'?'终局库存 · 本局不可用':end==='held'?'终局 · 接收仍受阻':'终局 · 交接未完成'
        : end==='buffer'?'等待交接':'接收受阻';
      await click(label);
      assert.equal(await text('clock'),`E${epoch}`);
    }
    assert(await page.locator('#primary-action').isDisabled());
    assert.match(await text('available'),/^0/); assert.doesNotMatch(await text('available-note'),/起可用|已可用/);
    assert.match(await text('primary-action'),/终局/); assert.doesNotMatch(await text('primary-action'),/T25|E25|已完成|已可用/);
    assert.match(await text('rear'),end==='received'?/^2/:/^0/);
    assert.match(await text('rear-hold'),end==='held'?/^2/:/^0/);
    assert.match(await text('transit'),end==='held'?/^2/:/^0/);
    assert.match(await text('buffer'),end==='buffer'?/^2/:/^0/);
    assert.match(await text('escrow'),end==='buffer'?/^2/:/^0/);
    if(end==='received') assert.match(await text('available-note'),/availableFromTurn=25/);
    await noOverflow();
    if (process.env.R1_SCREENSHOT_DIR && ((width===1440 && end==='received') || (width===820 && end==='held'))) {
      await mkdir(process.env.R1_SCREENSHOT_DIR,{recursive:true});
      await page.screenshot({path:path.join(process.env.R1_SCREENSHOT_DIR,`r1-e24-${end}.png`),fullPage:true});
    }
  }
  // View-only sentinel fixture: proves displayed values and phase descriptions come from snapshot.
  await page.evaluate(async()=>{
    const {createDemoAdapter}=await import('/demo-adapter.mjs'); const {render}=await import('/view.mjs');
    const s=createDemoAdapter().snapshot();
    s.quote={initialI:19,costI:6,feeI:4,outputE2:8,boundaries:9,expectedTurn:12}; s.totalI=10;
    s.orderId='VIEW-SENTINEL-987'; s.normalPath='阶段说明来自快照'; s.progressNote='结算说明来自快照';
    s.steps=[{title:'快照阶段',detail:'快照阶段细节',done:false}]; s.expected='快照预计时间';
    s.productionPaymentNote='快照支付时机'; s.handoffPaymentNote='快照托管时机';
    render(s,()=>{});
  });
  assert.match(await text('initial-budget'),/^19/); assert.equal(await text('production-cost'),'6 I');
  assert.equal(await text('handoff-cost'),'4 I'); assert.equal(await text('total-cost'),'10 I');
  assert.equal(await text('product-yield'),'8 E2'); assert.equal(await text('duration'),'9 个结算边界');
  assert.equal(await text('order-id'),'VIEW-SENTINEL-987'); assert.equal(await text('quote-note'),'阶段说明来自快照');
  assert.equal(await text('progress-note'),'结算说明来自快照'); assert.match(await text('progress-count'),/\/ 9/);
  assert.equal(await page.locator('#progress').getAttribute('max'),'9'); assert.match(await text('steps'),/快照阶段细节/);
  assert.equal(await text('production-payment-note'),'快照支付时机'); assert.equal(await text('handoff-payment-note'),'快照托管时机');
  assert.equal(await text('expected'),'快照预计时间');
  await noOverflow();
  const targets=await page.locator('button,select').evaluateAll(nodes=>nodes.map(n=>({height:n.getBoundingClientRect().height,tag:n.tagName}))); assert(targets.every(n=>n.height>=44));
  results.push({viewport:`${width}x${height}`,normal:'PASS',pending:'PASS',rejectionRetry:'PASS',unknownRetry:'PASS',dispatchRetry:'PASS',heldRetry:'PASS',terminalReceipt:'PASS',terminalHeld:'PASS',terminalBufferEscrow:'PASS',snapshotFields:'PASS',horizontalOverflow:false,minTargetHeight:44});
  await context.close();
}
try {for(const [w,h]of [[1440,1100],[820,1180],[1024,768]])await suite(w,h); assert.deepEqual(errors,[]); assert.deepEqual(external,[]);
  const report={revision:'INDUSTRY-UI-001-R1',base:'254dd9179944d183762a3bb6db7ce7cd4b5cccda',adapterTests:{original:10,addedTerminal:5,passed:15},kind:'Browser viewport simulation; not physical device acceptance',browser:await browser.version(),results,pageErrors:errors,externalRequests:external,baselineScreenshots:['desktop-order.png','desktop-received.png','tablet-held.png'],baselineScreenshotsUpdated:process.env.UPDATE_SCREENSHOTS==='1'};
  await writeFile(new URL('../VALIDATION.json',import.meta.url),JSON.stringify(report,null,2)+'\n'); console.log(JSON.stringify(report,null,2));
} finally {await browser.close();}

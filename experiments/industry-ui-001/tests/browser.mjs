// Install Playwright separately or set PLAYWRIGHT_MODULE to an existing package.
// Run the local server first. No external navigation or game service calls.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
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
  async function shot(name){await page.screenshot({path:new URL(name,base).pathname.replace(/^\/(\w:)/,'$1'),fullPage:true});}
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
  await noOverflow();
  const targets=await page.locator('button,select').evaluateAll(nodes=>nodes.map(n=>({height:n.getBoundingClientRect().height,tag:n.tagName}))); assert(targets.every(n=>n.height>=44));
  results.push({viewport:`${width}x${height}`,normal:'PASS',pending:'PASS',rejectionRetry:'PASS',unknownRetry:'PASS',dispatchRetry:'PASS',heldRetry:'PASS',horizontalOverflow:false,minTargetHeight:44});
  await context.close();
}
try {for(const [w,h]of [[1440,1100],[820,1180],[1024,768]])await suite(w,h); assert.deepEqual(errors,[]); assert.deepEqual(external,[]);
  const report={kind:'Browser viewport simulation; not physical device acceptance',browser:await browser.version(),results,pageErrors:errors,externalRequests:external,screenshots:['desktop-order.png','desktop-received.png','tablet-held.png']};
  await writeFile(new URL('../VALIDATION.json',import.meta.url),JSON.stringify(report,null,2)+'\n'); console.log(JSON.stringify(report,null,2));
} finally {await browser.close();}

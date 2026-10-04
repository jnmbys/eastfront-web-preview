import {createRequire} from 'node:module';import {writeFileSync} from 'node:fs';import assert from 'node:assert/strict';
const pw=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE??'playwright');
const browser=await pw.chromium.launch({headless:true,executablePath:process.env.STARTUP003_CHROMIUM});
const rows=[];
try{for(const fault of [false,true]){
 const context=await browser.newContext(),page=await context.newPage();page.setDefaultTimeout(120000);
 if(fault)await page.route('**/strategic-reset-f-map.json',route=>route.fulfill({status:404,body:'Local preflight failure fixture'}));
 await page.goto('http://127.0.0.1:4290/');await page.locator('#device').fill(fault?'Desktop synthetic failure preflight (not device)':'Desktop screenshot export preflight (not device)');await page.locator('#network').fill('127.0.0.1 local preflight');await page.locator('#start').click();
 if(fault){await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('已保存到本机并校验'));const data=JSON.parse(await page.locator('#backup').inputValue());assert.equal(data.outcome,'failed');assert.equal(data.progress.stage,'failed');rows.push({kind:'synthetic-local-failure',jsonPersisted:true,autoRefresh:false,marks:data.marks});}
 else{await page.waitForFunction(()=>!document.querySelector('#shot').disabled);await page.locator('#shot').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('地形截图已保存'));rows.push({kind:'local-screenshot',status:await page.locator('#status').textContent});}
 await context.close();
}writeFileSync('evidence/startup-004/aux-preflight.json',JSON.stringify({kind:'LOCAL_PREFLIGHT_ONLY_NOT_DEVICE',rows},null,2)+'\n',{flag:'wx'});}finally{await browser.close();}

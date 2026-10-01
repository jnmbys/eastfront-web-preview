import fs from 'node:fs';
import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.TEST_PLAYWRIGHT??'file:///C:/Users/jinyibo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out='experiments/supply-ux-020/evidence/second-attack';
let browser,log='';const server=spawn(process.env.TEST_PYTHON??'C:/Users/jinyibo/eastfront/extracted/eastfront-web-preview-a3346e4c34567811fb07652cb26b706833daa183/.venv/Scripts/python.exe',['-X','utf8','experiments/supply-ux-020/second_browser.py'],{windowsHide:true});
server.stdout.on('data',d=>log+=d);server.stderr.on('data',d=>log+=d);
const report={scope:'single second-attack scenario; real local browser/HTTP; no deployment/touch claim',errors:[]};
try{
 const start=Date.now();while(!log.includes('SECOND_READY')){if(Date.now()-start>15000||server.exitCode!==null)throw Error(log);await new Promise(r=>setTimeout(r,50));}
 browser=await chromium.launch({headless:true,executablePath:process.env.TEST_BROWSER??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});report.browser=await browser.version();
 const page=await browser.newPage({viewport:{width:1440,height:1800}});page.setDefaultTimeout(12000);page.on('pageerror',e=>report.errors.push(String(e)));
 await page.goto('http://127.0.0.1:8782/?supply=experiment');await page.locator('#supply-start').click();
 const switched=page.waitForResponse(r=>r.url().endsWith('/experiment')&&r.request().postDataJSON()?.op==='switch');await page.locator('#supply-handoff').click();await (await switched).finished();await page.waitForFunction(()=>document.querySelector('.map-toolbar')?.textContent.includes('德军视角'));
 await page.locator('[data-role="schwerpunkt-target"][data-hex="5,6"]').waitFor();await page.locator('[data-unit-id="S-I-02"]').first().click();
 await page.waitForFunction(()=>document.querySelector('#supply-experiment-panel')?.textContent.includes('G-PZ-01 · 第二次攻击'));
 const panel=page.locator('#supply-experiment-panel');const text=await panel.innerText();
 for(const value of ['本次消耗 0补给点','扣费后 0补给点','有效补给系数 50%','欠账折合 0.5补给点'])if(!text.includes(value))throw Error('missing '+value);
 if(text.includes('G-I-01 · 攻击'))throw Error('stale first attack row');
 await page.waitForLoadState('networkidle');await panel.evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));await page.screenshot({path:`${out}/second-preview.png`});fs.writeFileSync(`${out}/second-preview.txt`,text);
 const result=page.waitForResponse(r=>r.url().endsWith('/experiment')&&r.request().postDataJSON()?.action?.type==='SCHWERPUNKT_ATTACK');
 await page.locator('[data-schwerpunkt-unit="G-PZ-01"]').click();const response=await result;const packet=await response.json();if(!response.ok())throw Error(JSON.stringify(packet));
 if(packet.supply.preview.rows.length)throw Error('preview survived committed action');
 await page.waitForFunction(()=>document.querySelector('#supply-experiment-panel')?.textContent.includes('G-PZ-01 行动消耗 0补给点'));
 await page.waitForLoadState('networkidle');await panel.evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));await page.screenshot({path:`${out}/second-receipt.png`});fs.writeFileSync(`${out}/second-receipt.txt`,await panel.innerText());
 report.previewText=text;report.receipt=packet.supply.receipt;report.revision=packet.matchRevision;report.passed=true;
}catch(e){report.passed=false;report.failure=String(e);console.error(e);}
finally{if(browser)await browser.close();server.kill();report.serverLog=log;fs.writeFileSync(`${out}/browser.json`,JSON.stringify(report,null,2)+'\n');}
if(!report.passed)process.exitCode=1;

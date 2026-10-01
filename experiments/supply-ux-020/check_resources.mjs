import {spawn} from 'node:child_process';
import fs from 'node:fs';
const {chromium}=await import(process.env.TEST_PLAYWRIGHT??'file:///C:/Users/jinyibo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const server=spawn(process.env.TEST_PYTHON??'C:/Users/jinyibo/eastfront/extracted/eastfront-web-preview-a3346e4c34567811fb07652cb26b706833daa183/.venv/Scripts/python.exe',['-X','utf8','experiments/supply-ux-020/browser_fixture.py','movement','--port','8781'],{windowsHide:true});
let log='',browser;server.stdout.on('data',d=>log+=d);server.stderr.on('data',d=>log+=d);
const report={scope:'identify resource console warning only; no new game actions',responses:[],consoleErrors:[]};
try{
 const start=Date.now();while(!log.includes('LOCAL_FIXTURE_READY')){if(Date.now()-start>15000)throw Error(log);await new Promise(r=>setTimeout(r,50));}
 browser=await chromium.launch({headless:true,executablePath:process.env.TEST_BROWSER??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('response',r=>{if(r.status()>=400)report.responses.push({url:r.url(),status:r.status()});});
 page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push({message:m.text(),location:m.location()});});
 await page.goto('http://127.0.0.1:8781/?supply=experiment');await page.locator('#supply-start').click();await page.locator('#supply-handoff').waitFor();await page.waitForLoadState('networkidle');
 report.passed=report.responses.every(r=>r.url().endsWith('/favicon.ico'))&&report.consoleErrors.every(r=>r.location.url.endsWith('/favicon.ico'));
}finally{if(browser)await browser.close();server.kill();fs.writeFileSync('experiments/supply-ux-020/evidence/resource-check.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));

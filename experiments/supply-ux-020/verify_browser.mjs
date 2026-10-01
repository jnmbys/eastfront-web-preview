const {chromium}=await import(process.env.TEST_PLAYWRIGHT??'file:///C:/Users/jinyibo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
import {spawn,execFileSync} from 'node:child_process';
import fs from 'node:fs';
import ts from '../../node_modules/typescript/lib/typescript.js';
const root=process.cwd(),out='experiments/supply-ux-020/evidence';
const py=process.env.TEST_PYTHON??'C:/Users/jinyibo/eastfront/extracted/eastfront-web-preview-a3346e4c34567811fb07652cb26b706833daa183/.venv/Scripts/python.exe';
const before=ts.transpileModule(execFileSync('git',['-c',`safe.directory=${root}`,'show','813b4072568352e95d0726fe5fe04060c889c554:src/experimental/supplyClient.ts'],{encoding:'utf8'}),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const report={scope:'fresh local headless Edge, real main interface and HTTP authority; not Render or mobile acceptance',beforeMethod:'Only the supplyClient browser module is served from baseline 813 for the before image, on the same legal fixture; all requests go to local authority.',checks:[]};
let browser,server;
async function fixture(kind){
 if(server){server.kill();await new Promise(r=>server.once('exit',r));}
 server=spawn(py,['-X','utf8','experiments/supply-ux-020/browser_fixture.py',kind,'--port','8780'],{cwd:root,windowsHide:true});
 let logs='';server.stdout.on('data',d=>{logs+=d;});server.stderr.on('data',d=>{logs+=d;});
 const began=Date.now();while(!logs.includes('LOCAL_FIXTURE_READY')){if(Date.now()-began>15000||server.exitCode!==null)throw Error(logs);await new Promise(r=>setTimeout(r,50));}
 return ()=>logs;
}
async function open(old=false){
 const context=await browser.newContext({viewport:{width:1440,height:1800}});const page=await context.newPage();page.setDefaultTimeout(12000);
 if(old)await page.route('**/app/experimental/supplyClient.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:before}));
 const messages=[];page.on('response',r=>{if(r.status()>=400){report.resourceFailures??=[];report.resourceFailures.push({url:r.url(),status:r.status()});}});page.on('request',r=>{if(r.url().endsWith('/experiment')){const b=r.postDataJSON();report.lastRequests??=[];report.lastRequests.push(b);}});page.on('pageerror',e=>messages.push(String(e)));page.on('console',m=>{if(m.type()==='error')messages.push(m.text());});
 await page.goto('http://127.0.0.1:8780/?supply=experiment');await page.locator('#supply-start').click();const switched=page.waitForResponse(r=>r.url().endsWith('/experiment')&&r.request().postDataJSON()?.op==='switch');await page.locator('#supply-handoff').click();await (await switched).finished();await page.waitForFunction(()=>document.querySelector('.map-toolbar')?.textContent.includes('德军视角'));
 await page.locator('[data-unit-id="G-PZ-01"]').first().waitFor();
 return {context,page,messages};
}
const panel=p=>p.locator('#supply-experiment-panel');
async function image(p,name){await p.waitForLoadState('networkidle');await panel(p).evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));await p.screenshot({path:`${out}/${name}.png`});fs.writeFileSync(`${out}/${name}.txt`,await panel(p).innerText());}
try{
 browser=await chromium.launch({executablePath:process.env.TEST_BROWSER??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});report.browser=await browser.version();
 let logs=()=>'';if(!process.env.TEST_SKIP_MOVEMENT){logs=await fixture('movement');
 for(const old of [true,false]){
  const {context,page,messages}=await open(old);
  await page.locator('[data-unit-id="G-PZ-01"]').first().click();await page.locator('#move-start').click();
  await page.locator('[data-role="move-option"][data-hex="4,5"]').click();
  await page.locator('#move-commit').waitFor({state:'visible'});
  if(!old)await page.waitForFunction(()=>document.querySelector('#supply-experiment-panel')?.textContent.includes('扣费后 1补给点'));
  await image(page,old?'before-move':'after-move');
  if(!old){await page.locator('#move-commit').click();await page.waitForFunction(()=>document.querySelector('#supply-experiment-panel')?.textContent.includes('G-PZ-01 行动消耗 1补给点'));await image(page,'after-move-receipt');}
  report.checks.push({name:old?'before-original-panel':'move-preview-and-commit',passed:true,pageErrors:messages});await context.close();
 }
 report.movementLog=logs();}else{const previous=JSON.parse(fs.readFileSync(`${out}/browser.json`));report.checks=previous.checks.filter(c=>['before-original-panel','move-preview-and-commit'].includes(c.name));report.movementLog=previous.movementLog;}logs=await fixture('joint');
 {const {context,page,messages}=await open();
  await page.locator('[data-unit-id="G-I-01"]').first().click();
  await page.locator('[data-hex="5,5"][data-role="attack-target"]').waitFor();await page.locator('[data-unit-id="S-I-01"]').first().click();await page.waitForFunction(()=>document.querySelector('#supply-experiment-panel')?.textContent.includes('G-I-01 · 攻击'));
  await page.locator('[data-unit-id="G-PZ-01"]').first().click();
  await page.waitForFunction(()=>document.querySelector('#supply-experiment-panel')?.textContent.includes('G-PZ-01 · 攻击'));
  await image(page,'after-joint');await page.locator('#attack-declare').click();
  await page.waitForFunction(()=>document.querySelector('#supply-experiment-panel')?.textContent.includes('G-PZ-01 行动消耗 1补给点'));await image(page,'after-joint-receipt');
  report.checks.push({name:'joint-per-attacker-preview-and-commit',passed:true,pageErrors:messages});await context.close();}
 report.jointLog=logs();logs=await fixture('clear');
 {const {context,page,messages}=await open();await page.locator('[data-unit-id="G-MOT-01"]').first().click();await page.waitForLoadState('networkidle');
  await page.locator('[data-role="attack-target"][data-hex="5,6"]').waitFor();await page.locator('[data-unit-id="S-I-02"]').first().click();
  await page.waitForFunction(()=>document.querySelector('#supply-experiment-panel')?.textContent.includes('本次攻击有效补给系数 50%'));await image(page,'after-cleared-debt');
  report.checks.push({name:'cleared-debt-still-half-attack',passed:true,pageErrors:messages});await context.close();}
 report.clearLog=logs();report.passed=true;
}catch(e){report.passed=false;report.failure=String(e);console.error(e);}
finally{if(browser)await browser.close();if(server)server.kill();fs.writeFileSync(`${out}/browser.json`,JSON.stringify(report,null,2)+'\n');}
if(!report.passed)process.exitCode=1;

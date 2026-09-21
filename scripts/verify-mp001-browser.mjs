import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createMultiplayerServer} from '../.server-dist/server/runtime.js';
import {DEFAULTS} from '../.server-dist/server/config.js';
const require=createRequire(import.meta.url);
let playwright;try{playwright=require('playwright');}catch{playwright=require(`${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/playwright`);}
const {chromium}=playwright;
const server=createMultiplayerServer({...DEFAULTS,port:0,allowedOrigins:['http://127.0.0.1:4173']});
const port=await server.listen();
const originalConfig=readFileSync('dist/multiplayer-config.json');
writeFileSync('dist/multiplayer-config.json',JSON.stringify({serverUrl:`ws://127.0.0.1:${port}/ws`}));
const staticServer=spawn(process.execPath,['scripts/serve.mjs','dist'],{env:{...process.env,PORT:'4173'},stdio:['ignore','pipe','pipe']});
await new Promise((resolve,reject)=>{staticServer.stdout.once('data',resolve);staticServer.once('error',reject);});
let browser;const pages=[];const evidence={viewport:'Huawei-like Android tablet 1280x800 with touch',errors:[],checks:[]};
const out='evidence/mp-001';mkdirSync(out,{recursive:true});
try{
  browser=await chromium.launch({headless:true,...(process.env.MP_CHROMIUM_EXECUTABLE?{executablePath:process.env.MP_CHROMIUM_EXECUTABLE}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
  const tablet=await browser.newContext({viewport:{width:1280,height:800},hasTouch:true,isMobile:true,deviceScaleFactor:1,userAgent:'Mozilla/5.0 (Linux; Android 12; HUAWEI Tablet) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36'});
  const desktop=await browser.newContext({viewport:{width:1440,height:1000}});
  const a=await tablet.newPage(),b=await desktop.newPage();pages.push(a,b);const requests=[];
  for(const page of [a,b]){page.on('websocket',socket=>socket.on('framereceived',frame=>{try{const m=JSON.parse(String(frame.payload));if(m.messageType==='ROOM_ERROR')console.error('Protocol error:',m.payload.code);}catch{}}));page.on('pageerror',error=>evidence.errors.push(error.message));page.on('console',msg=>{if(msg.type()==='error')console.error('Browser:',msg.text());});page.on('response',response=>{if(response.status()>=400)console.error('HTTP',response.status(),response.url());});page.on('request',request=>requests.push(request.url()));}
  await a.goto('http://127.0.0.1:4173/');await a.locator('#multiplayer-button').waitFor();
  await a.screenshot({path:`${out}/01-home-tablet.png`});
  await b.goto('http://127.0.0.1:4173/');await b.locator('[data-language-select]').selectOption('en-US');
  for(const [page,name] of [[a,'玩家 A'],[b,'Player B']]){await page.locator('#multiplayer-button').click();await page.locator('#mp-name').fill(name);await page.locator('#mp-connect').click();await page.locator('#mp-create').waitFor();}
  await a.locator('#mp-create').click();await a.locator('#mp-room-code').waitFor();const code=await a.locator('#mp-room-code').innerText();
  await b.locator('#mp-code').fill(code.toLowerCase());await b.locator('#mp-join').click();await b.locator('[data-mp-seat="SOVIET"]').waitFor();
  await a.locator('[data-mp-seat="GERMANY"]').click();await b.locator('[data-mp-seat="SOVIET"]').click();
  await a.waitForFunction(()=>document.querySelector('[data-seat="SOVIET"] .mp-player')?.textContent?.includes('Player B'));
  await a.locator('#mp-ready').click();await a.waitForFunction(()=>document.querySelector('[data-seat="GERMANY"]')?.classList.contains('mp-ready'));
  await a.screenshot({path:`${out}/02-lobby-tablet-zh.png`});await b.screenshot({path:`${out}/03-lobby-desktop-en.png`});
  const originalToken=await a.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('eastfront.mp.identity:')).map(k=>sessionStorage.getItem(k))[0]);
  await tablet.setOffline(true);
  // Simulate transport loss as well as the browser's network switch; Chromium may retain loopback sockets.
  for(const ws of server.sockets.clients)ws.ping();
  await a.evaluate(()=>window.dispatchEvent(new Event('offline')));
  await a.waitForFunction(()=>document.querySelector('#mp-ready')?.disabled,{},{timeout:15000});
  await a.screenshot({path:`${out}/04-disconnected-tablet.png`});
  evidence.checks.push('Disconnected UI disables seat/ready immediately');
  await tablet.setOffline(false);await a.evaluate(()=>window.dispatchEvent(new Event('online')));
  await a.waitForFunction(()=>document.querySelector('.mp-status')?.textContent?.includes('已连接'),{},{timeout:20000});
  const restoredToken=await a.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('eastfront.mp.identity:')).map(k=>sessionStorage.getItem(k))[0]);assert.equal(restoredToken,originalToken);
  assert((await a.locator('[data-seat="GERMANY"] .mp-player').innerText()).includes('玩家 A'));
  evidence.checks.push('Reconnect restores original controller and seat');
  await a.locator('#mp-ready').click();await b.locator('#mp-ready').click();
  await a.locator('.mp-match').waitFor();await b.locator('.mp-match').waitFor();
  await a.waitForFunction(()=>document.querySelector('.mp-match')?.textContent?.includes('已收到你的初始视野'));
  await a.screenshot({path:`${out}/05-match-created-tablet.png`});
  assert.equal(requests.filter(url=>url.includes('/assets/terrain/')).length,0);assert.equal(await a.locator('#eastfront-map').count(),0);
  evidence.checks.push('No terrain asset requests or map construction through HOME/lobby/match foundation');
  await a.setViewportSize({width:390,height:844});await a.screenshot({path:`${out}/06-mobile-match.png`});
  assert(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const targets=await a.locator('button:not([disabled])').evaluateAll(buttons=>buttons.map(b=>b.getBoundingClientRect().height));assert(targets.every(height=>height>=48));
  evidence.checks.push('390px mobile has no horizontal overflow; active buttons >=48px');
  await a.locator('#mp-leave').click();await a.locator('#new-game-button').waitFor();await b.locator('#mp-create').waitFor();await b.locator('#mp-back').click();
  evidence.checks.push('In-game leave acknowledged; other player receives closed room');
  // Run the original local mode with no backend connection.
  await a.setViewportSize({width:1280,height:800});await server.close();
  await a.locator('#new-game-button').click();await a.locator('#eastfront-map').waitFor({timeout:120000});
  await a.screenshot({path:`${out}/07-single-player-retained.png`});
  assert(await a.locator('#terrain-surface').count());evidence.checks.push('Single-player startup and VS2 battlefield work with backend stopped');
  assert.deepEqual(evidence.errors,[]);evidence.result='PASS';
}catch(error){for(const [index,page]of pages.entries()){console.error('Failure UI',index,await page.locator('body').innerText());await page.screenshot({path:`${out}/failure-${index}.png`});}throw error;
}finally{
  writeFileSync(`${out}/browser-evidence.json`,JSON.stringify(evidence,null,2)+'\n');
  await browser?.close();staticServer.kill();await server.close();writeFileSync('dist/multiplayer-config.json',originalConfig);
}
console.log(JSON.stringify(evidence,null,2));

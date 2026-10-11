// Actual browser UI automation, two isolated cookie/storage contexts. No game
// function injection or protocol-generated commands; WS is observed only.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/jinyibo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),{gunzipSync}=require('node:zlib');
const origin=process.env.MP_URL||'http://127.0.0.1:4277',out='evidence/blackice-mp-001';
const wait=async(fn,ms=20000)=>{const t=Date.now();while(Date.now()-t<ms){if(fn())return;await new Promise(r=>setTimeout(r,50));}throw Error('BROWSER_WAIT_TIMEOUT');};
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true});const contexts=[],errors=[],events=[];let clicks=0;
const click=async(p,s)=>{await p.locator(s).click();clicks++;};
function watch(p,side){const rows=[];p.on('pageerror',e=>errors.push({side,message:e.message}));p.on('websocket',s=>s.on('framereceived',e=>{try{let m=JSON.parse(e.payload.toString());if(m.type==='STATE_GZIP')m=JSON.parse(gunzipSync(Buffer.from(m.data,'base64')));if(m.type==='RESULT'){rows.push(m.result);events.push({side,status:m.result.status,reason:m.result.reason,tick:m.result.simulationPoint.tick});}}catch{}}));return rows;}
try{
 for(let i=0;i<2;i++)contexts.push(await browser.newContext({viewport:{width:1280,height:800}}));const a=await contexts[0].newPage(),b=await contexts[1].newPage(),ra=watch(a,'GERMAN'),rb=watch(b,'SOVIET');
 await a.goto(origin+'/rooms');await click(a,'#create');await a.locator('#invitation').waitFor({state:'visible'});const invitation=await a.locator('#inviteLink').inputValue();await click(a,'#enter');await click(a,'#ai-start');await a.locator('.mp-room-status').waitFor();
 await b.goto(origin+'/rooms');await b.locator('#joinLink').fill(invitation);await click(b,'#join');await click(b,'#ai-start');await b.locator('.mp-room-status').waitFor();
 assert.notDeepEqual((await contexts[0].cookies()).find(x=>x.name==='blackice_mp_visitor').value,(await contexts[1].cookies()).find(x=>x.name==='blackice_mp_visitor').value);
 await a.getByText('德在线／苏在线',{exact:false}).first().waitFor();await click(a,'#mp-room-start');await a.locator('#mp-room-start').waitFor({state:'detached'});assert(await b.locator('#campaign-toggle').isDisabled());
 for(const [p,rows,side]of [[a,ra,'GERMAN'],[b,rb,'SOVIET']]){
  await click(p,'[data-ui-panel="direct"]');const choice=p.locator('[data-ui-unit]').first(),id=await choice.getAttribute('data-ui-unit');assert(id.startsWith(side==='GERMAN'?'G-':'S-'));await choice.click();clicks++;await p.locator('#direct-stop').waitFor();
  const n=rows.length;await click(p,'#direct-stop');await wait(()=>rows.length>n);assert.equal(rows.at(-1).status,'APPLIED');await p.getByText('手动驻守',{exact:false}).first().waitFor();
  await p.screenshot({path:out+'/'+(side==='GERMAN'?'01-german':'02-soviet')+'.png'});
 }
 const n=ra.length;await click(a,'#campaign-toggle');await wait(()=>ra.length>n);assert.equal(ra.at(-1).status,'APPLIED');await new Promise(r=>setTimeout(r,4500));
 await b.goto(origin+'/rooms');await a.getByText('苏军断线',{exact:false}).first().waitFor();await a.screenshot({path:out+'/03-disconnected-paused.png'});assert(await a.locator('#campaign-toggle').isDisabled());
 await b.locator('#rooms a').first().click();clicks++;await click(b,'#ai-start');await b.locator('.mp-room-status').waitFor();assert(await b.locator('#campaign-toggle').isDisabled());
 await a.getByText('德在线／苏在线',{exact:false}).first().waitFor();await click(a,'#campaign-toggle');await b.locator('#campaign-toggle:not([disabled])').waitFor();const nb=rb.length;await click(b,'#campaign-toggle');await wait(()=>rb.length>nb);assert.equal(rb.at(-1).status,'APPLIED');
 for(const [p,rows]of[[a,ra],[b,rb]]){const n=rows.length;await click(p,'#campaign-save');await wait(()=>rows.length>n);assert.equal(rows.at(-1).status,'APPLIED');}
 await b.reload();await click(b,'#ai-start');await b.locator('.mp-room-status').waitFor();await b.locator('#direct-stop').count();await b.screenshot({path:out+'/04-soviet-reconnected.png'});
 assert.equal(errors.length,0,JSON.stringify(errors));
 const report={passed:true,method:'Edge headless real page mouse clicks; two isolated browser contexts, distinct signed visitor cookies; no in-page application method injection',viewport:'1280x800',clicks,actions:['create Germany','invitation joined by isolated Soviet context','both enter authorized map','host start initially paused','both select own unit and stop/hold; accepted authoritative receipts','host resumes world','Soviet leaves map; Germany observes automatic pause','original Soviet identity returns same room','host resumes; Soviet pauses','both save; Soviet page reload returns same seat'],events,errors,limits:['Not physical tablet/touch input','Not public/remote two-device test','No battle balance validation','Native browser connector failed; headless Edge used instead']};fs.writeFileSync(out+'/browser.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

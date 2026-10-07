import {createRequire} from 'node:module';import {mkdirSync,writeFileSync} from 'node:fs';import assert from 'node:assert/strict';
import {start} from './server.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/jinyibo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const dir=process.argv[2];if(!dir)throw Error('Fresh evidence directory required');mkdirSync(dir,{recursive:false});
const service=await start({port:0,autoTick:false}),browser=await chromium.launch({channel:'msedge',headless:true}),errors=[],results=[];
const a=await browser.newPage({viewport:{width:1440,height:1000}}),b=await browser.newPage({viewport:{width:1440,height:1000}});for(const page of[a,b]){page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(20000);}
async function ready(page){await page.waitForFunction(()=>window.mp022?.view&&window.mp022.connected);}
async function settled(page,n){await page.waitForFunction(n=>window.mp022.history.length>=n,n);}
async function orderTarget(page,id){await page.locator('#unit').selectOption(id);await page.locator('#center').click();const {unit,target}=await page.evaluate(id=>{const v=window.mp022.view,u=v.units[id],neighbors=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]].map(([q,r])=>({q:u.hex.q+q,r:u.hex.r+r}));return {unit:u.hex,target:neighbors.find(h=>v.hexes[`${h.q},${h.r}`]&&!Object.values(v.units).some(x=>x.side===window.mp022.side&&x.hex.q===h.q&&x.hex.r===h.r))};},id);assert.ok(target);const box=await page.locator('#map').boundingBox();await page.mouse.click(box.x+box.width/2+Math.sqrt(3)*20*((target.q-unit.q)+(target.r-unit.r)/2)*.72,box.y+box.height/2+30*(target.r-unit.r)*.72);await page.locator('#order').click();}
async function move(page,id,button='#move'){await page.locator('#unit').selectOption(id);await page.waitForFunction(()=>{const c=window.mp022;return c.view.legal.selectionId===c.selectionId&&c.view.legal.movement?.options.some(o=>o.legal);});
 const target=await page.evaluate(()=>window.mp022.view.legal.movement.options.find(o=>o.legal).hex);
 // Read rendered map transform through an exposed DOM event-independent test hook is avoided: center then neighbor offset.
 await page.locator('#center').click();const unit=await page.evaluate(id=>window.mp022.view.units[id].hex,id),rect=await page.locator('#map').boundingBox();
 const x=rect.x+rect.width/2+Math.sqrt(3)*20*((target.q-unit.q)+(target.r-unit.r)/2)*.72,y=rect.y+rect.height/2+30*(target.r-unit.r)*.72;
 await page.mouse.click(x,y);await page.locator(button).click();return target;
}
try{
 await a.goto(service.url+'/a/');await b.goto(service.url+'/b/');await a.locator('#start').click();await b.locator('#start').click();await ready(a);await ready(b);
 await a.locator('#phase-next').click();await settled(a,1);await a.waitForFunction(()=>window.mp022.view.phase==='GERMAN_MOVEMENT');
 for(const page of [a,b])await page.locator('summary').click();
 for(const [profile,id] of [['rtt100','G-026'],['rtt300','G-027'],['rtt1000','G-028'],['constrained','G-029']]){
  const trafficBefore=structuredClone(service.metrics);
  await a.locator('#profile').selectOption(profile);await a.waitForFunction(p=>window.mp022.events.some(e=>e.type==='profile'&&e.name===p),profile);const pingCount=await a.evaluate(()=>window.mp022.events.filter(e=>e.type==='ping').length);await a.locator('#ping').click();await a.waitForFunction(n=>window.mp022.events.filter(e=>e.type==='ping').length>n,pingCount);
  const n=await a.evaluate(()=>window.mp022.history.length),before=await a.evaluate(id=>window.mp022.view.units[id].hex,id);await move(a,id);
  if(profile==='rtt1000'){
   const current=await a.evaluate(id=>({position:window.mp022.view.units[id].hex,pending:window.mp022.pending.size}),id);assert.deepEqual(current.position,before);assert.ok(current.pending>0);
   await a.locator('#move').click();assert.equal(await a.evaluate(()=>window.mp022.pending.size),1); // repeated click reuses pending intent
   await a.locator('#unit').selectOption('G-030');assert.equal(await a.locator('#unit').inputValue(),'G-030');const r=await a.locator('#map').boundingBox();await a.mouse.move(r.x+100,r.y+100);await a.mouse.down();await a.mouse.move(r.x+140,r.y+125);await a.mouse.up();await a.screenshot({path:dir+'/pending-can-select-drag.png'});
   await b.locator('#ping').click();await b.waitForFunction(()=>window.mp022.events.some(e=>e.type==='ping'));
  }
  await settled(a,n+1);const record=await a.evaluate(()=>window.mp022.history.at(-1));assert.equal(record.status,'applied');results.push({profile,record,ping:await a.evaluate(()=>window.mp022.events.filter(e=>e.type==='ping').at(-1)),trafficDelta:Object.fromEntries(['received','sent','receivedBytes','sentBytes'].map(k=>[k,service.metrics[k]-trafficBefore[k]]))});
  await a.screenshot({path:dir+'/'+profile+'.png'});
 }
 await a.locator('#profile').selectOption('rtt1000');await a.waitForTimeout(1600);
 const n=await a.evaluate(()=>window.mp022.history.length),prior=service.adapter.c.econ.accounts.GERMAN.I;await a.locator('#build').click();await a.waitForTimeout(650);await a.locator('#disconnect').click();await settled(a,n+1);const receipt=await a.evaluate(()=>window.mp022.history.at(-1));assert.equal(receipt.status,'applied');assert.equal(service.adapter.c.econ.accounts.GERMAN.I,prior-6);assert.ok((await a.evaluate(()=>window.mp022.events)).some(e=>e.type==='retry'));
 await a.screenshot({path:dir+'/reconnected.png'});await b.screenshot({path:dir+'/second-seat.png'});
 // Force an application baseline loss (not arbitrary WS message reorder), then verify full authorized recovery.
 await a.evaluate(()=>{window.mp022.version=0;window.mp022.select('G-031');});await a.waitForFunction(()=>window.mp022.events.some(e=>e.type==='resync'));
 await a.waitForFunction(()=>window.mp022.version>0&&window.mp022.view.legal.unitId==='G-031');
 const currentRevision=await a.evaluate(()=>window.mp022.view.revision);await a.evaluate(()=>{const c=window.mp022;c.receive({type:'STATE',instanceId:c.instanceId,connectionEpoch:c.epoch-1,viewVersion:9999,full:{revision:0}});});assert.equal(await a.evaluate(()=>window.mp022.view.revision),currentRevision);
 // Explicit stale/foreign intent uses the normal client transport, and the UI must show rejection.
 const rejectCount=await b.evaluate(()=>window.mp022.history.length);await b.evaluate(()=>window.mp022.submit('MOVE',{unitId:'G-026',path:[{q:0,r:0}]},['unit:G-026']));await settled(b,rejectCount+1);assert.match(await b.locator('#orders').innerText(),/UNIT_NOT_AUTHORIZED/);
 // Real concurrent intent pipeline: slow A keeps planning/sending a different object; B is not gated by A.
 await a.locator('#profile').selectOption('rtt1000');await a.waitForTimeout(1200);
 const concurrentStart=await a.evaluate(()=>window.mp022.history.length);await move(a,'G-032');
 await orderTarget(a,'G-033');
 assert.equal(await a.evaluate(()=>window.mp022.pending.size),2);await a.screenshot({path:dir+'/two-intents-in-flight.png'});
 const bcount=await b.evaluate(()=>window.mp022.history.length);await orderTarget(b,'S-001');await settled(b,bcount+1);assert.equal(await b.evaluate(()=>window.mp022.history.at(-1).status),'applied');
 await settled(a,concurrentStart+2);const concurrent=await a.evaluate(n=>window.mp022.history.slice(n),concurrentStart);assert.ok(concurrent.every(r=>r.status==='applied'));
 // Accepted task progresses via existing authority tick even while its browser is disconnected.
 const officerBefore=structuredClone(service.adapter.c.state.units['G-033'].hex);await a.locator('#disconnect').click();service.enableTicks();for(let i=0;i<30&&JSON.stringify(service.adapter.c.state.units['G-033'].hex)===JSON.stringify(officerBefore);i++)await new Promise(r=>setTimeout(r,100));const officerAfter=structuredClone(service.adapter.c.state.units['G-033'].hex);assert.notDeepEqual(officerAfter,officerBefore);await ready(a);await a.waitForFunction(rev=>window.mp022.view.revision>=rev,service.adapter.revision);
 const officer={before:officerBefore,after:officerAfter,phase:service.adapter.c.state.phase,serverTick:true,browserStepMessages:0};
 for(const page of[a,b]){await page.evaluate(()=>window.mp022.send({type:'METRICS'}));await page.waitForFunction(()=>window.mp022.metrics!==null);}
 assert.deepEqual(errors,[]);const clients=await Promise.all([a,b].map(p=>p.evaluate(()=>window.mp022.export())));for(let i=0;i<clients.length;i++)writeFileSync(dir+`/client-${i}.json`,JSON.stringify(clients[i],null,2));
 writeFileSync(dir+'/summary.json',JSON.stringify({kind:'Real headless desktop Edge, two isolated browser contexts, localhost injected FIFO delays',url:service.url,results,reconnect:receipt,concurrent,officer,metrics:{...service.metrics,peakAuthorityQueue:service.adapter.peakDepth},errors,notHuawei:true},null,2));console.log('PASS two real browsers');
}catch(error){await a.screenshot({path:dir+'/failure.png'}).catch(()=>{});writeFileSync(dir+'/failure.json',JSON.stringify({error:error.message,errors,body:await a.locator('body').innerText(),clients:await Promise.all([a,b].map(p=>p.evaluate(()=>window.mp022?.export()).catch(()=>null)))},null,2));throw error;}
finally{await browser.close();await service.close();}

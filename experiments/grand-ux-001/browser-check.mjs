import {createRequire} from 'node:module';import fs from 'node:fs';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/jinyibo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4196');await page.locator('#ai-start').click();await page.locator('.grand-panel').waitFor();
 await page.getByText('持续生产线',{exact:true}).click();
 for(const [n,k]of [[1,'RIFLE'],[2,'GUN'],[3,'TRAIN'],[4,'TRUCK'],[5,'RIFLE']]){const r=page.waitForResponse(r=>r.url().endsWith('/grand/action'));await page.locator(`[data-ux-line="GERMAN-industry-${n}"]`).selectOption(k);await r;}
 const audit=await page.evaluate(async()=>{const headers={'Content-Type':'application/json','X-Grand-Session':sessionStorage.getItem('grand-officer-session')};const api=async(path,q={})=>{const r=await fetch('/grand/'+path,{method:'POST',headers,body:JSON.stringify(q)});const d=await r.json();if(!r.ok)throw Error(d.error);return d;};let d=await api('state'),trace=[];
 for(let i=0;i<70&&!(d.turn===4&&d.phase==='GERMAN_RECOVERY');i++){if(d.owner!==d.viewer)d=await api('takeover');d=await api('action',{id:crypto.randomUUID(),version:d.version,action:{type:'READY_FOR_PHASE_END'}});trace.push({version:d.version,phase:d.phase,turn:d.turn});}return{trace,data:d};});
 assert.equal(audit.data.turn,4);await page.reload();await page.locator('#ai-start').click();await page.locator('.grand-panel').waitFor();await page.locator('#grand-unit').selectOption('G-059');await page.locator('#grand-focus').click();await page.locator('#recover-unit').waitFor();
 const r=page.waitForResponse(r=>r.url().endsWith('/grand/action'));await page.locator('#recover-unit').click();const after=await(await r).json();assert.equal(after.units.find(u=>u.id==='G-059').step,0);assert.equal(after.uses.length,1);await page.screenshot({path:'evidence/grand-ux-001/equipment-recovery.png'});assert.deepEqual(errors,[]);
 fs.writeFileSync('evidence/grand-ux-001/browser-equipment.json',JSON.stringify({trace:audit.trace,production:after.ux.lines,uses:after.uses,shipments:after.shipments,errors},null,2));console.log('PASS browser production/delivery/recovery');
}finally{await browser.close();}

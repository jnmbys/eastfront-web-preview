import assert from 'node:assert/strict';
import fs from 'node:fs';
import WS from 'ws';
const origin='https://eastfront-grand-preview.onrender.com',expected='ba44cd1b5f2ceea4408a9b63a9d31854543c44cd';
const cookies=new Map(),nativeFetch=globalThis.fetch,out={at:new Date().toISOString(),scope:'Independent new test visitor; public HTTPS/WSS protocol, not browser or tablet timings.',commands:[],phases:[],views:[]};let client;
const wait=ms=>new Promise(r=>setTimeout(r,ms)),until=async f=>{for(let n=0;n<600&&!f();n++)await wait(50);assert(f(),'bounded response wait');};
globalThis.fetch=async(p,o={})=>{const r=await nativeFetch(new URL(p,origin),{...o,headers:{...o.headers,origin,cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')},signal:AbortSignal.timeout(30000)});for(const c of r.headers.getSetCookie()){const [k,v]=c.split(';')[0].split('=');cookies.set(k,v);}return r;};
globalThis.location={origin,search:'?campaign=division'};globalThis.document={querySelector:()=>({content:'territory-1'})};globalThis.sessionStorage={getItem:()=>null,setItem:()=>{}};
globalThis.WebSocket=class extends WS{constructor(url){super(url,{headers:{origin,cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')}});this.on('error',()=>{});}};
const module=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
try{
 assert.equal((await fetch('/healthz')).status,200);
 assert.equal((await fetch('/release/info?campaign=division')).status,401);
 assert.equal((await fetch('/visitor/start',{method:'POST',redirect:'manual'})).status,303);
 const r=await fetch('/release/info?campaign=division');if(r.status===503){out.status='CAPACITY_BLOCKED';out.reason=await r.text();}else{
 assert.equal(r.status,200);const info=await r.json();assert.equal(info.build.source,expected);assert(info.paused&&info.divisionIntegrated&&!info.pieceFixture);out.build=info.build;
 const asset=await fetch('/assets/terrain/vs2-002/assets/ground/moist_soil.webp');assert.equal(asset.status,200);out.terrainBytes=(await asset.arrayBuffer()).byteLength;
 const view=await(await fetch('/transport/view.mjs')).text(),sync=await(await fetch('/sync.mjs')).text(),codec=await(await fetch('/transport/stateCodec.mjs')).text();
 const source=(await(await fetch('/transport/client.mjs')).text()).replace("'/transport/stateCodec.mjs'",JSON.stringify(module(codec))).replace("'/transport/view.mjs'",JSON.stringify(module(view))).replace("'/sync.mjs'",JSON.stringify(module(sync)));
 const {Client}=await import(module(source));client=new Client('a');client.addEventListener('view',e=>out.views.push(e.detail));await client.start();await until(()=>client.view);
 out.initialTick=client.document().continuous.tick;assert.equal(out.initialTick,0);out.stateEncoding=client.stateEncoding;
 async function submit(kind,payload,keys,dep={}){const id=client.submit(kind,payload,keys,dep);await until(()=>client.history.some(r=>r.command.requestId===id));const r=client.history.find(r=>r.command.requestId===id);assert.equal(r.status,'applied',JSON.stringify(r.result));out.commands.push({kind,type:payload.type,receiptMs:Math.round(r.resultAt-r.sendAt),stateReadyMs:Math.round(r.completedAt-r.sendAt),queueMs:r.result.timing.queueMs,authorityMs:r.result.timing.applyMs});}
 const world=()=>({worldGeneration:client.document().transport.worldGeneration});
 await submit('OPERATION',{type:'AUTOPAUSE',enabled:false},['world'],world());
 for(const speed of process.env.RECOVERY_ONLY?[1]:[0,1,4]){await submit('OPERATION',{type:'CLOCK',paused:speed===0,speed:speed||1},['world'],world());const begin=performance.now(),tick=client.document().continuous.tick;for(let n=0;n<(process.env.RECOVERY_ONLY?1:3);n++){await wait(10000);await submit('OPERATION',{type:'AUTOPAUSE',enabled:false},['world'],world());}client.send({type:'METRICS'});await wait(500);out.phases.push({speed,seconds:(performance.now()-begin)/1000,startTick:tick,endTick:client.document().continuous.tick,metrics:client.metrics});console.log('public phase',speed);}
 await submit('OPERATION',{type:'CLOCK',paused:true,speed:1},['world'],world());await submit('SAVE',{},['all']);out.finalTick=client.document().continuous.tick;
 const connections=()=>client.events.filter(x=>x.type==='connected').length;
 const count=connections();client.disconnect();await until(()=>connections()>count&&client.connected&&client.version>0);assert.equal(client.document().continuous.tick,out.finalTick);assert(client.document().continuous.paused);out.reconnect='same tick, paused';out.connectionEvents=client.events.filter(x=>['connected','disconnected','instance-reset','error'].includes(x.type));client.dispose();client=null;
 // Allow the isolated instance to unload and read the persistent file anew.
 await wait(36000);const read=await(await fetch('/release/info?campaign=division')).json();assert.equal(read.instanceId,info.instanceId);assert.equal(read.tick,out.finalTick);assert(read.paused&&read.saved);out.linuxPersistentReload={tick:read.tick,paused:read.paused,saved:read.saved,scope:'instance unloaded then recreated; no second whole-service restart'};
 const legacyResponse=await fetch('/release/info?campaign=legacy');out.legacyStatus=legacyResponse.status;if(legacyResponse.ok){const legacy=await legacyResponse.json();assert(!legacy.divisionIntegrated&&legacy.paused);assert.notEqual(legacy.instanceId,read.instanceId);out.legacyIndependent=true;}
 out.status='PASS';
 }
}catch(e){out.status='FAIL';out.error=e.message;process.exitCode=1;}finally{if(client)out.connectionEvents=client.events.filter(x=>['connected','disconnected','instance-reset','error'].includes(x.type));client?.dispose();fs.writeFileSync('evidence/grand-ux-005/public-'+(process.env.RECOVERY_ONLY?'recovery':'check')+'.json',JSON.stringify(out,null,2));console.log(JSON.stringify({status:out.status,error:out.error,reason:out.reason,commands:out.commands,phases:out.phases.map(({metrics,...x})=>x),reload:out.linuxPersistentReload,legacy:out.legacyStatus}));}

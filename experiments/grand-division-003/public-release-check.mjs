import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import WS from 'ws';
const origin='https://eastfront-grand-preview.onrender.com',expected='3d6eeb3070520fd8d3b03ee5cfdffff8baa149d4';
const phase=process.argv[2]??'before',privateFile=path.join(process.env.LOCALAPPDATA,'Eastfront','division003-public-check.json');
const saved=fs.existsSync(privateFile)?JSON.parse(fs.readFileSync(privateFile)):null;
if(phase==='after')assert(saved,'test visitor checkpoint required');
const cookies=new Map(saved?.cookies??[]),nativeFetch=globalThis.fetch,results={at:new Date().toISOString(),phase,source:expected,scope:'Independent visitor HTTPS/WSS checks; not browser/tablet performance; reload alone is not whole-service restart.',modes:[]};let client;
const checkpoint=saved??{cookies:[],modes:{}};
const wait=ms=>new Promise(r=>setTimeout(r,ms)),until=async f=>{for(let n=0;n<600&&!f();n++)await wait(50);assert(f(),'bounded response wait');};
globalThis.fetch=async(p,o={})=>{const r=await nativeFetch(new URL(p,origin),{...o,headers:{...o.headers,origin,cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')},signal:AbortSignal.timeout(30000)});for(const c of r.headers.getSetCookie()){const raw=c.split(';')[0],i=raw.indexOf('=');cookies.set(raw.slice(0,i),raw.slice(i+1));}return r;};
globalThis.location={origin,search:''};globalThis.document={querySelector:()=>({content:'territory-1'})};globalThis.sessionStorage={getItem:()=>null,setItem:()=>{}};
globalThis.WebSocket=class extends WS{constructor(url){super(url,{headers:{origin,cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')}});this.on('error',()=>{});}};
const module=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const record=()=>{checkpoint.cookies=[...cookies];fs.mkdirSync(path.dirname(privateFile),{recursive:true});fs.writeFileSync(privateFile,JSON.stringify(checkpoint));};
try{
 assert.equal((await fetch('/healthz')).status,200);
 if(!saved){assert.equal((await fetch('/release/info?campaign=combined')).status,401);assert.equal((await fetch('/visitor/start',{method:'POST',redirect:'manual'})).status,303);record();}
 const menu=await(await fetch('/campaigns')).text();for(const label of ['原战役','步兵先行','多兵种'])assert(menu.includes(label));results.menu=true;
 const view=await(await fetch('/transport/view.mjs')).text(),sync=await(await fetch('/sync.mjs')).text(),codec=await(await fetch('/transport/stateCodec.mjs')).text();
 const source=(await(await fetch('/transport/client.mjs')).text()).replace("'/transport/stateCodec.mjs'",JSON.stringify(module(codec))).replace("'/transport/view.mjs'",JSON.stringify(module(view))).replace("'/sync.mjs'",JSON.stringify(module(sync)));
 for(const mode of ['legacy','division','combined']){
  globalThis.location.search='?campaign='+mode;
  // Match a real navigation: this client captures campaignMode on module load.
  const {Client}=await import(module(source+'\n// campaign '+mode));
  const response=await fetch('/release/info?campaign='+mode);assert.equal(response.status,200,await response.clone().text());const info=await response.json();assert.equal(info.build.source,expected);assert(info.paused&&!info.pieceFixture);assert.equal(info.divisionIntegrated,mode!=='legacy');if(mode==='combined')assert.equal(info.divisionProfile,'DIVISION-003-COMBINED-1');
  client=new Client('a');await client.start();await until(()=>client.view);
  assert.equal(client.document().instanceId,info.instanceId,'transport must bind the requested campaign');
  const row={mode,instanceId:info.instanceId,commands:[]};results.modes.push(row);
  const fingerprint=()=>{const d=client.document();return {tick:d.continuous.tick,units:hash(d.units),divisions:hash(d.divisions??null),unitCount:d.units?.length,keys:Object.keys(d)};};
  async function submit(kind,payload,keys,dep={}){const id=client.submit(kind,payload,keys,dep);await until(()=>client.history.some(r=>r.command.requestId===id));const r=client.history.find(r=>r.command.requestId===id);assert.equal(r.status,'applied',JSON.stringify(r.result));row.commands.push({kind,operation:payload.type,receiptMs:Math.round(r.resultAt-r.sendAt)});}
  if(phase==='after'){assert.equal(info.instanceId,checkpoint.modes[mode].instanceId);assert.deepEqual(fingerprint(),checkpoint.modes[mode].fingerprint);row.persistedStateMatch=true;await submit('SAVE',{},['all']);assert.deepEqual(fingerprint(),checkpoint.modes[mode].fingerprint);row.resavedWithoutProgressChange=true;}
  else{
   const world=()=>({worldGeneration:client.document().transport.worldGeneration});
   await submit('OPERATION',{type:'CLOCK',paused:false,speed:1},['world'],world());const tick=client.document().continuous.tick;await until(()=>client.document().continuous.tick>tick);
   await submit('OPERATION',{type:'CLOCK',paused:true,speed:1},['world'],world());await submit('SAVE',{},['all']);
   checkpoint.modes[mode]={instanceId:info.instanceId,fingerprint:fingerprint()};record();
  }
  row.fingerprint=fingerprint();const connections=()=>client.events.filter(x=>x.type==='connected').length,count=connections();client.disconnect();await until(()=>connections()>count&&client.connected&&client.version>0);assert.deepEqual(fingerprint(),row.fingerprint);assert(client.document().continuous.paused);row.reconnect=true;record();client.dispose();client=null;
  await wait(36000);const reload=await(await fetch('/release/info?campaign='+mode)).json();assert.equal(reload.instanceId,info.instanceId);assert.equal(reload.tick,row.fingerprint.tick);assert(reload.saved&&reload.paused);row.linuxPersistentReload={tick:reload.tick,saved:reload.saved};console.log(JSON.stringify({mode,phase,tick:reload.tick,reconnect:true,persisted:true}));
  await wait(36000);
 }
 assert.equal(new Set(results.modes.map(x=>x.instanceId)).size,3);results.status='PASS';
}catch(e){results.status='FAIL';results.error=e.message;process.exitCode=1;}finally{client?.dispose();record();fs.writeFileSync('evidence/grand-division-003/release/public-'+phase+'.json',JSON.stringify(results,null,2));console.log(JSON.stringify({status:results.status,error:results.error,phase}));}

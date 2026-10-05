import assert from'node:assert/strict';import fs from'node:fs';
import{LogisticsPort}from'../../.ai003-preview/src/playable/logistics.js';
const storage=new Map();globalThis.sessionStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
const state=(version,revision,paused=false)=>({instanceId:'client-check',version,officers:{enabled:true,revision,groups:[{order:{kind:'REFIT'},paused,members:['own']}]},game:{message:{payload:{matchRevision:version}},meta:{ownerSide:'GERMAN'}}});
const p=new LogisticsPort(()=>{});p.data=state(0,1);let posts=[],resolveTick;let current=state(0,1);
globalThis.fetch=async(path,o)=>{if(path==='/play/officers/tick'){posts.push(path);return await new Promise(r=>resolveTick=()=>{current=state(1,1);r({ok:true,json:async()=>({ok:true,version:1})});});}
 if(path==='/play/officers/config'){posts.push(path);current=state(1,2,true);return{ok:true,json:async()=>({ok:true,revision:2})};}
 return{ok:true,json:async()=>current};};
// Controlled unresolved transaction: pause must not race ahead or dispatch a second action.
p.officerBusy=p.officerStep(0);const pause=p.officerConfig({type:'PAUSE',group:'0'});assert.deepEqual(posts,['/play/officers/tick']);resolveTick();await pause;
assert.deepEqual(posts,['/play/officers/tick','/play/officers/config']);assert.equal(p.data.version,1);assert(p.data.officers.groups[0].paused);assert.equal(p.officerTimer,null);p.terminate();
const q=new LogisticsPort(()=>{});q.data=state(5,4);globalThis.fetch=async()=>{throw Error('LOST_REPLY')};await q.officerStep(0);assert(q.locked&&q.officerHalt);assert.equal(q.officerTimer,null);q.terminate();
const serial=new LogisticsPort(()=>{});serial.data=state(1,1,true);let rev=1;const used=[];globalThis.fetch=async(path,o)=>{if(path==='/play/officers/config'){const q=JSON.parse(o.body);assert.equal(q.revision,rev);used.push(rev++);}return{ok:true,json:async()=>state(1,rev,true)};};await Promise.all([serial.officerConfig({type:'RP'}),serial.officerConfig({type:'ORDER'})]);assert.deepEqual(used,[1,2]);serial.terminate();
const summary={quickConfigurationSerialized:true,pauseWaitsForSubmittedResult:true,noPostPauseDispatch:true,lostReplyHaltsAndLocks:true};fs.writeFileSync('evidence/officer-001/client-check.json',JSON.stringify(summary,null,2));console.log(summary);

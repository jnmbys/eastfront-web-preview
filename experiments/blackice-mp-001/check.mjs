import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {fork} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {WebSocket} from 'ws';
import {patch,canonical} from '../grand-play-mp022/sync.mjs';
import {readSave} from '../grand-release-001/persistence.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),deadline=async(fn,ms=20000)=>{const t=Date.now();while(Date.now()-t<ms){const v=fn();if(v)return v;await sleep(30);}throw Error('TIMEOUT');};
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'blackice-mp-check-'));
const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));const origin=`http://127.0.0.1:${port}`;
let processChild;const sockets=[],checks=[];
async function boot(){processChild=fork(new URL('./server.mjs',import.meta.url),[],{env:{...process.env,PORT:String(port),SAVE_DIR:scratch},silent:true});let ready=false,err='';processChild.stdout.on('data',b=>{if(b.toString().includes('"ready":true'))ready=true;});processChild.stderr.on('data',b=>err+=b);await deadline(()=>{if(processChild.exitCode!==null)throw Error(err);return ready;});}
async function stop(){for(const x of sockets)x.ws?.close();await sleep(150);const child=processChild;child.send('shutdown');await deadline(()=>child.exitCode!==null);}
function visitor(){return {cookies:new Map()};}
async function http(v,url,data){const r=await fetch(origin+url,{method:data===undefined?'GET':'POST',headers:{Origin:origin,Cookie:[...v.cookies].map(([k,v])=>k+'='+v).join('; '),'Content-Type':'application/json','X-Grand-Protocol':'GRAND-RELEASE-TERRITORY-1'},...(data===undefined?{}:{body:JSON.stringify(data)})});for(const c of r.headers.getSetCookie()){const [k,value]=c.split(';')[0].split('=');v.cookies.set(k,value);}return {status:r.status,data:await r.json()};}
async function connect(v,room,seat){const s=await http(v,`/${seat}/session?campaign=${room}`,{});assert.equal(s.status,200);const c={visitor:v,room,seat,view:null,messages:[],epoch:null,instance:s.data.instanceId};
 c.ws=new WebSocket(origin.replace('http','ws')+`/${seat}/ws?campaign=${room}`,{origin,headers:{Cookie:[...v.cookies].map(([k,v])=>k+'='+v).join('; ')}});sockets.push(c);
 c.send=m=>c.ws.send(JSON.stringify({...m,instanceId:c.instance,connectionEpoch:c.epoch}));
 c.ws.on('open',()=>c.ws.send(JSON.stringify({type:'HELLO'})));c.ws.on('error',()=>{});c.ws.on('message',b=>{const m=JSON.parse(b);c.messages.push(m);if(m.type==='WELCOME'){c.epoch=m.connectionEpoch;c.era=m.era;}if(m.type==='STATE'){c.view=m.full??patch(c.view,m.change);c.send({type:'VIEW_ACK',stream:m.stream,viewVersion:m.viewVersion});}});
 await deadline(()=>c.view);return c;
}
async function fresh(c){const n=c.messages.length;c.send({type:'RESYNC',stream:c.messages.filter(m=>m.type==='STATE').at(-1).stream});await deadline(()=>c.messages.slice(n).some(m=>m.type==='STATE'));return c.view.document;}
async function issue(c,p,kind='OPERATION',extra={}){const d=await fresh(c),u=d.continuous.units[p.unit],g=d.continuous.corps.find(g=>g.permanentId===p.groupId);const command={instanceId:c.instance,era:c.era,requestId:randomUUID(),commandSeq:d.transport.nextCommandSeq,kind,payload:p,dependencies:{worldGeneration:d.transport.worldGeneration,economyGeneration:d.transport.economyGeneration,unitGeneration:u?.commandGeneration,commandGeneration:g?.commandGeneration,...extra}};c.send({type:'COMMAND',command});const m=await deadline(()=>c.messages.find(m=>m.type==='RESULT'&&m.result.requestId===command.requestId||m.type==='ERROR'&&m.requestId===command.requestId));return {command,result:m.result??m};}
const order=(d,id)=>({type:'DIRECT',unit:id,order:{kind:'HOLD',target:d.continuous.units[id].hex,risk:'NORMAL',paused:false}});
const hash=x=>createHash('sha256').update(canonical(x)).digest('hex');
try{
 await boot();const a=visitor(),b=visitor(),third=visitor();for(const v of[a,b,third])assert.equal((await http(v,'/visitor/start',{})).status,200);
 const made=await http(a,'/room/create',{});assert.equal(made.status,201);const room=made.data.roomId,invite=new URL(made.data.joinUrl,origin),join={roomId:room,invite:new URLSearchParams(invite.hash.slice(1)).get('invite')};
 assert.equal((await http(b,'/room/join',join)).status,200);assert.equal((await http(b,'/room/join',join)).data.seat,'b');assert.equal((await http(third,'/room/join',join)).data.error,'ROOM_FULL');
 assert.equal((await http(third,`/release/info?campaign=${room}`)).status,403);assert.equal((await http(a,`/b/session?campaign=${room}`,{})).status,403);
 const another=await http(third,'/room/create',{});assert.equal((await http(a,`/release/info?campaign=${another.data.roomId}`)).status,403);assert.equal((await http(third,'/room/join',{roomId:another.data.roomId,invite:join.invite})).status,403);checks.push('signed independent visitors; idempotent join; third/cross-room/wrong-seat rejected');
 let ca=await connect(a,room,'a'),cb=await connect(b,room,'b');let da=await fresh(ca),db=await fresh(cb);
 const forbiddenUpgrade=await new Promise(resolve=>{const stolenSeat=[...a.cookies].filter(([k])=>k.startsWith('bmp_')),cookies=new Map([...third.cookies,...stolenSeat]);const ws=new WebSocket(origin.replace('http','ws')+`/a/ws?campaign=${room}`,{origin,headers:{Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')}});ws.on('unexpected-response',(_,r)=>{r.resume();resolve(r.statusCode);});ws.on('error',()=>{});ws.on('open',()=>{ws.close();resolve(101);});});assert.equal(forbiddenUpgrade,403);checks.push('foreign visitor with copied short-lived seat cookie still cannot upgrade WebSocket');
 assert.equal(ca.instance,cb.instance);assert.equal(da.viewer,'GERMAN');assert.equal(db.viewer,'SOVIET');assert.equal(da.continuous.tick,db.continuous.tick);assert.equal(da.continuous.rules,'BLACKICE-001-LAND-1-R1');
 for(const d of[da,db]){assert(Object.values(d.continuous.units).every(u=>u.alive!==undefined));assert(d.modern.lines.every(l=>l.side===d.viewer));assert(d.divisions.integrated.units.every(u=>u.side===d.viewer));assert(!JSON.stringify(d).includes(join.invite));assert(!d.room.members);}
 assert.equal((await issue(ca,{type:'CLOCK',paused:false,speed:1})).result.status,'REJECTED');assert.equal((await http(b,`/room/start?campaign=${room}`,{})).status,409);assert.equal((await http(a,`/room/start?campaign=${room}`,{})).status,200);assert.equal((await fresh(ca)).continuous.paused,true);
 da=await fresh(ca);db=await fresh(cb);const ga=Object.keys(da.continuous.units)[0],sb=Object.keys(db.continuous.units)[0];
 const pair=await Promise.all([issue(ca,order(da,ga)),issue(cb,order(db,sb))]);assert(pair.every(x=>x.result.status==='APPLIED'),JSON.stringify(pair.map(x=>x.result)));checks.push('both sides same world; prestart gate; concurrent own manual commands applied');
 assert.equal((await issue(ca,{...order(db,sb)},'OPERATION',{unitGeneration:0})).result.status,'REJECTED');
 const foreign=db.modern.lines[0];assert.equal((await issue(ca,{type:'ECON_LINE',line:foreign.id,product:foreign.product,factories:[],priority:1})).result.reason,'LINE_NOT_AUTHORIZED');
 assert.equal((await issue(cb,{type:'CLOCK',paused:false,speed:1})).result.reason,'ONLY_HOST_MAY_RESUME_OR_CHANGE_SPEED');
 assert.equal((await issue(cb,{},'LOAD')).result.status,'REJECTED');
 const dup=pair[0];ca.send({type:'COMMAND',command:dup.command});await sleep(150);assert.equal(ca.messages.filter(m=>m.type==='RESULT'&&m.result.requestId===dup.command.requestId).length,2);checks.push('foreign unit/economy rejected; host-only resume; duplicate result returned without reapply');
 const old=ca;ca=await connect(a,room,'a');await deadline(()=>old.ws.readyState===3);assert(old.ws.readyState===3);checks.push('replacement connection closes old session');
 const before=readSave(path.join(scratch,'rooms',room,'campaign.json')).campaign;
 assert.equal((await issue(ca,{type:'CLOCK',paused:false,speed:4})).result.status,'APPLIED');await deadline(()=>ca.view.document.continuous.tick>=2,30000);
 cb.ws.close();await deadline(()=>ca.view.document.room.connected.b===false&&ca.view.document.continuous.paused);const disconnectedTick=ca.view.document.continuous.tick;await sleep(1000);assert.equal((await fresh(ca)).continuous.tick,disconnectedTick);
 cb=await connect(b,room,'b');assert.equal((await fresh(cb)).continuous.paused,true);assert.equal((await issue(cb,{type:'CLOCK',paused:true,speed:4})).result.status,'APPLIED');
 assert.equal((await issue(ca,{type:'CLOCK',paused:false,speed:1})).result.status,'APPLIED');await deadline(()=>ca.view.document.continuous.tick>disconnectedTick,15000);assert.equal((await issue(cb,{type:'CLOCK',paused:true,speed:1})).result.status,'APPLIED');checks.push('real time advance; any disconnect pauses; original identity reconnects; guest pause; explicit host resume');
 for(const c of[ca,cb])assert.equal((await issue(c,{},'SAVE')).result.status,'APPLIED');
 const file=path.join(scratch,'rooms',room,'campaign.json'),saved=readSave(file).campaign;
 assert.deepEqual(saved.clock.divisionLedger.combinedAI,before.clock.divisionLedger.combinedAI);
 assert.deepEqual(saved.econ.modern.management,before.econ.modern.management);
 assert.equal(saved.clock.units[ga].manual?.source,before.clock.units[ga].manual?.source);
 const checkpoint={tick:saved.clock.tick,rng:saved.clock.rng,units:saved.clock.units,tactical:saved.clock.tactical,frontDefense:saved.clock.frontDefense,corps:saved.clock.corps.map(({commandGeneration,...g})=>g),ledger:saved.clock.divisionLedger,room:saved.clock.room.members,manual:[saved.clock.units[ga].direct,saved.clock.units[sb].direct]};
 await stop();await boot();ca=await connect(a,room,'a');cb=await connect(b,room,'b');da=await fresh(ca);db=await fresh(cb);assert.equal(da.continuous.tick,checkpoint.tick);assert.equal(db.continuous.tick,checkpoint.tick);assert(da.continuous.paused&&db.continuous.paused);assert.equal(ca.instance,saved.instanceId);assert.equal(cb.instance,saved.instanceId);
 const restored=readSave(file).campaign;assert.equal(restored.clock.rng,checkpoint.rng);assert.deepEqual(restored.clock.tactical,checkpoint.tactical);assert.deepEqual(restored.clock.frontDefense,checkpoint.frontDefense);assert.deepEqual(restored.clock.corps.map(({commandGeneration,...g})=>g),checkpoint.corps);assert.deepEqual(restored.clock.divisionLedger,checkpoint.ledger);assert.deepEqual(restored.clock.room.members,checkpoint.room);assert.deepEqual([restored.clock.units[ga].direct,restored.clock.units[sb].direct],checkpoint.manual);
 ca.send({type:'COMMAND',command:dup.command});const stale=await deadline(()=>ca.messages.find(m=>m.type==='ERROR'&&m.requestId===dup.command.requestId));assert.equal(stale.reason,'RESTORED_SESSION_REPLAN_REQUIRED');
 for(const c of[ca,cb])assert.equal((await issue(c,{},'SAVE')).result.status,'APPLIED');assert.equal((await http(third,`/release/info?campaign=${room}`)).status,403);
 checks.push('actual child-process exit/restart; same identities/world/tick/RNG/inventory/manual intents; paused; save again; old era rejected');
 const result={schema:'BLACKICE-MP-PROTOCOL-EVIDENCE-1',passed:true,checks,tick:checkpoint.tick,privateCheckpointHash:hash(checkpoint),restart:'real Node child process, exited then launched with same isolated directory',privacy:'No credentials, invitation or hidden state included',scope:'HTTP/WS protocol; not browser or remote play'};
 fs.mkdirSync('evidence/blackice-mp-001',{recursive:true});fs.writeFileSync('evidence/blackice-mp-001/protocol.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{if(processChild?.exitCode===null)await stop();}

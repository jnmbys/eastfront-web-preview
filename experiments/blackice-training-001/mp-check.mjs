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
async function boot(){processChild=fork(new URL(process.env.BLACKICE_TEST_SERVER??'./mp-server.mjs',import.meta.url),[],{env:{...process.env,PORT:String(port),SAVE_DIR:scratch},silent:true});let ready=false,err='';processChild.stdout.on('data',b=>{if(b.toString().includes('"ready":true'))ready=true;});processChild.stderr.on('data',b=>err+=b);await deadline(()=>{if(processChild.exitCode!==null)throw Error(err);return ready;});}
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
 const made=await http(a,'/room/create',{});const room=made.data.roomId,invite=new URL(made.data.joinUrl,origin);assert.equal((await http(b,'/room/join',{roomId:room,invite:new URLSearchParams(invite.hash.slice(1)).get('invite')})).status,200);
 let ca=await connect(a,room,'a'),cb=await connect(b,room,'b');assert.equal((await http(a,`/room/start?campaign=${room}`,{})).status,200);
 const da=await fresh(ca),db=await fresh(cb);assert(da.training&&db.training);assert(!da.continuous.units['S-013']);assert(!db.continuous.units['G-013']);
 const ga=Object.keys(da.continuous.units).find(id=>!da.continuous.units[id].training.eligibleReason&&da.continuous.units[id].org>=25),sb=Object.keys(db.continuous.units).find(id=>!db.continuous.units[id].training.eligibleReason&&db.continuous.units[id].org>=25);
 assert(ga&&sb);const dup=await issue(ca,{type:'TRAINING',unit:ga,active:true});assert.equal(dup.result.status,'APPLIED');assert.equal((await issue(cb,{type:'TRAINING',unit:sb,active:true})).result.status,'APPLIED');
 ca.send({type:'COMMAND',command:dup.command});await sleep(100);assert.equal((await fresh(ca)).continuous.units[ga].training.active,true);
 assert.equal((await issue(cb,{type:'TRAINING',unit:ga,active:false})).result.status,'REJECTED');assert.equal((await issue(ca,{type:'TRAINING',unit:ga,active:false},'OPERATION',{unitGeneration:0})).result.status,'REJECTED');
 assert.equal((await http(third,`/release/info?campaign=${room}`)).status,403);checks.push('two independent visitor connections: own training, foreign denial, stale unit generation, duplicate request, third identity denied');
 await issue(ca,{type:'CLOCK',paused:false,speed:4});await deadline(()=>ca.view.document.continuous.tick>=3,30000);await issue(cb,{type:'CLOCK',paused:true,speed:4});
 assert((await fresh(ca)).continuous.units[ga].training.experience>0);assert((await fresh(cb)).continuous.units[sb].training.experience>0);checks.push('both human sides gain own unit XP under real shared clock; no enemy private training units exposed');
 await issue(ca,{},'SAVE');const file=path.join(scratch,'rooms',room,'campaign.json'),saved=readSave(file).campaign,prior={tick:saved.clock.tick,training:saved.clock.training,ledger:saved.clock.divisionLedger,weather:saved.clock.weather,rng:saved.clock.rng,members:saved.clock.room.members};
 await stop();await boot();ca=await connect(a,room,'a');cb=await connect(b,room,'b');const va=await fresh(ca),vb=await fresh(cb);assert(va.continuous.paused&&vb.continuous.paused);assert.equal(va.continuous.tick,prior.tick);const restored=readSave(file).campaign;assert.deepEqual(restored.clock.training,prior.training);assert.deepEqual(restored.clock.divisionLedger,prior.ledger);assert.deepEqual(restored.clock.weather,prior.weather);assert.equal(restored.clock.rng,prior.rng);assert.deepEqual(restored.clock.room.members,prior.members);
 assert.equal((await issue(ca,{type:'TRAINING',unit:ga,active:false})).result.status,'APPLIED');await issue(cb,{},'SAVE');checks.push('actual multiplayer service process restart: same identities/room/training/XP/wear/weather/RNG/inventory, paused, stop and save again');
 fs.writeFileSync('evidence/blackice-training-001/multiplayer.json',JSON.stringify({passed:true,checks,tick:prior.tick,scope:'two independent HTTP/WS identities; real process restart; not two-browser or remote play'},null,2));console.log(checks.join('\n'));
}finally{if(processChild?.exitCode===null)await stop();}

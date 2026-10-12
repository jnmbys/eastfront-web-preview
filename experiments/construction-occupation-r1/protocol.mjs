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
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'construction-mp-check-'));
const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));const origin=`http://127.0.0.1:${port}`;
let processChild;const sockets=[],checks=[];
async function boot(){processChild=fork(new URL(process.env.BLACKICE_TEST_SERVER??'./mp-worker.mjs',import.meta.url),[],{env:{...process.env,PORT:String(port),SAVE_DIR:scratch},silent:true});let ready=false,err='';processChild.stdout.on('data',b=>{if(b.toString().includes('"ready":true'))ready=true;});processChild.stderr.on('data',b=>err+=b);await deadline(()=>{if(processChild.exitCode!==null)throw Error(err);return ready;});}
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
 await boot();const a=visitor(),b=visitor();for(const v of [a,b])assert.equal((await http(v,'/visitor/start',{})).status,200);
 const made=await http(a,'/room/create',{}),room=made.data.roomId,invite=new URL(made.data.joinUrl,origin);assert.equal((await http(b,'/room/join',{roomId:room,invite:new URLSearchParams(invite.hash.slice(1)).get('invite')})).status,200);
 const ca=await connect(a,room,'a'),cb=await connect(b,room,'b');await http(a,`/room/start?campaign=${room}`,{});
 let da=await fresh(ca),db=await fresh(cb);const sa=da.modern.forts.find(s=>s.canBuild),sb=db.modern.forts.find(s=>s.canBuild);
 assert.equal((await issue(ca,{type:'ECON_BUILD',kind:'FORT',target:sa.hex})).result.status,'APPLIED');assert.equal((await issue(cb,{type:'ECON_BUILD',kind:'FORT',target:sb.hex})).result.status,'APPLIED');
 da=await fresh(ca);db=await fresh(cb);const qa=da.modern.queue[0],qb=db.modern.queue[0];assert(!da.modern.queue.some(q=>q.id===qb.id));
 assert.equal((await issue(cb,{type:'CONSTRUCTION_CANCEL',id:qa.id})).result.status,'REJECTED');assert.equal((await issue(cb,{type:'CONSTRUCTION_SORT',ids:[qa.id]})).result.status,'REJECTED');
 assert.equal((await issue(ca,{type:'CONSTRUCTION_SORT',ids:[qa.id]},'OPERATION',{economyGeneration:-1})).result.reason,'ECONOMY_CONFIGURATION_CHANGED');
 const cancelled=await issue(ca,{type:'CONSTRUCTION_CANCEL',id:qa.id});assert.equal(cancelled.result.status,'APPLIED');ca.send({type:'COMMAND',command:cancelled.command});await sleep(100);assert.equal(ca.messages.filter(m=>m.type==='RESULT'&&m.result.requestId===cancelled.command.requestId).length,2);
 assert((await fresh(ca)).modern.queue[0].cancelled);assert(!(await fresh(cb)).modern.queue[0].cancelled);await stop();
 fs.writeFileSync('evidence/construction-occupation-r1/protocol.json',JSON.stringify({passed:true,checks:['two signed independent visitors, each queues own project','opposing queue hidden, cancel/reorder rejected','stale economy generation rejected','duplicate cancellation returns same receipt; other side unaffected'],temporaryResourcesClosed:true},null,2));console.log('PASS focused two-identity construction protocol');
}finally{if(processChild?.exitCode===null)await stop();}

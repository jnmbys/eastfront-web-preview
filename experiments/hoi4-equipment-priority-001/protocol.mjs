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
 let da=await fresh(ca),db=await fresh(cb);
 const add=d=>({type:'RECRUIT_ADD',template:d.divisions.integrated.templates[0].id,templateVersion:d.divisions.integrated.templates[0].version,city:d.recruitment.cities.find(x=>!x.reason).id,quantity:1});
 const ra=await issue(ca,add(da)),rb=await issue(cb,add(db));assert.equal(ra.result.status,'APPLIED');assert.equal(rb.result.status,'APPLIED');
 da=await fresh(ca);db=await fresh(cb);const qa=da.recruitment.units[0],qb=db.recruitment.units[0];
 assert.equal((await issue(ca,{type:'EQUIPMENT_PRIORITY',policy:'RECRUIT'})).result.status,'APPLIED');
 const setting=await issue(ca,{type:'EQUIPMENT_PRIORITY',unit:qa.id,level:1});assert.equal(setting.result.status,'APPLIED');ca.send({type:'COMMAND',command:setting.command});
 assert.equal((await issue(cb,{type:'EQUIPMENT_PRIORITY',unit:qa.id,level:3})).result.status,'REJECTED');assert.equal((await fresh(cb)).equipmentPriority.policy,'FIELD');assert.equal((await fresh(cb)).equipmentPriority.levels[qa.id],undefined);
 assert.equal((await issue(ca,{type:'EQUIPMENT_PRIORITY',policy:'FIELD'},'OPERATION',{economyGeneration:-1})).result.reason,'ECONOMY_CONFIGURATION_CHANGED');assert(qa&&qb);assert(!da.recruitment.units.some(q=>q.id===qb.id));
 assert.equal((await issue(cb,{type:'RECRUIT_CANCEL',id:qa.id})).result.status,'REJECTED');
 assert.equal((await issue(ca,{type:'RECRUIT_PRIORITY',id:qa.id,direction:1},'OPERATION',{economyGeneration:-1})).result.reason,'ECONOMY_CONFIGURATION_CHANGED');
 ca.send({type:'COMMAND',command:ra.command});await sleep(100);assert.equal((await fresh(ca)).recruitment.units.length,1);
 await issue(ca,{},'SAVE');const prior=hash((await fresh(ca)).recruitment);await stop();await boot();const again=await connect(a,room,'a'),other=await connect(b,room,'b');assert.equal(hash((await fresh(again)).recruitment),prior);assert.equal((await fresh(again)).equipmentPriority.policy,'RECRUIT');assert.equal((await fresh(again)).equipmentPriority.levels[qa.id],1);assert((await fresh(again)).continuous.paused);assert.equal((await fresh(other)).recruitment.units[0].id,qb.id);await issue(again,{},'SAVE');await stop();
 fs.writeFileSync('evidence/hoi4-equipment-priority-001/protocol.json',JSON.stringify({passed:true,checks:['two independent signed visitors; priority foreign recipient rejected and hidden; stale economy generation; duplicate; settings retained across actual process restart','foreign queue hidden and cancel denied','stale economy generation rejects','duplicate creates once','real room service restart preserves both queues and identities; paused; save again'],temporaryResourcesClosed:true},null,2));console.log('PASS recruitment two-identity protocol');
}finally{if(processChild?.exitCode===null)await stop();}

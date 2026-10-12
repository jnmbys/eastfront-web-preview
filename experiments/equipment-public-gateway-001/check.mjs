import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import https from 'node:https';
import {fork} from 'node:child_process';import {randomUUID,createHash} from 'node:crypto';import {WebSocket} from 'ws';
import {patch,canonical} from '../grand-play-mp022/sync.mjs';import {readSave} from '../grand-release-001/persistence.mjs';
import {setup} from './test-setup.mjs';import {backup,verify,restore} from './backup.mjs';
const setupData=await setup(),{dir,cfg,config,ca,legacyCookie}=setupData,origin=cfg.origin;
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),deadline=async(fn,ms=25000)=>{const t=Date.now();while(Date.now()-t<ms){const v=fn();if(v)return v;await sleep(30);}throw Error('TIMEOUT');};
let child;const sockets=[],pids=[],checks=[];
async function boot(){child=fork(new URL('./test-worker.mjs',import.meta.url),[],{env:{...process.env,GATEWAY_TEST_CONFIG:config},silent:true});let ready=false,err='';child.stdout.on('data',b=>{if(b.toString().includes('"ready":true'))ready=true;});child.stderr.on('data',b=>err+=b);await deadline(()=>{if(child.exitCode!==null)throw Error(err);return ready;});pids.push(child.pid);}
async function stop(){for(const c of sockets)c.ws?.close();await sleep(150);child.send('shutdown');await deadline(()=>child.exitCode!==null);}
function visitor(){return {cookies:new Map()};}
async function http(v,url,data,extra={}){return new Promise((resolve,reject)=>{const p=https.request(origin+url,{ca,family:4,servername:'localhost',method:data===undefined?'GET':'POST',headers:{Origin:origin,Cookie:[...v.cookies].map(([k,v])=>k+'='+v).join('; '),'Content-Type':'application/json','X-Grand-Protocol':'GRAND-RELEASE-TERRITORY-1',...extra}},r=>{for(const c of r.headers['set-cookie']??[]){assert(c.includes('Secure'));assert(c.includes('HttpOnly'));const[k,val]=c.split(';')[0].split('=');v.cookies.set(k,val);}let body='';r.on('data',b=>body+=b);r.on('end',()=>{let data;try{data=JSON.parse(body);}catch{data=body;}resolve({status:r.statusCode,data});});});p.on('error',reject);if(data!==undefined)p.write(JSON.stringify(data));p.end();});}
async function connect(v,room,seat){const s=await http(v,`/${seat}/session?campaign=${room}`,{});assert.equal(s.status,200);const c={visitor:v,room,seat,view:null,messages:[],epoch:null,instance:s.data.instanceId};
 c.ws=new WebSocket(origin.replace('https','wss')+`/${seat}/ws?campaign=${room}`,{ca,family:4,origin,headers:{Cookie:[...v.cookies].map(([k,v])=>k+'='+v).join('; ')}});sockets.push(c);
 c.send=m=>c.ws.send(JSON.stringify({...m,instanceId:c.instance,connectionEpoch:c.epoch}));
 c.ws.on('open',()=>c.ws.send(JSON.stringify({type:'HELLO'})));c.ws.on('error',()=>{});c.ws.on('message',b=>{const m=JSON.parse(b);c.messages.push(m);if(m.type==='WELCOME'){c.epoch=m.connectionEpoch;c.era=m.era;}if(m.type==='STATE'){c.view=m.full??patch(c.view,m.change);c.send({type:'VIEW_ACK',stream:m.stream,viewVersion:m.viewVersion});}});
 await deadline(()=>c.view);return c;
}
async function fresh(c){const n=c.messages.length;c.send({type:'RESYNC',stream:c.messages.filter(m=>m.type==='STATE').at(-1).stream});await deadline(()=>c.messages.slice(n).some(m=>m.type==='STATE'));return c.view.document;}
async function issue(c,p,kind='OPERATION',extra={}){const d=await fresh(c),u=d.continuous.units[p.unit],g=d.continuous.corps.find(g=>g.permanentId===p.groupId);const command={instanceId:c.instance,era:c.era,requestId:randomUUID(),commandSeq:d.transport.nextCommandSeq,kind,payload:p,dependencies:{worldGeneration:d.transport.worldGeneration,economyGeneration:d.transport.economyGeneration,unitGeneration:u?.commandGeneration,commandGeneration:g?.commandGeneration,...extra}};c.send({type:'COMMAND',command});const m=await deadline(()=>c.messages.find(m=>m.type==='RESULT'&&m.result.requestId===command.requestId||m.type==='ERROR'&&m.requestId===command.requestId));return {command,result:m.result??m};}

const hash=x=>createHash('sha256').update(canonical(x)).digest('hex');
async function denyWS(v,url,headers={}){return new Promise((resolve,reject)=>{const w=new WebSocket(origin.replace('https','wss')+url,{ca,family:4,origin,headers:{Cookie:[...v.cookies].map(([k,v])=>k+'='+v).join('; '),...headers}});w.on('open',()=>{w.close();reject(Error('UNEXPECTED_WS_ACCEPT'));});w.on('unexpected-response',(_q,r)=>{r.resume();w.terminate();resolve(r.statusCode);});w.on('error',()=>{});});}
try{
 await boot();const a=visitor(),b=visitor(),c=visitor(),old=visitor();const[k,v]=legacyCookie.split('=');old.cookies.set(k,v);
 assert.equal((await http(a,'/')).status,200);assert((await http(a,'/')).data.includes('新双人战役'));
 for(const x of [a,b,c])assert.equal((await http(x,'/mp/visitor/start',{})).status,200);
 assert.equal((await http(old,'/room/list')).status,401);assert.equal((await http(a,'/campaigns')).status,401);
 assert.equal((await http(a,'/room/create',{}, {Origin:'https://wrong.invalid'})).status,403);
 assert.equal((await http(a,'/healthz',undefined,{Host:'wrong.invalid'})).status,403);
 assert.equal((await http(a,'/healthz',undefined,{'X-Forwarded-Host':'wrong.invalid'})).status,403);
 for(const mode of ['legacy','division','combined']){let r=await http(old,`/release/info?campaign=${mode}`);if(r.status===503){await sleep(31000);r=await http(old,'/release/info?campaign='+mode);}assert.equal(r.status,200);assert.equal(r.data.tick,0);assert.equal(r.data.paused,true);}
 checks.push('real HTTPS with explicitly trusted temporary certificate; Secure HttpOnly cookies; three synthetic old saves restored; old/new credentials rejected across namespaces; Host/Origin checks');
 assert.equal((await http(a,'/assets/terrain/vs2-002/assets/ground/moist_soil.webp')).status,200);
 const made=await http(a,'/room/create',{});assert.equal(made.status,201);const room=made.data.roomId,inv=new URL(made.data.joinUrl,origin),invite=new URLSearchParams(inv.hash.slice(1)).get('invite');
 assert.equal((await http(b,'/room/join',{roomId:room,invite})).status,200);
 assert((await http(a,`/?campaign=${room}`)).data.includes('blackice-mp-public'));
 assert.equal((await http(b,'/room/join',{roomId:room,invite})).status,200);
 assert.equal((await http(c,'/room/join',{roomId:room,invite})).status,409);
 assert.equal((await http(c,`/release/info?campaign=${room}`)).status,403);
 assert.equal((await http(a,`/b/session?campaign=${room}`,{})).status,403);
 assert.equal(await denyWS(c,`/a/ws?campaign=${room}`),403);
 assert.equal(await denyWS(a,`/a/ws?campaign=${room}`,{Origin:'https://wrong.invalid'}),403);
 const aa=await connect(a,room,'a'),bb=await connect(b,room,'b');assert.equal((await http(a,`/room/start?campaign=${room}`,{})).status,200);
 assert.equal((await fresh(aa)).room.localOnly,false);
 for(const [x,id]of [[aa,'G-013'],[bb,'S-013']]){const d=await fresh(x);assert.equal((await issue(x,{type:'DIRECT',unit:id,order:{kind:'HOLD',target:d.continuous.units[id].hex,risk:'NORMAL',paused:false}})).result.status,'APPLIED');}
 assert.equal((await issue(bb,{type:'DIRECT',unit:'G-013',order:{kind:'HOLD',target:{q:1,r:1},risk:'NORMAL',paused:false}})).result.status,'REJECTED');
 const d=await fresh(aa),template=d.divisions.integrated.templates[0],city=d.recruitment.cities.find(x=>!x.reason);
 const recruit=await issue(aa,{type:'RECRUIT_ADD',template:template.id,templateVersion:template.version,city:city.id,quantity:1});assert.equal(recruit.result.status,'APPLIED');aa.send({type:'COMMAND',command:recruit.command});await sleep(100);assert.equal((await fresh(aa)).recruitment.units.length,1);
 assert.equal((await issue(aa,{type:'EQUIPMENT_PRIORITY',policy:'EQUAL'})).result.status,'APPLIED');
 assert.equal((await issue(bb,{type:'CLOCK',paused:false,speed:1})).result.status,'REJECTED');
 assert.equal((await issue(aa,{type:'CLOCK',paused:false,speed:1})).result.status,'APPLIED');
 bb.ws.close();await deadline(()=>aa.view?.document.continuous.paused);const reconnected=await connect(b,room,'b');assert.equal((await fresh(reconnected)).room.seat,'b');
 // Advance normal settlement in this isolated protocol fixture, no grants or ready-state injection.
 await new Promise((resolve,reject)=>{child.once('message',m=>m.error?reject(Error(m.error)):resolve());child.send({type:'steps',count:12});});
 await issue(aa,{},'SAVE');await stop();
 const save=()=>readSave(path.join(cfg.mpDir,'rooms',room,'campaign.json')).campaign;
 const fields=s=>({members:s.clock.room.members,map:s.clock.regionalMap,queue:s.econ.modern.queue,transit:s.clock.divisionLedger.recruitment.transit,priority:s.clock.equipmentPriority,inventory:s.clock.divisionLedger,tick:s.clock.tick});
 const before=fields(save());assert(before.transit.length>0);assert(before.inventory.recruitment.units);
 cfg.proxyMode=true;fs.writeFileSync(config,JSON.stringify(cfg));await boot();const again=await connect(a,room,'a'),other=await connect(b,room,'b');assert((await fresh(again)).continuous.paused);assert.equal((await fresh(other)).room.seat,'b');await issue(again,{},'SAVE');await stop();assert.equal(hash(fields(save())),hash(before));
 checks.push('Direct TLS first process, trusted TLS-offload proxy after real restart; WSS two distinct visitors; both own commands; third seat/read and foreign command denied; repeated recruitment once; guest resume denied; disconnect pause and same-seat reconnect; real process restart retains room/map/queues/transit/priorities/identities; save again');
 const destination=path.join(dir,'backup');assert(backup(cfg.legacyDir,cfg.mpDir,destination).verified);assert(verify(destination));
 const recoveredLegacy=path.join(dir,'restore-legacy'),recoveredMP=path.join(dir,'restore-mp');fs.mkdirSync(recoveredLegacy);fs.mkdirSync(recoveredMP);assert(restore(destination,recoveredLegacy,recoveredMP).verified);
 fs.writeFileSync(config,JSON.stringify({...cfg,legacyDir:recoveredLegacy,mpDir:recoveredMP}));await boot();const restored=await connect(a,room,'a');assert.equal((await fresh(restored)).recruitment.units.length,1);await connect(b,room,'b');await issue(restored,{},'SAVE');await stop();
 checks.push('offline all-file backup including both keys; SHA256 verification; empty-directory isolated restore boot and original identities reused; no online files accessed');
 fs.writeFileSync('evidence/equipment-public-gateway-001/check.json',JSON.stringify({passed:true,checks,pids,realProcessRestarts:pids.length-1,transit:before.transit.length,source:JSON.parse(fs.readFileSync('.release-territory-preview/release-build.json')).source,scope:'Windows loopback TLS/WSS protocol clients; explicit CA trust, not browser or public internet; synthetic old saves and isolated new room; 12 normal settlement steps',secrets:'not recorded'},null,2));console.log('PASS HTTPS/WSS isolation, commands, restart, backup and restore');
}finally{if(child?.exitCode===null)await stop();}


import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import zlib from 'node:zlib';
import WebSocket from 'ws';
import {start} from './server.mjs';
import {readSave} from '../grand-release-001/persistence.mjs';
import {totals,validate} from '../grand-division-002/inventory.mjs';
const origin='http://127.0.0.1:4276',saveDir=fs.mkdtempSync(path.join(os.tmpdir(),'blackice-check-'));
const opts={port:4276,origin,saveDir,autoTick:false,maxActive:6};let server=await start(opts);const sockets=[],results=[];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const http=(p,cookie='',method='GET',extra={})=>fetch(origin+p,{method,headers:{origin,cookie,connection:'close',...extra},redirect:'manual'});
const info=async(cookie,mode)=>{const r=await http('/release/info?campaign='+mode,cookie);assert.equal(r.status,200);return r.json();};
const visitor=async()=>{const r=await http('/visitor/start','','POST');assert.equal(r.status,303);assert.equal(r.headers.get('location'),'/campaigns');return r.headers.get('set-cookie').split(';')[0];};
const service=(cookie,mode)=>server.active.get(cookie.split('=')[1].split('.')[0]+':'+mode).service;
async function connect(cookie,mode){
 const r=await http('/a/session?campaign='+mode,cookie,'POST',{'X-Grand-Protocol':'GRAND-RELEASE-TERRITORY-1'});assert.equal(r.status,200);
 const seatCookie=r.headers.get('set-cookie').split(';')[0],ws=new WebSocket(origin.replace('http','ws')+'/a/ws?campaign='+mode,{headers:{origin,cookie:cookie+'; '+seatCookie}});sockets.push(ws);const rows=[];let welcome;
 const send=x=>ws.send(JSON.stringify({...x,instanceId:welcome?.instanceId,connectionEpoch:welcome?.connectionEpoch}));
 ws.on('message',bytes=>{const m=JSON.parse(bytes);rows.push(m);if(m.type==='WELCOME')welcome=m;if(m.type==='STATE')send({type:'VIEW_ACK',stream:m.stream,viewVersion:m.viewVersion});if(m.type==='RESULT')send({type:'RESULT_ACK',ids:[m.result.requestId]});});
 await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});send({type:'HELLO'});
 for(let n=0;n<200&&!rows.some(x=>x.type==='STATE');n++)await wait(20);assert(rows.some(x=>x.type==='STATE'));
 return {ws,rows,send,seatCookie,async command(kind,payload={}){
  const a=service(cookie,mode).adapter,c=a.c,id='release002-'+crypto.randomUUID();
  const command={instanceId:a.id,era:a.era,requestId:id,commandSeq:c.transport.next.a,kind,payload,dependencies:{unitGeneration:c.clock.units[payload.unit]?.commandGeneration,worldGeneration:c.transport.worldGeneration,economyGeneration:c.transport.economyGeneration}};
  const t=performance.now();send({type:'COMMAND',command});for(let n=0;n<400&&!rows.some(x=>x.type==='RESULT'&&x.result.requestId===id);n++)await wait(10);
  const result=rows.find(x=>x.type==='RESULT'&&x.result.requestId===id)?.result;assert(result,'receipt');assert.equal(result.status,'APPLIED',result.reason);return {command,result,ms:performance.now()-t};
 }};
}
try{
 const a=await visitor(),metadata=await info(a,'blackice');
 const c=service(a,'blackice').adapter.c;
 const mid=JSON.parse(zlib.gunzipSync(fs.readFileSync('evidence/blackice-001/normal-mid.json.gz')));
 c.restore(mid,true);const client=await connect(a,'blackice');const receipt=await client.command('SAVE');
 const adapter=service(a,'blackice').adapter,file=adapter.saveFile,before=readSave(file),id=adapter.id;
 client.send({type:'COMMAND',command:receipt.command});await wait(80);assert.equal(service(a,'blackice').adapter.c.transport.next.a,receipt.command.commandSeq+1);
 await wait(2050);const b=await visitor(),other=await info(b,'blackice');assert.notEqual(other.instanceId,id);
 assert.equal((await http('/release/info?campaign=combined',a)).status,400);
 for(const ws of sockets)ws.terminate();await wait(100);await server.close();
 server=await start(opts);const restored=await info(a,'blackice');assert.equal(restored.instanceId,id);assert.equal(restored.tick,before.campaign.clock.tick);assert(restored.paused);
 const after=service(a,'blackice').adapter.c;assert.deepEqual(totals(after.clock.divisionLedger),totals(before.campaign.clock.divisionLedger));assert.deepEqual(after.clock.divisionLedger.balance,before.campaign.clock.divisionLedger.balance);
 const resumed=await connect(a,'blackice');await resumed.command('SAVE');
 const summary={kind:'Local HTTP/WebSocket protocol, not browser or tablet validation',mode:'blackice',tick:restored.tick,identityRestored:true,isolatedVisitor:true,paidTransitRestored:true,pausedAfterRestart:restored.paused,repeatSaveReceipt:true,saveAfterRestart:true};
 fs.mkdirSync('evidence/blackice-001',{recursive:true});fs.writeFileSync('evidence/blackice-001/protocol.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
}finally{for(const ws of sockets)ws.terminate();await wait(100);await server.close();}

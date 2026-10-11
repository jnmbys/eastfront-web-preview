import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import zlib from 'node:zlib';
import WebSocket from 'ws';
import {start} from '../blackice-001/server.mjs';
import {readSave} from '../grand-release-001/persistence.mjs';
import {totals,validate} from '../grand-division-002/inventory.mjs';
import net from 'node:net';
const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const testPort=probe.address().port;await new Promise(r=>probe.close(r));
const origin='http://127.0.0.1:'+testPort,saveDir=fs.mkdtempSync(path.join(os.tmpdir(),'blackice-r1-check-'));
const opts={port:testPort,origin,saveDir,autoTick:false,maxActive:6};let server=await start(opts);const sockets=[],results=[];
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
 const a=await visitor(),metadata=await info(a,'blackice-r1');
 const c=service(a,'blackice-r1').adapter.c;for(let i=0;i<12;i++)c.advance();
 const unit='G-013',g=c.clock.corps.find(g=>g.members.includes(unit));
 c.clock.tactical.states[unit]={phase:'RECOVER',stamp:JSON.stringify(g.order),until:40,reason:'定向持久化检查'};
 const client=await connect(a,'blackice-r1');const receipt=await client.command('SAVE');
 const adapter=service(a,'blackice-r1').adapter,file=adapter.saveFile,before=readSave(file),id=adapter.id;
 client.send({type:'COMMAND',command:receipt.command});await wait(80);assert.equal(service(a,'blackice-r1').adapter.c.transport.next.a,receipt.command.commandSeq+1);
 const legacy=await info(a,'blackice');assert.notEqual(legacy.instanceId,id);const oldClient=await connect(a,'blackice');await oldClient.command('SAVE');
 assert.equal(service(a,'blackice').adapter.c.clock.rules,'BLACKICE-001-LAND-1');
 await wait(2050);const b=await visitor(),other=await info(b,'blackice-r1');assert.notEqual(other.instanceId,id);
 assert.equal((await http('/release/info?campaign=combined',a)).status,400);
 for(const ws of sockets)ws.terminate();await wait(100);await server.close();
 server=await start(opts);const restored=await info(a,'blackice-r1');assert.equal(restored.instanceId,id);assert.equal(restored.tick,before.campaign.clock.tick);assert(restored.paused);
 const after=service(a,'blackice-r1').adapter.c;assert.equal(after.clock.rules,'BLACKICE-001-LAND-1-R1');assert.deepEqual(totals(after.clock.divisionLedger),totals(before.campaign.clock.divisionLedger));assert.deepEqual(after.clock.divisionLedger.balance,before.campaign.clock.divisionLedger.balance);assert.deepEqual(after.clock.tactical,before.campaign.clock.tactical);assert.equal(after.clock.rng,before.campaign.clock.rng);
 const legacyAfter=await info(a,'blackice');assert.equal(legacyAfter.instanceId,legacy.instanceId);assert.equal(legacyAfter.tick,legacy.tick);assert(legacyAfter.paused);
 const resumed=await connect(a,'blackice-r1');await resumed.command('SAVE');
 const summary={kind:'Directed local HTTP/WebSocket test; close and recreate service within Node process, not browser/tablet or OS-process restart',mode:'blackice-r1',tick:restored.tick,identityRestored:true,isolatedVisitor:true,tacticalRecoveryRestored:true,ledgerAndRngRestored:true,legacyModeRetained:true,pausedAfterRestart:restored.paused,repeatSaveReceipt:true,saveAfterRestart:true};
 fs.mkdirSync('evidence/blackice-mp-001',{recursive:true});fs.writeFileSync('evidence/blackice-mp-001/singleplayer-regression.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
}finally{for(const ws of sockets)ws.terminate();await wait(100);await server.close();}

import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import zlib from 'node:zlib';
import WebSocket from 'ws';
import {start} from '../grand-release-002/server.mjs';
import {readSave} from '../grand-release-001/persistence.mjs';
import {totals,validate} from '../grand-division-002/inventory.mjs';
const origin='http://127.0.0.1:4274',saveDir=fs.mkdtempSync(path.join(os.tmpdir(),'release002-check-'));
const opts={port:4274,origin,saveDir,autoTick:false,maxActive:6};let server=await start(opts);const sockets=[],results=[];
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
 const a=await visitor(), before={}, ids={}, clients={};
 for(const mode of ['legacy','division','combined']){
  const metadata=await info(a,mode);ids[mode]=metadata.instanceId;
  clients[mode]=await connect(a,mode);await clients[mode].command('SAVE');
  const adapter=service(a,mode).adapter;
  before[mode]={file:adapter.saveFile,bytes:fs.readFileSync(adapter.saveFile),save:readSave(adapter.saveFile),tick:adapter.c.clock.tick};
  if(mode!=='legacy')assert.equal(adapter.c.clock.divisionLedger.formal.xp.GERMAN,0);
 }
 assert.equal(new Set(Object.values(ids)).size,3);
 assert.equal(new Set(Object.values(clients).map(c=>c.seatCookie.split('=')[0])).size,3);
 for(const mode of Object.keys(before))assert.deepEqual(fs.readFileSync(before[mode].file),before[mode].bytes);
 assert(!before.legacy.save.campaign.clock.divisionLedger);
 assert(!before.division.save.campaign.clock.divisionLedger.profile);
 assert.equal(before.combined.save.campaign.clock.divisionLedger.profile,'DIVISION-003-COMBINED-1');
 const menu=await (await http('/campaigns',a)).text();for(const word of ['原战役','步兵先行','多兵种'])assert(menu.includes(word));
 const receipt=await clients.combined.command('SAVE');
 clients.division.send({type:'COMMAND',command:receipt.command});await wait(80);
 assert(clients.division.rows.some(r=>r.type==='ERROR'&&r.reason==='INSTANCE_MISMATCH'));
 const seq=service(a,'combined').adapter.c.transport.next.a;
 clients.combined.send({type:'COMMAND',command:receipt.command});await wait(80);
 assert.equal(service(a,'combined').adapter.c.transport.next.a,seq);
 await wait(2050);const b=await visitor();const other=await info(b,'combined');assert.notEqual(other.instanceId,ids.combined);
 const cb=await connect(b,'combined');cb.send({type:'COMMAND',command:receipt.command});await wait(80);assert(cb.rows.some(r=>r.type==='ERROR'&&r.reason==='INSTANCE_MISMATCH'));
 assert.equal((await http('/release/info?campaign=fixture',a)).status,400);
 assert.equal((await http('/release/info?campaign=combined',a.slice(0,-1)+'x')).status,401);
 assert.equal((await http('/visitor/start','','POST',{origin:'https://foreign.invalid'})).status,403);
 const adapters=Object.fromEntries(['legacy','division','combined'].map(m=>[m,service(a,m).adapter]));
 for(const ws of sockets)ws.terminate();await wait(100);await server.close();
 const final=Object.fromEntries(Object.entries(before).map(([m,v])=>[m,readSave(v.file)]));
 // A fresh update checkpoint must capture all three latest files, independently
 // of already existing release002/ux005 checkpoints. This directory is test-only.
 const {backupBeforeRelease}=await import('../grand-release-002/backup.mjs');
 backupBeforeRelease(saveDir,'before-division003-current-check');
 for(const [mode,v] of Object.entries(before)){
  const backup=path.join(saveDir,'before-division003-current-check',path.relative(saveDir,v.file));
  assert.deepEqual(fs.readFileSync(backup),fs.readFileSync(v.file));
 }
 assert.deepEqual(fs.readFileSync(path.join(saveDir,'visitor-key')),fs.readFileSync(path.join(saveDir,'before-division003-current-check/visitor-key')));
 server=await start(opts);
 for(const mode of Object.keys(before)){
  const resumed=await info(a,mode);assert.equal(resumed.instanceId,ids[mode]);assert.equal(resumed.tick,final[mode].campaign.clock.tick);assert(resumed.paused);
  const ledger=service(a,mode).adapter.c.clock.divisionLedger;
  if(ledger)assert.deepEqual(totals(ledger),totals(final[mode].campaign.clock.divisionLedger));
 }
 const resumed=await connect(a,'combined');resumed.send({type:'COMMAND',command:receipt.command});await wait(80);
 assert(resumed.rows.some(r=>r.type==='ERROR'&&r.reason==='RESTORED_SESSION_REPLAN_REQUIRED'));
 const {Campaign:Old}=await import('../grand-division-002/authority.mjs');
 const {Campaign:New}=await import('./authority.mjs');
 assert.throws(()=>new Old().restore(final.combined.campaign),/PROFILE_SAVE_MISMATCH|NEW_CAMPAIGN|COMBINED_SAVE_ONLY/);
 assert.throws(()=>new New().restore(final.division.campaign),/PROFILE_SAVE_MISMATCH|NEW_CAMPAIGN|COMBINED_SAVE_ONLY/);
 for(const ws of sockets)ws.terminate();await wait(100);await server.close();
 const combinedBytes=fs.readFileSync(before.combined.file);process.env.RELEASE_COMBINED_ENABLED='0';server=await start(opts);
 await info(a,'legacy');await info(a,'division');assert.equal((await http('/release/info?campaign=combined',a)).status,400);
 assert.deepEqual(fs.readFileSync(before.combined.file),combinedBytes);delete process.env.RELEASE_COMBINED_ENABLED;
 await server.close();
 // Corrupt the isolated gate checkpoint: startup must fail before opening port.
 fs.appendFileSync(path.join(saveDir,'before-division003-release/manifest.json'),'broken');
 await assert.rejects(()=>start(opts));
 results.push('three modes: independent IDs/cookies/files; zero-XP normal scenes; no implicit conversion',
 'foreign identity/origin and cross-mode command rejected; duplicate SAVE not repeated',
 'all-mode latest checkpoint and visitor-key checksum match; original files not overwritten',
 'restart retains identity, tick, personnel/equipment totals; paused; stale request era rejected',
 '002 and 003 reject wrong profile files; combined-only rollback preserves 003 bytes and keeps both old modes',
 'corrupt startup checkpoint fails before listen');
 fs.mkdirSync('evidence/grand-division-003/release',{recursive:true});
 fs.writeFileSync('evidence/grand-division-003/release/isolation.json',JSON.stringify({kind:'local HTTP/WS release-only check, temporary saves; not Linux/public acceptance',results},null,2));
 console.log('Release-only three-mode checks passed');
}finally{delete process.env.RELEASE_COMBINED_ENABLED;for(const ws of sockets)ws.terminate();await server.close();}

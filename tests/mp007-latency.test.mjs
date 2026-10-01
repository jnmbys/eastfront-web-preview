import test from 'node:test';
import assert from 'node:assert/strict';
import {network,harness,pair,start} from './helpers/mp001.mjs';
import {TransportDiagnostics} from '../.server-dist/server/transportDiagnostics.js';
import {analyze,summarize} from '../scripts/mp007/analyze.mjs';

test('MP007 opt-in, per-connection, bounded diagnostics exclude payloads and disappear on close',()=>{
  const d=new TransportDiagnostics(['http://test'],null),a='a'.repeat(36),b='b'.repeat(36);
  for(const id of [a,b])d.add(id,{extensions:'',bufferedAmount:0},'', '');
  const read=id=>{let value;d.handle({url:'/transport-diagnostics/'+id,method:'GET',headers:{origin:'http://test'}},{setHeader(){},end(s){value=JSON.parse(s);}});return value;};
  const row={stage:'core-apply',startAt:1,endAt:2,serverTimestamp:100};
  d.latency(a,row);assert.equal(read(a).stages.length,0);
  for(let i=0;i<600;i++){d.latency(a,row);d.latency(b,row);}
  assert.equal(read(a).stages.length,512);assert.equal(read(b).stages.length,0);
  d.remove(a);assert.equal(read(a).error,'not_found');
});

for(const format of ['snapshot-v2-inline-view','snapshot-v3-map-table'])test(`MP007 real WS ${format}: stage correlation, one apply, rejected/duplicate actions and private metadata`,async t=>{
  const h=await network(t),a=await h.peer(),b=await h.peer();
  await a.request('CREATE_ROOM');await b.request('JOIN_ROOM',{roomCode:a.room.roomCode});
  await a.request('SELECT_SEAT',{seat:'GERMANY'});await b.request('SELECT_SEAT',{seat:'SOVIET'});
  await a.request('SET_READY',{ready:true});await b.request('SET_READY',{ready:true});
  const initial=(await b.wait(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT')).payload;
  await b.request('SET_SNAPSHOT_FORMAT',{format});
  const read=async p=>(await fetch(`http://127.0.0.1:${h.port}/transport-diagnostics/${p.welcome.connectionId}`,{headers:{Origin:'http://127.0.0.1:4173'}})).json();
  await read(b);
  const [q,r]=initial.model.deployment.zoneKeys[0].split(',').map(Number);
  const payload={matchId:initial.matchId,expectedRevision:0,action:{type:'DEPLOY_INITIAL_UNIT',deploymentUnitId:initial.model.deployment.roster[0].id,hex:{q,r}}};
  const ack=await b.request('SUBMIT_ACTION',payload);
  const snap=await b.wait(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT'&&m.payload.matchRevision===1);
  const hidden=await a.wait(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT'&&m.payload.matchRevision===1);
  assert.equal(snap.payload.format,format);assert.equal(hidden.payload.view.units.length,0);
  assert.equal(snap.payload.serverSequence,ack.payload.serverSequence+1);
  const before=await read(b),id=ack.requestId,stages=before.stages;
  for(const name of ['request','validate','apply-intent','core-apply'])assert.equal(stages.filter(r=>r.stage===name&&r.requestId===id).length,1,name);
  const core=stages.find(r=>r.stage==='core-apply'),apply=stages.find(r=>r.stage==='apply-intent');
  assert(core.startAt>=apply.startAt&&core.endAt<=apply.endAt);
  for(const name of ['snapshot-build','snapshot-encode'])assert(stages.some(r=>r.stage===name&&r.sequence===snap.payload.serverSequence&&r.revision===1));
  assert(stages.every(r=>r.endAt>=r.startAt&&Number.isFinite(r.serverTimestamp)));
  const send=before.sends.find(r=>r.type==='PLAYER_VIEW_SNAPSHOT');assert.equal(send.bytes,Buffer.byteLength(JSON.stringify(snap)));assert(send.serializeMs>=0);
  // Replayed request produces another ACK only; Core is not called twice.
  b.ws.send(JSON.stringify({protocolVersion:2,messageType:'SUBMIT_ACTION',requestId:id,payload}));
  await b.wait(m=>m.messageType==='ACTION_ACCEPTED'&&m.payload.serverSequence>snap.payload.serverSequence);
  const rejected=await b.request('SUBMIT_ACTION',payload);assert.equal(rejected.messageType,'ACTION_REJECTED');
  const after=await read(b);assert.equal(after.stages.filter(r=>r.stage==='core-apply').length,1);
  assert.equal(after.sends.filter(r=>r.type==='PLAYER_VIEW_SNAPSHOT').length,1);
  assert.equal((await read(a)).stages.length,0,'other connection never opted in');
  const safe=JSON.stringify(after);for(const forbidden of [b.welcome.reconnectToken,payload.action.deploymentUnitId,'deploymentUnitId','hexes','controllerId','DEPLOY_INITIAL_UNIT'])assert(!safe.includes(forbidden),forbidden);
});

test('MP007 broken diagnostic sink cannot reject or reapply a legal action',()=>{
  const h=harness(),{a,b}=pair(h);start(a,b);
  h.authority.setDiagnostics({active(){return true;},latency(){throw Error('broken observer');}});
  const p=b.last('PLAYER_VIEW_SNAPSHOT').payload,[q,r]=p.model.deployment.zoneKeys[0].split(',').map(Number);
  const reply=b.send('SUBMIT_ACTION',{matchId:p.matchId,expectedRevision:0,action:{type:'DEPLOY_INITIAL_UNIT',deploymentUnitId:p.model.deployment.roster[0].id,hex:{q,r}}});
  assert.equal(reply.messageType,'ACTION_ACCEPTED');assert.equal(b.last('PLAYER_VIEW_SNAPSHOT').payload.matchRevision,1);
});

test('MP007 analysis uses duration differences across offset clocks and leaves missing/duplicate evidence unknown',()=>{
  const server={stages:[{stage:'receive',startAt:9000,endAt:9031},{stage:'request',type:'SUBMIT_ACTION',requestId:'r',startAt:9001,endAt:9030}],sends:[{type:'PLAYER_VIEW_SNAPSHOT',matchRevision:1,serverSequence:3,sendAt:9020,serializeMs:1}]};
  const report={connections:[{connectionId:'c',server,actionTimings:[{stage:'ui',type:'PLAYER_VIEW_SNAPSHOT',revision:1,at:170,ready:true,syncing:false,interactive:true}]}],submissions:[{connectionId:'c',requestId:'r',sentAt:100,snapshotArrival:160,acceptedRevision:1,snapshotSequence:3}]};
  const [row]=analyze(report);assert.equal(row.serverCriticalMs,20);assert.equal(row.transportAndSchedulingResidualMs,40);assert.equal(row.submitToUIReadyMs,70);assert.equal(row.inputToSendMs,null);
  server.stages.push({...server.stages[1]});assert.equal(analyze(report)[0].serverCriticalMs,null);
  assert.equal(summarize(analyze(report)).submitToUIReadyMs.n,0,'duplicate request cannot inflate successful latency statistics');
  delete report.connections[0].server;assert.equal(analyze(report)[0].transportAndSchedulingResidualMs,null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {randomUUID} from 'node:crypto';
import {createMultiplayerServer} from '../.server-dist/server/runtime.js';
import {RoomAuthority} from '../.server-dist/server/authority.js';
import {createMatchSession} from '../.server-dist/server/match.js';
import {DEFAULTS} from '../.server-dist/server/config.js';
import {checkSnapshot} from './helpers/mp002.mjs';

async function setup(t,compression){
 let match;const config={...DEFAULTS,port:0};
 const authority=new RoomAuthority(config,Date.now,(...args)=>match=createMatchSession(...args));
 const server=createMultiplayerServer(config,authority),port=await server.listen(),peers=[];
 t.after(async()=>{for(const p of peers)p.ws.terminate();await server.close();});
 async function peer(token){
  const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`,{origin:config.allowedOrigins[0],perMessageDeflate:compression}),messages=[],frames=[];let pending=Buffer.alloc(0),upgrade;
  ws.on('upgrade',r=>upgrade=r.headers['sec-websocket-extensions']);
  ws.on('message',data=>messages.push(JSON.parse(String(data))));
  await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
  // Test-only frame metadata, never payload. Counts actual transport frame bytes.
  ws._socket.on('data',chunk=>{pending=Buffer.concat([pending,chunk]);while(pending.length>=2){const tag=pending[0],second=pending[1];let n=second&127,header=2;if(n===126){if(pending.length<4)return;n=pending.readUInt16BE(2);header=4;}else if(n===127){if(pending.length<10)return;n=Number(pending.readBigUInt64BE(2));header=10;}if(second&128)header+=4;if(pending.length<header+n)return;frames.push({opcode:tag&15,compressed:!!(tag&64),bytes:header+n});pending=pending.subarray(header+n);}});
  const wait=async predicate=>{const start=performance.now();while(true){const m=messages.findLast(predicate);if(m)return m;if(performance.now()-start>7000)throw Error('Timed out');await new Promise(r=>setTimeout(r,2));}};
  const request=async(type,payload={},requestId=randomUUID())=>{ws.send(JSON.stringify({protocolVersion:2,messageType:type,requestId,payload}));return wait(m=>m.requestId===requestId);};
  const p={ws,messages,frames,wait,request,upgrade,get welcome(){return messages.findLast(m=>m.messageType==='WELCOME')?.payload;}};peers.push(p);
  if(token)await request('RECONNECT',{reconnectToken:token});else await request('HELLO',{displayName:'MP004 test'});return p;
 }
 const a=await peer(),b=await peer();const created=await a.request('CREATE_ROOM');await b.request('JOIN_ROOM',{roomCode:created.payload.room.roomCode});await a.request('SELECT_SEAT',{seat:'GERMANY'});await b.request('SELECT_SEAT',{seat:'SOVIET'});await a.request('SET_READY',{ready:true});await b.request('SET_READY',{ready:true});
 await Promise.all([a,b].map(p=>p.wait(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT')));
 return{server,port,a,b,peer,config,get match(){return match;}};
}

for(const compression of [true,false])test(`MP004 transport ${compression?'compressed':'fallback'} preserves authorized JSON, ordering, idempotency and reconnect`,async t=>{
 const h=await setup(t,compression),{a,b}=h;
 if(compression){assert.match(b.upgrade,/permessage-deflate/);assert.match(b.upgrade,/server_no_context_takeover/);assert.match(b.upgrade,/client_no_context_takeover/);}else assert.equal(b.upgrade,undefined);
 const url=`http://127.0.0.1:${h.port}/transport-diagnostics/${b.welcome.connectionId}`;
 const diagnostic=async()=>await (await fetch(url,{headers:{Origin:h.config.allowedOrigins[0]}})).json();
 const handshake=await diagnostic();
 assert.equal(handshake.connectionId,b.welcome.connectionId);
 assert.equal(handshake.negotiatedExtensions,compression?'permessage-deflate':'');
 assert.equal(handshake.responseExtensions,b.upgrade??'');
 assert.equal(handshake.requestExtensions.includes('permessage-deflate'),compression);
 assert.equal((await fetch(url)).status,403);
 assert.equal((await fetch(url,{headers:{Origin:'https://untrusted.example'}})).status,403);
 let current=b.messages.findLast(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT').payload;
 for(let i=0;i<10;i++){
  const id=current.model.deployment.roster.find(u=>!u.placed).id,[q,r]=current.model.deployment.zoneKeys[i].split(',').map(Number);
  const payload={matchId:current.matchId,expectedRevision:current.matchRevision,action:{type:'DEPLOY_INITIAL_UNIT',deploymentUnitId:id,hex:{q,r}}},requestId=randomUUID(),frameStart=b.frames.length;
  const ack=await b.request('SUBMIT_ACTION',payload,requestId);assert.equal(ack.messageType,'ACTION_ACCEPTED');
  const [actor,waiter]=await Promise.all([b,a].map(p=>p.wait(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT'&&m.payload.matchRevision===i+1)));
  current=actor.payload;assert.equal(current.serverSequence,ack.payload.serverSequence+1);assert.equal(current.view.units.length,i+1);assert.equal(waiter.payload.view.units.length,0);
  checkSnapshot(h.match,b,current);checkSnapshot(h.match,a,waiter.payload);
  const frames=b.frames.slice(frameStart).filter(f=>f.opcode===1);assert.equal(frames.length,2);assert.equal(frames[0].compressed,false);assert.equal(frames[1].compressed,compression);
  if(compression)assert(frames[1].bytes<Buffer.byteLength(JSON.stringify(actor))*0.2,'Compression must reduce this real snapshot substantially');
  // Same request on the compressed socket remains one authoritative application.
  await b.request('SUBMIT_ACTION',payload,requestId);await b.wait(m=>m.messageType==='ACTION_ACCEPTED'&&m.requestId===requestId&&m.payload.serverSequence>current.serverSequence);
  assert.equal(h.match.matchRevision,i+1);assert.equal(b.messages.filter(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT'&&m.payload.matchRevision===i+1).length,1);
 }
 const evidence=await diagnostic();assert(evidence.sends.length<=64);
 const snapshot=evidence.sends.findLast(s=>s.type==='PLAYER_VIEW_SNAPSHOT'),ack=evidence.sends.findLast(s=>s.type==='ACTION_ACCEPTED');
 assert.equal(snapshot.compressRequested,true);assert.equal(ack.compressRequested,false);
 assert(snapshot.bytes>200000);assert(snapshot.writeCallbackMs>=0);
 const safe=JSON.stringify(evidence);assert(!safe.includes(b.welcome.reconnectToken));assert(!safe.includes('controllerId'));assert(!safe.includes('units'));assert(!safe.includes('GameState'));
 const token=b.welcome.reconnectToken;b.ws.terminate();await a.wait(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT'&&m.payload.status==='WAITING_FOR_RECONNECT');assert.equal((await fetch(url,{headers:{Origin:h.config.allowedOrigins[0]}})).status,404);const restored=await h.peer(token);
 const next=await restored.wait(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT'&&m.payload.resync);assert.equal(next.payload.matchRevision,10);checkSnapshot(h.match,restored,next.payload);
 const id=next.payload.model.deployment.roster.find(u=>!u.placed).id,[q,r]=next.payload.model.deployment.zoneKeys[10].split(',').map(Number);
 const accepted=await restored.request('SUBMIT_ACTION',{matchId:next.payload.matchId,expectedRevision:10,action:{type:'DEPLOY_INITIAL_UNIT',deploymentUnitId:id,hex:{q,r}}});assert.equal(accepted.payload.acceptedRevision,11);
});

test('MP004 compressed inbound frame still enforces decompressed payload limit',async t=>{
 const h=await setup(t,true),p=await h.peer();const closed=new Promise(r=>p.ws.once('close',r));p.ws.send('x'.repeat(DEFAULTS.maxMessageBytes+1),{compress:true});await closed;
 const good=await h.peer();assert(good.welcome.controllerId);assert.equal(h.server.authority.counts().matches,1);
});

test('MP004 health reports only a valid provider deployment commit, no arbitrary env data',async t=>{
 const previous=process.env.RENDER_GIT_COMMIT;t.after(()=>{if(previous===undefined)delete process.env.RENDER_GIT_COMMIT;else process.env.RENDER_GIT_COMMIT=previous;});
 for(const value of ['a'.repeat(40),'invalid-private-value']){
  process.env.RENDER_GIT_COMMIT=value;const server=createMultiplayerServer({...DEFAULTS,port:0}),port=await server.listen();try{const response=await fetch(`http://127.0.0.1:${port}/health`);assert.deepEqual(await response.json(),{status:'ok',protocolVersion:2,sourceCommit:value.length===40?value:null});}finally{await server.close();}
 }
});

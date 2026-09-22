import {mkdirSync,writeFileSync,symlinkSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {WebSocket} from 'ws';
import assert from 'node:assert/strict';
import {deflateRawSync} from 'node:zlib';
import {randomUUID} from 'node:crypto';
const label=process.argv[2]??'before',root=resolve(`../mp004-evidence/server-${label}`);
if(!existsSync(resolve('../mp004-evidence/node_modules')))symlinkSync(resolve('node_modules'),resolve('../mp004-evidence/node_modules'),'dir');
const load=p=>import(pathToFileURL(root+'/'+p));
const {createMultiplayerServer}=await load('server/runtime.js'),{DEFAULTS}=await load('server/config.js'),{spans,sends}=await load('mp004Trace.js');
const server=createMultiplayerServer({...DEFAULTS,port:0}),port=await server.listen(),all=[];
async function peer(){
 const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`,{origin:DEFAULTS.allowedOrigins[0]}),received=[];
 ws.on('message',data=>{const at=performance.now(),m=JSON.parse(data.toString());received.push({m,at});});
 await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});all.push(ws);
 const wait=async pred=>{const start=performance.now();while(true){const row=received.findLast(r=>pred(r.m));if(row)return row;if(performance.now()-start>10000)throw Error('Timeout');await new Promise(r=>setTimeout(r,1));}};
 const request=async(type,payload={})=>{const requestId=randomUUID(),sentAt=performance.now();ws.send(JSON.stringify({protocolVersion:2,messageType:type,requestId,payload}));return{...await wait(m=>m.requestId===requestId),requestId,sentAt};};
 await request('HELLO',{displayName:'MP004 diagnostic'});return{ws,received,wait,request};
}
try{
 const a=await peer(),b=await peer();await a.request('CREATE_ROOM');const room=a.received.findLast(r=>r.m.messageType==='ROOM_CREATED').m.payload.room;
 await b.request('JOIN_ROOM',{roomCode:room.roomCode});await a.request('SELECT_SEAT',{seat:'GERMANY'});await b.request('SELECT_SEAT',{seat:'SOVIET'});await a.request('SET_READY',{ready:true});await b.request('SET_READY',{ready:true});
 let current=(await b.wait(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT')).m.payload;const samples=[];
 for(let i=0;i<20;i++){
  const id=current.model.deployment.roster.find(u=>!u.placed).id;
  const zones=current.model.deployment.zoneKeys;
  if(!zones)throw Error('Deployment zone field: '+Object.keys(current.model.deployment));
  const [q,r]=zones[i].split(',').map(Number);const start=performance.now(),spanIndex=spans.length,sendIndex=sends.length,actorBytes=b.ws._socket.bytesRead,waiterBytes=a.ws._socket.bytesRead;
  const ack=await b.request('SUBMIT_ACTION',{matchId:current.matchId,expectedRevision:current.matchRevision,action:{type:'DEPLOY_INITIAL_UNIT',deploymentUnitId:id,hex:{q,r}}});
  assert.equal(ack.m.messageType,'ACTION_ACCEPTED');const revision=ack.m.payload.acceptedRevision;
  const [actor,waiter]=await Promise.all([b,a].map(p=>p.wait(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT'&&m.payload.matchRevision===revision)));
  current=actor.m.payload;assert.equal(current.serverSequence,ack.m.payload.serverSequence+1);assert.equal(waiter.m.payload.view.units.length,0);
  const compression=[actor,waiter].map(row=>{const text=JSON.stringify(row.m),at=performance.now(),bytes=deflateRawSync(text,{level:3,memLevel:7}).length;return {viewer:row.m.payload.view.viewer,bytes,ms:performance.now()-at,rawBytes:Buffer.byteLength(text)};});
  samples.push({wireBytes:{actor:b.ws._socket.bytesRead-actorBytes,waiter:a.ws._socket.bytesRead-waiterBytes},compression,requestId:ack.requestId,revision,ackSequence:ack.m.payload.serverSequence,actorSequence:current.serverSequence,waiterSequence:waiter.m.payload.serverSequence,start,sentAt:ack.sentAt,ackArrival:ack.at,snapshotArrival:actor.at,waiterArrival:waiter.at,spans:spans.slice(spanIndex),sends:sends.slice(sendIndex)});
 }
 mkdirSync('evidence/mp-004',{recursive:true});writeFileSync(`evidence/mp-004/server-${label}.json`,JSON.stringify({environment:'Node '+process.version+' Linux loopback WS; no simulated latency; same-process clocks, not public latency',samples},null,2));
 console.log(JSON.stringify({samples:samples.length,first:samples[0].sends,last:samples.at(-1).sends}));
}finally{for(const ws of all)ws.terminate();await server.close();}

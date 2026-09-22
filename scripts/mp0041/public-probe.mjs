// A normal Node/ws PUBLIC client. Different network path from Cloud Chrome.
// Records frame metadata AFTER TLS decryption, BEFORE WS decompression; no payload logs.
import {WebSocket} from 'ws';
import {frameMetadata} from './frame-metadata.mjs';
import {randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
const origin='https://jnmbys.github.io',base='https://eastfront-server.onrender.com',url='wss://eastfront-server.onrender.com/ws';
const pause=ms=>new Promise(r=>setTimeout(r,ms)),report={environment:{node:process.version,runner:process.env.GITHUB_ACTIONS?'GitHub hosted Ubuntu':'external Node host',url},connections:[],samples:[],boundaries:['frame bytes include WebSocket header and compressed payload, exclude TLS/TCP/HTTP','local time uses performance.now; no cross-clock subtraction','Node path is not the Cloud browser or a physical user device']};
const sockets=[];
try{
 const deadline=performance.now()+360000;
 while(true){const health=await fetch(base+'/health',{cache:'no-store'}).then(r=>r.json());report.backend=health;if(!process.env.GITHUB_SHA||health.sourceCommit===process.env.GITHUB_SHA)break;if(performance.now()>deadline)throw Error('Expected Render version not observed');await pause(10000);}
 async function peer(compression){
  const ws=new WebSocket(url,{origin,perMessageDeflate:compression}),messages=[],frames=[];sockets.push(ws);
  const connection={compressionRequested:compression};report.connections.push(connection);
  ws.on('upgrade',r=>{connection.requestExtensions=ws._req?.getHeader('Sec-WebSocket-Extensions')??null;connection.responseExtensions=r.headers['sec-websocket-extensions']??'';});
  ws.on('message',raw=>messages.push({m:JSON.parse(String(raw)),arrival:performance.now(),bytes:raw.length}));
  await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});connection.extensions=ws.extensions;
  ws._socket.on('data',frameMetadata(m=>frames.push(m)));
  async function wait(fn){const end=performance.now()+30000;while(true){const row=messages.findLast(x=>fn(x.m));if(row)return row;if(performance.now()>end)throw Error('Public message deadline');await pause(5);}}
  async function request(type,payload={}){const id=randomUUID(),sent=performance.now();ws.send(JSON.stringify({protocolVersion:2,messageType:type,requestId:id,payload}));return {...await wait(m=>m.requestId===id&&(type!=='HELLO'||m.messageType==='WELCOME')),id,sent};}
  const hello=await request('HELLO',{displayName:'MP0041 public probe'});connection.connectionId=hello.m.payload.connectionId;if(!connection.connectionId)throw Error('Missing WELCOME connection identity');
  async function diagnostic(){return await fetch(base+'/transport-diagnostics/'+connection.connectionId,{headers:{Origin:origin},cache:'no-store'}).then(r=>r.json());}
  connection.server=await diagnostic();if(connection.server.connectionId!==connection.connectionId)throw Error('Missing correlated server diagnostic');return{ws,messages,frames,request,wait,diagnostic,connection};
 }
 const a=await peer(true),b=await peer(true),plain=await peer(false);plain.ws.close();
 const room=await a.request('CREATE_ROOM');await b.request('JOIN_ROOM',{roomCode:room.m.payload.room.roomCode});await a.request('SELECT_SEAT',{seat:'GERMANY'});await b.request('SELECT_SEAT',{seat:'SOVIET'});await a.request('SET_READY',{ready:true});await b.request('SET_READY',{ready:true});
 let snapshot=(await b.wait(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT')).m.payload;await a.wait(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT');
 for(let i=0;i<10;i++){
  const unit=snapshot.model.deployment.roster.find(u=>!u.placed),[q,r]=snapshot.model.deployment.zoneKeys[i].split(',').map(Number),af=a.frames.length,bf=b.frames.length;
  const ack=await b.request('SUBMIT_ACTION',{matchId:snapshot.matchId,expectedRevision:snapshot.matchRevision,action:{type:'DEPLOY_INITIAL_UNIT',deploymentUnitId:unit.id,hex:{q,r}}});
  if(ack.m.messageType!=='ACTION_ACCEPTED')throw Error('Deployment rejected');
  const actor=await b.wait(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT'&&m.payload.matchRevision===ack.m.payload.acceptedRevision),waiter=await a.wait(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT'&&m.payload.matchRevision===ack.m.payload.acceptedRevision);snapshot=actor.m.payload;
  if(snapshot.serverSequence!==ack.m.payload.serverSequence+1||waiter.m.payload.view.units.length!==0||snapshot.view.units.length!==i+1)throw Error('Ordering/privacy/count mismatch');
  report.samples.push({requestId:ack.id,acceptedRevision:ack.m.payload.acceptedRevision,matchRevision:snapshot.matchRevision,ackSequence:ack.m.payload.serverSequence,snapshotSequence:snapshot.serverSequence,submitAckMs:ack.arrival-ack.sent,ackSnapshotMs:actor.arrival-ack.arrival,submitSnapshotMs:actor.arrival-ack.sent,actorDecodedBytes:actor.bytes,waiterDecodedBytes:waiter.bytes,actorFrames:b.frames.slice(bf).filter(f=>f.opcode===1),waiterFrames:a.frames.slice(af).filter(f=>f.opcode===1)});
 }
 a.connection.server=await a.diagnostic();b.connection.server=await b.diagnostic();report.status='PASS';
}catch(error){report.status='FAIL';report.error=error.message;process.exitCode=1;}finally{for(const ws of sockets)ws.terminate();await writeFile('transport-probe.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}

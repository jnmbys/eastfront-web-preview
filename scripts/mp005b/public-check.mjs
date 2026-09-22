// Deployment gate: expected backend commit, legacy wire compatibility, negotiated compact and reconnect.
// No compression/handshake investigation. Emits safe metadata only.
import {WebSocket} from 'ws';
import {writeFileSync} from 'node:fs';
import {decodeSnapshot,COMPACT_SNAPSHOT as compact,FULL_SNAPSHOT as full} from '../../.server-dist/src/multiplayer/snapshotCodec.js';
const base='https://eastfront-server.onrender.com',origin='https://jnmbys.github.io',pause=ms=>new Promise(r=>setTimeout(r,ms));
const report={expectedCommit:process.env.GITHUB_SHA,environment:'GitHub Actions Node; not browser or physical device',checks:[]},sockets=[];
try{
 const end=performance.now()+300000;let health;
 do{health=await fetch(base+'/health',{signal:AbortSignal.timeout(15000)}).then(r=>r.json());if(health.sourceCommit===process.env.GITHUB_SHA)break;if(performance.now()>end)throw Error('Expected backend version not observed within 5 minutes');await pause(10000);}while(true);
 report.backend=health;
 async function peer(token=null,negotiate=false){
  const ws=new WebSocket(base.replace('https:','wss:')+'/ws',{origin}),messages=[];sockets.push(ws);
  ws.on('message',raw=>{const m=JSON.parse(String(raw));messages.push({m,bytes:raw.length,at:performance.now()});});ws.on('error',()=>{});
  await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);setTimeout(()=>reject(Error('Open deadline')),20000).unref();});
  const wait=async predicate=>{const end=performance.now()+20000;while(true){const row=messages.findLast(r=>predicate(r.m));if(row)return row;if(performance.now()>end)throw Error('Public response deadline');await pause(10);}};
  const send=async(type,payload={})=>{const id=crypto.randomUUID();ws.send(JSON.stringify({protocolVersion:2,messageType:type,requestId:id,payload}));return (await wait(m=>m.requestId===id&&(!['HELLO','RECONNECT'].includes(type)||['WELCOME','ROOM_ERROR'].includes(m.messageType)))).m;};
  const welcome=await send(token?'RECONNECT':'HELLO',token?{reconnectToken:token}:{displayName:'MP005B release verification'});
  if(welcome.messageType!=='WELCOME')throw Error('Identity failed');
  if(negotiate){const selected=await send('SET_SNAPSHOT_FORMAT',{format:compact});if(selected.messageType!=='SNAPSHOT_FORMAT_SELECTED'||selected.payload.format!==compact)throw Error('Compact negotiation failed');}
  return {ws,messages,wait,send,token:welcome.payload.reconnectToken};
 }
 const a=await peer(),b=await peer(null,true);
 const room=await a.send('CREATE_ROOM');await b.send('JOIN_ROOM',{roomCode:room.payload.room.roomCode});await a.send('SELECT_SEAT',{seat:'GERMANY'});await b.send('SELECT_SEAT',{seat:'SOVIET'});await a.send('SET_READY',{ready:true});await b.send('SET_READY',{ready:true});
 let current=decodeSnapshot((await b.wait(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT')).m.payload,true);
 async function deploy(p,index){const unit=current.model.deployment.roster.find(u=>!u.placed),[q,r]=current.model.deployment.zoneKeys[index].split(',').map(Number);
  const ack=await p.send('SUBMIT_ACTION',{matchId:current.matchId,expectedRevision:current.matchRevision,action:{type:'DEPLOY_INITIAL_UNIT',deploymentUnitId:unit.id,hex:{q,r}}});if(ack.messageType!=='ACTION_ACCEPTED')throw Error('Action rejected');
  const actor=await p.wait(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT'&&m.payload.matchRevision===ack.payload.acceptedRevision),waiter=await a.wait(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT'&&m.payload.matchRevision===ack.payload.acceptedRevision);
  current=decodeSnapshot(actor.m.payload,true);const other=decodeSnapshot(waiter.m.payload,false);
  if(actor.m.payload.format!==compact||waiter.m.payload.format!==full||current.serverSequence!==ack.payload.serverSequence+1||other.view.units.length!==0||current.view.units.length!==index+1)throw Error('Format/order/privacy/count mismatch');
  for(const unit of current.view.units)if(JSON.stringify(waiter.m).includes(JSON.stringify(unit.id)))throw Error('Hidden deployment leak');
  report.checks.push({revision:current.matchRevision,actorFormat:actor.m.payload.format,legacyFormat:waiter.m.payload.format,actorJSONBytes:actor.bytes,legacyJSONBytes:waiter.bytes,privacy:true});
 }
 await deploy(b,0);const token=b.token;b.ws.terminate();await a.wait(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT'&&m.payload.status==='WAITING_FOR_RECONNECT');
 const restored=await peer(token,true),recovered=await restored.wait(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT'&&m.payload.resync);
 if(recovered.m.payload.format!==full||recovered.m.payload.matchRevision!==1)throw Error('Reconnect full recovery failed');current=decodeSnapshot(recovered.m.payload,false);await deploy(restored,1);
 await restored.send('LEAVE_ROOM');report.status='PASS';report.reconnect={fullRecovery:true,revision:1,continuedRevision:2};
}catch(e){report.status='FAIL';report.error=e.message;process.exitCode=1;}finally{for(const ws of sockets)ws.terminate();writeFileSync('mp005b-public-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}

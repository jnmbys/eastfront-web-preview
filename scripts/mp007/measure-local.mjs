/** Loopback production clients + authority, no DOM/paint/device/network claims. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {WebSocket as Wire} from 'ws';
import {createMultiplayerServer} from '../../.server-dist/server/runtime.js';
import {DEFAULTS} from '../../.server-dist/server/config.js';
import {analyze,summarize} from './analyze.mjs';

globalThis.location={search:'?transportDiagnostics=1'};
globalThis.window=new EventTarget();
globalThis.sessionStorage={getItem(){return null;},setItem(){},removeItem(){}};
const {LobbyClient}=await import('../../dist/app/multiplayer/client.js');
const {NetworkPlayerSession}=await import('../../dist/app/multiplayer/networkSession.js');
const {createPresentationState}=await import('../../dist/app/state/presentation.js');
const connections=[],submissions=[];
let currentSocket=null;
window.addEventListener('eastfront-action-timing',e=>{if(currentSocket)currentSocket.row.actionTimings.push(e.detail);});
window.addEventListener('eastfront-transport-timing',e=>{
  const t=e.detail;if(t.type!=='PLAYER_VIEW_SNAPSHOT')return;
  const s=submissions.findLast(s=>s.connectionId===currentSocket?.row.connectionId&&s.acceptedRevision===t.revision&&s.snapshotSequence===t.sequence);
  if(s)s.production={callbackAt:t.callbackAt,parseAndEnvelopeMs:t.parsedAt-t.callbackAt,validateRebuildMs:t.decodedAt-t.parsedAt,receiveNotifyMs:t.appliedAt-t.decodedAt,processedAt:t.appliedAt};
});
window.addEventListener('eastfront-map-codec-timing',e=>{
  const t=e.detail,s=submissions.findLast(s=>s.connectionId===currentSocket?.row.connectionId&&s.acceptedRevision===t.revision&&s.snapshotSequence===t.sequence);
  if(s?.production)Object.assign(s.production,{validationMs:t.validationMs,rebuildMs:t.rebuildMs});
});
const wait=async fn=>{const start=performance.now();while(!fn()){if(performance.now()-start>7000)throw Error('deadline');await new Promise(r=>setTimeout(r,1));}};
class Socket extends Wire {
  constructor(url){super(url,{origin:'http://127.0.0.1:4173'});this.row={actionTimings:[],sentCounts:{}};connections.push(this.row);Socket.last=this;}
  send(raw){
    const at=performance.now(),m=JSON.parse(raw);this.row.sentCounts[m.messageType]=(this.row.sentCounts[m.messageType]??0)+1;
    if(m.messageType==='SUBMIT_ACTION')submissions.push({connectionId:this.row.connectionId,requestId:m.requestId,expectedRevision:m.payload.expectedRevision,sentAt:at,clientTimestamp:performance.timeOrigin+at,inputAt:null});
    super.send(raw);
  }
  set onmessage(fn){super.onmessage=event=>{
    const arrival=performance.now(),m=JSON.parse(String(event.data)),p=m.payload;
    if(m.messageType==='WELCOME')this.row.connectionId=p.connectionId;
    if(m.messageType==='ACTION_ACCEPTED'){const s=submissions.findLast(s=>s.requestId===m.requestId);if(s)Object.assign(s,{ackAt:arrival,acceptedRevision:p.acceptedRevision,ackSequence:p.serverSequence});}
    if(m.messageType==='PLAYER_VIEW_SNAPSHOT'){
      const s=submissions.findLast(s=>s.connectionId===this.row.connectionId&&s.acceptedRevision===p.matchRevision&&s.ackSequence+1===p.serverSequence&&!p.resync);
      if(s)Object.assign(s,{snapshotArrival:arrival,snapshotSequence:p.serverSequence,snapshotFormat:p.format,snapshotBytes:Buffer.byteLength(String(event.data))});
    }
    currentSocket=this;try{fn(event);}finally{currentSocket=null;}
  };}
}
globalThis.WebSocket=Socket;
const formats=['snapshot-v2-inline-view','snapshot-v3-map-table','snapshot-v3-map-table','snapshot-v2-inline-view'];
for(const [round,format] of formats.entries()){
  const server=createMultiplayerServer({...DEFAULTS,port:0}),port=await server.listen(),peers=[];
  try{
    const peer=()=>{const p=createPresentationState();let session;
      const client=new LobbyClient(`ws://127.0.0.1:${port}/ws`,()=>{if(!session&&client.state.snapshot)session=new NetworkPlayerSession(client,p,kind=>{if(kind!=='status')session.requestProjection(p);});},format);
      client.connect('MP007 local');const socket=Socket.last;Object.assign(socket.row,{format,round,environment:'Node loopback; no DOM'});
      const result={client,p,socket,get session(){return session;}};peers.push(result);return result;
    };
    const a=peer(),b=peer();
    await wait(()=>a.client.canMutate&&b.client.canMutate);a.client.send('CREATE_ROOM',{});await wait(()=>a.client.state.room);
    b.client.send('JOIN_ROOM',{roomCode:a.client.state.room.roomCode});await wait(()=>b.client.state.room);
    a.client.send('SELECT_SEAT',{seat:'GERMANY'});await wait(()=>a.client.canMutate);b.client.send('SELECT_SEAT',{seat:'SOVIET'});await wait(()=>b.client.canMutate);
    a.client.send('SET_READY',{ready:true});await wait(()=>a.client.canMutate);b.client.send('SET_READY',{ready:true});await wait(()=>a.session?.ready&&b.session?.interactive);
    const diagnostic=async p=>(await fetch(`http://127.0.0.1:${port}/transport-diagnostics/${p.socket.row.connectionId}`,{headers:{Origin:'http://127.0.0.1:4173'}})).json();
    for(const p of peers){p.socket.row.role=p===b?'actor':'waiting';await diagnostic(p);}
    for(let i=0;i<10;i++){
      const deployment=b.session.model.deployment,[q,r]=deployment.zoneKeys[i].split(',').map(Number),unit=deployment.roster.find(u=>!u.placed);
      currentSocket=b.socket;try{b.session.submit({type:'DEPLOY_INITIAL_UNIT',deploymentUnitId:unit.id,hex:{q,r}});}finally{currentSocket=null;}
      await wait(()=>b.session.matchRevision===i+1&&b.session.interactive&&a.session.matchRevision===i+1);
      assert.equal(a.session.playerView.units.length,0);assert.equal(b.session.playerView.units.length,i+1);
    }
    for(const p of peers){p.socket.row.server=await diagnostic(p);assert.equal(p.socket.row.sentCounts.QUERY_MATCH??0,0);assert.equal(p.socket.row.sentCounts.RESYNC_MATCH??0,0);}
  }finally{for(const p of peers)p.client.dispose();await server.close();}
}
const report={diagnosticVersion:'MP-007',environment:{node:process.version,platform:process.platform,order:'v2/v3/v3/v2, 10 deployments per round',browser:false,render:false,physicalDevice:false,compression:'Node ws permessage-deflate',clientTimeOrigin:performance.timeOrigin},connections,submissions};
const rows=analyze(report);assert.equal(rows.length,40);assert(rows.every(r=>r.coreApplyMs!==null&&r.serverCriticalMs!==null&&r.submitToUIReadyMs!==null&&!r.residualInvalid));
const summaries=Object.fromEntries([...new Set(formats)].map(f=>[f,summarize(rows.filter(r=>r.format===f))]));
await mkdir('evidence/mp-007',{recursive:true});
await writeFile('evidence/mp-007/local-trace.json',JSON.stringify(report,null,2)+'\n');
await writeFile('evidence/mp-007/local-analysis.json',JSON.stringify({boundary:'Production codec and session on Node loopback; UI means session ready, with no DOM renderer or paint. No public/iPad attribution.',summaries,rows},null,2)+'\n');
console.log(JSON.stringify(summaries,null,2));

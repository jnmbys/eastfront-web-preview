import test from 'node:test';import assert from 'node:assert/strict';
import {collectSamples} from '../scripts/mp005a/samples.mjs';
test('MP005C opt-in production timings correlate compact processing without payloads; invalid snapshots are not applied',async()=>{
 const previous={window:globalThis.window,location:globalThis.location,sessionStorage:globalThis.sessionStorage,WebSocket:globalThis.WebSocket};
 globalThis.location={search:'?transportDiagnostics=1'};globalThis.window=new EventTarget();globalThis.sessionStorage={getItem(){return null;},setItem(){}};
 const timing=[],sent=[];window.addEventListener('eastfront-transport-timing',e=>timing.push(e.detail));
 class Socket {static OPEN=1;static CONNECTING=0;readyState=1;constructor(){Socket.last=this;}send(data){sent.push(JSON.parse(data));}close(){this.readyState=3;this.onclose?.();}}
 globalThis.WebSocket=Socket;
 const {LobbyClient}=await import('../dist/app/multiplayer/client.js');const {encodeSnapshot,COMPACT_SNAPSHOT}=await import('../dist/app/multiplayer/snapshotCodec.js');
 const client=new LobbyClient('ws://test',()=>{});try{
  client.connect('test');const ws=Socket.last;ws.onopen();const emit=(messageType,payload,requestId=null)=>ws.onmessage({data:JSON.stringify({protocolVersion:2,messageType,payload,requestId})});
  emit('WELCOME',{controllerId:'controller',reconnectToken:'DO-NOT-EXPORT',connectionId:'connection'},sent.at(-1).requestId);
  emit('SNAPSHOT_FORMAT_SELECTED',{format:COMPACT_SNAPSHOT},sent.at(-1).requestId);
  const p=collectSamples().samples.find(x=>!x.message.payload.resync).message.payload;
  client.state.match={matchId:p.matchId,viewer:p.view.viewer};client.state.synced=true;
  const compact=encodeSnapshot({...p,model:{...p.model,playerView:p.view,hexes:p.view.hexes,edges:p.view.edges}},COMPACT_SNAPSHOT);
  emit('PLAYER_VIEW_SNAPSHOT',compact,'sample');assert.deepEqual(client.state.snapshot,p);
  const t=timing.at(-1);assert.equal(t.sequence,p.serverSequence);assert.equal(t.revision,p.matchRevision);assert.equal(t.outcome,'processed');
  assert.ok(t.callbackAt<=t.parsedAt&&t.parsedAt<=t.decodedAt&&t.decodedAt<=t.appliedAt);
  assert.deepEqual(Object.keys(t).sort(),['type','requestId','revision','sequence','callbackAt','parsedAt','decodedAt','appliedAt','outcome'].sort());
  assert.ok(!JSON.stringify(timing).includes('DO-NOT-EXPORT'));assert.ok(!JSON.stringify(timing).includes('hexes'));
  const before=client.state.snapshot;emit('PLAYER_VIEW_SNAPSHOT',{...compact,view:{...compact.view,units:'invalid'}});
  assert.equal(client.state.snapshot,before);assert.equal(timing.at(-1).outcome,'invalid-snapshot');assert.equal(sent.at(-1).messageType,'RESYNC_MATCH');
  assert.equal(sent.filter(m=>m.messageType==='SUBMIT_ACTION').length,0);
 }finally{client.dispose();Object.assign(globalThis,previous);}
});

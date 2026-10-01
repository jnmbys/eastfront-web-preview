import test from 'node:test';
import assert from 'node:assert/strict';
import {gameHarness} from './helpers/mp002.mjs';

test('MP007 production client measures send/apply/UI readiness; ACK never restores controls or canonical state',async()=>{
  const previous={window:globalThis.window,location:globalThis.location,sessionStorage:globalThis.sessionStorage,WebSocket:globalThis.WebSocket};
  globalThis.location={search:'?transportDiagnostics=1'};globalThis.window=new EventTarget();globalThis.sessionStorage={getItem(){return null;},setItem(){}};
  const timings=[],sent=[],receives=[];
  window.addEventListener('eastfront-action-timing',e=>timings.push(e.detail));
  window.addEventListener('eastfront-transport-timing',e=>receives.push(e.detail));
  class Socket {static OPEN=1;static CONNECTING=0;readyState=1;constructor(){Socket.last=this;}send(data){sent.push(JSON.parse(data));}close(){this.readyState=3;}}
  globalThis.WebSocket=Socket;
  const {LobbyClient}=await import('../dist/app/multiplayer/client.js');
  const {NetworkPlayerSession}=await import('../dist/app/multiplayer/networkSession.js');
  const {createPresentationState}=await import('../dist/app/state/presentation.js');
  const h=gameHarness(),initial=h.b.last('PLAYER_VIEW_SNAPSHOT'),client=new LobbyClient('ws://test',()=>{},'snapshot-v1');let session;
  try{
    client.connect('test');const ws=Socket.last;ws.onopen();
    const emit=m=>ws.onmessage({data:JSON.stringify(m)});
    emit({...h.b.last('WELCOME'),requestId:sent.at(-1).requestId,payload:{...h.b.last('WELCOME').payload,battleSummary:undefined}});
    client.state.match=h.b.last('MATCH_CREATED').payload;client.state.synced=true;emit(initial);
    let renderedRevision=null;
    session=new NetworkPlayerSession(client,createPresentationState(),kind=>{if(kind==='view')renderedRevision=session.matchRevision;});
    const [q,r]=initial.payload.model.deployment.zoneKeys[0].split(',').map(Number);
    const action={type:'DEPLOY_INITIAL_UNIT',deploymentUnitId:initial.payload.model.deployment.roster[0].id,hex:{q,r}};
    session.submit(action);const request=sent.at(-1);assert.equal(request.messageType,'SUBMIT_ACTION');assert.equal(session.ready,false);
    const ack=h.submit(h.b,action,0,request.requestId);emit(ack);
    assert.equal(session.matchRevision,0);assert.equal(session.playerView.units.length,0);assert.equal(session.ready,false);
    assert.equal(timings.at(-1).stage,'ui');assert.equal(timings.at(-1).ready,false);
    emit(h.b.last('PLAYER_VIEW_SNAPSHOT'));
    const ui=timings.at(-1);assert.equal(ui.stage,'ui');assert.equal(ui.ready,true);assert.equal(ui.revision,1);assert.equal(renderedRevision,1);
    assert(session.interactive);assert.equal(session.playerView.units.length,1);
    const submit=timings.find(r=>r.stage==='submit'),send=timings.find(r=>r.stage==='send');
    assert.equal(submit.requestId,request.requestId);assert.equal(send.requestId,request.requestId);assert(submit.at<=send.at&&send.at<=ui.at);
    assert(timings.every(r=>Number.isFinite(r.clientTimestamp)));
    assert(receives.at(-1).appliedAt>=ui.at);
    for(const value of [action.deploymentUnitId,h.b.welcome.reconnectToken,'hexes','DEPLOY_INITIAL_UNIT'])assert(!JSON.stringify(timings).includes(value));
  }finally{session?.dispose();client.dispose();Object.assign(globalThis,previous);}
});

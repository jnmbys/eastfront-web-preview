import test from 'node:test';
import assert from 'node:assert/strict';
import {WebSocket as Wire} from 'ws';
import {network} from './helpers/mp001.mjs';
import {LobbyClient} from '../dist/app/multiplayer/client.js';
import {NetworkPlayerSession} from '../dist/app/multiplayer/networkSession.js';
import {createPresentationState} from '../dist/app/state/presentation.js';
const wait=async(predicate)=>{const start=performance.now();while(!predicate()){if(performance.now()-start>7000)throw Error('Network integration deadline');await new Promise(resolve=>setTimeout(resolve,3));}};
async function pair(t){
 const server=await network(t),previous={window:globalThis.window,sessionStorage:globalThis.sessionStorage,WebSocket:globalThis.WebSocket},sockets=[],sent=[],delivered=[];
 globalThis.window=new EventTarget();globalThis.sessionStorage={getItem(){return null;},setItem(){},removeItem(){}};
 class BrowserSocket extends Wire {
  constructor(url){super(url,{origin:'http://127.0.0.1:4173'});sockets.push(this);}
  send(raw){const message=JSON.parse(raw);sent.push({socket:this,...message});super.send(raw);}
  set onmessage(fn){super.onmessage=event=>{const m=JSON.parse(String(event.data));if(this.drop?.(m))return;delivered.push({socket:this,message:m});fn(event);};}
 }
 globalThis.WebSocket=BrowserSocket;
 const peer=()=>{const presentation=createPresentationState();let session;const changes=[];const client=new LobbyClient(`ws://127.0.0.1:${server.port}/ws`,()=>{
  if(!session&&client.state.snapshot)session=new NetworkPlayerSession(client,presentation,kind=>{changes.push(kind);if(kind!=='status')session.requestProjection(presentation);});
 });client.connect('MP003 integration');return {client,presentation,changes,get session(){return session;},get socket(){return sockets.findLast(s=>s===this.initialSocket)??this.initialSocket;},initialSocket:sockets.at(-1)};};
 const a=peer(),b=peer();t.after(()=>{a.client.dispose();b.client.dispose();for(const socket of sockets)socket.terminate();Object.assign(globalThis,previous);});
 await wait(()=>a.client.canMutate&&b.client.canMutate);a.client.send('CREATE_ROOM',{});await wait(()=>a.client.state.room);b.client.send('JOIN_ROOM',{roomCode:a.client.state.room.roomCode});await wait(()=>b.client.state.room);
 a.client.send('SELECT_SEAT',{seat:'GERMANY'});await wait(()=>a.client.canMutate);b.client.send('SELECT_SEAT',{seat:'SOVIET'});await wait(()=>b.client.canMutate);a.client.send('SET_READY',{ready:true});await wait(()=>a.client.canMutate);b.client.send('SET_READY',{ready:true});await wait(()=>a.session?.ready&&b.session?.interactive);
 const deploy=async(index)=>{const row=b.session.model.deployment.roster[index],key=b.session.model.deployment.zoneKeys[index],[q,r]=key.split(',').map(Number),revision=b.session.matchRevision;
  b.presentation.selectedDeploymentUnitId=row.id;b.session.requestProjection();assert(b.session.interactive);
  const action={type:'DEPLOY_INITIAL_UNIT',deploymentUnitId:row.id,hex:{q,r}},requestIndex=sent.length;b.session.submit(action);b.session.submit(action);
  assert.equal(sent.slice(requestIndex).filter(m=>m.messageType==='SUBMIT_ACTION').length,1);
  await wait(()=>b.session.matchRevision===revision+1&&b.session.interactive);return {row,key,revision:revision+1,request:sent.findLast(m=>m.messageType==='SUBMIT_ACTION')};
 };
 return {...server,a,b,sent,delivered,sockets,deploy};
}

test('MP003 real clients: lobby handoff consumes initial snapshot once, deployments send no queries, both revisions agree',async t=>{
 const h=await pair(t);
 assert(!h.a.changes.includes('resync'));assert(!h.b.changes.includes('resync'));
 for(let i=0;i<4;i++){
  const r=await h.deploy(i);await wait(()=>h.a.session.matchRevision===r.revision);
  assert.equal(h.a.session.playerView.phase,h.b.session.playerView.phase);assert.equal(h.a.session.playerView.units.length,0);
  assert.equal(h.b.session.playerView.units.length,i+1);assert.equal(h.b.session.playerView.units.find(u=>u.id===r.row.id).hex.q,Number(r.key.split(',')[0]));
 }
 assert.equal(h.sent.filter(m=>m.messageType==='SUBMIT_ACTION').length,4);assert.equal(h.sent.filter(m=>m.messageType==='QUERY_MATCH'||m.messageType==='RESYNC_MATCH').length,0);
});

test('MP003 real clients: dropped observer snapshot triggers one resync, privacy holds and play continues',async t=>{
 const h=await pair(t);let dropped=false;
 h.a.initialSocket.drop=m=>{if(!dropped&&m.messageType==='PLAYER_VIEW_SNAPSHOT'&&m.payload.matchRevision===1){dropped=true;return true;}return false;};
 await h.deploy(0);assert(dropped);assert.equal(h.a.session.matchRevision,0);await h.deploy(1);
 await wait(()=>h.a.session.matchRevision===2&&!h.a.session.syncing);assert.equal(h.sent.filter(m=>m.messageType==='RESYNC_MATCH').length,1);assert.equal(h.a.session.playerView.units.length,0);
 await h.deploy(2);await wait(()=>h.a.session.matchRevision===3);assert.equal(h.sent.filter(m=>m.messageType==='RESYNC_MATCH').length,1);
});

test('MP003 real clients: token reconnect restores current private view and continues once without automatic decision',async t=>{
 const h=await pair(t);await h.deploy(0);const revision=h.b.session.matchRevision,controller=h.b.client.state.controllerId;
 h.b.presentation.pathDraft=[{q:100,r:100}];h.b.initialSocket.terminate();await wait(()=>h.a.session.status==='WAITING_FOR_RECONNECT');
 assert.equal(h.a.session.matchRevision,revision);assert.equal(h.sent.filter(m=>m.messageType==='SUBMIT_ACTION').length,1);
 await wait(()=>h.b.session.status==='ACTIVE'&&!h.b.session.syncing&&h.b.session.interactive&&h.sockets.length===3);
 assert.equal(h.b.client.state.controllerId,controller);assert.equal(h.b.session.matchRevision,revision);assert.deepEqual(h.b.presentation.pathDraft,[]);assert.equal(h.b.session.playerView.units.length,1);
 await h.deploy(1);await wait(()=>h.a.session.matchRevision===2);assert.equal(h.sent.filter(m=>m.messageType==='SUBMIT_ACTION').length,2);assert.equal(h.a.session.playerView.units.length,0);
});

test('MP003 real clients: replayed deployment request is idempotent and legal ACK/snapshot interleaving does not resync',async t=>{
 const h=await pair(t),r=await h.deploy(0);const {socket,...message}=r.request;socket.send(JSON.stringify(message));
 await wait(()=>h.delivered.filter(d=>d.message.messageType==='ACTION_ACCEPTED'&&d.message.requestId===message.requestId).length===2);
 assert.equal(h.b.session.matchRevision,1);assert.equal(h.b.session.playerView.units.length,1);assert.equal(h.sent.filter(m=>m.messageType==='RESYNC_MATCH').length,0);
 await h.deploy(1);assert.equal(h.b.session.matchRevision,2);
});

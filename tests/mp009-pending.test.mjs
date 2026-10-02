import test from 'node:test';
import assert from 'node:assert/strict';
import {gameHarness} from './helpers/mp002.mjs';
import {fixture,unit} from './helpers/combat-fixture.mjs';
import {NetworkPlayerSession} from '../dist/app/multiplayer/networkSession.js';
import {PendingActionTracker} from '../dist/app/multiplayer/pendingAction.js';
import {createPresentationState} from '../dist/app/state/presentation.js';
import {serverMessage} from '../dist/app/multiplayer/protocol.js';
import {deploymentDom} from './helpers/deployment-dom.mjs';

function setup(t,{move=false,observer=false}={}){
 const h=gameHarness(move?()=>{const s=fixture(17,[unit('own','G-INF','GERMAN','INFANTRY',{q:0,r:0}),unit('enemy','S-INF','SOVIET','INFANTRY',{q:5,r:0})]).s;s.state.phase='GERMAN_MOVEMENT';return s;}:undefined);
 const peer=(move!==observer)?h.a:h.b,listeners=new Set(),sent=[];
 const state={snapshot:peer.last('PLAYER_VIEW_SNAPSHOT').payload,connection:'CONNECTED',synced:true,pending:false,error:null};let pendingId;
 const c={state,sent,get canMutate(){return state.connection==='CONNECTED'&&state.synced&&!state.pending;},subscribe(f){listeners.add(f);return ()=>listeners.delete(f);},send(type,payload){if(!this.canMutate)return null;const requestId=`r-${sent.length}`;sent.push({type,payload,requestId});state.pending=true;pendingId=requestId;for(const f of listeners)f(null);return requestId;},resyncMatch(matchId){state.pending=false;this.send('RESYNC_MATCH',{matchId});},emit(m){if(m?.requestId===pendingId){state.pending=false;pendingId=null;}if(m?.messageType==='PLAYER_VIEW_SNAPSHOT')state.snapshot=m.payload;for(const f of listeners)f(m);},dispose(){}};
 const p=createPresentationState(),changes=[],n=new NetworkPlayerSession(c,p,k=>changes.push(k));t.after(()=>n.dispose());
 const hex=move?{q:1,r:0}:Object.fromEntries(['q','r'].map((k,i)=>[k,Number(n.model.deployment?.zoneKeys[0].split(',')[i])]));
 const action=move?{type:'MOVE',unitId:'own',path:[hex]}:{type:'DEPLOY_INITIAL_UNIT',deploymentUnitId:p.selectedDeploymentUnitId,hex};
 const order=(extra={})=>({matchId:state.snapshot.matchId,matchRevision:n.matchRevision,serverSequence:n.serverSequence+1,...extra});
 const emit=(type,payload={},id=sent[0]?.requestId)=>c.emit(serverMessage(type,{...order(),...payload},id));
 const snapshot=(extra={})=>emit('PLAYER_VIEW_SNAPSHOT',{...structuredClone(state.snapshot),...order(),resync:false,...extra},null);
 return {h,peer,c,n,p,action,changes,emit,snapshot};
}

for(const move of [false,true])test(`MP009 ${move?'move':'deployment'} waits for authoritative snapshot, guards repeats, owns a copied private intent`,async t=>{
 const f=setup(t,{move}),before=structuredClone(f.n.playerView),model=structuredClone(f.n.model),observer=setup(t,{move,observer:true});
 f.n.submit(f.action);f.n.submit(f.action);
 assert.equal(f.c.sent.length,1);assert.equal(f.n.pendingAction.stage,'submitting');assert.match(f.n.statusText,/提交|Submitting/);
 assert.deepEqual(f.n.playerView,before);assert.deepEqual(f.n.model,model);assert.equal(observer.n.pendingAction,null);
 const original=structuredClone(f.n.pendingAction.path);if(move)f.action.path[0].q=100;else f.action.hex.q=100;
 assert.deepEqual(f.n.pendingAction.path,original);
 f.emit('ACTION_ACCEPTED',{acceptedRevision:1,actionSequence:1});assert.equal(f.n.pendingAction.stage,'accepted');assert.match(f.n.statusText,/已接受|Accepted/);
 assert.deepEqual(f.n.playerView,before);assert.deepEqual(f.n.model,model);assert(!f.n.interactive);
 f.snapshot({matchRevision:1});assert.equal(f.n.pendingAction,null);assert(f.n.interactive);
 await new Promise(r=>setTimeout(r,5));assert.equal(f.c.sent.length,1,'no extra Query/resync');
});
test('MP009 actual authorized deployment result updates canonical state only on application',t=>{
 const f=setup(t);f.n.submit(f.action);f.h.submit(f.peer,f.action,0,f.c.sent[0].requestId);
 f.c.emit(f.peer.last('ACTION_ACCEPTED'));assert.equal(f.n.playerView.units.length,0);
 f.c.emit(f.peer.last('PLAYER_VIEW_SNAPSHOT'));assert.equal(f.n.playerView.units.length,1);assert.equal(f.n.pendingAction,null);
});
test('MP009 legal snapshot-before-ACK completes once; unrelated frames never clear intent',t=>{
 const f=setup(t);f.n.submit(f.action);const id=f.n.pendingAction.requestId;
 f.emit('ACTION_ACCEPTED',{acceptedRevision:1,actionSequence:1},'other');f.snapshot();
 f.c.emit(serverMessage('ROOM_ERROR',{code:'RATE_LIMIT'},'other'));assert.equal(f.n.pendingAction.requestId,id);
 f.snapshot({matchRevision:1});assert.equal(f.n.pendingAction.requestId,id,'no identity guessed from newer state');
 const phases=[];f.changes.length=0;f.emit('ACTION_ACCEPTED',{acceptedRevision:1,actionSequence:1});phases.push(f.n.pendingAction?.stage);
 assert.deepEqual(phases,[undefined]);assert(f.n.interactive);
 f.emit('ACTION_ACCEPTED',{acceptedRevision:1,actionSequence:1});assert.equal(f.n.pendingAction,null);assert(f.n.interactive);assert.equal(f.c.sent.length,1);
});
test('MP009 accepted receipt is not completed by an unrelated same-revision snapshot',t=>{
 const f=setup(t);f.n.submit(f.action);f.emit('ACTION_ACCEPTED',{acceptedRevision:1,actionSequence:1});f.snapshot();
 assert.equal(f.n.pendingAction.stage,'accepted');assert(!f.n.interactive);f.snapshot({matchRevision:1});assert.equal(f.n.pendingAction,null);
 const later=setup(t);later.n.submit(later.action);later.snapshot({matchRevision:1});later.emit('ACTION_ACCEPTED',{matchRevision:2,acceptedRevision:2,actionSequence:2});
 assert.equal(later.n.pendingAction.stage,'accepted','unrelated newer snapshot does not settle another revision');later.snapshot({matchRevision:2});assert.equal(later.n.pendingAction,null);assert.equal(later.c.sent.length,1);
});
test('MP009 rejection clears intent and move capture, displays safe reason without resending',t=>{
 const f=setup(t,{move:true});f.p.interactionMode='MOVE_PATH';f.p.pathDraft=[{q:1,r:0}];f.n.submit(f.action);
 f.emit('ACTION_REJECTED',{code:'INVALID_ACTION'},'other');assert(f.n.pendingAction);
 f.emit('ACTION_REJECTED',{code:'INVALID_ACTION'});assert.equal(f.n.pendingAction,null);assert.match(f.n.statusText,/不符合|invalid/i);assert.equal(f.p.interactionMode,'SELECT');assert.deepEqual(f.p.pathDraft,[]);assert.equal(f.c.sent.length,1);
});
test('MP009 timeout enters uncertainty, requests one recovery and never resends an action',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=setup(t);f.n.submit(f.action);t.mock.timers.tick(10001);
 assert.equal(f.n.pendingAction,null);assert.match(f.n.statusText,/结果待确认|unconfirmed/i);assert(f.n.syncing);
 f.n.resync();t.mock.timers.tick(10001);assert.deepEqual(f.c.sent.map(x=>x.type),['SUBMIT_ACTION','RESYNC_MATCH']);
 f.c.state.pending=false;f.snapshot({resync:true,matchRevision:1});assert(f.n.interactive);assert.equal(f.n.pendingAction,null);
});
test('MP009 disconnect/permission/phase/viewer/lost unit/resync clean up expired overlays',t=>{
 for(const scenario of ['disconnect','permission','phase','viewer','lost','resync']){
  const f=setup(t,{move:true});f.n.submit(f.action);
  if(scenario==='disconnect'){f.c.state.connection='DISCONNECTED';f.c.state.pending=false;f.c.emit(null);}
  else {const snap=structuredClone(f.c.state.snapshot);if(scenario==='permission')snap.canAct=false;if(scenario==='phase')snap.view.phase='GERMAN_COMBAT';if(scenario==='viewer')snap.model.viewerControllerId='other';if(scenario==='lost')snap.view.units=[];if(scenario==='resync')snap.resync=true;f.snapshot(snap);}
  assert.equal(f.n.pendingAction,null,scenario);assert.equal(f.c.sent.length,1,scenario);
 }
});
test('MP009 stale revision requests existing recovery once; null send and throw do not leave phantom markers',t=>{
 const f=setup(t);f.n.submit(f.action);f.emit('ACTION_REJECTED',{code:'STALE_REVISION'});assert.equal(f.n.pendingAction,null);assert.equal(f.c.sent.at(-1).type,'RESYNC_MATCH');assert.match(f.n.statusText,/已变化|stale|changed/i);
 const nil=setup(t);nil.c.send=()=>null;nil.n.submit(nil.action);assert.equal(nil.n.pendingAction,null);assert(nil.n.interactive);assert.match(nil.n.statusText,/未发送|not sent/i);
 const fail=setup(t);fail.c.send=()=>{throw Error('transport');};fail.c.resyncMatch=()=>{};fail.n.submit(fail.action);assert.equal(fail.n.pendingAction,null);assert(fail.n.syncing);assert.match(fail.n.statusText,/结果待确认|unconfirmed/i);
});
test('MP009 leaving disposes pending intent; tracker ignores unrelated receipts and unsupported actions',t=>{
 const f=setup(t);f.n.submit(f.action);f.n.dispose();assert.equal(f.n.pendingAction,null);
 const p=new PendingActionTracker();assert.equal(p.begin({type:'READY_FOR_PHASE_END'},{}),false);assert.equal(p.text,null);
});
test('MP009 real main status handler mounts a non-hit-test overlay without rebuilding terrain/counters; rejection removes it',async t=>{
 const f=setup(t),dom=await deploymentDom(f.n,f.p);t.after(()=>dom.dispose());
 const terrain=dom.document.querySelector('#terrain-surface'),counters=dom.unitNodes();
 f.n.submit(f.action);dom.change('status');const layer=dom.document.querySelector('#pending-action-layer');assert(layer);assert.equal(layer.getAttribute('pointer-events'),'none');assert.equal(layer.querySelectorAll('[data-unit-id]').length,0);
 assert.equal(dom.document.querySelector('#terrain-surface'),terrain);assert.deepEqual(dom.unitNodes(),counters);
 dom.change('status');assert.equal(dom.document.querySelector('#pending-action-layer'),layer);
 f.emit('ACTION_REJECTED',{code:'INVALID_ACTION'});dom.change('query');assert.equal(dom.document.querySelector('#pending-action-layer'),null);
});

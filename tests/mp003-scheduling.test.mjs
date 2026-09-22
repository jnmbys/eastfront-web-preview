import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {gameHarness,production} from './helpers/mp002.mjs';
import {fixture,unit} from './helpers/combat-fixture.mjs';
import {NetworkPlayerSession} from '../dist/app/multiplayer/networkSession.js';
import {createPresentationState} from '../dist/app/state/presentation.js';
import {serverMessage} from '../dist/app/multiplayer/protocol.js';
const turn=()=>new Promise(resolve=>setTimeout(resolve,5));
function mockClient(snapshot){
 const listeners=new Set(),sent=[],state={snapshot,connection:'CONNECTED',synced:true,pending:false,error:null};let pendingId=null;
 return {state,sent,get canMutate(){return state.connection==='CONNECTED'&&state.synced&&!state.pending;},subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn);},send(type,payload){if(!this.canMutate)return null;const requestId=`request-${sent.length}`;pendingId=requestId;sent.push({type,payload,requestId});state.pending=true;for(const f of [...listeners])f(null);return requestId;},resyncMatch(matchId){state.pending=false;this.send('RESYNC_MATCH',{matchId});},emit(m){if(m.requestId===pendingId){state.pending=false;pendingId=null;}if(m.messageType==='PLAYER_VIEW_SNAPSHOT')state.snapshot=m.payload;for(const f of [...listeners])f(m);},offline(){state.connection='DISCONNECTED';state.pending=false;pendingId=null;for(const f of [...listeners])f(null);},dispose(){}};
}
function setup(t,{deployment=false}={}){
 const h=gameHarness(deployment?()=>production(17):()=>{const s=fixture(17,[unit('a','G-INF','GERMAN','INFANTRY',{q:0,r:0}),unit('b','G-INF','GERMAN','INFANTRY',{q:0,r:1}),unit('c','G-INF','GERMAN','INFANTRY',{q:1,r:0}),unit('enemy','S-INF','SOVIET','INFANTRY',{q:5,r:0})]).s;s.state.phase='GERMAN_MOVEMENT';return s;});
 const peer=deployment?h.b:h.a,c=mockClient(peer.last('PLAYER_VIEW_SNAPSHOT').payload),p=createPresentationState(),changes=[];const n=new NetworkPlayerSession(c,p,kind=>changes.push(kind));t.after(()=>n.dispose());return {h,peer,c,p,n,changes};
}
const order=(n,extra={})=>({matchId:n.client.state.snapshot.matchId,matchRevision:n.matchRevision,serverSequence:n.serverSequence+1,...extra});
function answer({n,c},request,extra={}){const model=structuredClone(n.model);for(const row of model.counters)row.selected=row.id===request.payload.draft.selectedUnitId;model.selectedCounter=model.counters.find(c=>c.selected)??null;c.emit(serverMessage('MATCH_QUERY',{...order(n),model,forcedAction:null,...extra},request.requestId));}
function select(f,id){f.p.selectedUnitId=id;f.n.requestProjection();}

test('MP003 deployment unit/destination selection is local, sends no query and changes no canonical placement',async t=>{
 const f=setup(t,{deployment:true}),view=f.n.playerView;
 for(const row of f.n.model.deployment.roster.slice(0,8)){f.p.selectedDeploymentUnitId=row.id;f.n.requestProjection();assert(f.n.interactive);}
 await turn();assert.equal(f.c.sent.length,0);assert.equal(f.n.playerView,view);assert.equal(view.units.length,0);
});
test('MP003 same-turn selections send only the latest query; selected counter feedback is immediate',async t=>{
 const f=setup(t);for(const id of ['a','b','c','a','c'])select(f,id);
 assert.equal(f.n.renderModel().selectedCounter.id,'c');assert(f.n.canSelect);assert(!f.n.interactive);assert.equal(f.c.sent.length,0);
 await turn();assert.equal(f.c.sent.length,1);assert.equal(f.c.sent[0].payload.draft.selectedUnitId,'c');answer(f,f.c.sent[0]);assert(f.n.interactive);
});
test('MP003 one in-flight plus latest unsent query; obsolete result consumes sequence without overwriting selection',async t=>{
 const f=setup(t),view=f.n.playerView;select(f,'a');await turn();const first=f.c.sent[0],before=f.n.model;
 for(const id of ['b','c','b','c'])select(f,id);await turn();assert.equal(f.c.sent.length,1);
 const seq=f.n.serverSequence;answer(f,first);assert.equal(f.n.serverSequence,seq+1);assert.equal(f.n.model,before);assert.equal(f.n.renderModel().selectedCounter.id,'c');assert.equal(f.n.playerView,view);
 await turn();assert.equal(f.c.sent.length,2);assert.equal(f.c.sent[1].payload.draft.selectedUnitId,'c');answer(f,f.c.sent[1]);assert.equal(f.n.model.selectedCounter.id,'c');assert.equal(f.changes.filter(k=>k==='query').length,1);assert(!f.c.sent.some(x=>x.type==='RESYNC_MATCH'));
});
test('MP003 A-B-A clears the unsent B instead of applying it after A',async t=>{
 const f=setup(t);select(f,'a');await turn();select(f,'b');select(f,'a');answer(f,f.c.sent[0]);await turn();assert.equal(f.c.sent.length,1);assert.equal(f.n.model.selectedCounter.id,'a');assert(f.n.interactive);
});
test('MP003 snapshot while query is in flight does not free its transport slot or send duplicate queries',async t=>{
 const f=setup(t);select(f,'a');await turn();const request=f.c.sent[0];
 const next={...structuredClone(f.c.state.snapshot),...order(f.n,{matchRevision:1}),resync:false};f.c.emit(serverMessage('PLAYER_VIEW_SNAPSHOT',next));f.n.requestProjection();await turn();assert.equal(f.c.sent.length,1);
 answer(f,request,{matchRevision:0});assert.equal(f.n.matchRevision,1);assert(!f.n.syncing);await turn();assert.equal(f.c.sent.length,2);assert.equal(f.c.sent[1].payload.expectedRevision,1);answer(f,f.c.sent[1]);assert(f.n.interactive);
});
test('MP003 genuine sequence gap still requests exactly one resync and applies a current private snapshot',t=>{
 const f=setup(t,{deployment:true}),before=f.n.playerView,seq=f.n.serverSequence;
 const missing={...structuredClone(f.c.state.snapshot),resync:false,serverSequence:seq+2};f.c.emit(serverMessage('PLAYER_VIEW_SNAPSHOT',missing));assert(f.n.syncing);assert.equal(f.n.playerView,before);
 f.c.emit(serverMessage('PLAYER_VIEW_SNAPSHOT',{...missing,serverSequence:seq+3}));assert.equal(f.c.sent.filter(x=>x.type==='RESYNC_MATCH').length,1);
 const request=f.c.sent.at(-1);f.c.emit(serverMessage('PLAYER_VIEW_SNAPSHOT',{...missing,resync:true,serverSequence:seq+4},request.requestId));assert(!f.n.syncing);assert(f.n.interactive);assert.equal(f.n.playerView.viewer,'SOVIET');assert.equal(f.n.playerView.units.length,0);
});
test('MP003 future query revision still forces recovery; version validation is retained',async t=>{
 const f=setup(t);select(f,'a');await turn();answer(f,f.c.sent[0],{matchRevision:2});assert(f.n.syncing);assert.equal(f.c.sent.at(-1).type,'RESYNC_MATCH');
});
test('MP003 unrelated correlated response consumes order but cannot complete the current query',async t=>{
 const f=setup(t);select(f,'a');await turn();const old=f.n.model,request=f.c.sent[0];answer(f,{...request,requestId:'unrelated'});assert.equal(f.n.model,old);assert(!f.n.interactive);answer(f,request);assert(f.n.interactive);
});
test('MP003 Action ACK does not adopt state; one deployment click/reclick executes once and creates no follow-up query',async t=>{
 const f=setup(t,{deployment:true}),id=f.p.selectedDeploymentUnitId,key=f.n.model.deployment.zoneKeys[0],[q,r]=key.split(',').map(Number),action={type:'DEPLOY_INITIAL_UNIT',deploymentUnitId:id,hex:{q,r}};
 f.n.submit(action);f.n.submit(action);assert.equal(f.c.sent.length,1);assert.equal(f.n.playerView.units.length,0);
 const request=f.c.sent[0];f.h.submit(f.peer,action,0,request.requestId);f.c.emit(f.peer.last('ACTION_ACCEPTED'));assert.equal(f.n.matchRevision,0);assert.equal(f.n.playerView.units.length,0);assert(!f.n.interactive);
 f.c.emit(f.peer.last('PLAYER_VIEW_SNAPSHOT'));f.n.requestProjection();await turn();assert.equal(f.h.match.matchRevision,1);assert.equal(f.n.matchRevision,1);assert.equal(f.n.playerView.units.length,1);assert.equal(f.c.sent.length,1);assert(f.n.interactive);
});
test('MP003 query rejection does not retry itself or expose the previous selection options',async t=>{
 const f=setup(t);select(f,'a');await turn();const request=f.c.sent[0];f.c.state.error='error.RATE_LIMIT';f.c.emit(serverMessage('ROOM_ERROR',{code:'RATE_LIMIT'},request.requestId));f.n.requestProjection();await turn();assert.equal(f.c.sent.length,1);assert.equal(f.n.renderModel().movement,null);assert.equal(f.n.notice,'error.RATE_LIMIT');
 select(f,'b');await turn();assert.equal(f.c.sent.length,2);
});
test('MP003 ordered pending-resync frames cannot produce repeated recovery requests or roll back state',t=>{
 const f=setup(t,{deployment:true});f.n.resync();const request=f.c.sent.at(-1),seq=f.n.serverSequence;
 f.c.emit(serverMessage('ACTION_ACCEPTED',{...order(f.n),acceptedRevision:1,actionSequence:1}));assert.equal(f.n.serverSequence,seq+1);assert(f.n.syncing);
 const next={...structuredClone(f.c.state.snapshot),...order(f.n,{matchRevision:1}),resync:true};f.c.emit(serverMessage('PLAYER_VIEW_SNAPSHOT',next,request.requestId));assert.equal(f.n.matchRevision,1);
 f.c.emit(serverMessage('PLAYER_VIEW_SNAPSHOT',{...next,matchRevision:0,serverSequence:seq,resync:true}));assert.equal(f.n.matchRevision,1);assert.equal(f.c.sent.length,1);
});
test('MP003 disconnect clears queued input and reconnect restores current state before accepting another action',async t=>{
 const f=setup(t);select(f,'a');await turn();select(f,'b');f.c.offline();await turn();assert.equal(f.c.sent.length,1);assert(!f.n.canSelect);
 f.c.state.connection='CONNECTED';f.c.emit(serverMessage('PLAYER_VIEW_SNAPSHOT',{...f.c.state.snapshot,resync:true,serverSequence:10,matchRevision:3}));assert.equal(f.n.matchRevision,3);assert.equal(f.p.pathDraft.length,0);select(f,'c');await turn();assert.equal(f.c.sent.length,2);assert.equal(f.c.sent.at(-1).payload.expectedRevision,3);
});
test('MP003 network UI keeps selection buttons live while guarding Actions and Core-disabled controls',()=>{
 const source=readFileSync('src/main.ts','utf8'),code=source.slice(source.indexOf('function updateNetworkStatus():void'),source.indexOf('async function enterNetworkMatch')).replace(/:void/g,'').replace(/querySelector<HTMLElement>/g,'querySelector').replace(/querySelectorAll<HTMLButtonElement>/g,'querySelectorAll');
 const buttons=[{kind:'selection',disabled:false,dataset:{}},{kind:'action',disabled:false,dataset:{}},{kind:'illegal',disabled:true,dataset:{}}];for(const b of buttons)b.matches=()=>b.kind==='selection';
 const context={session:{canSelect:true,interactive:false,status:'ACTIVE',statusText:'Syncing',matchRevision:1},isNetwork:()=>true,document:{querySelector:()=>null,querySelectorAll:()=>buttons}};vm.createContext(context);vm.runInContext(code,context);vm.runInContext('updateNetworkStatus()',context);
 assert.deepEqual(buttons.map(b=>b.disabled),[false,true,true]);context.session.interactive=true;vm.runInContext('updateNetworkStatus()',context);assert.deepEqual(buttons.map(b=>b.disabled),[false,false,true]);context.session.canSelect=false;vm.runInContext('updateNetworkStatus()',context);assert(buttons.every(b=>b.disabled));
});

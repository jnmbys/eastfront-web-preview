import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {gameHarness} from './helpers/mp002.mjs';
import {createPresentationState} from '../dist/app/state/presentation.js';
import {serverMessage} from '../dist/app/multiplayer/protocol.js';

// The same tests can be run against the original MP009 client to reproduce the defect.
globalThis.location={search:'?transportDiagnostics=1'};
globalThis.window=new EventTarget();
const {NetworkPlayerSession}=await import(pathToFileURL(resolve(process.env.MP009_CLIENT_DIST??'dist/app','multiplayer/networkSession.js')).href);
function setup(t){
 let clock=10; t.mock.method(performance,'now',()=>clock);
 const h=gameHarness(),initial=h.b.last('PLAYER_VIEW_SNAPSHOT').payload,sent=[],records=[],listeners=new Set();
 const onTiming=e=>records.push(e.detail);window.addEventListener('eastfront-action-timing',onTiming);
 const state={snapshot:initial,connection:'CONNECTED',synced:true,pending:false,error:null};
 const client={state,canMutate:true,subscribe(f){listeners.add(f);return ()=>listeners.delete(f);},send(type,payload){sent.push({type,payload});return 'own-request';},resyncMatch(){sent.push({type:'RESYNC_MATCH'});},dispose(){}};
 const n=new NetworkPlayerSession(client,createPresentationState(),()=>{});t.after(()=>{n.dispose();window.removeEventListener('eastfront-action-timing',onTiming);});
 const [q,r]=n.model.deployment.zoneKeys[0].split(',').map(Number);n.submit({type:'DEPLOY_INITIAL_UNIT',deploymentUnitId:n.model.deployment.roster[0].id,hex:{q,r}});
 function emit(type,extra={},requestId=null){const payload={matchId:initial.matchId,matchRevision:n.matchRevision,serverSequence:n.serverSequence+1,...extra};for(const f of listeners)f(serverMessage(type,payload,requestId));}
 function snapshot(revision,extra={}){const next={...structuredClone(initial),matchRevision:revision,serverSequence:n.serverSequence+1,resync:false,...extra};state.snapshot=next;emit('PLAYER_VIEW_SNAPSHOT',next);}
 return {n,sent,records,setTime:v=>clock=v,snapshot,ack:(revision,id='own-request')=>emit('ACTION_ACCEPTED',{acceptedRevision:revision,actionSequence:1},id),emit,complete:()=>records.filter(r=>r.stage==='snapshot-applied')};
}
test('MP009R1 newer unrelated snapshot cannot be attributed before a matching receipt',t=>{
 const f=setup(t);f.setTime(20);f.snapshot(1);assert.equal(f.n.matchRevision,1,'authorized state applies immediately');assert.deepEqual(f.complete(),[]);
 f.ack(1,'other-request');assert.deepEqual(f.complete(),[]);assert.equal(f.sent.length,1);
});
test('MP009R1 late ACK emits once using first actual snapshot application time and sequence',t=>{
 const f=setup(t);f.setTime(20);f.snapshot(1);const sequence=f.n.serverSequence;assert.equal(f.n.matchRevision,1);assert.equal(f.complete().length,0);
 f.setTime(30);f.snapshot(1);f.setTime(90);f.ack(1);
 assert.deepEqual(f.complete().map(({requestId,revision,sequence,at})=>({requestId,revision,sequence,at})),[{requestId:'own-request',revision:1,sequence,at:20}]);
 f.setTime(100);f.ack(1);f.snapshot(1);assert.equal(f.complete().length,1);assert.equal(f.n.pendingAction,null);assert.equal(f.sent.length,1);
});
test('MP009R1 ACK before snapshot completes exactly once at application, never at ACK',t=>{
 const f=setup(t);f.setTime(20);f.ack(1);assert.equal(f.complete().length,0);f.setTime(80);f.snapshot(1);assert.equal(f.complete().length,1);assert.equal(f.complete()[0].at,80);
 f.snapshot(1);f.ack(1);assert.equal(f.complete().length,1);
});
test('MP009R1 wrong result revision is excluded even after a matching request receipt',t=>{
 const f=setup(t);f.ack(2);f.setTime(30);f.snapshot(1);assert.equal(f.complete().length,0);f.setTime(60);f.snapshot(2);assert.equal(f.complete().length,1);assert.equal(f.complete()[0].revision,2);assert.equal(f.complete()[0].at,60);
});
test('MP009R1 recovery may correlate an acknowledged exact revision after UI intent cleanup',t=>{
 const f=setup(t);f.ack(1);f.n.resync();assert.equal(f.n.pendingAction,null);f.setTime(12000);f.snapshot(1,{resync:true});assert.equal(f.complete().length,1);assert.equal(f.complete()[0].at,12000);assert.equal(f.complete()[0].requestId,'own-request');
});
test('MP009R1 a different authorized viewer cannot complete the request',t=>{
 const f=setup(t);f.ack(1);f.snapshot(1,{model:{...f.n.model,viewerControllerId:'different-viewer'}});assert.equal(f.complete().length,0);
});

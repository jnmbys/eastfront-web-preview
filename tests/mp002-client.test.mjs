import test from 'node:test';
import assert from 'node:assert/strict';
import {gameHarness,production} from './helpers/mp002.mjs';
import {fixture,unit} from './helpers/combat-fixture.mjs';
import {NetworkPlayerSession} from '../dist/app/multiplayer/networkSession.js';
import {createPresentationState} from '../dist/app/state/presentation.js';
import {serverMessage} from '../dist/app/multiplayer/protocol.js';
import {observePresentationTransitions} from '../dist/app/presentation/transitionBus.js';
import {FogRuntime} from '../dist/app/fog/runtime.js';
import {DynamicMapRenderer} from '../dist/app/render/dynamicMap.js';
import {svgDom} from './helpers/performance-dom.mjs';
function client(snapshot){
 const listeners=new Set(),sent=[],state={snapshot,connection:'CONNECTED',synced:true,pending:false,match:{matchId:snapshot.matchId,viewer:snapshot.view.viewer}};
 return {state,sent,get canMutate(){return state.connection==='CONNECTED'&&state.synced&&!state.pending;},subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn);},send(type,payload){if(!this.canMutate)return null;const requestId=`request-${sent.length}`;sent.push({type,payload,requestId});state.pending=true;for(const f of listeners)f(null);return requestId;},resyncMatch(matchId){sent.push({type:'RESYNC_MATCH',payload:{matchId}});state.pending=true;},emit(m){state.pending=false;if(m.messageType==='MATCH_QUERY'&&!m.requestId)m={...m,requestId:sent.findLast(s=>s.type==='QUERY_MATCH')?.requestId??null};if(m.messageType==='PLAYER_VIEW_SNAPSHOT')state.snapshot=m.payload;for(const f of listeners)f(m);},offline(){state.connection='DISCONNECTED';state.pending=false;for(const f of listeners)f(null);},dispose(){}};
}
function setup(){const h=gameHarness(()=>{const s=fixture(17,[unit('g','G-INF','GERMAN','INFANTRY',{q:0,r:0}),unit('d','S-INF','SOVIET','INFANTRY',{q:5,r:0})]).s;s.state.phase='GERMAN_MOVEMENT';return s;});const c=client(h.a.last('PLAYER_VIEW_SNAPSHOT').payload),p=createPresentationState(),changes=[],n=new NetworkPlayerSession(c,p,kind=>changes.push(kind));return {h,c,p,n,changes};}
const order=n=>({matchId:n.client.state.snapshot.matchId,matchRevision:n.matchRevision,serverSequence:n.serverSequence+1});
test('MP002 client has no canonical state/engine/RNG; submit is intent only and double click is suppressed',()=>{
 const {n,c}=setup(),before=JSON.stringify(n.playerView),action={type:'MOVE',unitId:'g',path:[{q:-1,r:0}]};
 n.submit(action);n.submit(action);assert.equal(c.sent.length,1);assert.equal(c.sent[0].type,'SUBMIT_ACTION');assert.equal(JSON.stringify(n.playerView),before);
 for(const key of ['state','engine','rules','random','knowledge'])assert(!(key in n));assert(!n.interactive);n.dispose();
});
test('MP002 accepted snapshot alone adopts position and publishes authorized events, ACK contains no raw result',()=>{
 const {h,n,c}=setup(),events=[];observePresentationTransitions(n,e=>events.push(...e));n.submit({type:'MOVE',unitId:'g',path:[{q:-1,r:0}]});
 h.submit(h.a,{type:'MOVE',unitId:'g',path:[{q:-1,r:0}]});const reply=h.a.last('ACTION_ACCEPTED');c.emit(reply);assert.deepEqual(n.playerView.units[0].hex,{q:0,r:0});
 c.emit(h.a.last('PLAYER_VIEW_SNAPSHOT'));assert.deepEqual(n.playerView.units[0].hex,{q:-1,r:0});assert(events.some(e=>e.kind==='move'));assert(n.interactive);n.dispose();
});
for(const reason of ['gap','out-of-order','revision mismatch'])test(`MP002 ${reason} triggers RESYNC; trusted fresh snapshot restores current state without replay`,()=>{
 const {n,c,p}=setup(),events=[];observePresentationTransitions(n,e=>events.push(...e));p.pathDraft=[{q:1,r:0}];
 const original=n.playerView,next=structuredClone(c.state.snapshot);next.resync=false;next.serverSequence=n.serverSequence+(reason==='gap'?2:reason==='out-of-order'?0:1);next.matchRevision=n.matchRevision+(reason==='revision mismatch'?2:0);
 c.emit(serverMessage('PLAYER_VIEW_SNAPSHOT',next));assert(n.syncing);assert.equal(n.playerView,original);assert.equal(c.sent.at(-1).type,'RESYNC_MATCH');
 const fresh={...structuredClone(c.state.snapshot),resync:true,serverSequence:20,matchRevision:3,events:[]};c.emit(serverMessage('PLAYER_VIEW_SNAPSHOT',fresh));assert.equal(n.matchRevision,3);assert(!n.syncing);assert.deepEqual(p.pathDraft,[]);assert.deepEqual(events,[]);n.dispose();
});
test('MP002 stale action rejection resyncs and invalid action clears busy without optimistic state changes',()=>{
 const {n,c}=setup();n.submit({type:'READY_FOR_PHASE_END'});const view=n.playerView;c.emit(serverMessage('ACTION_REJECTED',{...order(n),acceptedRevision:null,actionSequence:0,code:'INVALID_ACTION'}));assert(n.interactive);assert.equal(n.playerView,view);
 n.submit({type:'READY_FOR_PHASE_END'});c.emit(serverMessage('ACTION_REJECTED',{...order(n),acceptedRevision:null,actionSequence:0,code:'STALE_REVISION'}));assert(n.syncing);assert.equal(c.sent.at(-1).type,'RESYNC_MATCH');n.dispose();
});
test('MP002 network loss disables actions and drafts clear on active resync; camera is not a session field',()=>{
 const {n,c,p}=setup();p.pathDraft=[{q:1,r:0}];c.offline();n.submit({type:'READY_FOR_PHASE_END'});assert.equal(c.sent.length,0);assert(!n.interactive);assert(n.statusText.includes('对局连接中断'));
 c.state.connection='CONNECTED';c.emit(serverMessage('PLAYER_VIEW_SNAPSHOT',{...c.state.snapshot,resync:true,serverSequence:8,events:[]}));assert(n.interactive);assert.deepEqual(p.pathDraft,[]);assert(!('camera' in n));n.dispose();
});
test('MP002 query coalescing retains the authorized PlayerView object; unchanged observation reuses Fog and dynamic map',async()=>{
 const {n,c,p}=setup(),view=n.playerView;const root=svgDom('<svg id="eastfront-map" data-lod="medium" viewBox="-300 -250 600 500"><g id="fog-surface-layer"></g><g id="map-dynamic-layer"></g></svg>'),svg=root.querySelector('#eastfront-map'),layer=root.querySelector('#map-dynamic-layer');
 const fog=new FogRuntime(()=> 'raster'),renderer=new DynamicMapRenderer(),options={debug:false,rendererMode:'production',staticTerrainSurface:true};
 renderer.update(layer,n.renderModel(),options);fog.sync(svg,n.playerView);const builds=fog.buildCount,nodes=root.querySelectorAll('[data-unit-id]');
 p.selectedUnitId='g';n.requestProjection(p);n.requestProjection(p);await new Promise(resolve=>setTimeout(resolve,5));assert.equal(c.sent.length,1);
 c.emit(serverMessage('MATCH_QUERY',{...order(n),model:structuredClone(n.model),forcedAction:null}));assert.equal(n.playerView,view);
 const change=renderer.update(layer,n.renderModel(),options);fog.sync(svg,n.playerView);assert.equal(change.full,false);assert.equal(fog.buildCount,builds);assert.deepEqual(root.querySelectorAll('[data-unit-id]'),nodes);
 const snap={...structuredClone(c.state.snapshot),resync:false,serverSequence:n.serverSequence+1};c.emit(serverMessage('PLAYER_VIEW_SNAPSHOT',snap));fog.sync(svg,n.playerView);assert.equal(fog.buildCount,builds);n.dispose();
});

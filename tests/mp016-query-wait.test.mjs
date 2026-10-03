import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {gameHarness} from './helpers/mp002.mjs';
import {movementFixture} from './helpers/move001.mjs';
globalThis.location={search:'?transportDiagnostics=1'};
globalThis.window=new EventTarget();
globalThis.sessionStorage={getItem(){return null;},setItem(){}};
const root=process.env.MP016_CLIENT_DIST??'dist/app',fast=process.env.MP016_BASELINE!=='1';
const load=p=>import(pathToFileURL(resolve(root,p)).href);
const {LobbyClient}=await load('multiplayer/client.js');
const {NetworkPlayerSession}=await load('multiplayer/networkSession.js');
const {createPresentationState}=await load('state/presentation.js');
const {queryDraft}=await load('multiplayer/gameplayProtocol.js');
const {serverMessage}=await load('multiplayer/protocol.js');

// CPU busy time advances the monotonic clock WITHOUT servicing timers. This is
// what a nested mock-timer tick inside a renderer would incorrectly fail to model.
function clock(t){
 let now=0,serial=0;const jobs=new Map();
 t.mock.method(globalThis,'setTimeout',(fn,ms=0)=>{const id=++serial;jobs.set(id,{fn,due:now+ms});return id;});
 t.mock.method(globalThis,'clearTimeout',id=>jobs.delete(id));
 t.mock.method(performance,'now',()=>now);
 return {get now(){return now;},busy(ms){now+=ms;},advance(ms){const end=now+ms;let count=0;
   while(true){const next=[...jobs].sort((a,b)=>a[1].due-b[1].due||a[0]-b[0])[0];if(!next||next[1].due>end)break;
     if(++count>1000)throw Error('Timer loop');jobs.delete(next[0]);now=Math.max(now,next[1].due);next[1].fn();}
   now=Math.max(now,end);}};
}
function setup(t,{mode='fifo',renderMs=120}={}){
 const time=clock(t),h=gameHarness(()=>movementFixture()),peer=h.a,p=createPresentationState(),trace=[];
 let n,client,epoch=0,receiving=null;
 const log=(stage,data={})=>trace.push({at:time.now,...data,stage});
 const meta=m=>({type:m.messageType,requestId:m.requestId,revision:m.payload.matchRevision??null,sequence:m.payload.serverSequence??null});
 const state=stage=>{if(n)log(stage,{revision:n.matchRevision,canSelect:n.canSelect,legalOptionsReady:n.legalOptionsReady??(!n.needsProjection()||n.modelKey===n.key(queryDraft(p))),canSubmit:n.interactive,queryQueued:!!n.queued,queryInFlight:!!n.flight});};
 const deliver=m=>{receiving=m;log('receive',meta(m));Socket.last.onmessage({data:JSON.stringify(m)});state('after-receive');receiving=null;};
 function schedule(m,delay){const copy=JSON.parse(JSON.stringify(m));log('scheduled',{...meta(copy),due:time.now+delay});setTimeout(()=>deliver(copy),delay);}
 class Socket {
  static OPEN=1;static CONNECTING=0;readyState=1;
  constructor(){Socket.last=this;}
  send(raw){const m=JSON.parse(raw);log('send',{...meta(m),expectedRevision:m.payload.expectedRevision??null,action:m.payload.action?.type??null});
   if(m.messageType==='HELLO')return;
   const start=peer.messages.length;h.authority.receive(peer.connectionId,raw);const replies=peer.messages.slice(start);
   if(mode==='snapshot-first'&&m.messageType==='SUBMIT_ACTION'){
    const ack=replies.find(x=>x.messageType==='ACTION_ACCEPTED'),snap=replies.find(x=>x.messageType==='PLAYER_VIEW_SNAPSHOT');
    if(ack&&snap){const a=structuredClone(ack),s=structuredClone(snap);[a.payload.serverSequence,s.payload.serverSequence]=[s.payload.serverSequence,a.payload.serverSequence];schedule(s,400);schedule(a,600);return;}
   }
   for(const reply of replies){let delay=reply.messageType==='MATCH_QUERY'?700:reply.messageType==='ACTION_ACCEPTED'?200:reply.messageType==='PLAYER_VIEW_SNAPSHOT'&&!reply.payload.resync&&m.messageType==='SUBMIT_ACTION'?400:0;
    if(mode==='sequence-gap'&&reply.messageType==='ACTION_ACCEPTED')delay=600;
    if(mode==='timeout'&&m.messageType==='SUBMIT_ACTION')delay=12000;
    schedule(reply,delay);
   }
  }
  close(){this.readyState=3;this.onclose?.();}
 }
 const previousSocket=globalThis.WebSocket;globalThis.WebSocket=Socket;t.after(()=>{globalThis.WebSocket=previousSocket;});
 const timing=e=>log('timing',{...e.detail,timingStage:e.detail.stage});window.addEventListener('eastfront-action-timing',timing);
 client=new LobbyClient('ws://local-mp016',()=>{},'snapshot-v2-inline-view');
 client.connect('MP016 replay');Socket.last.onopen();const hello=trace.find(x=>x.stage==='send'&&x.type==='HELLO');
 deliver({...peer.last('WELCOME'),requestId:hello.requestId,payload:{...peer.last('WELCOME').payload,battleSummary:undefined}});
 time.advance(0);client.state.match=peer.last('MATCH_CREATED').payload;client.state.synced=true;deliver(peer.last('PLAYER_VIEW_SNAPSHOT'));
 n=new NetworkPlayerSession(client,p,kind=>{if(kind!=='status'){n.requestProjection();state('before-render');if(kind==='view'||kind==='resync'){log('render-start');time.busy(renderMs);log('render-end');}}else state('status');});
 const resync=n.resync.bind(n);n.resync=()=>{log('resync-trigger',{receiving:receiving?.messageType??null,expectedSequence:n.serverSequence+1});resync();};
 t.after(()=>{n.dispose();window.removeEventListener('eastfront-action-timing',timing);});
 function select(id){p.selectedUnitId=id;n.requestProjection();state('select');}
 function prepare(){select('mover');p.interactionMode='MOVE_PATH';p.pathDraft=[{q:-1,r:0}];n.requestProjection();time.advance(700);assert(n.interactive);assert(n.model.movement);epoch=time.now;trace.length=0;}
 function save(name){if(process.env.MP016_TRACE_DIR){mkdirSync(process.env.MP016_TRACE_DIR,{recursive:true});writeFileSync(resolve(process.env.MP016_TRACE_DIR,name+'.json'),JSON.stringify({root,fast,mode,epoch,renderMs,ackDelay:200,snapshotDelay:400,queryDelay:700,clock:'same virtual client monotonic clock; CPU busy does not service timers',transport:'serialized adapter, real LobbyClient/RoomAuthority/Core/codec; fixture only; not browser or device results',trace},null,2)+'\n');}}
 return {n,p,client,h,peer,time,trace,select,prepare,deliver,state,save,get epoch(){return epoch;},get socket(){return Socket.last;}};
}
const move={type:'MOVE',unitId:'mover',path:[{q:-1,r:0}]};

for(const renderMs of [0,120])test(`MP016 required query overlaps ${renderMs}ms snapshot rendering without changing gates`,t=>{
 const f=setup(t,{renderMs});f.prepare();const origin=structuredClone(f.n.playerView.units.find(u=>u.id==='mover').hex);
 f.n.submit(move);f.n.submit(move);assert.deepEqual(f.n.playerView.units.find(u=>u.id==='mover').hex,origin);f.time.advance(200);assert(!f.n.canSelect);assert.deepEqual(f.n.playerView.units.find(u=>u.id==='mover').hex,origin);
 f.time.advance(200);assert.equal(f.n.matchRevision,1);assert.deepEqual(f.n.playerView.units.find(u=>u.id==='mover').hex,{q:-1,r:0});assert(f.n.canSelect);assert(!f.n.interactive);assert.equal(f.n.renderModel().movement,null);
 f.n.submit(move);f.time.advance(900);assert(f.n.interactive);assert(f.n.renderModel().movement);
 const sends=f.trace.filter(e=>e.stage==='send');assert.equal(sends.filter(e=>e.type==='SUBMIT_ACTION').length,1);assert.equal(sends.filter(e=>e.type==='QUERY_MATCH').length,1);assert.equal(sends.filter(e=>e.type==='RESYNC_MATCH').length,0);
 const query=sends.find(e=>e.type==='QUERY_MATCH'),completion=f.trace.find(e=>e.timingStage==='snapshot-applied'&&e.at===f.epoch+400);
 assert(completion,'actual snapshot completion timestamp preserved');assert.equal(query.at-f.epoch,400+(fast?0:renderMs));
 const ready=f.trace.find(e=>e.revision===1&&e.canSubmit===true);assert.equal(ready.at-f.epoch,1100+(fast?0:renderMs));
 assert.equal(f.n.pendingAction,null);f.save('render-'+renderMs);
});

test('MP016 rapid selection while post-snapshot query runs discards old options and coalesces latest intent',t=>{
 const f=setup(t);f.prepare();f.n.submit(move);f.time.advance(400);const first=f.trace.filter(e=>e.stage==='send'&&e.type==='QUERY_MATCH').at(-1);
 assert(first);f.select('friend');f.select('far');assert(f.n.canSelect);assert.equal(f.n.renderModel().selectedCounter.id,'far');assert.equal(f.n.renderModel().movement,null);f.n.submit(move);
 f.time.advance(1600);assert(f.n.interactive);assert.equal(f.n.model.selectedCounter.id,'far');assert.equal(f.trace.filter(e=>e.stage==='send'&&e.type==='QUERY_MATCH').length,2);assert.equal(f.trace.filter(e=>e.stage==='send'&&e.type==='SUBMIT_ACTION').length,1);assert(!f.n.syncing);f.save('rapid-selection');
});

test('MP016 snapshot-first legal sequence retains actual apply time and cannot release before late ACK',t=>{
 const f=setup(t,{mode:'snapshot-first'});f.prepare();f.n.submit(move);f.time.advance(400);assert.equal(f.n.matchRevision,1);assert(f.n.pendingAction);assert(!f.n.interactive);assert.equal(f.trace.filter(e=>e.stage==='send'&&e.type==='QUERY_MATCH').length,0);
 f.time.advance(80);assert.equal(f.n.pendingAction,null);f.time.advance(700);assert(f.n.interactive);
 const completed=f.trace.filter(e=>e.timingStage==='snapshot-applied'&&e.at===f.epoch+400);assert.equal(completed.length,1);assert.equal(f.trace.filter(e=>e.stage==='send'&&e.type==='RESYNC_MATCH').length,0);f.save('snapshot-first');
});

test('MP016 genuine frame disorder retains recovery rather than treating an old query as current',t=>{
 const f=setup(t,{mode:'sequence-gap'});f.prepare();f.n.submit(move);f.time.advance(1600);assert(f.trace.some(e=>e.stage==='resync-trigger'));assert(f.trace.some(e=>e.stage==='send'&&e.type==='RESYNC_MATCH'));assert.equal(f.trace.filter(e=>e.stage==='send'&&e.type==='SUBMIT_ACTION').length,1);assert.equal(f.n.matchRevision,1);f.save('sequence-gap');
});

test('MP016 refusal preserves authority and does not auto-resubmit',t=>{
 const f=setup(t);f.prepare();f.n.submit({...move,path:[{q:3,r:0}]});f.time.advance(1000);assert.equal(f.n.matchRevision,0);assert.deepEqual(f.n.playerView.units.find(u=>u.id==='mover').hex,{q:0,r:0});assert.equal(f.n.pendingAction,null);assert.equal(f.trace.filter(e=>e.stage==='send'&&e.type==='SUBMIT_ACTION').length,1);f.save('rejection');
});

test('MP016 disconnect in query wait keeps canonical snapshot but prevents selection/submission',t=>{
 const f=setup(t);f.prepare();f.n.submit(move);f.time.advance(400);f.socket.close();assert(!f.n.canSelect);assert(!f.n.interactive);assert.equal(f.n.pendingAction,null);f.n.submit(move);assert.equal(f.trace.filter(e=>e.stage==='send'&&e.type==='SUBMIT_ACTION').length,1);f.save('disconnect');
});

test('MP016 forced-decision scheduling waits for correlated current query (synthetic authorized frames)',t=>{
 const time=clock(t),h=gameHarness(()=>movementFixture()),p=createPresentationState(),sent=[],listeners=new Set();
 const snapshot=structuredClone(h.a.last('PLAYER_VIEW_SNAPSHOT').payload);
 snapshot.view.phase='GERMAN_COMBAT';snapshot.model.phase='GERMAN_COMBAT';
 snapshot.view.pendingDecision={kind:'ADVANCE_AFTER_COMBAT',battleId:'fixture-battle',decisionOwnerControllerId:snapshot.model.viewerControllerId,side:'GERMAN'};
 snapshot.forcedAction={type:'PASS_ADVANCE',battleId:'fixture-battle'};
 const state={snapshot,connection:'CONNECTED',synced:true,pending:false,error:null};
 const c={state,get canMutate(){return !state.pending;},subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},send(type,payload){const id='forced-'+sent.length;sent.push({type,payload,id});state.pending=true;return id;},resyncMatch(){throw Error('unexpected resync');},dispose(){}};
 const n=new NetworkPlayerSession(c,p,kind=>{if(kind!=='status')n.requestProjection();});t.after(()=>n.dispose());
 const emit=m=>{if(m.requestId===sent.at(-1)?.id)state.pending=false;for(const fn of listeners)fn(m);};
 emit(serverMessage('PLAYER_VIEW_SNAPSHOT',{...snapshot,matchRevision:1,serverSequence:n.serverSequence+1}));
 assert.equal(sent.length,0);time.advance(0);assert.equal(sent.length,1);assert.equal(sent[0].type,'QUERY_MATCH');assert(!n.interactive);
 const reply={matchId:snapshot.matchId,matchRevision:1,model:snapshot.model,forcedAction:snapshot.forcedAction};
 emit(serverMessage('MATCH_QUERY',{...reply,serverSequence:n.serverSequence+1},'unrelated'));time.advance(0);assert.equal(sent.length,1);
 emit(serverMessage('MATCH_QUERY',{...reply,serverSequence:n.serverSequence+1},sent[0].id));time.advance(0);assert.equal(sent.length,2);assert.equal(sent[1].type,'SUBMIT_ACTION');assert.deepEqual(sent[1].payload.action,snapshot.forcedAction);assert.equal(sent[1].payload.expectedRevision,1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {gameHarness} from './helpers/mp002.mjs';
import {movementFixture} from './helpers/move001.mjs';

// Real authority, codec, LobbyClient and NetworkPlayerSession; deterministic virtual timers.
// Fault injection is outside production code: one old snapshot can be delivered after recovery.
globalThis.location={search:'?transportDiagnostics=1'};
globalThis.window=new EventTarget();
globalThis.sessionStorage={getItem(){return null;},setItem(){}};
const root=process.env.MP009_CLIENT_DIST??'dist/app';
const load=p=>import(pathToFileURL(resolve(root,p)).href);
const {LobbyClient}=await load('multiplayer/client.js');
const {NetworkPlayerSession}=await load('multiplayer/networkSession.js');
const {createPresentationState}=await load('state/presentation.js');
for(const mode of ['fifo','second-snapshot-after-resync'])test(`MP009R1 recovery trace ${mode}`,t=>{
 t.mock.timers.enable({apis:['setTimeout','Date'],now:0});t.mock.method(performance,'now',()=>Date.now());
 const trace=[],h=gameHarness(()=>movementFixture()),peer=h.a,presentation=createPresentationState();
 let n,client,actionCount=0,until=0,receiving=null,generatedIndex=0;const jobs=[];
 const metadata=m=>({type:m.messageType,requestId:m.requestId,revision:m.payload.matchRevision??null,sequence:m.payload.serverSequence??null,resync:m.payload.resync??false});
 const log=(stage,data={})=>trace.push({at:Date.now(),...data,stage});
 const deliver=m=>{receiving=m;log('receive',metadata(m));Socket.last.onmessage({data:JSON.stringify(m)});receiving=null;};
 function outbound(message){
  const m=JSON.parse(JSON.stringify(message)),index=++generatedIndex;log('server-generated',{index,...metadata(m)});
  if(m.messageType==='ACTION_ACCEPTED')until=Date.now()+12000;
  let delay=m.messageType==='ACTION_ACCEPTED'?1800:('serverSequence' in m.payload?Math.max(0,until-Date.now()):0);
  const race=mode==='second-snapshot-after-resync'&&actionCount===2;
  // Model the legacy fixture's independent timer race deterministically; never relabel sequence.
  if(race&&m.messageType==='PLAYER_VIEW_SNAPSHOT'&&!m.payload.resync)delay+=1;
  const job={ready:false,m};jobs.push(job);log('fixture-scheduled',{index,due:Date.now()+delay,...metadata(m)});
  setTimeout(()=>{job.ready=true;if(race){jobs.splice(jobs.indexOf(job),1);deliver(m);}else while(jobs[0]?.ready)deliver(jobs.shift().m);},delay);
 }
 class Socket {
  static OPEN=1;static CONNECTING=0;readyState=1;
  constructor(){Socket.last=this;}
  send(raw){const m=JSON.parse(raw);log('send',{type:m.messageType,requestId:m.requestId,expectedRevision:m.payload.expectedRevision??null,action:m.payload.action?.type??null});
   if(m.messageType==='HELLO')return;
   if(m.messageType==='SUBMIT_ACTION')actionCount++;
   const start=peer.messages.length;h.authority.receive(peer.connectionId,raw);for(const reply of peer.messages.slice(start))outbound(reply);
  }
  close(){this.readyState=3;this.onclose?.();}
 }
 globalThis.WebSocket=Socket;
 const timing=e=>log('client-timing',{...e.detail,timingStage:e.detail.stage});window.addEventListener('eastfront-action-timing',timing);
 client=new LobbyClient('ws://local-replay',()=>{},'snapshot-v2-inline-view');
 t.after(()=>{n?.dispose();window.removeEventListener('eastfront-action-timing',timing);});
 client.connect('replay');Socket.last.onopen();const hello=trace.find(x=>x.stage==='send'&&x.type==='HELLO');
 deliver({...peer.last('WELCOME'),requestId:hello.requestId,payload:{...peer.last('WELCOME').payload,battleSummary:undefined}});
 t.mock.timers.tick(0);client.state.match=peer.last('MATCH_CREATED').payload;client.state.synced=true;deliver(peer.last('PLAYER_VIEW_SNAPSHOT'));
 assert(client.state.snapshot,JSON.stringify({error:client.state.error,connection:client.state.connection,format:client.snapshotFormat,trace}));
 n=new NetworkPlayerSession(client,presentation,kind=>{log('session-change',{kind,sequence:n.serverSequence,revision:n.matchRevision,syncing:n.syncing});if(kind!=='status')n.requestProjection(presentation);});
 const resync=n.resync.bind(n);n.resync=()=>{
  log('resync-trigger',{reason:receiving?'ordered-frame-check':'snapshot-deadline',expectedSequence:n.serverSequence+1,currentRevision:n.matchRevision,syncing:n.syncing,...(receiving?metadata(receiving):{})});return resync();
 };
 for(const action of [{type:'MOVE',unitId:'mover',path:[{q:-1,r:0}]},{type:'MOVE',unitId:'far',path:[{q:2,r:0}]}]){
  assert(n.interactive);n.submit(action);t.mock.timers.tick(1800);t.mock.timers.tick(8200);t.mock.timers.tick(2000);t.mock.timers.tick(1);t.mock.timers.tick(1);
  assert(n.interactive,'all recovery/query responses consumed');
 }
 const recovery=trace.filter(x=>x.stage==='send'&&x.type==='RESYNC_MATCH'),actions=trace.filter(x=>x.stage==='send'&&x.type==='SUBMIT_ACTION');
 assert.equal(recovery.length,mode==='fifo'?2:3);assert.equal(actions.length,2,'never automatically resend an action');assert.equal(n.matchRevision,2);
 assert.deepEqual(n.playerView.units.find(u=>u.id==='mover').hex,{q:-1,r:0});assert.deepEqual(n.playerView.units.find(u=>u.id==='far').hex,{q:2,r:0});
 if(process.env.MP009_TRACE_DIR){mkdirSync(process.env.MP009_TRACE_DIR,{recursive:true});writeFileSync(resolve(process.env.MP009_TRACE_DIR,mode+'.json'),JSON.stringify({client:root,mode,clock:'virtual milliseconds; original 10000 ms deadline retained',transport:'serialized in-process WebSocket adapter; real authority/client/codec, no browser or compression emulation',actionCount:actions.length,resyncCount:recovery.length,trace},null,2)+'\n');}
});

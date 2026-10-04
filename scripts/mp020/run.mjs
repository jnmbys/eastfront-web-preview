import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {WebSocket} from 'ws';
import {queryMetrics} from './analyze.mjs';
import {frameMetadata} from '../mp0041/frame-metadata.mjs';
const [directory,root='.server-dist',diagnostics='on',delayArg='0',renderArg='0',countArg='5']=process.argv.slice(2);
if(!directory)throw Error('Usage: node scripts/mp020/run.mjs <NEW output dir> [server root] [on|off] [inbound delay ms] [render busy ms] [count]');
const out=resolve(directory),allowed=resolve('evidence/mp-020');
if(!out.startsWith(allowed+ '\\')&&!out.startsWith(allowed+'/'))throw Error('Output must be a new child of evidence/mp-020');
mkdirSync(allowed,{recursive:true});mkdirSync(out);
const save=(p,v)=>writeFileSync(join(out,p),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const delay=Number(delayArg),renderMs=Number(renderArg),count=Number(countArg);
assert([delay,renderMs,count].every(Number.isFinite)&&delay>=0&&delay<=1000&&renderMs>=0&&renderMs<=200&&count>=1&&count<=20);
globalThis.location={search:'?transportDiagnostics=1'};
globalThis.window=new EventTarget();globalThis.sessionStorage={getItem(){return null;},setItem(){}};
// Actual ws connection; optional ordered callback delay is explicitly synthetic.
class BrowserSocket extends WebSocket {
 frames=[];
 constructor(url){super(url,{origin:'http://127.0.0.1'});this.once('open',()=>this._socket.prependListener('data',frameMetadata(row=>this.frames.push(row))));}
 set onmessage(fn){super.onmessage=e=>{
  const frame=this.frames.shift(),message=JSON.parse(String(e.data));
  if(message.messageType==='MATCH_QUERY')current.push({event:'wire',requestId:message.requestId,at:performance.now(),bytes:frame?.bytes??null,rsv1:frame?.rsv1??null,frames:frame?.frames??null});
  delay?setTimeout(()=>fn(e),delay):fn(e);
 };}
}
globalThis.WebSocket=BrowserSocket;
const {LobbyClient}=await import('../../dist/app/multiplayer/client.js');
const {NetworkPlayerSession}=await import('../../dist/app/multiplayer/networkSession.js');
const {createPresentationState}=await import('../../dist/app/state/presentation.js');
const {queryDraft}=await import('../../dist/app/multiplayer/gameplayProtocol.js');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){const end=performance.now()+15000;while(!fn()){if(performance.now()>end)throw Error('Local fixture timeout');await sleep(2);}}
const child=fork('scripts/mp020/local-server.mjs',[resolve(root),diagnostics],{windowsHide:true,stdio:['ignore','ignore','pipe','ipc']});
// Never export stderr or server payloads; errors fail the run without private data.
let childError=false;child.stderr.on('data',()=>{childError=true;});
const next=type=>new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(Error('Child timeout: '+type)),20000),message=m=>{if(m.type===type){clearTimeout(timer);child.off('message',message);ok(m);}};child.on('message',message);child.once('error',fail);});
const ready=await next('ready'),samples=[],clients=[],allEvents=[];
let current=[];
const onAction=e=>{const {clientTimestamp,...data}=e.detail;current.push({event:'action',...data});};
const onTransport=e=>current.push({event:'transport',...e.detail});
window.addEventListener('eastfront-action-timing',onAction);window.addEventListener('eastfront-transport-timing',onTransport);
const hash=model=>{const value=structuredClone(model);if(value.battleSummaries)delete value.battleSummaries.matchId;return createHash('sha256').update(JSON.stringify(value)).digest('hex');};
try{
 for(let i=0;i<count;i++){
  current=[];
  const a=new LobbyClient(`ws://127.0.0.1:${ready.port}/ws`,()=>{},'snapshot-v3-map-table'),b=new LobbyClient(`ws://127.0.0.1:${ready.port}/ws`,()=>{},'snapshot-v3-map-table');clients.push(a,b);
  a.connect('Local A');b.connect('Local B');await until(()=>a.canMutate&&b.canMutate);
  async function send(c,type,payload={}){assert(c.send(type,payload));await until(()=>c.canMutate);}
  await send(a,'CREATE_ROOM');await send(b,'JOIN_ROOM',{roomCode:a.state.room.roomCode});await send(a,'SELECT_SEAT',{seat:'GERMANY'});await send(b,'SELECT_SEAT',{seat:'SOVIET'});await send(a,'SET_READY',{ready:true});await send(b,'SET_READY',{ready:true});await until(()=>a.state.snapshot&&b.state.snapshot);
  const p=createPresentationState();let n;
  n=new NetworkPlayerSession(a,p,kind=>{if(kind!=='status'){n.requestProjection();if(kind==='view'&&renderMs){const end=performance.now()+renderMs;current.push({event:'render',stage:'start',at:performance.now()});while(performance.now()<end){}current.push({event:'render',stage:'end',at:performance.now()});}}});
  p.selectedUnitId='G-I-01';p.interactionMode='MOVE_PATH';p.pathDraft=[{q:1,r:1}];n.requestProjection();await until(()=>n.interactive);
  assert(n.model.movement&&!n.model.movement.issues.length);current=[];
  const revision=n.matchRevision,action={type:'MOVE',unitId:'G-I-01',path:[{q:1,r:1}]};
  n.submit(action);n.submit(action);assert.equal(n.matchRevision,revision);assert(!n.interactive);
  await until(()=>n.matchRevision===revision+1&&n.interactive);await sleep(20);
  assert.equal(n.pendingAction,null);assert(n.legalOptionsReady);assert(n.canSelect);
  assert.deepEqual(n.playerView.units.find(u=>u.id==='G-I-01').hex,{q:1,r:1});
  const events=current.slice(),queries=events.filter(e=>e.stage==='send'&&e.type==='QUERY_MATCH');
  assert.equal(queries.length,1);assert.equal(events.filter(e=>e.stage==='send'&&e.type==='SUBMIT_ACTION').length,1);assert.equal(events.filter(e=>e.stage==='send'&&e.type==='RESYNC_MATCH').length,0);
  const applied=events.find(e=>e.stage==='snapshot-applied');assert(applied);
  const resultDigest=hash(n.model);
  const id=b.send('QUERY_MATCH',{matchId:b.state.snapshot.matchId,expectedRevision:revision+1,draft:queryDraft(createPresentationState())});
  // Complete default presentation draft; compare assertions, never export model.
  let opposing;const unsub=b.subscribe(m=>{if(m?.requestId===id&&m.messageType==='MATCH_QUERY')opposing=m.payload.model;});
  await until(()=>opposing);unsub();assert.equal(opposing.readOnly,true);assert.equal(opposing.movement,null);assert.equal(opposing.playerView.viewer,'SOVIET');
  samples.push({sample:i+1,kind:delay||renderMs?'artificial-delay':'local-loopback',queryRequestId:queries[0].requestId,actionAppliedAt:applied.at,authorizedResultSha256:resultDigest,queryCount:1,actionCount:1,resyncCount:0,recovered:true,opponentReadOnly:true});
  allEvents.push(...events);n.dispose();b.dispose();await sleep(30);
 }
 const done=next('done');child.send({type:'finish'});const server=await done;assert(!childError,'Child emitted an error');
 save('client.json',allEvents);save('server.json',server.rows);
 const results=samples.map(s=>({...s,wire:allEvents.find(e=>e.event==='wire'&&e.requestId===s.queryRequestId)??null,timing:queryMetrics(s.queryRequestId,allEvents,server.rows)}));
 save('results.json',{codeBaseline:'a7dfdd9c57400c6a856186a70d8fb71b118b02dc',evidenceBaseline:'2a1b784ce11963380605e20d3aff57cd87fb8685',serverRoot:root,diagnostics,clock:'two independent process monotonic clocks; only same-process differences',delay,renderMs,count,scenario:'exact MP017 move scenario, seed 17; Node real WS + real client/session/authority/Core, NOT browser/device',serverSourceSha256:Object.fromEntries(['runtime','authority','latencyDiagnostics'].map(p=>[p,createHash('sha256').update(readFileSync(join(root,'server',p+'.js'))).digest('hex')])),samples:results});
 console.log(JSON.stringify({out,samples:results.map(s=>({sample:s.sample,wait:s.timing.client.sendToReceiveMs,server:s.timing.server.receiveToHandoffMs,compute:s.timing.server.queryModelMs,bytes:s.timing.server.serializedBytes,unknown:s.timing.unknownResidualMs}))}));
}catch(error){save('failure.json',{reason:error.message,clientMetadata:current});throw error;
}finally{for(const c of clients)c.dispose();window.removeEventListener('eastfront-action-timing',onAction);window.removeEventListener('eastfront-transport-timing',onTransport);if(child.connected)child.kill();}

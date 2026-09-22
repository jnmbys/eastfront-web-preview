// Same production main/renderer workload for baseline and candidate. This is NOT
// a browser: software DOM excludes layout, paint, PNG encoding and device latency.
import {cpSync,mkdtempSync,symlinkSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir,cpus} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {WebSocket as Wire} from 'ws';
import {deploymentDom} from '../tests/helpers/deployment-dom.mjs';
import {RoomAuthority} from '../.server-dist/server/authority.js';
import {createMultiplayerServer} from '../.server-dist/server/runtime.js';
import {DEFAULTS} from '../.server-dist/server/config.js';
const source=resolve(process.argv[2]??'.'),output=process.argv[3];
const temp=mkdtempSync(join(tmpdir(),'eastfront-perf002-'));
cpSync(join(source,'dist/app'),join(temp,'app'),{recursive:true});
symlinkSync(join(source,'dist/vendor'),join(temp,'vendor'));
writeFileSync(join(temp,'package.json'),'{"type":"module"}');
const instrument={'player-view/playerView.js':['derivePlayerView'],'core-adapter/browserProjection.js':['deriveBrowserRenderModel'],'fog/surface.js':['deriveFogPlan','rasterizeFog'],'render/coreSvg.js':['coreSvgDynamicMarkup','coreSvgOverlayMarkup'],'ui/commandPresentation.js':['deploymentLocations']};
for(const [file,names] of Object.entries(instrument)){
 let code=readFileSync(join(temp,'app',file),'utf8');
 for(const name of names){const declaration=`export function ${name}(`;assert(code.includes(declaration),file+name);code=code.replace(declaration,`function _timed_${name}(`);code+=`\nexport function ${name}(...args){const p=globalThis.__perf002;if(!p)return _timed_${name}(...args);const start=performance.now();try{return _timed_${name}(...args);}finally{p.calls['${name}']=(p.calls['${name}']??0)+1;p.ms['${name}']=(p.ms['${name}']??0)+performance.now()-start;}}\n`;}
 writeFileSync(join(temp,'app',file),code);
}
const load=p=>import(pathToFileURL(join(temp,'app',p)).href);
const sessionApi=await load('core-adapter/session.js'),{createPresentationState}=await load('state/presentation.js');
const {deriveBrowserRenderModel}=await load('multiplayer/playerSession.js');
const {LobbyClient}=await load('multiplayer/client.js'),{NetworkPlayerSession}=await load('multiplayer/networkSession.js');
const map=JSON.parse(readFileSync(join(source,'vendor/eastfront-digital-core/reference/strategic-reset-f-map.json')));
const rows=[],warmups=[],newTrace=()=>({calls:{},ms:{},refreshes:[],responses:[]});
let active=null;
function activate(trace){active=trace;globalThis.__perf002=trace;}
function measure(name,fn){const trace=active,start=performance.now();try{return fn();}finally{if(trace){trace.calls[name]=(trace.calls[name]??0)+1;trace.ms[name]=(trace.ms[name]??0)+performance.now()-start;}}}
async function ui(s,p){
 let h;
 h=await deploymentDom(s,p,{dist:join(temp,'app'),measure:(name,fn)=>{
  if(!h||name!=='refreshDynamicView')return measure(name,fn);
  const trace=active,before=h.root.querySelectorAll('*'),units=h.unitNodes(),presences=h.root.querySelectorAll('[data-presence-id]'),created=h.root.ownerDocument.created,fog=h.fog.buildCount,start=performance.now();
  const result=measure(name,fn);
  if(trace){const after=new Set(h.root.querySelectorAll('*')),remaining=new Set(h.unitNodes());trace.refreshes.push({durationMs:performance.now()-start,createdNodes:h.root.ownerDocument.created-created,removedNodes:before.filter(n=>!after.has(n)).length,unitNodesCreated:h.unitNodes().filter(n=>!units.includes(n)).length,unitNodesRemoved:units.filter(n=>!remaining.has(n)).length,unitNodesReused:units.filter(n=>remaining.has(n)).length,presenceNodesRemoved:presences.filter(n=>!after.has(n)).length,fogBuilds:h.fog.buildCount-fog,terrainBuilds:0});}
  return result;
 }});return h;
}
function save(mode,index,start,trace,extra={}){activate(null);(index<2?warmups:rows).push({mode,index,elapsedMs:performance.now()-start,...extra,...trace});}
const local=sessionApi.createLocalGameSession(map,8246),p=createPresentationState(),localUi=await ui(local,p);
const apply=local.engine.apply.bind(local.engine);local.engine.apply=(...args)=>measure('rulesApply',()=>apply(...args));
for(let i=0;i<12;i++){
 const model=deriveBrowserRenderModel(local,p),row=model.deployment.roster[i],key=model.deployment.zoneKeys[i];
 localUi.select(row.id,key);const trace=newTrace(),start=performance.now();activate(trace);
 localUi.click('#confirm-deployment');save('local',i,start,trace,{submitTaskMs:performance.now()-start});
 assert(local.lastResult.accepted);assert.equal(Object.keys(local.state.units).length,i+1);
 assert.equal(localUi.unitNodes().length,i+1);
}
localUi.dispose();
globalThis.window=new EventTarget();globalThis.sessionStorage={getItem(){return null;},setItem(){},removeItem(){}};
const sends=[],serverSamples=[],sockets=[],checks={};let currentActor=null,currentWaiter=null;
class BrowserSocket extends Wire {
 constructor(url){super(url,{origin:DEFAULTS.allowedOrigins[0]});sockets.push(this);}
 send(raw){const m=JSON.parse(raw);sends.push({type:m.messageType,requestId:m.requestId,sentAt:performance.now()});super.send(raw);}
 set onmessage(fn){super.onmessage=e=>{
  const m=JSON.parse(String(e.data)),trace=this.actor?currentActor:currentWaiter,received=performance.now();activate(trace);
  try{fn(e);}finally{if(trace)trace.responses.push({type:m.messageType,revision:m.payload.matchRevision,applyMs:performance.now()-received,rttMs:this.actor&&m.requestId?sends.findLast(s=>s.requestId===m.requestId)?.sentAt:null});activate(null);}
  if(trace){const last=trace.responses.at(-1);if(last.rttMs!==null)last.rttMs=received-last.rttMs;}
 };}
}
globalThis.WebSocket=BrowserSocket;
const config={...DEFAULTS,port:0,messagesPerWindow:10000},authority=new RoomAuthority(config),original=authority.receive.bind(authority);
authority.receive=(id,raw)=>{const m=JSON.parse(raw),start=performance.now();original(id,raw);if(m.messageType==='SUBMIT_ACTION')serverSamples.push(performance.now()-start);};
const server=createMultiplayerServer(config,authority),port=await server.listen();
const wait=async(fn)=>{const start=performance.now();while(!fn()){if(performance.now()-start>15000)throw Error('Harness deadline');await new Promise(r=>setTimeout(r,2));}};
function peer(){const presentation=createPresentationState();let session,dom;const client=new LobbyClient(`ws://127.0.0.1:${port}/ws`,()=>{if(!session&&client.state.snapshot)session=new NetworkPlayerSession(client,presentation,k=>dom?.change(k));});client.connect('PERF002 fixture');return {client,presentation,get session(){return session;},set dom(h){dom=h;},get dom(){return dom;}};}
const a=peer(),b=peer();
try{
 await wait(()=>a.client.canMutate&&b.client.canMutate);a.client.send('CREATE_ROOM',{});await wait(()=>a.client.state.room);b.client.send('JOIN_ROOM',{roomCode:a.client.state.room.roomCode});await wait(()=>b.client.state.room);
 a.client.send('SELECT_SEAT',{seat:'GERMANY'});await wait(()=>a.client.canMutate);b.client.send('SELECT_SEAT',{seat:'SOVIET'});await wait(()=>b.client.canMutate);a.client.send('SET_READY',{ready:true});await wait(()=>a.client.canMutate);b.client.send('SET_READY',{ready:true});await wait(()=>a.session?.ready&&b.session?.interactive);
 a.dom=await ui(a.session,a.presentation);b.dom=await ui(b.session,b.presentation);
 // Label the controller socket without recording identity or tokens.
 const originalSend=BrowserSocket.prototype.send;BrowserSocket.prototype.send=function(raw){if(JSON.parse(raw).messageType==='SUBMIT_ACTION')this.actor=true;return originalSend.call(this,raw);};
 for(let i=0;i<12;i++){
  const model=b.session.renderModel(),row=model.deployment.roster[i],key=model.deployment.zoneKeys[i],revision=b.session.matchRevision;
  b.dom.select(row.id,key);const start=performance.now(),sent=sends.length;currentActor=newTrace();currentWaiter=newTrace();activate(currentActor);
  const button=b.dom.document.querySelector('#confirm-deployment');
  b.dom.click('#confirm-deployment');button.fire('click');const submitTaskMs=performance.now()-start;activate(null);
  assert.equal(b.dom.unitNodes().length,i,'no optimistic unit before the authoritative snapshot');
  assert.equal(sends.slice(sent).filter(s=>s.type==='SUBMIT_ACTION').length,1,'double click sends once');
  await wait(()=>b.session.matchRevision===revision+1&&a.session.matchRevision===revision+1&&b.session.interactive);
  save('network-actor',i,start,currentActor,{submitTaskMs,serverProcessingMs:serverSamples.at(-1),requests:sends.slice(sent).map(s=>s.type)});
  save('network-waiter',i,start,currentWaiter);
  currentActor=null;currentWaiter=null;
  assert.equal(a.session.playerView.units.length,0);assert.equal(b.session.playerView.units.length,i+1);assert.equal(b.dom.unitNodes().length,i+1);assert.equal(a.dom.unitNodes().length,0);
  assert.equal(a.session.playerView.phase,b.session.playerView.phase);
  assert.deepEqual(b.session.playerView.units.find(u=>u.id===row.id).hex,Object.fromEntries(['q','r'].map((k,j)=>[k,Number(key.split(',')[j])])));
 }
 // Outside measured samples: reconnect exercises the actual presentation cache
 // clearing path, without replaying stale animations or losing the current view.
 const revision=b.session.matchRevision,oldGrid=b.dom.document.querySelector('.location-grid');
 sockets.find(s=>s.actor&&s.readyState===Wire.OPEN).terminate();
 await wait(()=>a.session.status==='WAITING_FOR_RECONNECT');assert.equal(b.session.matchRevision,revision);
 await wait(()=>b.session.status==='ACTIVE'&&b.session.interactive&&sockets.length===3);
 assert.equal(b.session.matchRevision,revision);assert.notEqual(b.dom.document.querySelector('.location-grid'),oldGrid);assert.equal(a.session.playerView.units.length,0);
 const m=b.session.renderModel(),row=m.deployment.roster[12],key=m.deployment.zoneKeys[12];b.dom.select(row.id,key);b.dom.click('#confirm-deployment');
 await wait(()=>b.session.matchRevision===revision+1&&a.session.matchRevision===revision+1&&b.session.interactive);
 assert.equal(b.dom.unitNodes().length,13);checks.reconnectContinue=true;checks.duplicateClickOneSubmission=true;checks.noOptimisticUnit=true;checks.revisionsPhasesAndPrivacy=true;
 assert.equal(sends.filter(s=>s.type==='QUERY_MATCH'||s.type==='RESYNC_MATCH').length,0);
}finally{a.dom?.dispose();b.dom?.dispose();a.session?.dispose();b.session?.dispose();await server.close();}
const median=xs=>{const a=[...xs].sort((a,b)=>a-b),m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;},stats=xs=>({median:median(xs),max:Math.max(...xs)});
const summary=Object.fromEntries(['local','network-actor','network-waiter'].map(mode=>{
 const rs=rows.filter(r=>r.mode===mode),stages=[...new Set(rs.flatMap(r=>Object.keys(r.ms)))];
 return [mode,{samples:rs.length,elapsedMs:stats(rs.map(r=>r.elapsedMs)),synchronousRefreshMs:stats(rs.flatMap(r=>r.refreshes.map(x=>x.durationMs))),refreshCount:stats(rs.map(r=>r.refreshes.length)),stages:Object.fromEntries(stages.map(k=>[k,{ms:stats(rs.map(r=>r.ms[k]??0)),calls:stats(rs.map(r=>r.calls[k]??0))}])),dom:Object.fromEntries(['createdNodes','removedNodes','unitNodesCreated','unitNodesRemoved','unitNodesReused','presenceNodesRemoved','fogBuilds','terrainBuilds'].map(k=>[k,stats(rs.map(r=>r.refreshes.reduce((sum,x)=>sum+x[k],0)))])),networkRttMs:rs.flatMap(r=>r.responses.filter(x=>x.type==='ACTION_ACCEPTED'&&x.rttMs!==null).map(x=>x.rttMs)),serverProcessingMs:rs.map(r=>r.serverProcessingMs).filter(x=>x!==undefined),earlySyncMs:stats(rs.slice(0,5).map(r=>r.ms.refreshDynamicView??0)),lateSyncMs:stats(rs.slice(5).map(r=>r.ms.refreshDynamicView??0))}];
}));
for(const [mode,s] of Object.entries(summary)){
 const callbacks=rows.filter(r=>r.mode===mode).map(r=>Math.max(r.submitTaskMs??0,...r.responses.map(v=>v.applyMs)));
 s.longestSynchronousSoftwareCallbackMs=stats(callbacks);
}
const report={environment:{node:process.version,cpu:cpus()[0]?.model,dom:'Counted software SVG/HTML DOM executing production main handlers; no browser layout/paint/PNG encode',modelMode:'auto',lod:'medium',camera:{zoom:1.8,panX:94,panY:-61},terrain:'already mounted static layer; terrain initialization excluded',warmupDeploymentsPerMode:2,measuredDeploymentsPerMode:10,transport:'real loopback WebSockets; no simulated link delay; same-process server',clock:'performance.now() per process; RTT client send to ACK receive; no cross-clock one-way calculation',longestBrowserTask:null,presentedFrameIntervals:null,confirmationToPixels:null,confirmationToDomAndControlsProxy:'elapsedMs (software only; network includes both viewers and polling)'},summary,warmups,rows,privacy:'waiting viewer units/DOM remained empty; no state/token/payload logging',queries:sends.filter(s=>s.type==='QUERY_MATCH').length,resyncs:sends.filter(s=>s.type==='RESYNC_MATCH').length};
report.checks=checks;
report.runtimeSha256=Object.fromEntries(['main.js','render/coreSvg.js','render/dynamicMap.js','ui/commandPresentation.js','multiplayer/client.js','multiplayer/networkSession.js','render/terrainSurface.js'].map(p=>[p,createHash('sha256').update(readFileSync(join(source,'dist/app',p))).digest('hex')]));
if(output)writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(summary,null,2));rmSync(temp,{recursive:true,force:true});

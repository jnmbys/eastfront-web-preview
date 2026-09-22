// Real loopback WebSockets with explicit link delay. No browser/device claims.
import {WebSocket as Wire} from 'ws';
import {writeFileSync} from 'node:fs';
import {cpus,arch} from 'node:os';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {RoomAuthority} from '../.server-dist/server/authority.js';
import {createMultiplayerServer} from '../.server-dist/server/runtime.js';
import {DEFAULTS} from '../.server-dist/server/config.js';
import {createPresentationState} from '../dist/app/state/presentation.js';
import {chooseDeploymentTarget,createDeploymentTouch} from '../dist/app/ui/deploymentTouch.js';
import {DynamicMapRenderer} from '../dist/app/render/dynamicMap.js';
import {svgDom} from '../tests/helpers/performance-dom.mjs';
import assert from 'node:assert/strict';
// Set MP003_CLIENT_DIST to an unmodified baseline build's dist/app directory
// to repeat the identical workload and server instrumentation before the fix.
const clientRoot=process.env.MP003_CLIENT_DIST;
const clientModule=name=>clientRoot?pathToFileURL(resolve(clientRoot,`multiplayer/${name}.js`)):new URL(`../dist/app/multiplayer/${name}.js`,import.meta.url);
const {LobbyClient}=await import(clientModule('client'));
const {NetworkPlayerSession}=await import(clientModule('networkSession'));
const delay=Number(process.env.MP003_DELAY_MS??150),samples=Number(process.env.MP003_SAMPLES??5),out=process.argv[2];
const requests=[],responses=[],serverSamples=[],rows=[],timers=new Set();
const later=(fn,ms)=>{const t=setTimeout(()=>{timers.delete(t);fn();},ms);timers.add(t);};
globalThis.window=new EventTarget();globalThis.sessionStorage={getItem(){return null;},setItem(){},removeItem(){}};
class BrowserWire {
 static OPEN=Wire.OPEN;static CONNECTING=Wire.CONNECTING;
 constructor(url){this.wire=new Wire(url,{origin:DEFAULTS.allowedOrigins[0]});this.wire.on('open',()=>this.onopen?.());this.wire.on('error',()=>this.onerror?.());this.wire.on('close',()=>this.onclose?.());this.wire.on('message',data=>{
  const raw=data.toString();later(()=>{const receivedAt=performance.now(),m=JSON.parse(raw),r=requests.find(r=>r.requestId===m.requestId);this.onmessage?.({data:raw});responses.push({messageType:m.messageType,requestId:m.requestId,matchRevision:m.payload.matchRevision,serverSequence:m.payload.serverSequence,receivedAt,appliedAt:performance.now(),bytes:Buffer.byteLength(raw),rttMs:r?receivedAt-r.sentAt:null,applyAndSoftwareDomMs:performance.now()-receivedAt});},delay);
 });}
 get readyState(){return this.wire.readyState;}
 send(raw){const m=JSON.parse(raw);requests.push({messageType:m.messageType,requestId:m.requestId,expectedRevision:m.payload.expectedRevision,sentAt:performance.now()});later(()=>{if(this.wire.readyState===Wire.OPEN)this.wire.send(raw);},delay);}
 close(){this.wire.close();}
}
globalThis.WebSocket=BrowserWire;
const authority=new RoomAuthority({...DEFAULTS,port:0,messagesPerWindow:10000});
const original=authority.receive.bind(authority);authority.receive=(id,raw)=>{const m=JSON.parse(raw),start=performance.now();original(id,raw);serverSamples.push({messageType:m.messageType,requestId:m.requestId,receivedAt:start,processingMs:performance.now()-start});};
const server=createMultiplayerServer({...DEFAULTS,port:0},authority),port=await server.listen();
const wait=async(test)=>{const start=performance.now();while(!test()){if(performance.now()-start>10000)throw Error('Harness deadline');await new Promise(r=>setTimeout(r,2));}};
function peer(){
 const p=createPresentationState(),touch=createDeploymentTouch(),root=svgDom('<svg id="eastfront-map"><g id="map-dynamic-layer"></g></svg>'),renderer=new DynamicMapRenderer();let n;
 const render=()=>{if(!n)return;n.requestProjection(p);renderer.update(root.querySelector('#map-dynamic-layer'),n.renderModel(),{debug:false,rendererMode:'production',staticTerrainSurface:true});};
 const client=new LobbyClient(`ws://127.0.0.1:${port}/ws`,()=>{if(!n&&client.state.snapshot){n=new NetworkPlayerSession(client,p,kind=>{if(kind!=='status')render();});render();}});
 client.connect('latency fixture');return {client,p,touch,render,get n(){return n;}};
}
const a=peer(),b=peer();
function record(operation,start,feedback,index){
 const end=performance.now(),req=requests.slice(index),during=responses.filter(r=>r.receivedAt>=start&&r.receivedAt<=end);
 const byType=Object.fromEntries(['QUERY_MATCH','SUBMIT_ACTION'].map(type=>{
  const ids=new Set(req.filter(r=>r.messageType===type).map(r=>r.requestId));
  return [type,{rttMs:during.filter(r=>ids.has(r.requestId)&&r.rttMs!==null).map(r=>r.rttMs),serverProcessingMs:serverSamples.filter(r=>ids.has(r.requestId)).map(r=>r.processingMs)}];
 }));
 rows.push({operation,localFeedbackMs:feedback,controlsReadyMs:end-start,requestCount:req.length,queries:req.filter(r=>r.messageType==='QUERY_MATCH').length,resyncs:req.filter(r=>r.messageType==='RESYNC_MATCH').length,firstSendQueueMs:req.length?req[0].sentAt-start:null,byType,
  snapshotsAppliedMs:during.filter(r=>r.messageType==='PLAYER_VIEW_SNAPSHOT').map(r=>r.appliedAt-start),responseApplyAndSoftwareDomMs:during.map(r=>r.applyAndSoftwareDomMs),
  queryApplyAndSoftwareDomMs:during.filter(r=>r.messageType==='MATCH_QUERY').map(r=>r.applyAndSoftwareDomMs),snapshotApplyAndSoftwareDomMs:during.filter(r=>r.messageType==='PLAYER_VIEW_SNAPSHOT').map(r=>r.applyAndSoftwareDomMs)});
}
try{
 await wait(()=>a.client.canMutate&&b.client.canMutate);a.client.send('CREATE_ROOM',{});await wait(()=>a.client.state.room);b.client.send('JOIN_ROOM',{roomCode:a.client.state.room.roomCode});await wait(()=>b.client.state.room);a.client.send('SELECT_SEAT',{seat:'GERMANY'});await wait(()=>a.client.canMutate);b.client.send('SELECT_SEAT',{seat:'SOVIET'});await wait(()=>b.client.canMutate);a.client.send('SET_READY',{ready:true});await wait(()=>a.client.canMutate);b.client.send('SET_READY',{ready:true});await wait(()=>a.n?.ready&&b.n?.interactive);await new Promise(r=>setTimeout(r,delay*2+50));
 for(let i=0;i<samples;i++){
  let start=performance.now(),index=requests.length;
  b.p.selectedDeploymentUnitId=b.n.model.deployment.roster[i+1].id;b.render();let feedback=performance.now()-start;
  await wait(()=>b.n.interactive);record('select-unit',start,feedback,index);
  start=performance.now();index=requests.length;const key=b.n.model.deployment.zoneKeys[i];assert(chooseDeploymentTarget(b.touch,b.n.renderModel(),b.p.selectedDeploymentUnitId,key));b.render();feedback=performance.now()-start;
  await wait(()=>b.n.interactive);record('select-position',start,feedback,index);
  start=performance.now();index=requests.length;const rev=b.n.matchRevision,unit=b.p.selectedDeploymentUnitId,[q,r]=key.split(',').map(Number);
  b.n.submit({type:'DEPLOY_INITIAL_UNIT',deploymentUnitId:unit,hex:{q,r}});b.render();feedback=performance.now()-start;
  await wait(()=>b.n.matchRevision===rev+1&&a.n.matchRevision===rev+1&&b.n.interactive&&a.n.ready);record('confirm-deployment',start,feedback,index);
  assert.equal(b.n.playerView.units.find(u=>u.id===unit).hex.q,q);assert.equal(a.n.playerView.units.length,0);assert.equal(a.n.playerView.phase,b.n.playerView.phase);
 }
 const median=xs=>{const s=[...xs].sort((a,b)=>a-b);return s.length?s[Math.floor(s.length/2)]:null;};
 const summary=Object.fromEntries(['select-unit','select-position','confirm-deployment'].map(operation=>{const rs=rows.filter(r=>r.operation===operation);return [operation,{samples:rs.length,localFeedbackMedianMs:median(rs.map(r=>r.localFeedbackMs)),controlsReadyMedianMs:median(rs.map(r=>r.controlsReadyMs)),requestCount:rs.reduce((s,r)=>s+r.requestCount,0),queries:rs.reduce((s,r)=>s+r.queries,0),resyncs:rs.reduce((s,r)=>s+r.resyncs,0),queueMedianMs:median(rs.map(r=>r.firstSendQueueMs).filter(x=>x!==null)),byType:Object.fromEntries(['QUERY_MATCH','SUBMIT_ACTION'].map(type=>[type,{rttMedianMs:median(rs.flatMap(r=>r.byType[type].rttMs)),serverProcessingMedianMs:median(rs.flatMap(r=>r.byType[type].serverProcessingMs))}])),snapshotsAppliedMedianMs:median(rs.flatMap(r=>r.snapshotsAppliedMs)),responseApplyAndSoftwareDomMedianMs:median(rs.flatMap(r=>r.responseApplyAndSoftwareDomMs))}];}));
 for(const [operation,s] of Object.entries(summary)){
  const rs=rows.filter(r=>r.operation===operation);
  s.queryApplyAndSoftwareDomMedianMs=median(rs.flatMap(r=>r.queryApplyAndSoftwareDomMs));
  s.snapshotApplyAndSoftwareDomMedianMs=median(rs.flatMap(r=>r.snapshotApplyAndSoftwareDomMs));
 }
 const tracked=new Set(['QUERY_MATCH','SUBMIT_ACTION','RESYNC_MATCH']);
 const result={environment:{runtime:process.version,platform:process.platform,architecture:arch(),cpu:cpus()[0]?.model,transport:'real loopback WebSockets',simulatedDelayPerDirectionMs:delay,browser:'none; production client/session with software DOM (no browser layout/paint)',server:'in-process production RoomAuthority, no hosting changes',clockMethod:'RTT and application intervals use client-local monotonic time; server processing uses server-local monotonic time. No cross-clock subtraction.'},summary,rows,messageTotals:Object.fromEntries([...new Set(requests.map(r=>r.messageType))].map(k=>[k,requests.filter(r=>r.messageType===k).length])),responseBytes:Object.fromEntries(['MATCH_QUERY','PLAYER_VIEW_SNAPSHOT'].map(k=>[k,median(responses.filter(r=>r.messageType===k).map(r=>r.bytes))])),trace:{clientSends:requests.filter(r=>tracked.has(r.messageType)),serverProcessing:serverSamples.filter(r=>tracked.has(r.messageType)),clientReceives:responses.filter(r=>['MATCH_QUERY','PLAYER_VIEW_SNAPSHOT','ACTION_ACCEPTED','ACTION_REJECTED'].includes(r.messageType))},privacy:'hidden Soviet deployment absent from German authorized view'};
 if(out)writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({summary,messageTotals:result.messageTotals,responseBytes:result.responseBytes},null,2));
}finally{a.n?.dispose();b.n?.dispose();a.client.dispose();b.client.dispose();for(const t of timers)clearTimeout(t);await server.close();}

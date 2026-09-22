import {observeTerrainBuild} from './app/render/terrainWork.js';
import {observeTerrainLoad} from './app/render/terrainLoadProgress.js';
const buildTimings=[],inputs=[],spans=[],network=[],longTasks=[],frameGaps=[],clicks=[],assets=[];
const clock=()=>performance.now();let pendingExport=false,loadedImages=0;
performance.setResourceTimingBufferSize(3000);
const report=document.createElement('pre');report.id='perf002-evidence';report.hidden=true;document.body.append(report);
const push=(array,value,max=512)=>{if(array.length<max)array.push(value);schedule();};
const resourceSummary=()=>{
 const groups={};for(const e of performance.getEntriesByType('resource')){
  const path=new URL(e.name,location.href).pathname;const kind=/\.(png|webp|jpe?g)$/i.test(path)?'images':path.endsWith('.json')?'json':path.endsWith('.js')?'modules':'other';
  const g=groups[kind]??={count:0,transferBytes:0,encodedBytes:0,firstStartMs:e.startTime,lastEndMs:0,totalOverlappingDurationMs:0,cachedOrUnreportedCount:0};
  g.count++;g.transferBytes+=e.transferSize||0;g.encodedBytes+=e.encodedBodySize||0;g.firstStartMs=Math.min(g.firstStartMs,e.startTime);g.lastEndMs=Math.max(g.lastEndMs,e.responseEnd);g.totalOverlappingDurationMs+=e.duration;if(!e.transferSize)g.cachedOrUnreportedCount++;
 }return groups;
};
function publish(){pendingExport=false;report.textContent=JSON.stringify({diagnosticOnly:true,userAgent:navigator.userAgent,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},clock:'performance.now; navigation-relative milliseconds',timeOrigin:performance.timeOrigin,buildTimings,inputs,spans,network,longTasks,frameGaps,clicks,assets,loadedImages,resources:resourceSummary(),boundaries:['requestAnimationFrame gaps are scheduling proxies, not presented pixels','No hidden payload, token, unit identity or GameState recorded','Resource durations can overlap; transferSize=0 may be cache or unreported','Image decode and GPU paint are not separately timed']});}
function schedule(){if(!pendingExport){pendingExport=true;setTimeout(publish,250);}}
function begin(name){const start=clock();let ended=false;return ()=>{if(!ended){ended=true;push(spans,{name,startMs:start,durationMs:clock()-start});}};}
export const trace={begin,async:async(name,fn)=>{const end=begin(name);try{return await fn();}finally{end();}},sync:(name,fn)=>{const end=begin(name);try{return fn();}finally{end();}}};
observeTerrainLoad(e=>{if(e.kind==='asset-complete'){loadedImages++;return;}push(assets,{kind:e.kind,total:e.total??null,atMs:clock()},128);});
try{new PerformanceObserver(list=>{for(const e of list.getEntries())push(longTasks,{startMs:e.startTime,durationMs:e.duration},128);}).observe({type:'longtask',buffered:true});}catch{}
try{new PerformanceObserver(()=>schedule()).observe({type:'resource',buffered:true});}catch{}
let lastFrame=null,frames=0;function frame(t){if(document.visibilityState==='visible'){if(lastFrame!==null&&t-lastFrame>50)push(frameGaps,{startMs:lastFrame,gapMs:t-lastFrame},128);lastFrame=t;}else lastFrame=null;if(++frames<36000)requestAnimationFrame(frame);}requestAnimationFrame(frame);
document.addEventListener('visibilitychange',()=>{lastFrame=null;});
document.addEventListener('click',event=>{const button=event.target instanceof Element?event.target.closest('button'):null;if(!button)return;const id=button.id;if(['new-game-button','multiplayer-button','mp-connect','mp-create','mp-join','mp-ready','confirm-deployment','restart-button'].includes(id))push(clicks,{control:id,atMs:clock()},128);},true);
const NativeWebSocket=window.WebSocket;
window.WebSocket=class extends NativeWebSocket{
 constructor(...args){super(...args);this.perfStart=clock();this.perfRequests=new Map();this.addEventListener('open',()=>push(network,{type:'OPEN',atMs:clock(),durationMs:clock()-this.perfStart}));this.addEventListener('message',event=>{
  try{const m=JSON.parse(String(event.data)),at=clock(),sent=this.perfRequests.get(m.requestId);const type=m.messageType;if(typeof type!=='string')return;
   const row={direction:'receive',type,atMs:at,bytes:typeof event.data==='string'?event.data.length:null};if(sent)row.sinceSendMs=at-sent.at;
   if(Number.isSafeInteger(m.payload?.matchRevision))row.revision=m.payload.matchRevision;
   if(type==='PLAYER_VIEW_SNAPSHOT'){row.format=m.payload.format;row.resync=m.payload.resync;row.status=m.payload.status;}
   push(network,row);if(['WELCOME','ACTION_ACCEPTED','ACTION_REJECTED','MATCH_QUERY'].includes(type))this.perfRequests.delete(m.requestId);
  }catch{}
 });this.addEventListener('close',()=>push(network,{type:'CLOSE',atMs:clock()}));}
 send(data){try{const m=JSON.parse(String(data));if(typeof m.messageType==='string'){const at=clock();if(this.perfRequests.size<256)this.perfRequests.set(m.requestId,{at,type:m.messageType});push(network,{direction:'send',type:m.messageType,atMs:at});}}catch{}return super.send(data);}
};
schedule();

observeTerrainBuild(t=>{push(buildTimings,{...t,atMs:clock()},256);});

document.addEventListener('pointerdown',e=>{push(inputs,{type:'pointerdown',atMs:clock(),eventLagMs:Math.max(0,clock()-e.timeStamp)},128)},true);
document.addEventListener('wheel',e=>{push(inputs,{type:'wheel',atMs:clock(),eventLagMs:Math.max(0,clock()-e.timeStamp)},128)},true);

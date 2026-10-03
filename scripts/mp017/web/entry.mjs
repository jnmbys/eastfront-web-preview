import {safePath,safeError,assetPath} from './trace-base.mjs';
import {ComparisonTimeline as Timeline} from './timeline.mjs';
import {installObserver} from './observer.mjs';
const version=location.pathname.split('/')[2],base=new URL('./',location.href).href;
const runId=crypto.randomUUID(),timeline=new Timeline();
let config,allowed=new Set(),stage='diagnostic-bootstrap',lastSession=null,input=null,context=null;
const sendTimes=new Map(),scopes=new Map();
const now=()=>performance.now();
const scope=s=>JSON.stringify([s.client.state.snapshot?.matchId,s.model.viewerControllerId]);
const emit=(kind,fields={})=>{try{timeline.event(kind,now(),fields);}catch{/* Observer cannot block gameplay. */}};
let startupReport=()=>null,publishTimer=null;
function publish(force=false){if(!force){if(publishTimer===null)publishTimer=setTimeout(()=>{publishTimer=null;publish(true);},250);return;}try{parent.postMessage({source:'MP017-DIAG',runId,version,sourceSha:config?.sourceSha??null,diagnosticSha256:config?.diagnosticSha256??null,scenario:location.pathname.split('/')[3],mode:location.pathname.split('/')[4],fixtureFault:config?.fault??'unknown',stage,report:timeline.report(),startup:startupReport()},location.origin);}catch{/* No effect on app. */}}
function failure(kind,error){emit(kind,{stage,...safeError(error,base,allowed)});publish(true);}
addEventListener('error',e=>{if(e.error)failure('uncaught-error',e.error);else{const path=safePath(e.target?.src??e.target?.href,base,allowed);emit('resource-element-error',{path});publish();}},true);
addEventListener('unhandledrejection',e=>failure('unhandled-rejection',e.reason));
addEventListener('message',e=>{if(e.source===parent&&e.origin===location.origin&&['MP017','MP017-DIAG'].includes(e.data?.source)&&['finish','export'].includes(e.data.type))publish(true);});
for(const event of ['offline','online','visibilitychange'])addEventListener(event,()=>{emit(event,{visible:document.visibilityState==='visible',online:navigator.onLine});publish();});
const originalError=console.error;
console.error=function(...args){if(args[0]==='EASTFRONT startup failed'){stage=['manifest/map','static-terrain-surface'].includes(args[1]?.phase)?args[1].phase:'startup-failed';failure('caught-startup-error',args[2]);}return originalError.apply(this,args);};
try{
  config=await (await fetch(`/mp017/config/${version}`)).json();allowed=new Set(config.paths);
  emit('build',{version,sourceSha:config.sourceSha,diagnosticSha256:config.diagnosticSha256,serviceWorkerControlled:!!navigator.serviceWorker?.controller,cachePolicy:'gateway no-store; resource sizes separately observed'});
  // Enable only the existing read-only transport observer before loading any app module.
  const url=new URL(location.href);url.searchParams.set('transportDiagnostics','1');history.replaceState(null,'',url);
  const originalFetch=window.fetch,responsePaths=new WeakMap();
  window.fetch=async function(...args){const path=safePath(args[0]?.url??args[0],base,allowed),at=now();try{const response=await originalFetch.apply(this,args);if(path){responsePaths.set(response,path);emit('fetch-headers',{path,startedAt:at,status:response.status,ok:response.ok});}return response;}catch(error){if(path){emit('fetch-failed',{path,startedAt:at,...safeError(error,base,allowed)});publish();}throw error;}};
  for(const method of ['json','text','blob','arrayBuffer']){const original=Response.prototype[method];Response.prototype[method]=async function(...args){const path=responsePaths.get(this),at=now();try{const value=await original.apply(this,args);if(path)emit('resource-body-ready',{path,method,startedAt:at});return value;}catch(error){if(path){emit('resource-body-failed',{path,method,startedAt:at,...safeError(error,base,allowed)});publish();}throw error;}};}
  try{new PerformanceObserver(list=>{for(const e of list.getEntries()){const path=safePath(e.name,base,allowed);if(path)emit('resource-timing',{path,startTime:e.startTime,responseStart:e.responseStart,responseEnd:e.responseEnd,duration:e.duration,transferSize:e.transferSize,encodedBodySize:e.encodedBodySize,decodedBodySize:e.decodedBodySize,status:Number.isFinite(e.responseStatus)?e.responseStatus:null,deliveryType:['cache','navigational-prefetch'].includes(e.deliveryType)?e.deliveryType:null});}}).observe({type:'resource',buffered:true});}catch{emit('resource-timing-unavailable');}
  const [{NetworkPlayerSession},{LobbyClient},{startupProgress},{startupDiagnosticReport}]=await Promise.all([
    import(new URL('app/multiplayer/networkSession.js',base)),import(new URL('app/multiplayer/client.js',base)),
    import(new URL('app/web/startupProgress.js',base)),import(new URL('app/web/startupDiagnostics.js',base))]);
  startupReport=()=>{
    const r=startupDiagnosticReport();
    return {build:r.build,online:r.online,visibility:r.visibility,imageJobs:r.imageJobs,recent:r.recent.map(x=>({file:assetPath(x.file,base,allowed),outcome:x.outcome,elapsedMs:x.elapsedMs,attempts:x.attempts.map(a=>Object.fromEntries(['path','elapsedMs','outcome','stage','transferStage','httpStatus','bytes','abortRequested','imageComplete','width','height'].filter(k=>k in a).map(k=>[k,a[k]])))}))};
  };
  startupProgress.subscribe(s=>{stage=s.stage;emit('startup-progress',{stage:s.stage,completedSteps:s.completedSteps,completedAssets:s.completedAssets});publish();});
  const {queryDraft}=await import(new URL('app/multiplayer/gameplayProtocol.js',base));
  document.addEventListener('click',e=>{const button=e.target.closest?.('#confirm-deployment,#move-commit');if(!button||button.disabled)return;input={at:now()};emit('input',{actionKind:button.id==='move-commit'?'move':'deployment'});setTimeout(()=>{input=null;},0);},true);
  installObserver({NetworkPlayerSession,LobbyClient,timeline,queryDraft,inputAt:()=>input?.at??null});
  addEventListener('eastfront-transport-timing',()=>publish());
  new MutationObserver(()=>{const present=!!document.querySelector('#eastfront-map');if(present&&stage!=='map-dom-ready'){stage='map-dom-ready';emit('map-dom-ready');publish();}}).observe(document.documentElement,{childList:true,subtree:true});
  stage='app-import';emit('app-import');await import(new URL('mp017/bootstrap.mjs',base));emit('app-import-complete');publish();
}catch(error){failure('diagnostic-or-module-startup-failed',error);}

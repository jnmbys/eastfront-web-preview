import {Timeline,safePath,safeError,assetPath} from './trace.mjs';
const version=location.pathname.split('/')[2],base=new URL('./',location.href).href;
const runId=crypto.randomUUID(),timeline=new Timeline();
let config,allowed=new Set(),stage='diagnostic-bootstrap',lastSession=null,input=null,context=null;
const sendTimes=new Map(),scopes=new Map();
const now=()=>performance.now();
const scope=s=>JSON.stringify([s.client.state.snapshot?.matchId,s.model.viewerControllerId]);
const emit=(kind,fields={})=>{try{timeline.event(kind,now(),fields);}catch{/* Observer cannot block gameplay. */}};
let startupReport=()=>null,publishTimer=null;
function publish(force=false){if(!force){if(publishTimer===null)publishTimer=setTimeout(()=>{publishTimer=null;publish(true);},250);return;}try{parent.postMessage({source:'MP012',runId,version,sourceSha:config?.sourceSha??null,diagnosticSha256:config?.diagnosticSha256??null,scenario:location.pathname.split('/')[3],mode:location.pathname.split('/')[4],fixtureFault:config?.fault??'unknown',stage,report:timeline.report(),startup:startupReport()},location.origin);}catch{/* No effect on app. */}}
function failure(kind,error){emit(kind,{stage,...safeError(error,base,allowed)});publish(true);}
addEventListener('error',e=>{if(e.error)failure('uncaught-error',e.error);else{const path=safePath(e.target?.src??e.target?.href,base,allowed);emit('resource-element-error',{path});publish();}},true);
addEventListener('unhandledrejection',e=>failure('unhandled-rejection',e.reason));
addEventListener('message',e=>{if(e.source===parent&&e.origin===location.origin&&['MP010','MP012'].includes(e.data?.source)&&['finish','export'].includes(e.data.type))publish(true);});
for(const event of ['offline','online','visibilitychange'])addEventListener(event,()=>{emit(event,{visible:document.visibilityState==='visible',online:navigator.onLine});publish();});
const originalError=console.error;
console.error=function(...args){if(args[0]==='EASTFRONT startup failed'){stage=['manifest/map','static-terrain-surface'].includes(args[1]?.phase)?args[1].phase:'startup-failed';failure('caught-startup-error',args[2]);}return originalError.apply(this,args);};
try{
  config=await (await fetch(`/mp012/config/${version}`)).json();allowed=new Set(config.paths);
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
  const blocked=s=>({revision:s.matchRevision,interactive:s.interactive,syncing:!!s.syncing,submitting:!!s.submitting,queryQueued:!!s.queued,queryInFlight:!!s.flight,transportPending:!!s.client.state.pending,canAct:!!s.canAct,connection:s.client.state.connection});
  document.addEventListener('click',e=>{const button=e.target.closest?.('#confirm-deployment,#move-commit');if(!button||button.disabled)return;input={at:now()};emit('input',{actionKind:button.id==='move-commit'?'move':'deployment'});setTimeout(()=>{input=null;},0);},true);
  addEventListener('eastfront-action-timing',e=>{const d=e.detail;if(d.stage==='send'){sendTimes.set(d.requestId,d.at);if(sendTimes.size>128)sendTimes.delete(sendTimes.keys().next().value);emit('send',{requestId:d.requestId,type:d.type,sendAt:d.at});if(d.type==='SUBMIT_ACTION'&&context){timeline.submit(d.requestId,context.scope,context.revision,context.inputAt,d.at);const id=d.requestId,initialStatus=document.querySelector('#network-match-status')?.textContent;let frames=0;const frame=()=>{frames++;const marker=!!document.querySelector('#pending-action-layer'),changed=document.querySelector('#network-match-status')?.textContent!==initialStatus;if(document.visibilityState==='visible'&&(marker||changed)){timeline.feedback(id,now());emit('feedback-frame-opportunity',{requestId:id,feedbackKind:marker?'pending-marker':'status-change'});}else if(frames<300)requestAnimationFrame(frame);};requestAnimationFrame(frame);}}});
  const submit=NetworkPlayerSession.prototype.submit;
  NetworkPlayerSession.prototype.submit=function(action){lastSession=this;const previous=context;context=input?{scope:scope(this),revision:this.matchRevision,inputAt:input.at}:null;try{return submit.call(this,action);}finally{context=previous;emit('submit-return',blocked(this));}};
  const send=LobbyClient.prototype.send;
  LobbyClient.prototype.send=function(type,payload){const id=send.call(this,type,payload);if(id&&type==='QUERY_MATCH'&&lastSession?.client===this)timeline.query(id,scope(lastSession),payload.expectedRevision,sendTimes.get(id)??null);return id;};
  const receive=NetworkPlayerSession.prototype.receive;
  NetworkPlayerSession.prototype.receive=function(m){lastSession=this;const oldSequence=this.serverSequence,wasSyncing=this.syncing,change=this.onChange;const s=scope(this);
    this.onChange=kind=>{if(m?.messageType==='PLAYER_VIEW_SNAPSHOT'&&['view','resync'].includes(kind)&&this.playerView===m.payload.view&&this.serverSequence===m.payload.serverSequence){timeline.applied(scope(this),this.matchRevision,this.serverSequence,now());emit('snapshot-applied',{revision:this.matchRevision,sequence:this.serverSequence});}return change.call(this,kind);};
    try{return receive.call(this,m);}finally{this.onChange=change;
      const consumed=m&&m.payload?.serverSequence!==oldSequence&&this.serverSequence===m.payload?.serverSequence&&!wasSyncing;
      if(m&&Number.isInteger(m.payload?.serverSequence)){scopes.set(`${m.messageType}/${m.payload.serverSequence}`,s);if(scopes.size>128)scopes.delete(scopes.keys().next().value);}
      if(consumed&&m.messageType==='ACTION_ACCEPTED')timeline.ack(m.requestId,m.payload.acceptedRevision,now());
      if(this.interactive)timeline.interactive(scope(this),this.matchRevision,now());
      emit('operation-block-state',blocked(this));
    }
  };
  const lobbyReceive=LobbyClient.prototype.receive;
  LobbyClient.prototype.receive=function(m){try{return lobbyReceive.call(this,m);}finally{emit('connection-state',{connection:this.state.connection,synced:this.state.synced,pending:this.state.pending,errorPresent:!!this.state.error});}};
  addEventListener('eastfront-transport-timing',e=>{const d=e.detail,s=scopes.get(`${d.type}/${d.sequence}`);if(s)timeline.receive(s,{type:d.type,sequence:d.sequence,callbackAt:d.callbackAt,parsedAt:d.parsedAt,decodedAt:d.decodedAt,appliedAt:d.appliedAt,outcome:d.outcome});if(d.type==='MATCH_QUERY')timeline.queryReceived(d.requestId,d.callbackAt,d.appliedAt);emit('receive',{type:d.type,requestId:d.requestId,revision:d.revision??null,sequence:d.sequence??null,callbackAt:d.callbackAt,parsedAt:d.parsedAt,decodedAt:d.decodedAt,handlerEndAt:d.appliedAt,outcome:d.outcome});publish();});
  new MutationObserver(()=>{const present=!!document.querySelector('#eastfront-map');if(present&&stage!=='map-dom-ready'){stage='map-dom-ready';emit('map-dom-ready');publish();}}).observe(document.documentElement,{childList:true,subtree:true});
  stage='app-import';emit('app-import');await import(new URL('mp010/bootstrap.mjs',base));emit('app-import-complete');publish();
}catch(error){failure('diagnostic-or-module-startup-failed',error);}

// Only observes the fixed candidate. No loader, decoder, drawing or ready-gate patch.
import {startupProgress} from '/r1/app/web/startupProgress.js';
import {startupDiagnosticReport} from '/r1/app/web/startupDiagnostics.js';
import {observeTerrainBuild} from '/r1/app/render/terrainWork.js';
const events=[],buildTimings=[],marks={startAt:null,mapDomReadyAt:null,controlsAvailableAt:null};
let started=false,failed=false,lastLod='',lastTransform='',lastStage='',queued=false;
const now=()=>Math.round(performance.now()*10)/10;
const emit=(kind,data={})=>{if(events.length<400)events.push({kind,at:now(),...data});};
function current(){const c=document.querySelector('#terrain-surface'),svg=document.querySelector('#eastfront-map'),wrap=document.querySelector('#map-wrap');return {canvas:!!c,width:c?.width??0,height:c?.height??0,lod:c?.dataset.lod??null,zoom:wrap?.dataset.zoom??null,panelExpanded:document.querySelector('#panel-toggle')?.getAttribute('aria-expanded')??null,transform:svg?.getAttribute('style')??null};}
function snapshot(){return {clientTimeOrigin:performance.timeOrigin,snapshotAt:now(),userAgent:navigator.userAgent,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},visibility:document.visibilityState,marks:{...marks},events:[...events],failed,progress:{...startupProgress.snapshot},diagnostics:startupDiagnosticReport(),current:current(),buildTimings:[...buildTimings],resources:performance.getEntriesByType('resource').filter(r=>new URL(r.name).pathname.startsWith('/r1/')).slice(-400).map(r=>({path:new URL(r.name).pathname,recovery:new URL(r.name).searchParams.has('terrain-recovery'),start:r.startTime,responseEnd:r.responseEnd,duration:r.duration,transferSize:r.transferSize,encodedBodySize:r.encodedBodySize,decodedBodySize:r.decodedBodySize})),limitations:['DOM available, requested LOD, completed LOD and mounted canvas are separate observations.','Steps count generator resumptions, not pixels. A JS thread blocked at export cannot supply a live snapshot.','Resource timing is not independent decoding CPU or proof of a cold cache.','Snapshot polling adds overhead; this is a functional observation, not a performance benchmark.','No cookies, authentication values, game state or full URLs are exported.']};}
const post=(type,data)=>parent.postMessage({startup006:type,data},location.origin);
const send=()=>{queued=false;post('snapshot',snapshot());};
const publish=()=>{if(!queued){queued=true;setTimeout(send,0);}};
const complete=startupProgress.complete;startupProgress.complete=function(lod){const result=complete.call(this,lod);emit('terrain-complete',{lod});publish();return result;};
startupProgress.subscribe(s=>{if(s.stage!==lastStage){lastStage=s.stage;emit('progress-stage',{stage:s.stage,completedSteps:s.completedSteps});}if(s.stage==='failed'){failed=true;emit('startup-failed');}publish();});
observeTerrainBuild(t=>{if(buildTimings.length<100)buildTimings.push({...t,at:now()});});
const inspect=()=>{const c=current(),map=document.querySelector('#eastfront-map'),button=document.querySelector('#zoom-in');if(map&&marks.mapDomReadyAt===null){marks.mapDomReadyAt=now();emit('map-dom-ready',{initial:c});}if(map&&c.canvas&&button&&!button.disabled&&marks.controlsAvailableAt===null){marks.controlsAvailableAt=now();emit('controls-available');}if(c.lod&&c.lod!==lastLod){lastLod=c.lod;emit('lod-mounted',{lod:c.lod});}if(c.transform&&c.transform!==lastTransform){lastTransform=c.transform;emit('map-transform',{zoom:c.zoom,lod:c.lod,panelExpanded:c.panelExpanded});}if(document.querySelector('[data-preview-state="fatal"]')||document.querySelector('#terrain-detail-status')?.dataset.failed==='true')failed=true;publish();};
new MutationObserver(inspect).observe(document.querySelector('#app'),{subtree:true,childList:true,attributes:true,attributeFilter:['style','data-zoom','data-failed','data-lod','aria-expanded']});
for(const name of ['pointerdown','pointerup','wheel'])document.addEventListener(name,e=>{if(e.target.closest?.('#map-wrap'))emit('map-input',{type:name,trusted:e.isTrusted});},{passive:true,capture:true});
document.addEventListener('visibilitychange',()=>{emit('visibility',{state:document.visibilityState});publish();});
window.addEventListener('error',e=>{if(e instanceof ErrorEvent){failed=true;emit('uncaught-error',{message:String(e.message).slice(0,300)});publish();}});
window.addEventListener('unhandledrejection',()=>{failed=true;emit('unhandled-rejection');publish();});
window.addEventListener('message',async e=>{if(e.source!==parent||e.origin!==location.origin)return;const type=e.data?.startup006;
 if(type==='start'&&!started&&!failed){started=true;marks.startAt=now();emit('local-start-request');document.querySelector('#new-game-button')?.click();publish();}
 if(type==='snapshot')send();
 if(type==='screenshot'){
  const c=document.querySelector('#terrain-surface');if(!c){post('screenshot',{error:'No mounted canvas',requestId:e.data.requestId});return;}
  const at=now(),state=snapshot(),width=c.width,height=c.height;
  try{const blob=await new Promise(r=>c.toBlob(r,'image/png'));if(!blob)throw Error('Empty PNG');post('screenshot',{requestId:e.data.requestId,blob,at,lod:c.dataset.lod,width,height,state});}catch(error){post('screenshot',{requestId:e.data.requestId,error:String(error)});}
 }
});
performance.setResourceTimingBufferSize(400);emit('observer-attached');post('ready',{});send();

// Added after the unchanged candidate HOME page loads, before its local-start
// button is enabled. No image/decode/fetch/Canvas methods or ready gates patched.
import {startupProgress} from '/r1/app/web/startupProgress.js';
import {startupDiagnosticReport} from '/r1/app/web/startupDiagnostics.js';
import {observeTerrainBuild} from '/r1/app/render/terrainWork.js';
const events=[],buildTimings=[],marks={startAt:null,mapDomReadyAt:null,controlsAvailableAt:null},startOrigin=performance.timeOrigin;
let failed=false,started=false,lastTransform='',lastLod='',lastStage='',snapshotQueued=false;
const now=()=>Math.round(performance.now()*10)/10;
const emit=(kind,fields={})=>{if(events.length<4000)events.push({kind,at:now(),...fields});};
function current(){const canvas=document.querySelector('#terrain-surface'),svg=document.querySelector('#eastfront-map'),wrap=document.querySelector('#map-wrap');return {canvas:!!canvas,width:canvas?.width??0,height:canvas?.height??0,lod:canvas?.dataset.lod??null,zoom:wrap?.dataset.zoom??null,transform:svg?.getAttribute('style')??null};}
function send(){snapshotQueued=false;parent.postMessage({startup004:'snapshot',data:{clientTimeOrigin:startOrigin,userAgent:navigator.userAgent,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},marks,events:[...events],failed,progress:{...startupProgress.snapshot},diagnostics:startupDiagnosticReport(),current:current(),buildTimings:[...buildTimings],resources:performance.getEntriesByType('resource').filter(r=>new URL(r.name).pathname.startsWith('/r1/')).slice(-3000).map(r=>({path:new URL(r.name).pathname,recovery:new URL(r.name).searchParams.has('terrain-recovery'),start:r.startTime,responseEnd:r.responseEnd,duration:r.duration,transferSize:r.transferSize,encodedBodySize:r.encodedBodySize,decodedBodySize:r.decodedBodySize,initiatorType:r.initiatorType})),limitations:['Observer attaches after HOME load, before local start; its module requests precede startAt.','terrain-complete follows the existing progress.complete callback; no readiness is advanced.','map-dom-ready and controls-available are DOM observations, not visible paint or proof of physical input.','Actual drag/zoom/visual checks are user observations; transform events are supplementary.','Native image diagnostics retain the original bounded last-12 records; Resource Timing covers requests, not independent decode CPU.','A new page is not proof of a completely cold cache; transferSize is a browser report.','No game state, cookies, authentication value, or full resource URL/query is exported.']}},location.origin);}
function publish(){if(!snapshotQueued){snapshotQueued=true;setTimeout(send,0);}}
// Observer only: the original singleton callback is called first, with the same
// receiver/arguments. Readiness and loading decisions remain in the pinned module.
const complete=startupProgress.complete;startupProgress.complete=function(lod){const result=complete.call(this,lod);if(['far','medium','close'].includes(lod))emit('terrain-complete',{lod});publish();return result;};
startupProgress.subscribe(s=>{if(s.stage!==lastStage){lastStage=s.stage;emit('progress-stage',{stage:s.stage,completedSteps:s.completedSteps});}if(s.stage==='failed'){failed=true;emit('startup-failed');}publish();});
observeTerrainBuild(t=>{if(buildTimings.length<100)buildTimings.push({...t,at:now()});});
const inspect=()=>{const c=current(),map=document.querySelector('#eastfront-map'),button=document.querySelector('#zoom-in');
 if(map&&marks.mapDomReadyAt===null){marks.mapDomReadyAt=now();emit('map-dom-ready');}
 if(map&&c.canvas&&button&&!button.disabled&&marks.controlsAvailableAt===null){marks.controlsAvailableAt=now();emit('controls-available');}
 if(c.lod&&c.lod!==lastLod){lastLod=c.lod;emit('lod-mounted',{lod:c.lod});}
 if(c.transform&&c.transform!==lastTransform){lastTransform=c.transform;emit('map-transform',{zoom:c.zoom,lod:c.lod});}
 if(document.querySelector('[data-preview-state="fatal"]')||document.querySelector('#terrain-detail-status')?.dataset.failed==='true'){if(!failed)emit('fatal-or-detail-failure');failed=true;}
 publish();};
new MutationObserver(inspect).observe(document.querySelector('#app'),{childList:true,subtree:true,attributes:true,attributeFilter:['style','data-zoom','data-failed','data-lod']});
for(const name of ['pointerdown','pointerup','wheel'])document.addEventListener(name,e=>{if(e.target.closest?.('#map-wrap')){emit('map-input',{type:name,trusted:e.isTrusted});publish();}},{passive:true,capture:true});
document.addEventListener('visibilitychange',()=>{emit('visibility',{state:document.visibilityState});publish();});
window.addEventListener('error',e=>{if(e instanceof ErrorEvent){failed=true;emit('uncaught-error',{message:String(e.message).slice(0,300)});publish();}});
window.addEventListener('unhandledrejection',()=>{failed=true;emit('unhandled-rejection');publish();});
window.addEventListener('message',async e=>{if(e.source!==parent||e.origin!==location.origin)return;const type=e.data?.startup004;
 if(type==='start'&&!started&&!failed){started=true;marks.startAt=now();emit('local-start-request');document.querySelector('#new-game-button')?.click();publish();}
 if(type==='snapshot')send();
 if(type==='screenshot'){const c=document.querySelector('#terrain-surface');if(!c)return;const lod=c.dataset.lod,at=now();try{const blob=await new Promise(r=>c.toBlob(r,'image/png'));const response=await fetch('/s004/screenshot',{method:'POST',headers:{'Content-Type':'image/png'},body:blob});if(!response.ok)throw Error();const saved=await response.json();parent.postMessage({startup004:'screenshot',data:{...saved,lod,at}},location.origin);}catch{emit('screenshot-save-failed');publish();}}
});
performance.setResourceTimingBufferSize(3000);emit('observer-attached',{homeButtonPresent:!!document.querySelector('#new-game-button')});parent.postMessage({startup004:'ready'},location.origin);send();

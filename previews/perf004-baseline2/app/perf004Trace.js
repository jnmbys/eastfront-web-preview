// Diagnostic build only. No state payload, identity token or hidden unit is exported.
const spans=[],network=[],tasks=[],frames=[],samples=[],batches=[],created={svg:0,html:0};
let parent=null,serial=0,active=null,lastRaf=null,saving=false;
const now=()=>performance.now();
const report=document.createElement('pre');report.id='perf004-evidence';report.hidden=true;document.body.append(report);
const count=()=>document.querySelectorAll('#counter-layer [data-unit-id]').length;
const detail=()=>Number(document.querySelector('#terrain-detail-status')?.dataset.completed??0);
function publish(){saving=false;report.textContent=JSON.stringify({version:1,userAgent:navigator.userAgent,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},clock:'performance.now; same-page monotonic ms',spans,network,tasks,frames,samples,batches,boundaries:['Nested spans overlap; do not sum','rAF/control readiness is not proof of pixel presentation','No DevTools trace: layout/paint are not separately measured','Public WSS, no simulated delay','Diagnostic wrappers add the same small overhead to both builds']});}
function save(){if(!saving){saving=true;setTimeout(publish,100);}}
export const perf4={begin(name){const id=++serial,start=now(),up=parent;parent=id;return ()=>{parent=up;if(spans.length<30000)spans.push({id,parent:up,name,start,ms:now()-start});save();};},sync(name,fn){const end=this.begin(name);try{return fn();}finally{end();}}};
const createNS=document.createElementNS.bind(document);document.createElementNS=(...a)=>{created.svg++;return createNS(...a);};
const create=document.createElement.bind(document);document.createElement=(...a)=>{created.html++;return create(...a);};
const snapshot=()=>({units:count(),presence:[...document.querySelectorAll('[data-presence-id]')],counters:[...document.querySelectorAll('#counter-layer [data-unit-id]')],fogBuilds:Number(document.querySelector('#fog-surface-layer')?.getAttribute('data-fog-builds')??0),lods:detail(),created:{...created}});
function sampleStart(mode,revision){if(active)return;active={mode,revision,start:now(),before:snapshot()};}
function sampleEnd(){const s=active;if(!s)return;const mark=now();requestAnimationFrame(()=>requestAnimationFrame(()=>{if(active!==s)return;const a=snapshot();samples.push({mode:s.mode,revision:s.revision,start:s.start,appliedAt:mark,readyProxyMs:now()-s.start,unitsBefore:s.before.units,unitsAfter:a.units,lodsBefore:s.before.lods,lodsAfter:a.lods,fogBuilds:a.fogBuilds-s.before.fogBuilds,presenceCreated:a.presence.filter(n=>!s.before.presence.includes(n)).length,presenceRemoved:s.before.presence.filter(n=>!a.presence.includes(n)).length,presenceReused:a.presence.filter(n=>s.before.presence.includes(n)).length,countersCreated:a.counters.filter(n=>!s.before.counters.includes(n)).length,countersReused:a.counters.filter(n=>s.before.counters.includes(n)).length,createdSVG:a.created.svg-s.before.created.svg,createdHTML:a.created.html-s.before.created.html});active=null;save();}));}
document.addEventListener('click',e=>{if(e.target.closest?.('#confirm-deployment')){sampleStart('actor');if(!document.querySelector('.network-map-card')){queueMicrotask(sampleEnd);}}},true);
try{new PerformanceObserver(list=>{for(const e of list.getEntries())if(tasks.length<4000)tasks.push({start:e.startTime,ms:e.duration});save();}).observe({type:'longtask',buffered:true});}catch{}
function frame(t){if(document.visibilityState==='visible'&&lastRaf!==null&&t-lastRaf>40&&frames.length<4000)frames.push({start:lastRaf,ms:t-lastRaf});lastRaf=document.visibilityState==='visible'?t:null;requestAnimationFrame(frame);}requestAnimationFrame(frame);
const Native=window.WebSocket;
window.WebSocket=class extends Native{
 constructor(...args){super(...args);this.sent=new Map();const start=now();this.addEventListener('open',()=>{network.push({type:'OPEN',start:now(),ms:now()-start});save();});}
 send(data){try{const m=JSON.parse(String(data));this.sent.set(m.requestId,now());network.push({direction:'send',type:m.messageType,start:now()});}catch{}return super.send(data);}
 set onmessage(fn){super.onmessage=e=>{let m;try{m=JSON.parse(String(e.data));}catch{}const type=m?.messageType,revision=m?.payload?.matchRevision;const at=now(),sent=this.sent.get(m?.requestId);network.push({direction:'receive',type,revision,start:at,rtt:sent===undefined?undefined:at-sent});if(type==='PLAYER_VIEW_SNAPSHOT'&&revision>0&&!active)sampleStart('waiting',revision);if(active&&type==='PLAYER_VIEW_SNAPSHOT')active.revision=revision;const end=perf4.begin('response:'+type);try{return fn?.(e);}finally{end();if(type==='PLAYER_VIEW_SNAPSHOT'&&revision>0)sampleEnd();save();}};}
};
const bar=document.createElement('div');bar.id='perf004-controls';bar.style.cssText='position:fixed;left:10px;bottom:26px;z-index:99999;background:#071626;padding:6px;border:1px solid #a18c5d;color:white';bar.innerHTML='<button id="perf004-run" type="button">Measure 10 deployments</button> <button id="perf004-run32" type="button">Finish deployment</button> <span id="perf004-run-status">Diagnostic ready</span>';document.body.append(bar);
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(fn){const start=now();while(!fn()){if(now()-start>25000)throw Error('Diagnostic condition deadline');await pause(30);}}
async function run(limit){const status=bar.querySelector('#perf004-run-status'),record={start:now(),limit,lods:detail(),completed:0};batches.push(record);for(const b of bar.querySelectorAll('button'))b.disabled=true;try{
 for(let i=0;i<limit;i++){
  const unit=document.querySelector('[data-deploy-unit-id].unplaced');if(!unit)break;unit.click();
  await wait(()=>document.querySelector('[data-deploy-destination]:not(:disabled)'));
  const options=[...document.querySelectorAll('[data-deploy-destination]:not(:disabled)')].filter(e=>e.textContent.includes('平原'));
  const before=count(),card=options[before];if(!card)throw Error('No observed plain destination');card.click();const confirm=document.querySelector('#confirm-deployment');if(!confirm||confirm.disabled)throw Error('Confirmation unavailable');confirm.click();
  await wait(()=>count()===before+1&&!active);record.completed++;status.textContent=`Completed ${record.completed}`;save();await pause(260);
 }
 record.status='PASS';status.textContent=`PASS ${record.completed}`;
 }catch(error){record.status='FAIL';record.error=String(error);status.textContent=String(error);}finally{record.ms=now()-record.start;for(const b of bar.querySelectorAll('button'))b.disabled=false;save();}}
bar.querySelector('#perf004-run').onclick=()=>run(10);bar.querySelector('#perf004-run32').onclick=()=>run(32);
save();

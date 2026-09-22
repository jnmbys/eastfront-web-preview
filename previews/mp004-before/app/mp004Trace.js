// Diagnostic entry only. Record metadata/timing, never messages or hidden state.
const spans=[],messages=[],submissions=[],tasks=[],batches=[];
let parent=null,serial=0,current=null,lastClick=null,saving=false;
const now=()=>performance.now(),units=()=>document.querySelectorAll('#counter-layer [data-unit-id]').length;
const lods=()=>Number(document.querySelector('#terrain-detail-status')?.dataset.completed??0);
const report=document.createElement('pre');report.id='mp004-evidence';report.hidden=true;document.body.append(report);
function publish(){saving=false;report.textContent=JSON.stringify({version:1,userAgent:navigator.userAgent,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},clock:'same-page performance.now',spans,messages,submissions,tasks,batches,boundaries:['Native message callback entry is after complete browser message delivery, not packet receipt','UTF-8 byte count is uncompressed application bytes','Synchronous controls-restored timestamp is not pixel presentation','Nested spans overlap','Public WSS; no simulated latency; no DevTools layout/paint trace']});}
function save(){if(!saving){saving=true;setTimeout(publish,100);}}
export const trace={
 begin(name){const id=++serial,up=parent,start=now();parent=id;return()=>{parent=up;if(spans.length<10000)spans.push({id,parent:up,name,start,ms:now()-start});};},
 parse(text){const start=now(),m=JSON.parse(text),parsedAt=now();if(current){const p=m.payload;Object.assign(current,{parseMs:parsedAt-start,parsedAt,type:m.messageType,requestId:['ACTION_ACCEPTED','ACTION_REJECTED','MATCH_QUERY'].includes(m.messageType)?m.requestId:undefined,matchId:p?.matchId,revision:p?.matchRevision,acceptedRevision:p?.acceptedRevision,sequence:p?.serverSequence,resync:p?.resync,viewer:p?.view?.viewer,authorizedUnits:p?.view?.units?.length,hiddenEnemyUnits:p?.view?.phase?.endsWith('_DEPLOYMENT')?p.view.units.filter(u=>u.side!==p.view.viewer).length:undefined});}return m;}
};
document.addEventListener('click',e=>{if(e.target.closest?.('#confirm-deployment'))lastClick={at:now(),lods:lods(),units:units()};},true);
try{new PerformanceObserver(list=>{for(const e of list.getEntries())if(tasks.length<4000)tasks.push({start:e.startTime,ms:e.duration});save();}).observe({type:'longtask',buffered:true});}catch{}
const Native=window.WebSocket;
window.WebSocket=class extends Native{
 send(data){const at=now();try{const m=JSON.parse(String(data));if(m.messageType==='SUBMIT_ACTION')submissions.push({requestId:m.requestId,matchId:m.payload.matchId,expectedRevision:m.payload.expectedRevision,type:m.payload.action.type,click:lastClick,sentAt:at,bytes:new TextEncoder().encode(data).length});else messages.push({direction:'send',type:m.messageType,at});}catch{}const result=super.send(data);save();return result;}
 set onmessage(fn){super.onmessage=event=>{
  // Before application parsing, diagnostic parsing, byte counting, or DOM work.
  const row={direction:'receive',arrival:now()};current=row;
  try{return fn?.(event);}finally{
   row.handlerFinished=now();current=null;
   const status=document.querySelector('#network-match-status');
   row.appliedRevision=status?Number(status.dataset.revision):null;row.interactive=status?.dataset.interactive==='true';row.visibleUnits=units();row.lods=lods();
   row.bytes=new TextEncoder().encode(String(event.data)).length;
   if(row.type==='PLAYER_VIEW_SNAPSHOT'&&!row.resync){const s=submissions.findLast(s=>s.matchId===row.matchId&&s.acceptedRevision===row.revision&&s.ackSequence+1===row.sequence);if(s){row.actionRequestId=s.requestId;s.snapshotArrival=row.arrival;s.snapshotSequence=row.sequence;s.appliedRevision=row.appliedRevision;s.appliedAt=row.handlerFinished;s.controlsRestored=row.interactive?row.handlerFinished:null;}}
   if(row.type==='ACTION_ACCEPTED'){const s=submissions.find(s=>s.requestId===row.requestId&&s.matchId===row.matchId);if(s){s.ackAt=row.arrival;s.acceptedRevision=row.acceptedRevision;s.ackSequence=row.sequence;s.unitsAtAck=row.visibleUnits;}}
   messages.push(row);save();
  }
 };}
};
const bar=document.createElement('div');bar.id='mp004-controls';bar.style.cssText='position:fixed;left:10px;bottom:26px;z-index:99999;background:#071626;padding:6px;border:1px solid #a18c5d;color:white';bar.innerHTML='<button id="mp004-run">Measure 10 deployments</button> <span id="mp004-status">Ready</span>';document.body.append(bar);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function wait(fn){const start=now();while(!fn()){if(now()-start>25000)throw Error('Diagnostic deadline');await pause(30);}}
bar.querySelector('button').onclick=async()=>{const button=bar.querySelector('button'),status=bar.querySelector('span'),batch={start:now(),lods:lods(),completed:0};batches.push(batch);button.disabled=true;try{
 for(let i=0;i<10;i++){
  const unit=document.querySelector('[data-deploy-unit-id].unplaced');if(!unit)break;unit.click();await pause(30);
  const cards=[...document.querySelectorAll('[data-deploy-destination]:not(:disabled)')].filter(e=>e.textContent.includes('平原')),before=units(),card=cards[before];if(!card)throw Error('No observed destination');card.click();await pause(30);
  const confirm=document.querySelector('#confirm-deployment');if(!confirm||confirm.disabled)throw Error('Confirmation unavailable');confirm.click();
  await wait(()=>units()===before+1&&document.querySelector('#network-match-status')?.dataset.interactive==='true');batch.completed++;status.textContent=`Completed ${batch.completed}`;save();await pause(300);
 }
 batch.status='PASS';status.textContent=`PASS ${batch.completed}`;
}catch(error){batch.status='FAIL';batch.error=String(error);status.textContent=String(error);}finally{button.disabled=false;batch.ms=now()-batch.start;save();}};
save();

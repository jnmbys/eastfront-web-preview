// Bounded, safe diagnostic metadata. Real UI actions, no canonical-state access.
const now=()=>performance.now(),submissions=[],packets=[],tasks=[],spans=[],batches=[];let current=null,dirty=false;
const report=document.createElement('pre');report.id='mp005b-evidence';report.hidden=true;document.body.append(report);
const status=()=>document.querySelector('#network-match-status');
const lods=()=>Number(document.querySelector('#terrain-detail-status')?.dataset.completed??0);
function save(){if(dirty)return;dirty=true;setTimeout(()=>{dirty=false;report.textContent=JSON.stringify({browser:navigator.userAgent,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},preferred:new URLSearchParams(location.search).get('snapshotFormat')??'auto',submissions,packets,spans,tasks,batches,boundaries:['UTF-8 JSON bytes, not on-wire frames','Native message callback is after complete-message arrival and browser scheduling','Controls-ready microtask is not pixel presentation','Nested apply/render spans overlap; do not add','Instrumented compiled copies; no simulated network delay','No payloads, token, unit IDs, routes, GameState or RNG recorded']});},80);}
export const mp5={
 incoming(m,raw,arrival,parseMs){
  if(!['PLAYER_VIEW_SNAPSHOT','ACTION_ACCEPTED','ACTION_REJECTED','SNAPSHOT_FORMAT_SELECTED'].includes(m.messageType))return;
  const p=m.payload,row={type:m.messageType,arrival,parseMs,bytes:new TextEncoder().encode(raw).length,format:p.format,revision:p.matchRevision,sequence:p.serverSequence,resync:p.resync};
  if(m.messageType==='ACTION_ACCEPTED'){const s=submissions.findLast(s=>s.requestId===m.requestId);if(s){s.ackAt=arrival;s.acceptedRevision=p.acceptedRevision;s.ackSequence=p.serverSequence;}}
  if(m.messageType==='PLAYER_VIEW_SNAPSHOT'){
   current=row;row.hiddenEnemyCount=p.view.phase.endsWith('_DEPLOYMENT')?p.view.units.filter(u=>u.side!==p.view.viewer).length:undefined;
   const s=submissions.findLast(s=>!p.resync&&s.acceptedRevision===p.matchRevision&&s.ackSequence+1===p.serverSequence);
   if(s){s.snapshotAt=arrival;s.snapshotBytes=row.bytes;s.format=p.format;s.snapshotSequence=p.serverSequence;s.parseMs=parseMs;}
   queueMicrotask(()=>{row.appliedRevision=Number(status()?.dataset.revision);row.controlsReady=status()?.dataset.interactive==='true';if(s){s.controlsAt=now();s.controlsReady=row.controlsReady;s.appliedRevision=row.appliedRevision;}save();});
  }
  packets.push(row);if(packets.length>160)packets.shift();save();
 },
 begin(name,arg){const start=now(),packet=current;return ()=>{const ms=now()-start;if(spans.length<4000)spans.push({name,start,ms,revision:packet?.revision});
  if(packet&&name==='decodeSnapshot')packet.decodeMs=ms;
  if(packet&&name==='NetworkPlayerSession.receive'&&arg?.messageType==='PLAYER_VIEW_SNAPSHOT'&&arg.payload.matchRevision===packet.revision)packet.applyMs=ms;save();};}
};
try{new PerformanceObserver(list=>{for(const e of list.getEntries())if(tasks.length<1000)tasks.push({start:e.startTime,ms:e.duration});save();}).observe({type:'longtask'});}catch{}
const Native=window.WebSocket;window.WebSocket=new Proxy(Native,{construct(target,args,newTarget){const ws=Reflect.construct(target,args,newTarget),send=ws.send;
 ws.send=function(raw){const sentAt=now();try{const m=JSON.parse(String(raw));if(m.messageType==='SUBMIT_ACTION'){submissions.push({requestId:m.requestId,expectedRevision:m.payload.expectedRevision,sentAt,lods:lods()});if(submissions.length>64)submissions.shift();}
  else if(['QUERY_MATCH','RESYNC_MATCH','SET_SNAPSHOT_FORMAT','RECONNECT'].includes(m.messageType))packets.push({type:m.messageType,direction:'send',at:sentAt});}catch{}return send.call(this,raw);};return ws;}});
const bar=document.createElement('div');bar.id='mp005b-controls';bar.style.cssText='position:fixed;bottom:10px;left:10px;z-index:99999;background:#071626;color:#eee4ce;border:1px solid #aa925d;padding:8px';bar.innerHTML='<button id="mp005b-run">Measure 10 deployments</button> <span id="mp005b-status">Diagnostic ready</span>';document.body.append(bar);
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(fn){const start=now();while(!fn()){if(now()-start>20000)throw Error('Bounded diagnostic wait');await pause(20);}}
bar.querySelector('button').onclick=async()=>{const button=bar.querySelector('button'),label=bar.querySelector('span'),batch={start:now(),lods:lods(),completed:0};batches.push(batch);button.disabled=true;
 try{if(lods()!==3)throw Error('Wait for ALL LODs before measuring');
  for(let i=0;i<10;i++){
   const roster=document.querySelector('[data-deploy-unit-id].unplaced');if(!roster)throw Error('Missing own unit');roster.click();
   const cards=[...document.querySelectorAll('[data-deploy-destination]:not(:disabled)')].filter(e=>e.textContent.includes('平原'));
   if(!cards[i])throw Error('Missing legal destination');cards[i].click();
   const confirm=document.querySelector('#confirm-deployment'),revision=Number(status()?.dataset.revision);if(!confirm||confirm.disabled)throw Error('Missing confirmation');confirm.click();
   await wait(()=>Number(status()?.dataset.revision)===revision+1&&status()?.dataset.interactive==='true');batch.completed++;label.textContent=`Completed ${batch.completed}`;await pause(200);
  }batch.status='PASS';label.textContent='PASS 10';
 }catch(e){batch.status='FAIL';batch.error=String(e);label.textContent=String(e);}finally{batch.end=now();button.disabled=false;save();}};
save();

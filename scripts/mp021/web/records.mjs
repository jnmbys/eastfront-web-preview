export const purposes=['warmup','normal','normal','normal'];
const keys=['stage','at','requestId','type','revision','sequence','ready','interactive','syncing','canSelect','legalOptionsReady','canSubmit','queryQueued','queryInFlight','callbackAt','parsedAt','decodedAt','appliedAt','outcome'];
export function safeTiming(event,detail){return {event,...Object.fromEntries(keys.filter(k=>Object.hasOwn(detail,k)&&['string','number','boolean'].includes(typeof detail[k])||keys.includes(k)&&detail[k]===null).map(k=>[k,detail[k]]))};}
export function makeRecord({config,device,index,report,sample,exportedAt}){
 const reasons=[],purpose=purposes[index-1];
 const events=sample?.events??[],sends=events.filter(e=>e.stage==='send'&&e.type==='SUBMIT_ACTION');
 const action=report?.actions?.find(a=>a.requestId===sends[0]?.requestId)??null;
 if(!purpose)reasons.push('sample-index');if(sends.length!==1)reasons.push('action-count');
 if(!action||action.completionCount!==1||!Number.isFinite(action.times.ackAt))reasons.push('missing-exact-completion');
 if(!sample?.restored||!sample?.foreground?.satisfiedAtInput)reasons.push('not-restored-or-foreground');
 if(sample?.flags?.length)reasons.push('exception');
 if(events.some(e=>e.type==='RESYNC_MATCH'||e.type==='ACTION_REJECTED'))reasons.push('recovery-or-rejection');
 if(events.some(e=>e.type==='transport-status'&&e.syncing))reasons.push('connection-interrupted');
 if(!action||!['authorityAppliedMs','canSelectMs','legalOptionsReadyMs','canSubmitMs'].every(k=>Number.isFinite(action.milestones?.[k])))reasons.push('missing-milestone');
 const queries=events.filter(e=>e.stage==='send'&&e.type==='QUERY_MATCH').map(e=>{
  const received=events.find(r=>r.event==='transport'&&r.type==='MATCH_QUERY'&&r.requestId===e.requestId),applied=events.find(r=>r.type==='query-applied'&&r.requestId===e.requestId);
  const phase=!action||e.at<action.times.sendAt?'preparation':e.at<=action.times.canSubmitAt?'authority-recovery':'post-recovery';
  return {requestId:e.requestId,revision:received?.revision??null,phase,sendAt:e.at,callbackAt:received?.callbackAt??null,parsedAt:received?.parsedAt??null,appliedAt:applied?.at??null,legalOptionsReadyAt:applied?.legalOptionsReady?applied.at:null,canSubmitAt:applied?.canSubmit?applied.at:null};
 });
 const recovery=queries.filter(q=>q.phase==='authority-recovery');
 if(!recovery.length||recovery.some(q=>['sendAt','callbackAt','parsedAt','appliedAt','legalOptionsReadyAt','canSubmitAt'].some(k=>!Number.isFinite(q[k]))))reasons.push('missing-query-timing');
 return {schema:'MP021-query-trace-v1',instanceId:config.instanceId,sourceSha:config.sourceSha,gameplayClientSha:config.gameplayClientSha,packageTreeSha256:config.packageTreeSha256,diagnosticSha256:config.diagnosticSha256,device:String(device).slice(0,120),index,purpose,classification:reasons.length?'exception-or-incomplete':purpose,performanceSample:false,exportedAt,action,queries,events,foreground:sample?.foreground??null,flags:sample?.flags??[],restored:sample?.restored??false,reasons,
  limits:['Same iframe monotonic clock across four moves; no startup duration included.','Server records are independent and joined offline by instanceId + requestId + revision.','No cross-clock timestamp subtraction; send/write completion is not peer receipt.','Three normal diagnostic samples do not prove stable performance improvement.']};
}

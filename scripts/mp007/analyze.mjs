import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const duration=row=>row?row.endAt-row.startAt:null;
const delta=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)?a-b:null;
export function analyze(report){
  return (report.submissions??[]).map(s=>{
    const connection=report.connections?.find(c=>c.connectionId===s.connectionId);
    const stages=connection?.server?.stages??[],sends=connection?.server?.sends??[];
    const requests=stages.filter(r=>r.stage==='request'&&r.type==='SUBMIT_ACTION'&&r.requestId===s.requestId);
    const request=requests.length===1?requests[0]:null;
    const snapshot=sends.find(r=>r.type==='PLAYER_VIEW_SNAPSHOT'&&r.matchRevision===s.acceptedRevision&&r.serverSequence===s.snapshotSequence);
    const receive=request?stages.find(r=>r.stage==='receive'&&r.startAt<=request.startAt&&r.endAt>=request.endAt):null;
    const ui=connection?.actionTimings?.find(r=>r.stage==='ui'&&r.type!=='ACTION_ACCEPTED'&&r.revision===s.acceptedRevision&&r.at>=s.snapshotArrival&&r.ready&&!r.syncing);
    const stage=name=>duration(stages.find(r=>r.stage===name&&r.requestId===s.requestId));
    const snapStage=name=>duration(stages.find(r=>r.stage===name&&r.revision===s.acceptedRevision&&r.sequence===s.snapshotSequence));
    const serverCriticalMs=receive&&snapshot?delta(snapshot.sendAt,receive.startAt):null;
    const beforeReceiveMs=delta(s.snapshotArrival,s.sentAt);
    const residual=beforeReceiveMs!==null&&serverCriticalMs!==null?beforeReceiveMs-serverCriticalMs:null;
    return {
      requestId:s.requestId,revision:s.acceptedRevision??null,sequence:s.snapshotSequence??null,
      outcome:s.rejectedAt?'rejected':s.snapshotArrival===undefined?'incomplete':requests.length>1?'duplicate-request; attribution unavailable':'snapshot-received',
      snapshotBytes:s.snapshotBytes??null,format:s.snapshotFormat??null,
      inputToSendMs:delta(s.sentAt,s.inputAt),submitToSnapshotMs:beforeReceiveMs,
      submitToAckMs:delta(s.ackAt,s.sentAt),ackToSnapshotMs:delta(s.snapshotArrival,s.ackAt),
      serverCriticalMs,transportAndSchedulingResidualMs:residual!==null&&residual>=0?residual:null,
      residualInvalid:residual!==null&&residual<0,
      validateMs:request?stage('validate'):null,applyIntentMs:request?stage('apply-intent'):null,
      coreApplyMs:request?stage('core-apply'):null,
      snapshotBuildMs:snapStage('snapshot-build'),snapshotEncodeMs:snapStage('snapshot-encode'),serializationMs:snapshot?.serializeMs??null,
      parseAndEnvelopeMs:s.production?.parseAndEnvelopeMs??null,validationMs:s.production?.validationMs??null,
      reconstructionMs:s.production?.rebuildMs??null,clientApplyMs:s.production?.receiveNotifyMs??null,
      observerBeforeProductionMs:delta(s.production?.callbackAt,s.snapshotArrival),
      submitToUIReadyMs:delta(ui?.at,s.sentAt),interactiveAtReady:ui?.interactive??null,
    };
  });
}
export function summarize(rows){
  rows=rows.filter(r=>r.outcome==='snapshot-received');
  const keys=['snapshotBytes','inputToSendMs','submitToAckMs','ackToSnapshotMs','submitToSnapshotMs','serverCriticalMs','transportAndSchedulingResidualMs','validateMs','applyIntentMs','coreApplyMs','snapshotBuildMs','snapshotEncodeMs','serializationMs','parseAndEnvelopeMs','validationMs','reconstructionMs','clientApplyMs','submitToUIReadyMs'];
  return Object.fromEntries(keys.map(key=>{const v=rows.map(r=>r[key]).filter(Number.isFinite).sort((a,b)=>a-b),n=v.length;return [key,{n,median:n?(v[Math.floor((n-1)/2)]+v[Math.floor(n/2)])/2:null,p95:n?v[Math.ceil(n*.95)-1]:null,max:n?v[n-1]:null}];}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const rows=analyze(JSON.parse(readFileSync(process.argv[2],'utf8')));
  const result=JSON.stringify({rows,summary:summarize(rows),boundary:'Residual includes network, compression, native/event-loop scheduling; no one-way clock subtraction. UI ready is not paint. Nested server spans must not be summed.'},null,2)+'\n';
  if(process.argv[3])writeFileSync(process.argv[3],result);else process.stdout.write(result);
}

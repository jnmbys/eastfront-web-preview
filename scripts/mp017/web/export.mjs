const pick=(o,keys)=>o?Object.fromEntries(keys.filter(k=>k in o).map(k=>[k,o[k]])):null;
const metricKeys=['schema','requestId','snapshotFormat','compression','baseRevision','acceptedRevision','appliedSequence','appliedRevision','interactiveRevision','sendMs','ackMs','authorizedAppliedMs','interactiveMs','feedbackFrameOpportunityMs','feedbackProxyKind','visibleFeedbackMs','visibleFeedbackMethod','rejected','resyncCount','queryCount','confirmClicks','submitCount','flags'];
export function diagnosticMatches(run,config,version){return run?.source==='MP017-DIAG'&&run.version===version&&run.sourceSha===config.versions[version]&&run.diagnosticSha256===config.diagnosticSha256;}
export function sampleOf(data,config,version){return data?.build?.sourceSha===config.versions[version]?{metrics:pick(data.result,metricKeys),finalState:pick(data.finalState,['interactive','pendingMarker']),preparation:pick(data.preparation,['requiredVisibleMs','continuousVisibleMs','satisfiedAtInput'])}:null;}
export function exportRecord({config,device,version,pairId,purpose,order,run,sample,attempt,exportedAt}){
 const diagnostic=diagnosticMatches(run,config,version)?pick(run,['runId','version','sourceSha','diagnosticSha256','scenario','mode','fixtureFault','stage','report','startup']):null;
 const a=diagnostic?.report?.actions?.find(a=>a.requestId===sample?.metrics?.requestId),m=sample?.metrics;
 const reasons=[];
 if(!diagnostic)reasons.push('missing-diagnostic');
 if(!m)reasons.push('missing-action');
 if(m?.resyncCount>0)reasons.push('resync');if(m?.rejected)reasons.push('rejected');
 if(!Number.isFinite(m?.ackMs))reasons.push('missing-ack');
 if(a?.completionCount!==1||a.acceptedRevision!==m?.acceptedRevision||a.appliedSequence!==m?.appliedSequence)reasons.push('missing-exact-completion');
 if(!sample?.finalState?.interactive||!Number.isFinite(a?.milestones?.canSubmitMs))reasons.push('not-restored');
 if(!['authorityAppliedMs','canSelectMs','legalOptionsReadyMs','canSubmitMs'].every(k=>Number.isFinite(a?.milestones?.[k])))reasons.push('missing-milestone');
 if(!sample?.preparation?.satisfiedAtInput)reasons.push('foreground-wait-unmet');
 if(m?.flags?.length)reasons.push('flagged');if(m?.submitCount!==1)reasons.push('submission-count');
 if(diagnostic?.report?.events?.some(e=>/error|failed/.test(e.kind)||e.kind==='offline'||e.kind==='visibilitychange'&&!e.visible))reasons.push('diagnostic-exception');
 return {schema:'MP017-paired-trial-v1',exportedAt,pairId,purpose,order,device:device.slice(0,120),version,sourceSha:config.versions[version],serverSha:config.serverSha,snapshotFormat:config.snapshotFormat,diagnosticSha256:config.diagnosticSha256,cachePolicy:config.cachePolicy,parentAttempt:attempt,diagnostic,sample,
  classification:reasons.length?'exception-or-incomplete':purpose==='warmup'?'warmup':'normal',reasons,
  limitations:['Real device result only if user actually ran that device; empty/missing data is not a pass.','One functional completion is not performance improvement. Compare only matched pairs/conditions; small samples do not establish stable P95.','Four milestone times use iframe performance.now; parent clock is separate; render is synchronous subscriber work, not paint.','rAF is frame opportunity; actual visible feedback and server compute/build are missing.']};
}

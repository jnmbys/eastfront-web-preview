// Export is local only. Deliberately do not copy arbitrary fields from frame messages.
const metrics=['schema','requestId','snapshotFormat','compression','baseRevision','acceptedRevision','appliedSequence','appliedRevision','interactiveRevision','sendMs','ackMs','authorizedAppliedMs','interactiveMs','feedbackFrameOpportunityMs','feedbackProxyKind','visibleFeedbackMs','visibleFeedbackMethod','rejected','resyncCount','queryCount','confirmClicks','submitCount','flags'];
const pick=(o,keys)=>o?Object.fromEntries(keys.filter(k=>k in o).map(k=>[k,o[k]])):null;
export function diagnosticMatches(run,config){return run?.source==='MP012'&&run.version==='control'&&run.sourceSha===config.versions.control&&run.diagnosticSha256===config.diagnosticSha256;}
export function sampleOf(data,config){if(data?.build?.sourceSha!==config.versions.control)return null;return {metrics:pick(data.result,metrics),finalState:pick(data.finalState,['interactive','pendingMarker']),preparation:pick(data.preparation,['requiredVisibleMs','continuousVisibleMs','satisfiedAtInput'])};}
export function exportRecord({config,device,run,sample,attempt,exportedAt}){
  const diagnostic=diagnosticMatches(run,config)?pick(run,['runId','version','sourceSha','diagnosticSha256','scenario','mode','fixtureFault','stage','report','startup']):null;
  return {schema:'MP013-owner-diagnostic-v1',exportedAt,device:device.slice(0,120),sourceSha:config.versions.control,serverSha:config.serverSha,snapshotFormat:config.snapshotFormat,diagnosticSha256:config.diagnosticSha256,
    parentAttempt:attempt,diagnostic,sample,missing:{diagnostic:!diagnostic,actionMetrics:!sample?.metrics,interactive:sample?.finalState?.interactive!==true},
    limitations:['Single exploratory diagnostic, not a normal sample quota or latency improvement result.','Parent performance.now and iframe performance.now are separate clocks; never subtract them.','rAF means frame opportunity, not visible paint. Missing data remains null.','Export may be incomplete when startup or the page is unresponsive.']};
}

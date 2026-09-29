// Reuse immutable browser evidence; no new browser/presentation measurements.
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const ref='57a690f9f120db5a075f01b3e8ce33eac7972607';
const read=name=>JSON.parse(execFileSync('git',['show',`${ref}:evidence/ai-perf-preview-006/browser/${name}.json`],{encoding:'utf8'}));
const rows=[];
for(const variant of ['candidate','control']){
 for(let round=1;round<=3;round++){
  const d=read(`${variant}-${round}`),p=d.diagnostic.performance,s=p.stages;
  assert.equal(d.diagnostic.accepted,33);assert.equal(d.diagnostic.rejected,0);
  rows.push({variant,round,visibilityAtExport:p.visibility,accepted:33,
   zoomTimestampToCapture:s.zoomEventQueue.samples,zoomCaptureToRAF:s.zoomCallbackToRAF.samples,
   eventCount:s.zoomEventQueue.count,rafCount:s.zoomCallbackToRAF.count,
   longTaskMax:s.mainLongTask?.maxMs??null,viewUpdateMax:s.viewUpdate.maxMs,mapUpdateMax:s.mapUpdate.maxMs,
   exitSyncHandlerMax:d.exit.stages.exitHandler.maxMs});
 }
}
const idle=['candidate','control'].map(variant=>{
 const {before,after}=read('idle-'+variant),a=before.performance.stages,b=after.performance.stages;
 assert.equal(before.accepted,33);assert.equal(after.accepted,33);assert.equal(a.thinkMs.count,b.thinkMs.count);
 return {variant,acceptedBefore:before.accepted,acceptedAfter:after.accepted,thinkFramesBefore:a.thinkMs.count,thinkFramesAfter:b.thinkMs.count,
  additionalZoomCaptureToRAF:b.zoomCallbackToRAF.samples.slice(a.zoomCallbackToRAF?.samples.length??0),additionalDragTimestampToCapture:b.dragEventQueue.samples.slice(a.dragEventQueue?.samples.length??0)};
});
const cancel=read('cancel-candidate'),later=read('cancel-candidate-later');
// The later export wraps the performance report in report.
assert.deepEqual(cancel.report,later.report);assert.equal(later.report.active,false);
writeFileSync('evidence/ai-perf-007/reanalysis.json',JSON.stringify({sourceEvidenceCommit:ref,environment:'reanalysis of cloud Chrome 1363x936, seed17; no new live measurements',deployment:rows,idle,cancelReportUnchanged:true,limitations:['No event IDs/types in historical input arrays: cannot pair by array index','Only export-time visibility; no cadence/presentation or tool dispatch trace','No movement/combat UI latency comparison in this checkpoint']},null,2)+'\n');
console.log('6 deployment rounds + 2 idle controls reanalyzed; unchanged cancellation export verified. No presentation inference.');

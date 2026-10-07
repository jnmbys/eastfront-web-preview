import {readFileSync,writeFileSync} from 'node:fs';import assert from 'node:assert/strict';import {join} from 'node:path';
const dir=process.argv[2],out=process.argv[3];if(!dir)throw Error('Usage: node summarize.mjs EVIDENCE-DIR [NEW-OUTPUT.json]');
const summary=JSON.parse(readFileSync(join(dir,'summary.json'))),client=JSON.parse(readFileSync(join(dir,'client-0.json')));
const delta=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)?a-b:null;
const rows=summary.results.map(({profile,record:r,ping,trafficDelta})=>{
 assert.equal(r.status,'applied');assert.equal(r.command.kind,'MOVE');assert.equal(r.command.requestId,r.result.requestId);assert.equal(r.command.instanceId,client.instanceId);
 const frame=client.events.find(e=>e.type==='feedback-frame-opportunity'&&e.requestId===r.command.requestId);
 return {condition:profile,requestId:r.command.requestId,smallMessageRoundTripMs:ping?.elapsedMs??null,localFeedbackHandlerMs:delta(r.feedbackAt,r.inputAt),
  feedbackFrameOpportunityMs:delta(frame?.at,r.inputAt),commandResultKnownMs:delta(r.resultAt,r.inputAt),authorityQueueMs:r.result.timing.queueMs,
  authorityInternalApplyMs:r.result.timing.applyMs,authorizedViewAvailableMs:delta(r.viewAvailableAt,r.inputAt),trafficIncludingSelectionAndProbes:trafficDelta};
});
const result={schema:'MP022-local-timings-v1',kind:summary.kind,rows,metrics:summary.metrics,concurrentCommands:summary.concurrent.map(r=>({kind:r.command.kind,sendAt:r.sendAt,resultAt:r.resultAt,status:r.status})),
 limits:['Local injected traffic only; one move per condition, no stable percentiles or public/Huawei improvement claim.',
 'Client and server clocks are independent. Authority internal duration is not input-to-server-apply latency.',
 'Feedback handler and rAF opportunity are not measured pixel presentation.',
 'JSON traffic includes selection, probes, both seats, recovery; not compressed wire bytes.']};
if(out)writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});else console.log(JSON.stringify(result,null,2));

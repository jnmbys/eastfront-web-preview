// Evidence replay only: original sampling/classification and source bytes stay unchanged.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {summarize} from '../mp010/summarize.mjs';
import {classify} from '../mp010/web/classify.mjs';
import {VERSIONS,FORMAT,SERVER_SHA,SEED} from '../mp010/config.mjs';
import {verifyArtifacts} from '../mp010/integrity.mjs';
const file='evidence/mp-011-r1/huawei-warmup-original.json';
const bytes=readFileSync(file),data=JSON.parse(bytes),manifest=verifyArtifacts();
const expected={versions:VERSIONS,format:FORMAT,serverSha:SERVER_SHA};
const difference=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)?Math.round((a-b)*1000)/1000:null;
assert.equal(data.schema,'MP010-v1');
assert.equal(data.rows.length,4);
const reviewed=data.rows.map((row,sourceIndex)=>{
  const m=row.metrics;
  return {sourceIndex,trialId:row.trialId,device:row.device,platform:row.platform,scenario:row.scenario,version:row.version,
    classification:classify(row,expected),
    packageMatches:row.samplerSha256===manifest.samplerSha256&&row.harnessSha256===manifest.harnessSha256&&row.seed===SEED,
    inputToAckMs:m.ackMs,inputToAppliedMs:m.authorizedAppliedMs,inputToInteractiveMs:m.interactiveMs,
    submittedToAckMs:difference(m.ackMs,m.sendMs),submittedToAppliedMs:difference(m.authorizedAppliedMs,m.sendMs),
    ackToAppliedMs:difference(m.authorizedAppliedMs,m.ackMs),appliedToInteractiveMs:difference(m.interactiveMs,m.authorizedAppliedMs),
    frameOpportunityProxyMs:m.feedbackFrameOpportunityMs,visibleFeedbackMs:m.visibleFeedbackMs,
    queryCount:m.queryCount,resyncCount:m.resyncCount,finalState:row.finalState};
});
const categories=reviewed.reduce((counts,row)=>{counts[row.classification.category]=(counts[row.classification.category]??0)+1;return counts;},{});
// These are assertions about this archived export, not new sampling rules.
assert.deepEqual(categories,{warmup:2,incomplete:2});
assert.ok(reviewed.every(r=>r.packageMatches));
assert.ok(reviewed.filter(r=>r.scenario==='move').every(r=>r.classification.reasons.includes('not-interactive')&&r.inputToInteractiveMs===null&&r.appliedToInteractiveMs===null));
const summary=summarize(data);
assert.ok(summary.groups.every(g=>g.normalCount===0));
assert.ok(summary.groups.filter(g=>g.group[4]==='move').every(g=>g.buckets.incomplete.metrics.interactiveMs.n===0&&g.buckets.incomplete.metrics.interactiveMs.median===null));
const result={sourceSha256:createHash('sha256').update(bytes).digest('hex'),sourceBytes:bytes.length,exportedAt:data.exportedAt,
  categories,normalQuotaConsumed:0,huaweiWarmupGatePassed:false,reviewed,
  userClarification:'User reports ending both move trials as soon as the piece moved; recovery time was not fully observed. This does not establish a stuck UI.',
  limitations:['Device label is Huawei tablet; platform was entered as hormony. Exact model, OS version and browser are unknown.',
    'No video reviewed; rAF is only a frame-opportunity proxy; authoritative application is not proof of visible paint.',
    'Move recovery times remain missing, never zero and never reclassified as completed.',
    'ACK-to-application intervals cannot separate server snapshot work, network delivery and client processing.',
    'Deployment viewport heights differ (376 vs 740); conditions are not fully matched.',
    'One warmup per combination cannot demonstrate a regression, latency reduction or stable P95. iPad remains pending.']};
writeFileSync('evidence/mp-011-r1/huawei-export-review.json',JSON.stringify(result,null,2)+'\n');
writeFileSync('evidence/mp-011-r1/huawei-export-summary.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({sourceSha256:result.sourceSha256,categories,normalQuotaConsumed:0,huaweiWarmupGatePassed:false}));

// Replay this cumulative export without replacing earlier evidence or sampling rules.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {summarize} from '../mp010/summarize.mjs';
import {classify} from '../mp010/web/classify.mjs';
import {VERSIONS,FORMAT,SERVER_SHA,SEED} from '../mp010/config.mjs';
import {verifyArtifacts} from '../mp010/integrity.mjs';
const root='evidence/mp-011-r1/';
const bytes=readFileSync(root+'huawei-followup-original.json'),data=JSON.parse(bytes);
const old=JSON.parse(readFileSync(root+'huawei-warmup-original.json'));
const manifest=verifyArtifacts(),expected={versions:VERSIONS,format:FORMAT,serverSha:SERVER_SHA};
assert.equal(data.schema,'MP010-v1');
assert.equal(data.rows.length,6);
const oldRows=new Map(old.rows.map(r=>[r.trialId,r]));
assert.equal(new Set(data.rows.map(r=>r.trialId)).size,data.rows.length);
for(const row of old.rows)assert.deepEqual(data.rows.find(r=>r.trialId===row.trialId),row);
const difference=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)?Math.round((a-b)*1000)/1000:null;
const reviewed=data.rows.map(row=>{
  const m=row.metrics;
  return {trialId:row.trialId,previouslyArchived:oldRows.has(row.trialId),scenario:row.scenario,version:row.version,platform:row.platform,
    classification:classify(row,expected),packageMatches:row.samplerSha256===manifest.samplerSha256&&row.harnessSha256===manifest.harnessSha256&&row.seed===SEED,
    inputToAckMs:m?.ackMs??null,inputToAppliedMs:m?.authorizedAppliedMs??null,inputToInteractiveMs:m?.interactiveMs??null,
    submittedToAckMs:difference(m?.ackMs,m?.sendMs),submittedToAppliedMs:difference(m?.authorizedAppliedMs,m?.sendMs),
    ackToAppliedMs:difference(m?.authorizedAppliedMs,m?.ackMs),appliedToInteractiveMs:difference(m?.interactiveMs,m?.authorizedAppliedMs),
    frameOpportunityProxyMs:m?.feedbackFrameOpportunityMs??null,visibleFeedbackMs:m?.visibleFeedbackMs??null,
    queryCount:m?.queryCount??null,resyncCount:m?.resyncCount??null,finalState:row.finalState};
});
const count=rows=>rows.reduce((counts,r)=>{counts[r.classification.category]=(counts[r.classification.category]??0)+1;return counts;},{});
const added=reviewed.filter(r=>!r.previouslyArchived),categories=count(reviewed),newCategories=count(added);
assert.deepEqual(categories,{warmup:3,incomplete:3});
assert.deepEqual(newCategories,{warmup:1,incomplete:1});
assert.ok(reviewed.every(r=>r.packageMatches));
const failed=added.find(r=>r.version==='control');
assert.ok(failed.classification.reasons.includes('missing-metrics'));
assert.equal(failed.inputToAppliedMs,null);
assert.equal(failed.resyncCount,null);
const summary=summarize(data);
assert.ok(summary.groups.every(g=>g.normalCount===0));
const result={sourceSha256:createHash('sha256').update(bytes).digest('hex'),sourceBytes:bytes.length,exportedAt:data.exportedAt,
  deduplication:{cumulativeUnique:6,unchangedPreviouslyArchived:4,newTrials:2,method:'trialId plus deep equality; do not add both export row counts'},
  categories,newCategories,normalQuotaConsumed:0,huaweiWarmupGatePassed:false,reviewed,
  reportedIssues:[{trialId:failed.trialId,source:'User clarification in chat',stage:'After Start next, while loading map',errorText:null,
    disposition:'Startup failure separately recorded. Original row remains incomplete; no inferred action submission or zero timing.'}],
  limitations:['New rows identify hormony/default browser; exact model, OS and browser versions unknown.',
    'No video reviewed; rAF is a frame opportunity only. Application is a pre-render boundary.',
    'Candidate completed recovery; control startup error prevents a paired completed comparison.',
    'Query count is not query duration; ACK-to-apply cannot separate server, network and client costs.',
    'Boundary request IDs cannot be joined exactly to action request IDs; 101 does not prove map startup success.',
    'No latency reduction, regression or P95 claim. Previous incomplete rows remain incomplete; iPad pending.']};
writeFileSync(root+'huawei-followup-review.json',JSON.stringify(result,null,2)+'\n');
writeFileSync(root+'huawei-followup-summary.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({sourceSha256:result.sourceSha256,deduplication:result.deduplication,categories,newCategories,huaweiWarmupGatePassed:false}));

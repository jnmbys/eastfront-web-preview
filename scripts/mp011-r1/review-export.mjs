// Replays the existing classifier; never edits the source export or sampling rules.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {summarize} from '../mp010/summarize.mjs';
import {classify} from '../mp010/web/classify.mjs';
import {VERSIONS,FORMAT,SERVER_SHA,SEED} from '../mp010/config.mjs';
import {verifyArtifacts} from '../mp010/integrity.mjs';
const file=process.argv[2];
if(!file)throw Error('Export file path required');
const bytes=readFileSync(file),data=JSON.parse(bytes),manifest=verifyArtifacts();
if(data.schema!=='MP010-v1'||!Array.isArray(data.rows))throw Error('Unexpected export schema');
const expected={versions:VERSIONS,format:FORMAT,serverSha:SERVER_SHA};
const round=n=>Math.round(n*1000)/1000;
const difference=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)?round(a-b):null;
const reviewed=data.rows.map((row,index)=>{
  const classification=classify(row,expected),m=row.metrics;
  const packageMatches=row.samplerSha256===manifest.samplerSha256&&row.harnessSha256===manifest.harnessSha256&&row.seed===SEED;
  return {sourceIndex:index,trialId:row.trialId,requestId:m?.requestId,scenario:row.scenario,version:row.version,sourceSha:row.sourceSha,device:row.device,platform:row.platform,network:row.network,mode:row.mode,purpose:row.check,classification,packageMatches,
    submittedToAckMs:difference(m?.ackMs,m?.sendMs),submittedToAppliedMs:difference(m?.authorizedAppliedMs,m?.sendMs),appliedToInteractiveMs:difference(m?.interactiveMs,m?.authorizedAppliedMs),
    inputToAckMs:m?.ackMs??null,inputToAppliedMs:m?.authorizedAppliedMs??null,inputToInteractiveMs:m?.interactiveMs??null,frameOpportunityProxyMs:m?.feedbackFrameOpportunityMs??null,visibleFeedbackMs:m?.visibleFeedbackMs??null,
    queryCount:m?.queryCount??null,resyncCount:m?.resyncCount??null,pendingMarkerAtEnd:row.finalState?.pendingMarker??null};
});
const passed=reviewed.filter(r=>r.classification.category==='warmup'&&r.packageMatches&&r.device==='桌面预检'&&r.mode==='real'&&r.pendingMarkerAtEnd===false);
const coverage=Object.fromEntries(['deployment','move'].flatMap(s=>['candidate','control'].map(v=>[`${s}/${v}`,passed.filter(r=>r.scenario===s&&r.version===v).length])));
const result={reviewedAt:new Date().toISOString(),exportedAt:data.exportedAt,sourceSha256:createHash('sha256').update(bytes).digest('hex'),sourceBytes:bytes.length,
  expected,expectedSamplerSha256:manifest.samplerSha256,expectedHarnessSha256:manifest.harnessSha256,expectedSeed:SEED,coverage,desktopWarmupGatePassed:Object.values(coverage).every(n=>n>=1),
  categories:reviewed.reduce((counts,row)=>{counts[row.classification.category]=(counts[row.classification.category]??0)+1;return counts;},{}),
  normalQuotaConsumed:reviewed.filter(r=>r.classification.category==='normal').length,reviewed,
  limitations:['User-operated Chrome export; exact OS/Chrome versions not supplied.','No video reviewed; rAF is a frame-opportunity proxy only.','Four warmups are not a latency-improvement study or stable P95 estimate.','Boundary WS request IDs differ from gameplay action request IDs; transport evidence is separate.','iPad Safari and Huawei acceptance remain pending.']};
writeFileSync('evidence/mp-011-r1/desktop-export-review.json',JSON.stringify(result,null,2)+'\n');
writeFileSync('evidence/mp-011-r1/desktop-export-summary.json',JSON.stringify(summarize(data),null,2)+'\n');
console.log(JSON.stringify({sourceSha256:result.sourceSha256,desktopWarmupGatePassed:result.desktopWarmupGatePassed,coverage,categories:result.categories,normalQuotaConsumed:result.normalQuotaConsumed}));

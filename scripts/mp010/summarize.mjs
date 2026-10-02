// Descriptive only; every category retains its metrics and complete source rows.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {VERSIONS,FORMAT,SERVER_SHA} from './config.mjs';
import {classify,statistics} from './web/classify.mjs';
const expected = {versions:VERSIONS, format:FORMAT, serverSha:SERVER_SHA};
const metricNames = ['visibleFeedbackMs','feedbackFrameOpportunityMs','authorizedAppliedMs','interactiveMs','ackMs'];
export function summarize(data) {
  const groups = new Map();
  for (const [sourceIndex,row] of (data.rows ?? []).entries()) {
    const key = JSON.stringify([row.deviceRunId??'legacy-preflight',row.device,row.platform,row.network,row.scenario,
      row.mode,row.version,row.sourceSha,row.samplerSha256,row.harnessSha256,row.metrics?.compression]);
    if (!groups.has(key)) groups.set(key,{group:JSON.parse(key),attempts:0,buckets:{}});
    const group = groups.get(key), classification = classify(row,expected);
    group.attempts++;
    const bucket = group.buckets[classification.category] ??= {count:0,reasonCounts:{},records:[]};
    bucket.count++;
    for (const reason of classification.reasons) bucket.reasonCounts[reason]=(bucket.reasonCounts[reason]??0)+1;
    bucket.records.push({sourceIndex,classification,row});
  }
  for (const group of groups.values()) {
    for (const category of ['normal','abnormal','incomplete','warmup','check','excluded']) {
      const bucket = group.buckets[category] ??= {count:0,reasonCounts:{},records:[]};
      bucket.metrics=Object.fromEntries(metricNames.map(name=>[name,statistics(bucket.records.map(r=>r.row.metrics?.[name]))]));
    }
    group.normalCount=group.buckets.normal.count;
    group.normalVideoReviewed=group.buckets.normal.records.filter(({row})=>row.observation?.method==='manual-video' &&
      Number.isFinite(row.metrics?.visibleFeedbackMs) && row.metrics.visibleFeedbackMs>=0 && row.observation?.fps>0).length;
    group.target=10;group.targetNormalMet=group.normalCount>=10;group.targetVideoMet=group.normalVideoReviewed>=10;
  }
  return {schema:'MP010-descriptive-v2',warning:'Exploratory only. No stable P95 or lower-network-latency inference. Missing values never become zero. Categories are exclusive; all reasons and original rows are retained.',groups:[...groups.values()]};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename))
  console.log(JSON.stringify(summarize(JSON.parse(readFileSync(process.argv[2],'utf8'))),null,2));

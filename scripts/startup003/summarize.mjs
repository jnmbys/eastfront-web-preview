import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {vs2AssetCatalog} from '../../dist/app/render/vs2Assets.js';
const files=['chromium','webkit-native-initial','webkit-canvas','webkit-native','chromium-uncached'];
const rows=[];
for(const file of files){
 const path=`evidence/startup-003/${file}.json`;if(!existsSync(path))continue;
 const data=JSON.parse(readFileSync(path));if(!data.complete&&file!=='webkit-native-initial')throw Error('Incomplete '+path);
 for(const row of data.reports.filter(r=>r.trace)){
  const jobs=row.trace.jobs,seen=new Set();let readyTailMs=0,matched=0;
  for(const job of jobs){
   const file=vs2AssetCatalog.byId(job.id).file;
   const resource=row.resources.filter(r=>r.path.endsWith('/'+file)&&r.start>=job.start-1&&r.responseEnd<=job.end).at(-1);
   if(resource){readyTailMs+=job.end-resource.responseEnd;matched++;}
  }
  rows.push({dataset:file,pixelGate:data.pixelEquality??'initial native pixel equality assertion failed',engine:row.engine,label:row.label,scenario:row.scenario,cache:row.cache,wallMs:row.wallMs,
   jobs:jobs.length,duplicateJobs:jobs.length-new Set(jobs.map(j=>j.id)).size,requests:row.server.requests,duplicateRequests:row.server.duplicates,recoveries:row.server.recoveries,
   jobElapsedSumMs:jobs.reduce((n,j)=>n+j.elapsedMs,0),resourceElapsedSumMs:row.resources.reduce((n,r)=>n+r.duration,0),
   responseEndToReadySumMs:readyTailMs,responseEndToReadyMatchedJobs:matched,bitmapMs:row.draw.bitmapMs,bitmapCalls:row.draw.bitmapCalls,
   drawImageMs:row.draw.ms,drawImageCalls:row.draw.calls,pixelReadMs:row.draw.readMs,
   cpuWorkMs:row.timings.reduce((n,t)=>n+t.workMs,0),peakJobs:row.trace.peakActive,peakResident:row.trace.peakResident,peakDecodedRGBABytes:row.trace.peakBytes,
   activeAtEnd:row.trace.active,residentAtEnd:row.trace.resident,rgbaSha256:row.rgbaSha256});
 }
}
writeFileSync('evidence/startup-003/summary.json',JSON.stringify({
 scope:'Production terrain builder, 640 hexes, seed 17, medium LOD; excludes imports, session, network queries and map DOM readiness.',
 timing:'Independent single samples, not median/P95. Job/resource sums overlap under concurrency. drawImage measures synchronous API work, not compositor/GPU completion. responseEndToReady includes decode/event scheduling and is not isolated decode CPU. Bitmap timing is the explicit API call. Memory is owned decoded RGBA estimate, not browser RSS/GPU/network cache.',
 rows},null,2)+'\n');
console.table(rows.map(({engine,label,scenario,cache,wallMs,jobs,requests,duplicateRequests,peakJobs,peakResident})=>({engine,label,scenario,cache,ms:Math.round(wallMs),jobs,requests,duplicateRequests,peakJobs,peakResident})));

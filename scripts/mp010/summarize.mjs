// Explicitly descriptive only: no P95 or performance improvement claims from ten trials.
import {readFileSync} from 'node:fs';
import {VERSIONS,FORMAT,SERVER_SHA} from './config.mjs';
const data=JSON.parse(readFileSync(process.argv[2],'utf8')),groups=new Map();
for(const row of data.rows??[]){
 const key=JSON.stringify([row.deviceRunId??'legacy-preflight',row.device,row.platform,row.network,row.scenario,row.mode,row.version,row.sourceSha,row.samplerSha256,row.harnessSha256,row.metrics?.compression]);
 if(!groups.has(key))groups.set(key,{group:JSON.parse(key),attempts:0,excluded:0,automaticComplete:0,videoReviewed:0,samples:[]});
 const g=groups.get(key),m=row.metrics;g.attempts++;
 if(row.check!=='sample'||row.invalidBuild||row.sourceSha!==VERSIONS[row.version]||row.serverSha!==SERVER_SHA||row.snapshotFormat!==FORMAT||!m||m.snapshotFormat!==FORMAT||m.flags.length||m.rejected||m.submitCount!==1||row.observation?.outcome==='invalid'){g.excluded++;continue;}
 if(Number.isFinite(m.authorizedAppliedMs)&&Number.isFinite(m.interactiveMs))g.automaticComplete++;
 if(row.observation?.method==='manual-video'&&Number.isFinite(m.visibleFeedbackMs)&&row.observation?.fps>0)g.videoReviewed++;
 g.samples.push(m);
}
function summary(values){const xs=values.filter(x=>Number.isFinite(x)&&x>=0).sort((a,b)=>a-b),n=xs.length;return {n,min:n?xs[0]:null,median:n?(xs[Math.floor((n-1)/2)]+xs[Math.floor(n/2)])/2:null,max:n?xs[n-1]:null};}
console.log(JSON.stringify({schema:'MP010-descriptive-v1',warning:'Exploratory only. No stable P95 or lower-network-latency inference. Null/manual-unreviewed is missing, never zero.',groups:[...groups.values()].map(({samples,...g})=>({...g,target:10,targetAutomaticMet:g.automaticComplete>=10,targetVideoMet:g.videoReviewed>=10,metrics:Object.fromEntries(['visibleFeedbackMs','feedbackFrameOpportunityMs','authorizedAppliedMs','interactiveMs','ackMs'].map(k=>[k,summary(samples.map(s=>s[k]))]))}))},null,2));

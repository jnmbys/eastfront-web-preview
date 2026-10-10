// Same host/checkpoint: released division authority vs packaging candidate.
// Measures authority queue/view/persistence, NOT browser frames or public RTT.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import zlib from 'node:zlib';
import {monitorEventLoopDelay} from 'node:perf_hooks';
import {Campaign as Baseline} from '../../../grand-division-002-integrated/experiments/grand-division-002/authority.mjs';
import {Campaign as Candidate} from '../grand-division-002/authority.mjs';
import {ReleaseAdapter} from '../grand-release-001/persistence.mjs';
const saved=JSON.parse(zlib.gunzipSync(fs.readFileSync('evidence/grand-division-002/revision/approved-chain/battle-loss.json.gz')));
const summary=a=>{a.sort((a,b)=>a-b);return {count:a.length,median:a[Math.floor(a.length/2)]??0,p95:a[Math.min(a.length-1,Math.floor(a.length*.95))]??0,max:a.at(-1)??0};};
const results=[];
for(const [label,CampaignClass] of [['41b56d4',Baseline],['release002',Candidate]])for(const speed of [1,4]){
 const a=new ReleaseAdapter({CampaignClass,saveFile:path.join(fs.mkdtempSync(path.join(os.tmpdir(),'release002-perf-')),'campaign.json')});a.c.restore(saved,false);a.c.transport={next:{a:1,b:1},worldGeneration:0,economyGeneration:0};a.c.clock.paused=false;a.c.clock.autopause=false;a.c.clock.speed=speed;
 const step=[],view=[],command=[],startTick=a.c.clock.tick,start=performance.now(),lag=monitorEventLoopDelay({resolution:20});let last=start,nextView=start,nextCommand=start+1000,seq=0;lag.enable();
 const submit=paused=>a.submit('a',{instanceId:a.id,era:a.era,requestId:'release002-perf-'+(++seq),commandSeq:a.c.transport.next.a,kind:'OPERATION',payload:{type:'CLOCK',paused,speed},dependencies:{worldGeneration:a.c.transport.worldGeneration}});
 while(performance.now()-start<12000){const now=performance.now(),elapsed=now-last;last=now;let t=performance.now(),tick=a.c.clock.tick;await a.tick(elapsed);if(a.c.clock.tick!==tick)step.push(performance.now()-t);
  if(now>=nextView){t=performance.now();await a.view('a');view.push(performance.now()-t);nextView=now+500;}
  if(now>=nextCommand){t=performance.now();const r=await submit(false);if(r.status!=='APPLIED')throw Error(r.reason);command.push(performance.now()-t);nextCommand=now+1000;}
  await a.autoSave();await new Promise(r=>setTimeout(r,20));
 }
 const t=performance.now(),r=await submit(true),pauseMs=performance.now()-t;lag.disable();
 results.push({label,speed,startTick,ticks:a.c.clock.tick-startTick,wallMs:performance.now()-start,stepMs:summary(step),viewMs:summary(view),commandMsIncludingSave:summary(command),pauseMs,pauseStatus:r.status,eventLoopP95Ms:lag.percentile(95)/1e6,rssMB:process.memoryUsage().rss/1048576});
 console.log(label,speed,results.at(-1).ticks);
}
fs.mkdirSync('evidence/grand-release-002',{recursive:true});fs.writeFileSync('evidence/grand-release-002/performance.json',JSON.stringify({kind:'local authority and persistence benchmark; excludes browser, HTTP/WSS and public network',host:os.cpus()[0]?.model,node:process.version,checkpoint:'approved-chain/battle-loss.json.gz',results},null,2));

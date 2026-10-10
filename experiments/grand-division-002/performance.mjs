// Isolated real-time authority/protocol probe; not browser or tablet timing.
import fs from 'node:fs';import zlib from 'node:zlib';import os from 'node:os';import {monitorEventLoopDelay,performance} from 'node:perf_hooks';
import {Campaign} from './authority.mjs';import {CampaignAdapter} from '../grand-play-mp022/adapter.mjs';
const file=process.argv[2],raw=JSON.parse(fs.readFileSync(file,'utf8')),saved=JSON.parse(raw.payload).campaign;
const dir='evidence/grand-division-002/performance';fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(dir+'/start.json.gz',zlib.gzipSync(JSON.stringify(saved)));
const summarize=x=>{x.sort((a,b)=>a-b);return {n:x.length,median:x[Math.floor(x.length/2)]??0,p95:x[Math.min(x.length-1,Math.floor(x.length*.95))]??0,max:x.at(-1)??0};};
const results=[];
for(const speed of [1,4]){
 const a=new CampaignAdapter({CampaignClass:Campaign});a.c.restore(saved,false);a.c.clock.paused=false;a.c.clock.speed=speed;a.c.clock.autopause=false;
 const steps=[],views=[],receipts=[],startTick=a.c.clock.tick,t0=performance.now(),lag=monitorEventLoopDelay({resolution:20});lag.enable();let last=t0,nextView=t0,nextCommand=t0+1000,n=0;
 while(performance.now()-t0<16000){const now=performance.now(),elapsed=now-last;last=now;const tick=a.c.clock.tick,t=performance.now();await a.tick(elapsed);if(a.c.clock.tick!==tick)steps.push(performance.now()-t);
  if(now>=nextView){const v=performance.now();await a.view('a');views.push(performance.now()-v);nextView=now+500;}
  if(now>=nextCommand){const t=performance.now();const r=await a.submit('a',{instanceId:a.id,era:a.era,requestId:'perf-clock-'+(++n),commandSeq:a.c.transport.next.a,kind:'OPERATION',payload:{type:'CLOCK',paused:false,speed},dependencies:{worldGeneration:a.c.transport.worldGeneration}});receipts.push(performance.now()-t);if(r.status!=='APPLIED')throw Error(r.reason);nextCommand=now+1000;}
  await new Promise(r=>setTimeout(r,20));
 }
 const t=performance.now();const pause=await a.submit('a',{instanceId:a.id,era:a.era,requestId:'perf-pause-final',commandSeq:a.c.transport.next.a,kind:'OPERATION',payload:{type:'CLOCK',paused:true,speed},dependencies:{worldGeneration:a.c.transport.worldGeneration}});lag.disable();
 results.push({speed,wallMs:performance.now()-t0,ticks:a.c.clock.tick-startTick,stepMs:summarize(steps),viewMs:summarize(views),commandMs:summarize(receipts),pauseMs:performance.now()-t,pauseStatus:pause.status,eventLoopP95Ms:lag.percentile(95)/1e6,eventLoopMaxMs:lag.max/1e6,memoryMB:process.memoryUsage().rss/1048576});
}
fs.writeFileSync(dir+'/results.json',JSON.stringify({kind:'local authority probe, no network/browser rendering included',cpu:os.cpus()[0]?.model,node:process.version,platform:process.platform,startTick:saved.clock.tick,results},null,2));console.log(JSON.stringify(results,null,2));

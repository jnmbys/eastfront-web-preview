// Offline, streaming reader. Never infer physical presentation from DrawFrame.
const fs=require('node:fs'),path=require('node:path'),readline=require('node:readline');
const dir=process.argv[2];if(!dir)throw Error('Pass evidence directory');
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8'));
const stats=v=>{v=v.filter(Number.isFinite).sort((a,b)=>a-b);return v.length?{n:v.length,p50:v[Math.ceil(v.length*.5)-1],p95:v[Math.ceil(v.length*.95)-1],max:v.at(-1)}:{n:0};};
(async()=>{
 const b=read('browser.json'),s=read('server.json'),windows=[],segments=[],otherClientWindows=[];
 for(const c of b.coverage){
  const events=[];for await(const line of readline.createInterface({input:fs.createReadStream(path.join(dir,'trace-'+c.segment+'.ndjson'))}))events.push(JSON.parse(line));
  const marks=events.filter(e=>e.name.startsWith('p2-')).sort((a,b)=>a.ts-b.ts),pending=new Map();
  for(const e of marks){const [tag,phase,seat]=e.name.split(':');if(tag==='p2-start')pending.set(e.pid,{...e,phase,seat});else if(tag==='p2-end'&&pending.has(e.pid)){
   const start=pending.get(e.pid);pending.delete(e.pid);const groups=new Map();
   for(const f of events)if(f.name==='DrawFrame'&&f.pid===e.pid&&f.ts>=start.ts&&f.ts<=e.ts){if(!groups.has(f.tid))groups.set(f.tid,new Set());groups.get(f.tid).add(f.ts);}
   const intervals=[];let first,last;for(const values of groups.values()){const times=[...values].sort((a,b)=>a-b);for(let i=1;i<times.length;i++)intervals.push((times[i]-times[i-1])/1000);first=Math.min(first??Infinity,times[0]);last=Math.max(last??-Infinity,times.at(-1));}
   windows.push({phase,seat,segment:c.segment,pid:e.pid,startUs:start.ts,endUs:e.ts,durationMs:(e.ts-start.ts)/1000,firstDrawLagMs:(first-start.ts)/1000,lastDrawTailMs:(e.ts-last)/1000,intervals,threads:groups.size,drawCount:events.filter(f=>f.name==='DrawFrame'&&f.pid===e.pid&&f.ts>=start.ts&&f.ts<=e.ts).length});
  }}
  const seatPids=new Map(marks.map(e=>[e.name.split(':')[2],e.pid]));
  for(const w of windows.filter(x=>x.segment===c.segment)){
   const seat=w.seat==='a'?'b':'a',pid=seatPids.get(seat),groups=new Map();
   for(const e of events)if(e.name==='DrawFrame'&&e.pid===pid&&e.ts>=w.startUs&&e.ts<=w.endUs){if(!groups.has(e.tid))groups.set(e.tid,new Set());groups.get(e.tid).add(e.ts);}
   const intervals=[];for(const v of groups.values()){const t=[...v].sort((a,b)=>a-b);for(let i=1;i<t.length;i++)intervals.push((t[i]-t[i-1])/1000);}
   otherClientWindows.push({phase:w.phase,seat,segment:c.segment,intervals,seconds:w.durationMs/1000});
  }
  segments.push({...c,eventNames:[...new Set(events.map(e=>e.name))],traceRangeUs:events.length?[Math.min(...events.map(e=>e.ts)),Math.max(...events.map(e=>e.ts))]:null,unclosedMarkers:pending.size});
 }
 const rows=[];for(const phase of ['pilot','1x','4x'])for(const side of [0,1]){
  const seat=side?'b':'a',w=windows.filter(x=>x.phase===phase&&x.seat===seat),sel=b.selections.filter(x=>x.phase===phase&&x.side===side),p=b.pages[side];
  const errors=sel.filter(x=>x.status!=='success'||x.title?.split(' · ')[0]!==x.expected);
  const wrong=sel.filter(x=>x.seen.some(t=>t.split(' · ')[0]!==x.expected&&t.split(' · ')[0]!==x.old?.split(' · ')[0]));
  const acks=p.acks.filter(x=>x.phase===phase&&x.unitId),conditions=b.conditions.filter(x=>x.phase===phase&&x.side===side),background=b.conditions.filter(x=>x.phase===phase&&x.side!==side);
  rows.push({phase,seat,gestureWindows:w.length,coverageSeconds:w.reduce((a,x)=>a+x.durationMs,0)/1000,compositorDrawIntervalMs:stats(w.flatMap(x=>x.intervals)),drawBoundaryLagMs:stats(w.flatMap(x=>[x.firstDrawLagMs,x.lastDrawTailMs])),emptyDrawWindows:w.filter(x=>!x.drawCount).length,selectionAttempts:sel.length,selectionMs:stats(sel.map(x=>x.ms)),selectionFailures:errors.length,wrongIntermediateTitles:wrong.length,commandAckMs:stats(acks.map(x=>x.ms)),commandFailures:acks.filter(x=>x.status!=='APPLIED').length,commandTargetChecks:b.commandChecks.filter(x=>x.phase===phase&&x.side===side).map(x=>x.ok),longTaskMs:stats(p.longTasks.filter(x=>x.phase===phase).map(x=>x.ms)),longTasksOver1s:p.longTasks.filter(x=>x.phase===phase&&x.ms>1000).length,activeConditions:conditions.map(x=>x.pages[side]),otherSeatActiveConditions:background.map(x=>x.pages[side]),viewApplyMs:stats(p.events.filter(x=>x.phase===phase&&x.type==='view').map(x=>x.applyMs)),decodeMs:stats(p.events.filter(x=>x.phase===phase&&x.type==='view').map(x=>x.decodeMs)),disconnections:p.events.filter(x=>x.phase===phase&&x.type==='disconnected').length});
 }
 for(const row of rows){const w=otherClientWindows.filter(x=>x.phase===row.phase&&x.seat===row.seat),m=b.memory.filter(x=>x.phase===row.phase&&x.side===(row.seat==='a'?0:1)),heap=x=>x?.metrics.find(y=>y.name==='JSHeapUsedSize')?.value/1048576;row.otherClientOperated={seconds:w.reduce((a,x)=>a+x.seconds,0),drawIntervalMs:stats(w.flatMap(x=>x.intervals)),meaning:'non-operated page compositor activity, not proven physical background or idle-page FPS target'};row.heapMiB=m.length?[heap(m[0]),heap(m.at(-1))]:null;}
 const phases=b.phases.map(x=>{const r=s.runtime.filter(y=>y.phase===x.phase),steps=s.step.filter(y=>y.phase===x.phase&&y.advanced&&y.tick>x.startTick&&y.tick<=x.endTick);return{...x,wallSeconds:(x.ended-x.started)/1000,advancedSteps:x.endTick-x.startTick,actualMultiplier:(x.endTick-x.startTick)*2000/(x.ended-x.started),combatSteps:steps.filter(y=>y.battles>0).length,epochRange:r.length?[r[0].epoch,r.at(-1).epoch]:null,pauseSamples:r.filter(y=>y.paused).length,stepMs:stats(steps.map(y=>y.ms)),queueMs:stats(s.queue.filter(y=>y.phase===x.phase).map(y=>y.ms)),viewMs:stats(s.view.filter(y=>y.phase===x.phase).map(y=>y.ms)),saveMs:stats(s.save.filter(y=>y.phase===x.phase).map(y=>y.ms)),maxDepth:Math.max(0,...r.map(y=>y.depth)),maxUnacked:Math.max(0,...r.flatMap(y=>y.connections.map(z=>z.unacked))),cpuCores:stats(r.map(y=>y.cpuCores)),rssMiB:r.length?[r[0].rss/1048576,r.at(-1).rss/1048576]:null,metrics:r.at(-1)?.metrics};});
 const report={source:b.source,environment:b.environment,identity:b.identity,rows,phases,segments,gestureWindows:windows.map(({intervals,...x})=>({...x,intervalMs:stats(intervals)})),errors:b.errors,cameraFailures:b.actions.filter(x=>x.kind==='roundtrip gesture'&&!x.ok),limits:['DrawFrame: compositor scheduling, not physical displayed frames or calibrated presentation time','Headed Edge/CDP activation and document focus do not continuously prove physical foreground; no native touch','Trace intervals only within each page PID/thread and marked gesture; gaps between segments excluded','Both phases continue same room; workload changes, no optimization comparison','Selection is visible correct heading DOM after actual click, not pixel presentation latency']};
 fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({rows:rows.map(({activeConditions,otherSeatActiveConditions,commandTargetChecks,...x})=>x),phases,errors:report.errors,cameraFailures:report.cameraFailures},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});

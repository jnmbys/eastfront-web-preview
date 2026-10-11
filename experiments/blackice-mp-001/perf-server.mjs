// Test-only observer. Never use a real save directory; no exported test HTTP route.
import {start} from './server.mjs';
import {monitorEventLoopDelay} from 'node:perf_hooks';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const out=process.env.P1_OUT,saveDir=fs.mkdtempSync(path.join(os.tmpdir(),'blackice-mp-p1-'));
const svc=await start({port:0,saveDir});
const samples={step:[],view:[],queue:[],save:[],runtime:[]},lag=monitorEventLoopDelay({resolution:20});lag.enable();
let phase='setup';const put=(key,row)=>samples[key].push({phase,...row});
const originalSet=svc.rooms.set.bind(svc.rooms);
svc.rooms.set=(id,s)=>{const a=s.adapter,c=a.c;
 c.clock.rng=219031;c.clock.autopause=false;c.clock.paused=true;
 for(const [i,id]of ['G-013','S-013'].entries())c.state.units[id].hex={q:23+i,r:4};
 for(const g of c.clock.corps)if(g.members.includes('G-013')||g.members.includes('S-013'))g.order={kind:g.side==='GERMAN'?'ADVANCE':'HOLD',target:{q:24,r:4},risk:'NORMAL',paused:false};
 c.observeVision();
 for(const [name,key]of [['step','step'],['view','view'],['saveFileNow','save']]){const f=a[name].bind(a);a[name]=async(...args)=>{const t=performance.now(),tick=c.clock.tick;try{return await f(...args);}finally{put(key,{ms:performance.now()-t,seat:name==='view'?args[0]:undefined,tick:c.clock.tick,advanced:c.clock.tick-tick,battles:c.clock.battles.length,epoch:c.econ.epoch});}};}
 const ex=a.exclusive.bind(a);a.exclusive=fn=>{const t=performance.now();return ex(()=>{put('queue',{ms:performance.now()-t,depth:a.depth});return fn();});};
 return originalSet(id,s);};
let cpu=process.cpuUsage(),at=performance.now();
const timer=setInterval(()=>{const now=performance.now(),used=process.cpuUsage(cpu);cpu=process.cpuUsage();for(const s of svc.rooms.values()){const a=s.adapter;put('runtime',{at:Date.now(),tick:a.c.clock.tick,paused:a.c.clock.paused,speed:a.c.clock.speed,battles:a.c.clock.battles.length,epoch:a.c.econ.epoch,depth:a.depth,rss:process.memoryUsage().rss,cpuCores:(used.user+used.system)/((now-at)*1000),lagMaxMs:lag.max/1e6,metrics:{...s.metrics},connections:[...s.seats.values()].map(v=>({seat:v.side,closed:v.connection?.closed,unacked:v.connection?.outstanding.length??0,links:v.connection?.links.map(l=>({queued:l.jobs.length,bytes:l.bytes}))}))});}at=now;lag.reset();fs.writeFileSync(out+'/server.json',JSON.stringify(samples));},2000);
process.send?.({ready:true,url:svc.url,source:svc.source,environment:{platform:process.platform,node:process.version,cpu:os.cpus()[0].model,logicalCpus:os.cpus().length,totalMemory:os.totalmem()}});
process.on('message',async m=>{if(m.phase){phase=m.phase;process.send?.({phase});}if(m==='shutdown'){clearInterval(timer);lag.disable();await svc.close();fs.writeFileSync(out+'/server.json',JSON.stringify(samples));process.exit(0);}});

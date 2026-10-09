import fs from 'node:fs';import{gunzipSync}from'node:zlib';
const {Campaign}=await import(process.env.PERF_TAG==='before'?'../../../grand-officer-003-persistent-front/experiments/grand-release-001/territory.mjs':'../grand-release-001/territory.mjs');
const c=new Campaign();c.restore(JSON.parse(gunzipSync(fs.readFileSync('evidence/grand-perf-005/combat-start.json.gz'))),false);c.clock.paused=false;c.clock.autopause=false;
const times={},rows=[];for(const name of ['fair','snapshot','save','advance','observeVision','enemyPlan','capability']){const f=c[name];if(!f)continue;c[name]=function(...a){const t=performance.now();try{return f.apply(this,a)}finally{const x=times[name]??={calls:0,ms:0};x.calls++;x.ms+=performance.now()-t;}}}
for(let i=0;i<120;i++){const t=performance.now();c.tick();const b=performance.now();c.snapshot();rows.push({tick:c.clock.tick,step:b-t,view:performance.now()-b,battles:c.clock.battles.length});}
const out={times,rows};fs.writeFileSync('evidence/grand-perf-005/profile-'+(process.env.PERF_TAG??'before')+'.json',JSON.stringify(out));console.log(JSON.stringify({times,first:rows[0],last:rows.at(-1)}));

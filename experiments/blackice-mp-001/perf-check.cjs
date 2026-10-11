// Assertions over actual sustained executions, not synthetic protocol responses.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{gunzipSync}=require('node:zlib');
const dir=process.argv[2]||'evidence/blackice-mp-001-p1/fixed-camera';
const read=name=>JSON.parse(fs.existsSync(path.join(dir,name))?fs.readFileSync(path.join(dir,name)):gunzipSync(fs.readFileSync(path.join(dir,name+'.gz'))));
const s=read('server.json'),b=read('browser.json');assert.match(b.source,/^[a-f0-9]{40}$/);if(process.env.P1_EXPECTED_SOURCE)assert.equal(b.source,process.env.P1_EXPECTED_SOURCE);assert.equal(b.pages.length,2);assert.deepEqual(b.errors,[]);
const result={source:b.source,phases:{}};
for(const[phase,min]of[['1x',300],['4x',180]]){
 const r=s.runtime.filter(x=>x.phase===phase),steps=s.step.filter(x=>x.phase===phase&&x.advanced);const seconds=(r.at(-1).at-r[0].at)/1000;
 assert(seconds>=min);assert(r.every(x=>!x.paused));assert(steps.some(x=>x.battles>0));assert(r.at(-1).epoch>r[0].epoch);assert(r.every(x=>x.metrics.errors===0&&x.metrics.resyncs===0&&x.metrics.connections===2));
 for(const p of b.pages){const ack=p.acks.filter(x=>x.phase===phase&&x.kind!=='SAVE'&&x.operation!=='CLOCK');assert(ack.length>=10);assert(ack.every(x=>x.status==='APPLIED'));assert(p.panFeedback.some(x=>x.phase===phase));}
 const gestures=b.actions.filter(x=>x.phase===phase&&x.kind==='roundtrip gesture');assert(gestures.length>=10);for(const g of gestures){const numbers=v=>(v.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)||[]).map(Number),before=numbers(g.before),after=numbers(g.after);assert.equal(before.length,after.length);assert(before.every((v,i)=>Math.abs(v-after[i])<.001),'Camera roundtrip drift');}
 result.phases[phase]={seconds,ticks:steps.length,combatSteps:steps.filter(x=>x.battles>0).length,epochs:[r[0].epoch,r.at(-1).epoch],gestures:gestures.length,continuousSelectedHeadingTimingAvailable:b.pages.every(p=>p.localFeedback.some(x=>x.phase===phase))};
}
assert(b.pages.flatMap(x=>x.acks).filter(x=>x.kind==='SAVE').every(x=>x.status==='APPLIED'));
fs.writeFileSync(path.join(dir,'execution-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));

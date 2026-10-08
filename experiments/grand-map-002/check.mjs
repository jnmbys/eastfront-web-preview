import assert from 'node:assert/strict';
import fs from 'node:fs';import {gunzipSync} from 'node:zlib';
import {Campaign} from './authority.mjs';import {Campaign as Base} from '../grand-map-r1/authority.mjs';import {estimate} from './estimates.mjs';
const saved=JSON.parse(JSON.parse(gunzipSync(fs.readFileSync('evidence/grand-map-r1/battle-t10.save.json.gz'))).payload).campaign;
const a=new Base(),b=new Campaign();a.restore(saved);b.restore(saved);
const rows=fs.readFileSync('evidence/grand-map-r1/browser-commands.jsonl','utf8').trim().split('\n').map(JSON.parse).slice(39,122);
let steps=0,commands=0;const predictions=[],ends=new Map();
for(const row of rows){
 if(row.kind==='OPERATION'&&row.status==='APPLIED'){for(const c of[a,b])c.transaction({id:row.requestId,version:c.version,operation:row.payload});commands++;}
 if(row.type==='step-end'&&row.changed){a.tick();b.tick();steps++;assert.equal(b.clock.tick,row.tick);
  const d=b.snapshot();for(const x of d.continuous.map.battles)predictions.push({tick:b.clock.tick,id:x.id,...x.estimate});
  for(const x of b.clock.engagements.ended)ends.set(x.id,x.endedAt);
  for(const x of d.continuous.map.actions){if(x.segment)assert.equal(x.progress,x.segment.completed/x.segment.total);else assert.equal(x.progress,undefined);}
 }
 assert.deepEqual(a.state,b.state);assert.deepEqual(a.econ,b.econ);assert.equal(a.clock.rng,b.clock.rng);assert.deepEqual(a.clock.engagements,b.clock.engagements);assert.deepEqual(a.fair('GERMAN'),b.fair('GERMAN'));assert.deepEqual(a.fair('SOVIET'),b.fair('SOVIET'));
}
const savedNew=b.save(),restored=new Campaign();restored.restore(savedNew);assert.equal(restored.clock.paused,true);assert.deepEqual(restored.clock.displayForecast,b.clock.displayForecast);assert.deepEqual(restored.snapshot().continuous.map.battles,b.snapshot().continuous.map.battles);
const sample=(tick,org)=>({tick,units:[{id:'a',side:'GERMAN',org:[org,org+10],strength:[90,100],blocked:false},{id:'b',side:'SOVIET',org:[80,90],strength:[90,100],blocked:false}]});
assert.equal(estimate([sample(1,70)],'GERMAN').status,'ASSESSING');assert.equal(estimate([sample(1,70),sample(2,70),sample(3,70)],'GERMAN').status,'STALLED');assert.equal(estimate([sample(1,70),sample(2,60),sample(3,50)],'GERMAN').status,'ESTIMATED');
// Extra support formation prevents a single weak pair from representing the whole group.
const solo=[sample(1,70),sample(2,60),sample(3,50)],many=structuredClone(solo);
for(const row of many)row.units.push({id:'support',side:'GERMAN',org:[90,100],strength:[90,100],blocked:false});
assert.equal(estimate(many,'GERMAN').status,'STALLED');assert.ok(estimate(solo,'GERMAN').minutes[0]>0);
// Same-band changes cannot affect the derived forecast; opposing precise fields stay null.
for(const x of b.snapshot().continuous.map.battles)for(const u of x.participants.filter(u=>u.side!=='GERMAN')){assert.equal(u.org,null);assert.equal(u.personnel,null);assert.equal(u.supply,null);}
assert.ok(Object.values(b.clock.displayForecast.contacts).every(r=>r.samples.length<=6));assert.ok(b.clock.displayForecast.audit.length<=600);
const frozen=JSON.stringify(b.snapshot().continuous.map);b.clock.paused=true;b.tick();assert.equal(JSON.stringify(b.snapshot().continuous.map),frozen);
const compared=predictions.map(x=>({...x,actualEndTick:ends.get(x.id)??null,actualRemainingMinutes:ends.has(x.id)?(ends.get(x.id)-x.tick)*5:null}));
assert.ok(compared.some(x=>x.status==='ESTIMATED'));
fs.writeFileSync('evidence/grand-map-002/estimates-vs-end.json',JSON.stringify(compared,null,2));
fs.writeFileSync('evidence/grand-map-002/check.json',JSON.stringify({steps,commands,tick:b.clock.tick,rng:b.clock.rng,stateEconomyFairViewsEngagementsEqual:true,restoreEqual:true,finite:compared.filter(x=>x.status==='ESTIMATED').length,estimates:compared.length},null,2));console.log(fs.readFileSync('evidence/grand-map-002/check.json','utf8'));

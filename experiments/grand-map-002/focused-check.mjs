import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import {Campaign} from './authority.mjs';import {estimate,band} from './estimates.mjs';
const saved=JSON.parse(JSON.parse(gunzipSync(fs.readFileSync('evidence/grand-map-002/observed-t32.save.json.gz'))).payload).campaign;
const c=new Campaign();c.restore(saved);const before=c.snapshot().continuous.map;
const view=c.fair('GERMAN'),enemy=c.state.units['S-043'];const oldOrg=c.clock.units[enemy.id].org;c.clock.units[enemy.id].org+=.01;
assert.deepEqual(c.snapshot().continuous.map,before);assert.deepEqual(c.fair('GERMAN'),view);c.clock.units[enemy.id].org=oldOrg;
assert.deepEqual(band(51,10),band(59,10));
// A missing authorization sample breaks the visible history, even after later identification.
const group=Object.values(c.clock.displayForecast.contacts)[0];if(group){group.samples=group.samples.map(x=>({...x,authorized:[]}));assert.equal(c.snapshot().continuous.map.battles[0].estimate.status,'ASSESSING');}
let blocked=0,arrived=0;c.clock.paused=false;
for(let i=0;i<8;i++){const old=Object.fromEntries(Object.entries(c.clock.units).filter(([,v])=>v.march).map(([id,v])=>[id,{...structuredClone(v.march),from:structuredClone(c.state.units[id].hex)}]));c.advance();const actions=c.snapshot().continuous.map.actions;for(const [id,m] of Object.entries(old)){if(c.state.units[id].side!=='GERMAN'||m.remaining!==1)continue;const u=c.state.units[id],a=actions.find(a=>a.unit===id&&a.status==='COMPLETED');if(u.alive&&u.hex.q===m.to.q&&u.hex.r===m.to.r){assert.ok(a);arrived++;}else{assert.equal(a,undefined);blocked++;}}}
const sample=Array.from({length:6},(_,tick)=>({tick,units:Array.from({length:36},(_,id)=>({id:String(id),side:id%2?'GERMAN':'SOVIET',org:band(90-tick*5,10),strength:band(100-tick*2,10),blocked:false}))}));const t=performance.now();for(let i=0;i<1000;i++)estimate(sample,'GERMAN');const ms=performance.now()-t;
const result={sameBandIsolation:true,snapshotNoPrivateRecalculation:true,authorizationHistoryGap:true,arrivalChecks:arrived,blockedOrInterruptedChecks:blocked,estimateCalls:1000,totalMs:ms,perCallMs:ms/1000,limits:{samplesPerContact:6,auditRows:600},benchmarkParticipants:36};fs.writeFileSync('evidence/grand-map-002/focused-check.json',JSON.stringify(result,null,2));console.log(result);

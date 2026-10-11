import fs from 'node:fs';import readline from 'node:readline';import path from 'node:path';import assert from 'node:assert/strict';
import {resolve} from '../blackice-001/combat.mjs';
import {createGunzip} from 'node:zlib';
const out=process.argv[2]??'evidence/blackice-content-001',final=JSON.parse(fs.readFileSync(path.join(out,'final.json'),'utf8'));
const ids=final.units.map(x=>x.unit.id),summary={tick:final.tick,stop:final.stop,cohort:{},production:[],adoption:[],conservation:final.conservation},seen=new Map(),previous=new Map();
let last,initial,received={};
for(const id of ids){summary.cohort[id]={arrivedPersonnel:0,arrivedEquipment:{},firstArrival:{},fullyEquippedTick:null,fullyStaffedTick:null,lossPersonnel:0};received[id]={};}
const raw=path.join(out,'timeline.ndjson'),input=fs.existsSync(raw)?fs.createReadStream(raw):fs.createReadStream(raw+'.gz').pipe(createGunzip());
for await(const line of readline.createInterface({input})){
 const r=JSON.parse(line);if(r.kind==='command'&&r.type==='DIVISION_FORMAL_ADOPT')summary.adoption.push(r);if(r.kind!=='state')continue;
 initial??=r;last=r;
 if(!summary.production.length||summary.production.at(-1).produced!==r.produced.support_equipment_1)summary.production.push({tick:r.tick,produced:r.produced.support_equipment_1,stock:r.stock.support_equipment_1,workDay:r.line.workDay,progress:r.line.progress,efficiency:r.line.efficiency,missing:r.line.missing});
 for(const x of r.transit){const key=JSON.stringify(x);if(!seen.has(key))seen.set(key,x);}
 for(const u of r.units){const s=summary.cohort[u.id],old=previous.get(u.id),f=u.refill;
  if(f?.tick===r.tick){s.arrivedPersonnel+=f.personnel;for(const[k,q]of Object.entries(f.items)){s.arrivedEquipment[k]=(s.arrivedEquipment[k]??0)+q;if(q&&!s.firstArrival[k])s.firstArrival[k]=r.tick;}}
  if(old)s.lossPersonnel+=old.personnel+(f?.tick===r.tick?f.personnel:0)-u.personnel;
  if(u.target.equipment.support_equipment_1===30&&Object.entries(u.target.equipment).every(([k,q])=>u.held[k]>=q))s.fullyEquippedTick??=r.tick;
  if(u.target.manpower===2850&&u.personnel===2850)s.fullyStaffedTick??=r.tick;
  previous.set(u.id,u);
 }
}
summary.firstSupportDispatch=[...seen.values()].filter(x=>x.model==='support_equipment_1').sort((a,b)=>a.dispatched-b.dispatched).slice(0,3);
summary.firstSupportDispatch=summary.firstSupportDispatch.map(x=>({unit:x.unit,quantity:x.quantity,dispatched:x.dispatched,arrival:x.arrival,routeEdges:x.route.path.length,hub:x.route.hub,source:x.route.source,freightTonnes:x.quantity*.05,trainWork:x.quantity*.05*Math.max(1,x.route.path.length)}));
summary.supportFinal={initialReserve:60,produced:final.nation.produced.support_equipment_1,nationalStock:final.nation.stock.support_equipment_1,heldCohort:final.units.reduce((n,x)=>n+x.unit.held.support_equipment_1,0),lostNational:final.nation.lost.support_equipment_1};
summary.dispatchCount=seen.size;summary.pendingAtEnd=last.transit.length;
summary.transportAccounting={};
for(const model of ['personnel','infantry_equipment_1','support_equipment_1']){
 const dispatched=[...seen.values()].filter(x=>x.model===model).reduce((n,x)=>n+x.quantity,0),arrived=Object.values(summary.cohort).reduce((n,x)=>n+(model==='personnel'?x.arrivedPersonnel:x.arrivedEquipment[model]??0),0),pending=last.transit.filter(x=>x.model===model).reduce((n,x)=>n+x.quantity,0);
 summary.transportAccounting[model]={dispatched,arrived,pending,returnedOrCancelled:dispatched-arrived-pending};assert(dispatched>=arrived+pending);
}
for(const u of last.units){const s=summary.cohort[u.id];Object.assign(s,{initialPersonnel:2500,finalPersonnel:u.personnel,missingPersonnel:u.target.manpower-u.personnel,heldSupport:u.held.support_equipment_1});assert.equal(2500+s.arrivedPersonnel-u.personnel,s.lossPersonnel);}
summary.bottleneck={nationalManpower:final.nation.manpower,personnelRateCapDay:300,actualPersonnelDay:Object.fromEntries(ids.map(id=>[id,summary.cohort[id].arrivedPersonnel/((final.tick-240)/288)])),endRows:last.units.map(u=>({unit:u.id,need:u.supply.need,received:u.supply.received,reason:u.refill.reason,constraints:u.supply.constraints,refill:u.refill.personnelRateDay})),cargo:last.cargo?.sides?.GERMAN};
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2));
// Controlled kernel ablation, with actual naturally acquired state and equal deterministic draws.
// No campaign is advanced or replenished here; this is not a natural battle result.
const source=final.units.find(x=>x.unit.id==='G-025'),natural=source.attributes,without=structuredClone(natural);
without.components.find(x=>x.id==='ENGINEER').satisfaction=0;
const units={A:{side:'GERMAN',hex:{q:0,r:0}},B:{side:'SOVIET',hex:{q:1,r:0}}};
const run=(a,fort=0)=>resolve({contacts:[{units:['A','B'],initiators:['A'],hex:'1,0'}],units,stats:{A:a,B:natural},random:()=>.5,ground:()=>({terrain:'PLAIN',river:true}),fortification:()=>fort});
const withRiver=run(natural),withoutRiver=run(without),sat=natural.components.find(x=>x.id==='ENGINEER').satisfaction;
assert(withRiver.traces.find(x=>x.source==='A').attack>withoutRiver.traces.find(x=>x.source==='A').attack);
const effects={kind:'controlled same naturally acquired attributes / engineer-effect ablation, NOT natural battle or full-strength proof',unit:source.unit.id,tick:final.tick,personnel:source.unit.personnel,target:source.unit.target.manpower,support:source.unit.held.support_equipment_1,satisfaction:sat,river:{with:withRiver.traces.find(x=>x.source==='A'),without:withoutRiver.traces.find(x=>x.source==='A'),factorWith:.65+.15*sat,factorWithout:.65},fortificationFormula:'min(works/288,1) * (0.10 + 0.05 * engineer satisfaction); additional damage effect depends on attack crossing defense, not guaranteed',forestHillBonus:'catalog fields not consumed by BLACKICE combat resolver; not claimed'};
fs.writeFileSync(path.join(out,'effects.json'),JSON.stringify(effects,null,2));console.log(JSON.stringify({stop:summary.stop,tick:summary.tick,cohort:summary.cohort,support:summary.supportFinal,river:effects.river}));

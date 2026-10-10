import test from 'node:test';import assert from 'node:assert/strict';
import {attributeCases,duration} from './revision-audit.mjs';
import {accrueReception,debitReception,receptionRates,CURRENT_RECEPTION,LEGACY_RECEPTION} from './reception.mjs';
import {Campaign} from './authority.mjs';
import {cfg} from '../grand-economy-002/config.mjs';
import {uniqueActions,explainBattle} from './presentation.mjs';
test('component accounting separates unfilled personnel from absent support kit',()=>{
 const [base,expanded,zero,half,full]=attributeCases();
 assert.equal(base.paper.orgMax,60);assert.equal(full.paper.orgMax,40);
 assert.equal(zero.effective.softAttack,base.effective.softAttack);
 assert.equal(zero.components[0].satisfaction,1);assert.equal(zero.components[1].satisfaction,0);
 assert.equal(half.effective.softAttack,7.5);assert.equal(full.effective.softAttack,9);
 assert.equal(expanded.components[0].satisfaction,1000/1300);
 assert.equal(full.components.reduce((n,x)=>n+x.orgTerm*x.orgWeight,0),40);
});
test('extracted reception algorithm exactly preserves baseline accrual/debit',()=>{
 const a={personnel:0,infantry_equipment_1:0,support_equipment_1:0},b=structuredClone(a);
 for(let tick=0;tick<10000;tick++){const factor=[1,.25,.5][tick%3],r=cfg.personnelDay/288*factor,q=cfg.equipmentDay/288*factor;
 b.personnel=Math.min(1+r,b.personnel+r);for(const k of ['infantry_equipment_1','support_equipment_1'])b[k]=Math.min(1+q,b[k]+q);
 const allowed=accrueReception(a,factor);assert.deepEqual(a,b);assert.deepEqual(allowed,Object.fromEntries(Object.entries(b).map(([k,v])=>[k,Math.floor(v+1e-9)])));
 const sent={personnel:tick%2?allowed.personnel:0,equipment:{infantry_equipment_1:allowed.infantry_equipment_1,support_equipment_1:tick%5?allowed.support_equipment_1:0}};
 debitReception(a,sent);b.personnel=Math.max(0,b.personnel-sent.personnel);for(const k of Object.keys(sent.equipment))b[k]=Math.max(0,b[k]-sent.equipment[k]);assert.deepEqual(a,b);
 }
});
test('one accepted action rendered once while both battle associations remain available',()=>{
 const a={id:'e1:u',battleId:'e1',unit:'u',kind:'ATTACK',status:'EXECUTING',from:{q:0,r:0},to:{q:1,r:0},path:[{q:0,r:0},{q:1,r:0}]};
 const rows=[a,{...a,id:'e2:u',battleId:'e2'},{...a,id:'e1:v',unit:'v',kind:'SUPPORT'}],before=structuredClone(rows),r=uniqueActions(rows);
 assert.equal(r.length,2);assert.deepEqual(r[0].battleIds,['e1','e2']);assert.deepEqual(rows,before);
 assert.equal(uniqueActions([{...a,kind:'MOVE'},{...a,kind:'RETREAT'}]).length,2);
 assert.equal(explainBattle({participants:[{id:'enemy'}]}).participants[0].org,undefined);
});
test('real rate and freight loops reveal 50 day reception cap and indivisible support blockage',()=>{
 assert.equal(duration(false,'stocked').allDays,50);assert.equal(duration(true,'stocked').allDays,15);
 const r=duration(true,'no-whole-support');assert.equal(r.allDays,null);assert.equal(r.remaining.support_equipment_1,30);
});
test('approved rates apply only to new campaigns; missing old field restores explicitly as old rate',()=>{
 const c=new Campaign();assert.equal(c.clock.divisionLedger.receptionPolicy,CURRENT_RECEPTION);
 const s=c.save();delete s.clock.divisionLedger.receptionPolicy;c.restore(s);
 assert.equal(c.clock.divisionLedger.receptionPolicy,LEGACY_RECEPTION);assert.equal(receptionRates(c.clock.divisionLedger.receptionPolicy).equipmentDay,2);
 const before=structuredClone(c.clock.divisionLedger.units);c.restore(c.save());assert.deepEqual(c.clock.divisionLedger.units,before);
 s.clock.divisionLedger.receptionPolicy='future';assert.throws(()=>c.restore(s),/UNSUPPORTED_RECEPTION_POLICY/);
 assert.equal(duration(false,'stocked',CURRENT_RECEPTION).allDays,10);
 assert.equal(duration(true,'stocked',CURRENT_RECEPTION).allDays,3);
});

import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createInventory,validate,totals,returnSurplus,settle} from './inventory.mjs';
import {transportProgress} from './freight-progress.mjs';
import {freightPolicy,debitReception} from './reception.mjs';
const I='infantry_equipment_1',S='support_equipment_1',emptyCargo=()=>({train:0,edges:{},hubs:{},sources:{}});
function fixture(){const s=createInventory({nations:{GERMAN:{manpower:0,stock:{[I]:0,[S]:1}},SOVIET:{manpower:0,stock:{[I]:0,[S]:0}}},units:{A:{id:'A',side:'GERMAN',personnel:1300,held:{[I]:110,[S]:29},target:{manpower:1300,equipment:{[I]:110,[S]:30}},revision:0,org:30,trainingExperience:0}}});const o={network:{rows:{A:{routes:[{source:'source',hub:'hub',path:['rail']}]}},hubs:[{id:'hub',capacity:.03,used:0}],sources:{},edges:{},trainUsed:0},rails:{rail:{level:1,damage:0}},trainCapacity:100,sourceCapacity:100,railCapacity:100,policy:freightPolicy,rates:{personnel:0,[I]:0,[S]:1},destination:'1,1',tick:1,cargo:emptyCargo()};return {s,o};}
test('0.03 hourly work completes one real 0.04 item across periods, not phantom capacity',()=>{
 const {s,o}=fixture(),before=totals(s),a=transportProgress(s,'A',o);validate(s);
 assert.equal(s.nations.GERMAN.stock[S],0);assert.equal(s.units.A.held[S],29);assert.equal(a.cargo.hubs.hub,.03);assert.equal(a.inTransit[0].work,.03);assert.equal(a.equipment[S],0);
 const credits={personnel:0,[I]:0,[S]:1};debitReception(credits,a);assert.equal(credits[S],0);
 const restored=JSON.parse(JSON.stringify(s)),b=transportProgress(restored,'A',{...o,tick:12,cargo:emptyCargo(),rates:credits});validate(restored);
 assert.equal(restored.units.A.held[S],30);assert.ok(Math.abs(b.cargo.hubs.hub-.01)<1e-10);assert.equal(Object.keys(restored.freightReservations).length,0);assert.deepEqual(totals(restored),before);
 const again=transportProgress(restored,'A',{...o,tick:12,cargo:b.cargo,rates:credits});assert.equal(again.equipment[S],0);assert.equal(restored.units.A.held[S],30);
 fs.mkdirSync('evidence/grand-division-002/closeout',{recursive:true});fs.writeFileSync('evidence/grand-division-002/closeout/two-periods.json',JSON.stringify({kind:'directed-real-freight-functions',first:a,second:b,totals:before},null,2));
});
test('same-period work cannot be reused; no stock is reserved without paid positive capacity',()=>{
 const {s,o}=fixture(),a=transportProgress(s,'A',o),b=transportProgress(s,'A',{...o,tick:2,cargo:a.cargo});assert.equal(b.inTransit[0].work,.03);assert.equal(b.cargo.hubs.hub,.03);
 const f=fixture();f.o.trainCapacity=0;const r=transportProgress(f.s,'A',f.o);assert.equal(r.inTransit.length,0);assert.equal(f.s.nations.GERMAN.stock[S],1);
});
test('broken route or changed destination cancels reservation, never refunds spent work',()=>{
 for(const change of ['route','destination']){const {s,o}=fixture(),a=transportProgress(s,'A',o);if(change==='route')o.rails.rail.damage=1;else o.destination='2,1';
 const b=transportProgress(s,'A',{...o,tick:2,cargo:a.cargo});validate(s);assert.equal(s.nations.GERMAN.stock[S],1);assert.equal(s.units.A.held[S],29);assert.equal(b.cargo.hubs.hub,.03);assert.equal(b.inTransit.length,0);}
});
test('downsizing returns reserved item once plus actual surplus; fractional work gives no extra equipment',()=>{
 const {s,o}=fixture(),before=totals(s);transportProgress(s,'A',o);returnSurplus(s,'A',{manpower:1000,equipment:{[I]:100,[S]:0}});validate(s);assert.equal(s.nations.GERMAN.stock[S],30);assert.deepEqual(totals(s),before);returnSurplus(s,'A',{manpower:1000,equipment:{[I]:100,[S]:0}});assert.equal(s.nations.GERMAN.stock[S],30);
});
test('failed commit discards reservations and work; already settled tick is rejected',()=>{
 const {s,o}=fixture(),before=structuredClone(s);assert.throws(()=>settle(s,0,d=>{transportProgress(d,'A',o);throw Error('FAIL_AFTER_RESERVE');}),/FAIL_AFTER_RESERVE/);assert.deepEqual(s,before);
 const next=settle(s,0,d=>transportProgress(d,'A',o));assert.throws(()=>settle(next.state,0,d=>transportProgress(d,'A',o)),/OUT_OF_SEQUENCE/);assert.equal(next.state.nations.GERMAN.stock[S],0);assert.equal(next.state.units.A.held[S],29);
});

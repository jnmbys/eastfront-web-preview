import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createInventory,validate,totals,returnSurplus,settle} from './inventory.mjs';
import {transportProgress} from './freight-progress.mjs';
import {freightPolicy,debitReception} from './reception.mjs';
import {planNetwork} from '../grand-economy-002/network.mjs';
import {canonicalEdgeKey} from '../../vendor/eastfront-digital-core/dist/index.js';
import {Campaign} from './authority.mjs';
import {emptyDraft} from '../grand-division-001/templates.mjs';
import {initializeFormal,formalTransaction} from './formal.mjs';
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

test('captured source removes the authorized route; reserved goods return to original nation once, not the captor',()=>{
 const {s,o}=fixture(),a={q:0,r:0},b={q:1,r:0},edge=canonicalEdgeKey(a,b);
 const view={hexes:[{coord:a,control:'GERMAN',terrain:'PLAIN'},{coord:b,control:'GERMAN',terrain:'PLAIN'}],edges:[{key:edge,a,b,railway:{destroyed:false}}],units:[{id:'A',side:'GERMAN',hex:b,friendly:{alive:true}}]};
 const e={rails:{[edge]:{id:edge,level:1,damage:0}},hubs:{hub:{id:'hub',hex:'1,0',level:1,motor:0}},nations:{GERMAN:{stock:{TRAIN:10,TRUCK:0}}},priorities:{},establishment:{A:{}},divisionDailyNeed:{A:.01}};
 const network=()=>planNetwork(view,e,'GERMAN',[{id:'source',hex:'0,0',sourceQ:1}],{tick:1,units:{A:{personnel:1300,max:1300}}},[]);
 const connected=network();assert.equal(connected.rows.A.routes.length,1);
 o.network.rows.A.routes=connected.rows.A.routes;o.rails=e.rails;
 const sent=transportProgress(s,'A',o),paid=structuredClone(sent.cargo),before=totals(s);
 view.hexes[0].control='SOVIET';const captured=network();assert.equal(captured.rows.A.routes.length,0);
 const next={...o,network:captured,tick:2,cargo:paid};
 for(let i=0;i<2;i++){const r=transportProgress(s,'A',next);assert.deepEqual(r.cargo,paid);assert.equal(r.equipment[S],0);}
 validate(s);assert.deepEqual(totals(s),before);assert.equal(s.nations.GERMAN.stock[S],1);assert.equal(s.nations.SOVIET.stock[S],0);assert.equal(s.units.A.held[S],29);assert.equal(Object.keys(s.freightReservations).length,0);
});

test('formal readoption cancels escrow atomically; replay and stale competition do not return goods or capacity twice',()=>{
 const {s,o}=fixture(),t=emptyDraft();t.regiments[0][0]='INFANTRY';t.support[0]='ENGINEER';Object.assign(t,{id:'old',side:'GERMAN',version:1,status:'FORMAL'});
 const reduced=structuredClone(t);reduced.id='new';reduced.support[0]=null;
 Object.assign(s.units.A,{templateId:t.id,templateVersion:1});s.id='directed-readoption';initializeFormal(s,{old:t,new:reduced});
 const sent=transportProgress(s,'A',o),paid=structuredClone(sent.cargo),before=totals(s);
 const req={id:'readopt-reserved',version:s.version,operation:{type:'FORMAL_ADOPT',unit:'A',expectedUnitRevision:s.units.A.revision,templateId:'new',expectedTemplateVersion:1}};
 assert.throws(()=>formalTransaction(s,req,'GERMAN',()=>{throw Error('INELIGIBLE');}),/INELIGIBLE/);assert.equal(s.freightReservations['A:'+S].work,.03);
 const out=formalTransaction(s,req,'GERMAN',()=>{}),restored=JSON.parse(JSON.stringify(out.state));
 assert.deepEqual(formalTransaction(restored,req,'GERMAN',()=>{}).receipt,out.receipt);
 assert.throws(()=>formalTransaction(restored,{...req,id:'readopt-competing'},'GERMAN',()=>{}),/STALE_VERSION/);
 assert.equal(restored.nations.GERMAN.stock[S],30);assert.equal(restored.nations.SOVIET.stock[S],0);assert.deepEqual(totals(restored),before);
 const r=transportProgress(restored,'A',{...o,tick:2,cargo:paid});assert.deepEqual(r.cargo,paid);assert.equal(r.equipment[S],0);assert.equal(restored.units.A.held[S],0);validate(restored);
});

test('authoritative death cleanup survives save/restart, excludes dead target and never refunds spent capacity',()=>{
 const c=new Campaign(),id='G-013',p=c.clock.divisionLedger,u=p.units[id];
 // Directed fixture only: move one existing rifle from the unit to its own pool.
 u.held[I]--;p.nations.GERMAN.stock[I]++;
 const {o}=fixture();o.network.rows[id]=o.network.rows.A;o.network.hubs[0].capacity=.0075;
 const sent=transportProgress(p,id,{...o,destination:JSON.stringify(c.state.units[id].hex),rates:{personnel:0,[I]:1,[S]:0},tick:0});
 assert.equal(sent.inTransit.length,1);const paid=structuredClone(sent.cargo);
 c.econ.modern.cargoHour={hour:0,sides:{GERMAN:paid,SOVIET:emptyCargo()}};
 c.state.units[id].alive=false;c.recordEquipmentLoss();c.clock.tick=1;c.economyStep();
 assert.equal(p.nations.GERMAN.stock[I],1);assert.equal(p.nations.SOVIET.stock[I],0);assert.equal(u.held[I],0);assert.equal(Object.keys(p.freightReservations).length,0);assert.deepEqual(c.econ.modern.cargoHour.sides.GERMAN,paid);validate(p);
 const restored=new Campaign();restored.restore(c.save());restored.clock.tick=2;restored.economyStep();
 assert.equal(restored.clock.divisionLedger.nations.GERMAN.stock[I],1);assert.equal(restored.clock.divisionLedger.units[id].held[I],0);assert.deepEqual(restored.econ.modern.cargoHour.sides.GERMAN,paid);validate(restored.clock.divisionLedger);
});

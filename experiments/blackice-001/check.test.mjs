import test from 'node:test';import assert from 'node:assert/strict';
import {Campaign} from './authority.mjs';import {Campaign as Old} from '../grand-division-003/authority.mjs';
import {PROFILE,reference} from './catalog.mjs';import {cfg,freightPolicy} from './config.mjs';
import {emptyDraft} from '../grand-division-001/templates.mjs';import {attributes} from '../grand-division-002/combat.mjs';
import {modelDemand} from '../grand-division-002/model-demand.mjs';import {totals,validate,produce,createInventory} from '../grand-division-002/inventory.mjs';
import {production,setLine,refreshNetwork} from '../grand-economy-002/economy.mjs';import {transportProgress} from '../grand-division-002/freight-progress.mjs';
import {travel} from '../grand-play-001/planner.mjs';import {armorFactor} from './combat.mjs';
import {transport as physicalTransport} from './freight.mjs';
import {cancelReservedFreight} from '../grand-division-002/inventory.mjs';
function t(...ids){const t=emptyDraft();ids.forEach((id,i)=>t.regiments[i][0]=id);return t;}
test('scoped catalog and effective contributions; no old-profile migration',()=>{
 const a=t('INFANTRY','ANTI_TANK'),d=modelDemand(a,PROFILE);assert.equal(d.manpower,1850);assert.equal(d.equipment.anti_tank_equipment_2,24);
 const full=attributes(a,{personnel:d.manpower,held:d.equipment},PROFILE),short=attributes(a,{personnel:d.manpower,held:{...d.equipment,anti_tank_equipment_2:0}},PROFILE);
 assert(full.effective.hardAttack>short.effective.hardAttack);assert.equal(short.components[0].satisfaction,1);assert.equal(short.components[1].satisfaction,0);assert(full.paper.orgMax>25&&full.paper.orgMax<35);
 assert.equal(armorFactor(18,30),.76);assert.equal(armorFactor(0,30),.4);
 const c=new Campaign();assert.throws(()=>c.restore(new Old().save()),/BLACKICE/);assert.throws(()=>new Old().restore(c.save()),/SAVE/);
});
test('normal manifest, both-side fairness, immutable initial accounting, paused restore',()=>{
 const c=new Campaign();assert.equal(c.clock.divisionLedger.formal.xp.GERMAN,0);validate(c.clock.divisionLedger);const initial=structuredClone(c.clock.divisionLedger.initial);
 for(let i=0;i<24;i++)c.advance();assert.deepEqual(c.clock.divisionLedger.initial,initial);
 const saved=c.save(),restored=new Campaign();restored.restore(saved);assert.equal(restored.clock.paused,true);assert.deepEqual(restored.clock.divisionLedger,c.clock.divisionLedger);
 const view=restored.snapshot();assert(view.divisions.integrated.units.every(u=>u.side===restored.viewer));assert.equal(view.modern.config.militaryWorkDay,120);
 c.advance();restored.advance();assert.deepEqual(c.clock.divisionLedger,restored.clock.divisionLedger);assert.equal(c.clock.rng,restored.clock.rng);
});
test('network unit is hourly tonnes, daily demand cannot monopolize whole hourly flow',()=>{
 const c=new Campaign(),e=c.econ.modern;refreshNetwork(c);
 const id=Object.keys(e.net.GERMAN.rows)[0],row=e.net.GERMAN.rows[id];assert.equal(row.need,e.divisionDailyNeed[id]/24);assert(row.local<=cfg.localFlow*2);assert(row.received<=row.need+1e-8);
 const old=c.fair('GERMAN').view,first=structuredClone(e.net.GERMAN);
 for(const u of Object.values(c.state.units).filter(u=>u.side==='SOVIET'))c.clock.units[u.id].org=1;
 refreshNetwork(c);assert.deepEqual(e.net.GERMAN.rows,first.rows);
});
test('10km travel has physical duration and zero available speed blocks movement',()=>{
 const v={hexes:[{coord:{q:1,r:0},terrain:'PLAIN'}],edges:[]};assert.equal(travel(v,{q:0,r:0},{q:1,r:0},{physicalSpeed:4}),30);assert.equal(travel(v,{q:0,r:0},{q:1,r:0},{physicalSpeed:0}),Infinity);
});
test('retool destroys in-process work not finished stock; new work and costs used',()=>{
 const c=new Campaign(),e=c.econ.modern,l=e.lines['GERMAN:infantry_equipment_1'];const stock=e.nations.GERMAN.stock.infantry_equipment_1;l.progress=.2;l.efficiency=.8;
 setLine(e,'GERMAN',{line:l.id,product:'anti_tank_equipment_2',factories:l.factories,priority:1});assert.equal(l.progress,0);assert.equal(l.efficiency,.2);assert.equal(l.lostWork,.2);assert.equal(e.nations.GERMAN.stock.infantry_equipment_1,stock);production(c,false);assert(l.workDay<=120*l.factories.length*.2+1e-9);
});
test('8 tonne tank crosses finite hourly reservations; blocked route returns stock, not spent work',()=>{
 const target=modelDemand(t('LIGHT_ARMOR'),PROFILE),zero=()=>Object.fromEntries(Object.keys(reference.models).map(k=>[k,0]));
 const s=createInventory({profile:PROFILE,nations:Object.fromEntries(['GERMAN','SOVIET'].map(side=>[side,{manpower:0,stock:zero()}])),units:{A:{id:'A',side:'GERMAN',target,personnel:0,held:zero(),revision:0,org:0,trainingExperience:0}}});produce(s,{line:'L',side:'GERMAN',model:'leichttraktor_lt0',work:reference.models.leichttraktor_lt0.cost});
 const cargo={train:0,hubs:{},sources:{},edges:{}},network={rows:{A:{routes:[{hub:'H',source:'S',path:['E']}]}},hubs:[{id:'H',capacity:3,used:0}],trainUsed:0,sources:{},edges:{}},opt={network,rails:{E:{level:1,damage:0}},trainCapacity:3,sourceCapacity:3,railCapacity:3,policy:freightPolicy,rates:{personnel:0,...zero(),leichttraktor_lt0:1},destination:'0,0',tick:1,cargo};
 const sent=transportProgress(s,'A',opt);assert.equal(sent.cargo.train,3);assert.equal(s.units.A.held.leichttraktor_lt0,0);assert.equal(s.nations.GERMAN.stock.leichttraktor_lt0,0);validate(s);
 network.rows.A.routes=[];const cancelled=transportProgress(s,'A',{...opt,cargo:sent.cargo,tick:2});assert.equal(cancelled.cargo.train,3);assert.equal(s.nations.GERMAN.stock.leichttraktor_lt0,1);validate(s);
});
test('paid shipment is not equipment until timed arrival; save, capture and re-adoption conserve escrow',()=>{
 const target=modelDemand(t('INFANTRY'),PROFILE),zero=()=>Object.fromEntries(Object.keys(reference.models).map(k=>[k,0]));
 const s=createInventory({profile:PROFILE,nations:Object.fromEntries(['GERMAN','SOVIET'].map(side=>[side,{manpower:20,stock:zero()}])),units:{A:{id:'A',side:'GERMAN',target,personnel:0,held:zero(),revision:0,org:0,trainingExperience:0}}});s.balance={transit:[]};produce(s,{line:'L',side:'GERMAN',model:'infantry_equipment_1',work:.48});
 const network={rows:{A:{routes:[{hub:'H',source:'S',path:['E']}]}},hubs:[{id:'H',hex:'0,0',capacity:3,used:0}],trainUsed:0,sources:{},edges:{}},opt={network,rails:{E:{level:1,damage:0}},trainCapacity:3,sourceCapacity:3,railCapacity:3,policy:freightPolicy,rates:{personnel:1,...zero(),infantry_equipment_1:1},destination:'{"q":1,"r":0}',tick:1,cargo:{train:0,hubs:{},sources:{},edges:{}}};
 const sent=physicalTransport(s,'A',opt);assert.equal(sent.equipment.infantry_equipment_1,0);assert.equal(s.units.A.personnel,0);assert.equal(s.balance.transit.length,2);validate(s);
 const restored=JSON.parse(JSON.stringify(s)),due=Math.max(...s.balance.transit.map(x=>x.arrival));const arrived=physicalTransport(restored,'A',{...opt,tick:due,rates:{personnel:0,...zero()},cargo:sent.cargo});assert.equal(arrived.personnel,1);assert.equal(arrived.equipment.infantry_equipment_1,1);validate(restored);
 const cancelled=structuredClone(s);cancelReservedFreight(cancelled,'A');cancelReservedFreight(cancelled,'A');assert.equal(cancelled.nations.GERMAN.stock.infantry_equipment_1,1);assert.equal(cancelled.nations.GERMAN.manpower,20);validate(cancelled);
 network.rows.A.routes=[];const blocked=physicalTransport(s,'A',{...opt,tick:2,cargo:sent.cargo});assert.equal(blocked.cargo.train,sent.cargo.train);assert.equal(s.balance.transit.length,0);validate(s);
});

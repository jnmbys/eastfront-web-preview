import test from 'node:test';import assert from 'node:assert/strict';
import {Campaign,VERSION} from './authority.mjs';
import {Campaign as Before} from '../grand-division-002/authority.mjs';
import {reference,demand,TRUCK,TANK,PROFILE,freightPolicy} from './catalog.mjs';
import {emptyDraft} from '../grand-division-001/templates.mjs';
import {attributes,resolveContacts} from '../grand-division-002/combat.mjs';
import {createInventory,produce,deliver,validate,totals} from '../grand-division-002/inventory.mjs';
import {initializeFormal,formalTransaction} from '../grand-division-002/formal.mjs';
import {transportProgress} from '../grand-division-002/freight-progress.mjs';
import {fuelAdjusted,terrainModifier} from './attributes.mjs';
const copy=structuredClone;
function template(kind='INFANTRY'){const t=emptyDraft();t.regiments[0][0]=kind;return t;}
function attr(t,ratio=1){const d=demand(t);return attributes(t,{personnel:d.manpower,held:Object.fromEntries(Object.entries(d.equipment).map(([k,v])=>[k,Math.floor(v*ratio)]))},PROFILE);}
function fixture(kind='MOTORIZED'){
 const t=template(kind),d=demand(t),ids=Object.keys(reference.models),zero=()=>Object.fromEntries(ids.map(k=>[k,0])),s=createInventory({profile:PROFILE,nations:Object.fromEntries(['GERMAN','SOVIET'].map(side=>[side,{manpower:4800,stock:zero()}])),units:{A:{id:'A',side:'GERMAN',personnel:d.manpower,held:zero(),target:d,revision:0,org:10,trainingExperience:3}}});return s;
}
test('file-defined complete tank, integer demands, category restrictions and zero stock',()=>{
 assert.equal(reference.models[TANK].completeVariant.moduleSlots.main_armament_slot,'tank_small_cannon');assert(Math.abs(reference.models[TANK].cost-6.28)<1e-9);
 assert.equal(demand(template('ARTILLERY')).equipment.artillery_equipment_1,24);assert.equal(demand(template('MOTORIZED')).equipment[TRUCK],35);assert.equal(demand(template('LIGHT_ARMOR')).equipment[TANK],60);
 const t=template();t.regiments[0][1]='ARTILLERY';assert.throws(()=>demand(t),/FAMILY/);t.regiments[0][1]=null;t.support[0]='SUPPORT_ARTILLERY';assert.equal(demand(t).equipment.artillery_equipment_1,12);
});
test('mixed combat, hardness, partial piercing, real equipment and terrain',()=>{
 const inf=attr(template()),mixed=template();mixed.regiments[1][0]='ARTILLERY';assert(attr(mixed).effective.softAttack>inf.effective.softAttack);
 const mot=attr(template('MOTORIZED')),empty=attr(template('MOTORIZED'),0),tank=attr(template('LIGHT_ARMOR'));
 assert.equal(mot.paper.speed,9);assert.equal(empty.effective.speed,3);assert.equal(empty.effective.softAttack,0);assert(tank.effective.armor>0);assert.equal(terrainModifier(tank,'FOREST','movement'),-.4);
 mixed.regiments[1][0]='MOTORIZED';assert.equal(attr(mixed).effective.speed,3);assert.equal(fuelAdjusted(tank,0).effective.speed,0);assert.equal(fuelAdjusted(mot,0).effective.speed,3);
 const run=piercing=>resolveContacts({contacts:[{hex:'1,1',units:['A','B'],initiators:['A']}],units:{A:{side:'GERMAN'},B:{side:'SOVIET'}},stats:{A:{...inf,effective:{...inf.effective,piercing}},B:tank},random:()=>.5,combined:true});
 assert(run(30).damage.B>run(0).damage.B);assert.equal(run(0).damage.B*2,run(30).damage.B);
});
test('allocated logistics trucks cannot also deliver to formation; integer work retained',()=>{
 const s=fixture();produce(s,{line:'truck',side:'GERMAN',model:TRUCK,work:2.5*4+.2});assert.equal(s.nations.GERMAN.stock[TRUCK],4);assert.equal(s.lines.truck.work.toFixed(1),'.2'.replace('.','0.'));
 s.vehicleCommitments={GERMAN:{[TRUCK]:3}};assert.equal(deliver(s,'A',{personnel:0,equipment:{[TRUCK]:4}}).equipment[TRUCK],1);assert.equal(s.nations.GERMAN.stock[TRUCK],3);validate(s);
});
test('fractional work crosses periods for a tank; capture/cancel returns escrow once',()=>{
 const s=fixture('LIGHT_ARMOR');produce(s,{line:'tank',side:'GERMAN',model:TANK,work:reference.models[TANK].cost});
 const cargo=()=>({train:0,hubs:{},sources:{},edges:{}}),network={rows:{A:{routes:[{hub:'H',source:'S',path:['E']}]}},hubs:[{id:'H',capacity:.06,used:0}],trainUsed:0,sources:{},edges:{}},options={network,rails:{E:{level:1,damage:0}},trainCapacity:1,sourceCapacity:1,railCapacity:1,policy:freightPolicy,rates:{personnel:0,...Object.fromEntries(Object.keys(reference.models).map(k=>[k,k===TANK?1:0]))},destination:'1,1'};
 let sent=transportProgress(s,'A',{...options,tick:1,cargo:cargo()});assert.equal(s.units.A.held[TANK],0);assert.equal(sent.inTransit.length,1);validate(s);
 const saved=copy(s);transportProgress(s,'A',{...options,tick:2,cargo:cargo()});assert.equal(s.units.A.held[TANK],1);validate(s);
 options.network.rows.A.routes=[];sent=transportProgress(saved,'A',{...options,tick:2,cargo:cargo()});assert.equal(saved.nations.GERMAN.stock[TANK],1);assert.equal(sent.equipment[TANK],0);assert.equal(Object.keys(saved.freightReservations).length,0);validate(saved);
});
test('formal fees/returns stay atomic and idempotent in explicitly injected test fixture',()=>{
 const s=fixture('INFANTRY'),t={...template(),id:'T',version:1,side:'GERMAN',status:'FORMAL'};s.id='TEST-INJECTED';s.units.A.templateId='T';s.units.A.templateVersion=1;initializeFormal(s,{T:t});s.formal.xp.GERMAN=10;const d=copy(t);d.regiments[1][0]='ARTILLERY';
 const req={id:'test-new-template',version:0,operation:{type:'FORMAL_SAVE',baseId:'T',expectedBaseVersion:1,draft:d}},r=formalTransaction(s,req,'GERMAN',()=>{});assert.equal(r.receipt.paidXP,5);assert.deepEqual(formalTransaction(r.state,req,'GERMAN',()=>{}).state,r.state);
 const adopt={id:'test-adopt-formation',version:1,operation:{type:'FORMAL_ADOPT',unit:'A',expectedUnitRevision:0,templateId:r.receipt.templateId,expectedTemplateVersion:1}};
 assert.throws(()=>formalTransaction(r.state,adopt,'GERMAN',()=>{throw Error('BLOCKED');}),/BLOCKED/);assert.equal(r.state.units.A.templateId,'T');const adopted=formalTransaction(r.state,adopt,'GERMAN',()=>{});assert.equal(adopted.state.units.A.trainingExperience,3);assert.equal(adopted.state.units.A.org,10);assert.deepEqual(totals(adopted.state),totals(s));
});
test('normal new campaign, save isolation, fuel bookkeeping and own-only view',()=>{
 const c=new Campaign();assert.equal(c.clock.rules,VERSION);assert.equal(c.clock.divisionLedger.formal.xp.GERMAN,0);assert.equal(c.clock.divisionLedger.nations.GERMAN.stock.FUEL,0);
 for(let i=0;i<24;i++)c.advance();const saved=c.save(),r=new Campaign();r.restore(saved);assert.deepEqual(r.clock.divisionLedger,c.clock.divisionLedger);assert(r.clock.paused);assert.throws(()=>new Before().restore(saved),/PROFILE|SAVE/);assert.throws(()=>r.restore(new Before().save()),/PROFILE|SAVE/);
 const view=r.snapshot();assert(Object.keys(view.continuous.units).every(id=>r.state.units[id].side===r.viewer));assert(view.divisions.integrated.units.every(u=>u.side===r.viewer));assert.equal(view.modern.stock.TRUCK,undefined);assert.equal(view.ux.vehicles.TRUCK.available,view.modern.stock[TRUCK]);
});
import {settleFuel,validateFuel,clampFuel} from './fuel.mjs';
import {manage} from '../grand-economy-002/manager.mjs';
test('explicit fuel fixture consumes and transports only residual capacity',()=>{
 const c=new Campaign(),p=c.clock.divisionLedger,id='G-013',t={...template('MOTORIZED'),id:'TEST:FUEL',version:1,side:'GERMAN',status:'FORMAL'};p.formal.templates[t.id]=t;p.units[id].templateId=t.id;p.units[id].target=demand(t);p.units[id].held[TRUCK]=35;p.units[id].personnel=1200;
 // Clearly isolated fixture: reset conservation baseline to these declared resources.
 p.nations.GERMAN.stock.FUEL=10;p.nations.GERMAN.produced.FUEL=10;c.bindModels();c.econ.modern.cargoHour={hour:0,sides:Object.fromEntries(['GERMAN','SOVIET'].map(s=>[s,{train:0,hubs:{},sources:{},edges:{}}]))};
 const before=c.econ.modern.cargoHour.sides.GERMAN;settleFuel(c,new Set());assert((p.fuel.units[id]??0)>0);validateFuel(c);const held=p.fuel.units[id];c.econ.modern.net.GERMAN.rows[id].routes=[];c.econ.modern.net.GERMAN.rows[id].route=null;settleFuel(c,new Set([id]));assert(Math.abs(p.fuel.units[id]-(held-.1))<1e-9);assert(Math.abs(p.fuel.consumed.GERMAN-.1)<1e-9);validateFuel(c);assert(before.train>=0);
 const a=c.divisionAttributes(id);assert.equal(a.effective.speed,9);assert.equal(fuelAdjusted(a,0).effective.speed,3);const remaining=p.fuel.units[id],stock=p.nations.GERMAN.stock.FUEL;p.units[id].held[TRUCK]=0;clampFuel(c);assert.equal(p.nations.GERMAN.stock.FUEL,stock);assert.equal(p.fuel.units[id],0);assert(Math.abs(p.fuel.lost.GERMAN-remaining)<1e-9);validateFuel(c);
});
test('new-mode enemy prioritizes empty fuel without extra factory changes per day',()=>{
 const c=new Campaign(),e=c.econ.modern;c.clock.tick=600;e.fuelDemand.SOVIET=10;const view=c.fair('SOVIET').view;manage(c,view,'SOVIET');manage(c,view,'SOVIET');const fuel=e.lines['SOVIET:FUEL'];assert.equal(fuel.factories.length,1);const prior=JSON.stringify(e.lines);manage(c,view,'SOVIET');assert.equal(JSON.stringify(e.lines),prior);assert.equal(e.nations.SOVIET.stock.FUEL,0);
});

// A pure artillery design has file-defined zero organization. It must not gain
// the old normalized 100-point bar from generic rest processing.
test('zero-organization artillery does not regenerate a fictitious organization bar',()=>{
 const c=new Campaign(),p=c.clock.divisionLedger,id='G-013',t={...template('ARTILLERY'),id:'TEST:ART',version:1,side:'GERMAN',status:'FORMAL'};
 p.formal.templates[t.id]=t;p.units[id].templateId=t.id;p.units[id].target=demand(t);p.units[id].org=0;c.bindModels();
 c.clock.units[id].org=10;for(let i=0;i<3;i++)c.advance();assert.equal(c.clock.units[id].org,0);assert.equal(c.divisionAttributes(id).paper.orgMax,0);assert.equal(c.restOrgRate(id),0);
});

test('casualties while equipment absent cannot be billed to a later manufactured tank',()=>{
 const c=new Campaign(),p=c.clock.divisionLedger,id='G-017',u=p.units[id],t={...template('LIGHT_ARMOR'),id:'TEST:DEBT',version:1,side:'GERMAN',status:'FORMAL'};
 c.recordEquipmentLoss();p.formal.templates[t.id]=t;u.templateId=t.id;u.target=demand(t);p.lossFractions[id][TANK]=4.5;u.held[TANK]=0;c.recordEquipmentLoss();assert.equal(p.lossFractions[id][TANK],0);
 // Explicit fixture arrival after prior losses, no new casualties this step.
 u.held[TANK]=1;p.lossFractions[id][TANK]=4.5;const lost=p.nations.GERMAN.lost[TANK];c.recordEquipmentLoss();assert.equal(u.held[TANK],1);assert.equal(p.nations.GERMAN.lost[TANK],lost);
});

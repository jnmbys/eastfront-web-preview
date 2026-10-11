import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {fixture,observe} from './r1-authority.mjs';import {scenarios,forced} from './r1-forced.mjs';import {resolve} from './combat.mjs';import {validate} from '../grand-division-002/inventory.mjs';import {canonicalEdgeKey} from '../../vendor/eastfront-digital-core/dist/index.js';
import {planSide} from '../grand-officer-001/policy.mjs';import {Campaign as R1,VERSION} from './r1-campaign.mjs';import {Campaign as Land1} from './authority.mjs';
test('five-minute raw HP and org convert once to manpower and normalized org; no RNG lookahead',()=>{
 const {c,ids}=fixture(scenarios[0],219031),stats={};for(const id of ids){c.clock.units[id].dailySupply={effective:1};stats[id]=structuredClone(c.divisionAttributes(id));}
 const battles=[{hex:{q:24,r:4},units:ids,initiators:[ids[0]]}],ground=(target,source)=>{const a=c.state.units[source].hex,b=c.state.units[target].hex;return {terrain:c.state.hexes[b.q+','+b.r].terrain,river:c.state.edges[canonicalEdgeKey(a,b)]?.river};};
 const raw=resolve({contacts:battles,units:c.state.units,stats,random:()=>.5,ground}),damage={},orgDamage={};let calls=0;c.random=()=>{calls++;return .5;};c.resolveDivisionCombat({battles,damage,orgDamage});
 assert.equal(calls,4);for(const id of ids){assert.equal(damage[id],raw.damage[id]/stats[id].paper.hp*c.clock.units[id].max);assert.equal(orgDamage[id],raw.orgDamage[id]/stats[id].paper.orgMax*100);}
 assert(Math.abs(.05*2.5/(.1*1.5)-5/6)<1e-12);assert(Math.abs((35-25*5/6)-14.166666666666664)<1e-9);
});
test('fractional loss settles once across combat and withdrawal hooks; effective fire updates with actual equipment',()=>{
 const {c,ids}=fixture(scenarios[0],219031),id=ids[0],p=c.clock.divisionLedger,u=p.units[id],n=p.nations[u.side],before=u.personnel;
 c.clock.units[id].personnel-=.6;c.recordEquipmentLoss();assert.equal(u.personnel,before);c.recordEquipmentLoss();assert.equal(u.personnel,before);
 c.clock.units[id].personnel-=.6;c.recordEquipmentLoss();assert.equal(u.personnel,before-1);c.recordEquipmentLoss();assert.equal(u.personnel,before-1);validate(p);
 const old=c.divisionAttributes(id).effective.softAttack;const q=u.held.infantry_equipment_1;u.held.infantry_equipment_1=0;n.stock.infantry_equipment_1+=q;assert(old>0);assert.equal(c.divisionAttributes(id).effective.softAttack,0);validate(p);
});
test('actual collapse threshold uses normalized 18; withdrawal consumes travel and only then applies existing floor',()=>{
 const {c,ids}=fixture(scenarios[0],219031),id=ids[0],v=c.clock.units[id];v.org=17;c.clock.divisionLedger.units[id].org=17/100*c.divisionAttributes(id).paper.orgMax;
 assert(c.clock.divisionLedger.units[id].org>5);const views=Object.fromEntries(['GERMAN','SOVIET'].map(s=>[s,c.fair(s).view])),units=ids.map(id=>c.state.units[id]),caps=Object.fromEntries(ids.map(id=>[id,c.capability(id)])),from={...c.state.units[id].hex};
 c.resolveTimedWithdrawal(units,views,caps);const w=c.clock.tactical.withdrawals[id];assert(w?.total>=30);assert.deepEqual(c.state.units[id].hex,from);assert.equal(v.org,17);
 for(let i=0;i<w.total+1&&c.clock.tactical.withdrawals[id];i++){c.clock.tick++;c.resolveTimedWithdrawal(units,views,caps);}
 assert(!c.clock.tactical.withdrawals[id]);assert.notDeepEqual(c.state.units[id].hex,from);assert.equal(v.org,25);assert.equal(v.losses,4);c.recordEquipmentLoss();validate(c.clock.divisionLedger);
});
test('blocked known retreat does not teleport; no in-combat resting recovery is called',()=>{
 const {c,ids}=fixture(scenarios[0],219031),watch=observe(c,ids);c.advance();watch.after();assert(watch.data.combatSteps>0);assert.equal(watch.data.inCombatOrgRecovery,0);
 const id=ids[0],v=c.clock.units[id],from={...c.state.units[id].hex};v.org=17;const views=Object.fromEntries(['GERMAN','SOVIET'].map(s=>[s,structuredClone(c.fair(s).view)]));for(const h of views.GERMAN.hexes)h.control=null;
 c.resolveTimedWithdrawal(ids.map(id=>c.state.units[id]),views,Object.fromEntries(ids.map(id=>[id,c.capability(id)])));assert.deepEqual(c.state.units[id].hex,from);assert(!c.clock.tactical.withdrawals[id]);assert.match(v.reason,/退路受阻/);
});
test('original comparison preserved and normalized first sample reproduces; normal replay differs only in measured wall time',()=>{
 const bytes=fs.readFileSync('evidence/blackice-001/comparison.json'),r1=JSON.parse(fs.readFileSync('evidence/blackice-001-r1/forced.json'));assert.equal(createHash('sha256').update(bytes).digest('hex'),r1.originalSHA256);assert.equal(r1.rows.length,48);assert(r1.same48Results);assert.deepEqual(forced(219031,scenarios[0]).originalShape,JSON.parse(bytes).results[0].runs[0].candidate);
 const n=JSON.parse(fs.readFileSync('evidence/blackice-001-r1/normal.json'));assert(['state','rng','units','corps','divisionLedger','battles','territory'].every(k=>n.checks[k]));assert(n.differences.every(x=>/^(econ\.modern\.(networkTiming\.(totalMs|maxMs)|management\.SOVIET\.(ms|totalMs|maxMs))|frontDefense\.metrics\.(totalMs|maxMs|lastMs))$/.test(x.path)));
});
test('R1 preserves recovery on automatic risk change, releases on real recovery, respects manual and pause',()=>{
 const {c,ids}=fixture(scenarios[0],219031),id=ids[0],view=c.fair('GERMAN').view,g=structuredClone(c.clock.corps.find(g=>g.members.includes(id))),old=JSON.stringify(g.order);g.members=[id];g.order.risk='LOW';
 const own={[id]:{...c.capability(id),...structuredClone(c.clock.units[id]),org:50,personnel:200,max:1250,stock:3,direct:null,engaged:0,march:null}},memory={[id]:{phase:'RECOVER',stamp:old,until:20,reason:'已撤出整补'}};
 const run=options=>planSide(view,own,[g],memory,21,options);assert.notEqual(run().states[id]?.phase,'RECOVER');assert.equal(run({preserveRecoveryOnReplan:true}).states[id].phase,'RECOVER');assert.equal(run({preserveRecoveryOnReplan:true}).states[id].until,20);
 own[id].org=100;own[id].personnel=1250;assert.notEqual(run({preserveRecoveryOnReplan:true}).states[id]?.phase,'RECOVER');
 g.order.paused=true;assert(!run({preserveRecoveryOnReplan:true}).states[id]);g.order.paused=false;own[id].direct={kind:'HOLD'};assert(!run({preserveRecoveryOnReplan:true}).states[id]);
});
test('R1 save namespaces reject cross-load, recovery and RNG survive same-version restore',()=>{
 const old=new Land1(),c=new R1();assert.throws(()=>c.restore(old.save()),/BLACKICE/);assert.throws(()=>old.restore(c.save()),/BLACKICE/);
 const id='G-013',g=c.clock.corps.find(g=>g.members.includes(id));c.clock.tactical.states[id]={phase:'RECOVER',stamp:JSON.stringify(g.order),until:30,reason:'定向恢复状态'};const saved=c.save(),r=new R1();r.restore(saved);assert.equal(saved.format,VERSION);assert.deepEqual(r.clock.tactical,c.clock.tactical);assert.equal(r.clock.rng,c.clock.rng);assert(r.clock.paused);
});
test('same manual battle sequence and steps have identical casualties, economy and RNG in both versions',()=>{
 const a=fixture(scenarios[1],219031,'manual').c,b=fixture(scenarios[1],219031,'manual',R1).c;
 for(let i=0;i<12;i++){a.advance();b.advance();}
 assert.deepEqual(a.state.units,b.state.units);assert.equal(a.clock.rng,b.clock.rng);assert.deepEqual(a.clock.divisionLedger.nations,b.clock.divisionLedger.nations);assert.deepEqual(a.clock.units,b.clock.units);
});

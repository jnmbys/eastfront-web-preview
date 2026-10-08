import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';
import {Campaign} from './authority.mjs';import {Campaign as Base} from '../grand-map-002/authority.mjs';
import {ownStatus,aggregateStatus,statusBars,battleStatus} from '../../.ai003-preview/src/playable/unitStatus.js';
const load=p=>JSON.parse(JSON.parse(gunzipSync(fs.readFileSync(p))).payload).campaign;
const a=new Base(),b=new Campaign(),save=load('evidence/grand-map-002/mid-march.save.json.gz');a.restore(save);b.restore(save);
const port=c=>({data:c.snapshot(),selections:{}}),rows=[],approx=(a,b)=>assert.ok(Math.abs(a-b)<1e-10);
for(let n=0;n<=4;n++){
 const p=port(b),old=a.snapshot(),actual=structuredClone(p.data);delete actual.continuous.unitStatusRules;assert.deepEqual(actual,old);
 const units=p.data.game.message.payload.view.units.filter(u=>u.side===p.data.viewer);for(const u of units){const s=ownStatus(p,u.id),v=b.clock.units[u.id];approx(s.orgRatio,v.org/100);approx(s.personnelRatio,v.personnel/v.max);assert.equal(s.low,v.org<18);}
 const stacked=units.filter(u=>u.hex.q===25&&u.hex.r===4),states=stacked.map(u=>ownStatus(p,u.id)),agg=aggregateStatus(states);
 approx(agg.personnelRatio,states.reduce((n,s)=>n+s.personnel,0)/states.reduce((n,s)=>n+s.max,0));for(const u of stacked){p.selections['map-selected-unit']=u.id;assert.deepEqual(aggregateStatus(stacked.map(u=>ownStatus(p,u.id))),agg);}
 for(const battle of p.data.continuous.map.battles)for(const u of battle.participants)if(u.side!==p.data.viewer){assert.equal(battleStatus(p,u),null);assert.ok(!statusBars(battleStatus(p,u)).includes('unit-status-track'));assert.equal(ownStatus(p,u.id),null);}
 rows.push({tick:b.clock.tick,units:states,aggregate:agg});assert.deepEqual(a.state,b.state);assert.deepEqual(a.econ,b.econ);assert.equal(a.clock.rng,b.clock.rng);assert.deepEqual(a.fair('GERMAN'),b.fair('GERMAN'));
 if(n<4){a.clock.paused=false;b.clock.paused=false;a.tick();b.tick();}
}
assert.ok(rows.some(r=>r.aggregate.low===1&&r.aggregate.orgRatio>.4));
const p=port(b),own=p.data.game.message.payload.view.units.find(u=>u.side===p.data.viewer),s=ownStatus(p,own.id);
const varied=aggregateStatus([{...s,personnel:50,max:100,personnelRatio:.5,org:10,orgRatio:.1,low:true},{...s,personnel:900,max:1000,personnelRatio:.9,org:90,orgRatio:.9,low:false}]);approx(varied.personnelRatio,950/1100);approx(varied.orgRatio,.5);assert.equal(varied.low,1);
const enemy=p.data.game.message.payload.view.units.find(u=>u.side!==p.data.viewer);p.data.continuous.units[enemy.id]={...p.data.continuous.units[own.id]};assert.equal(ownStatus(p,enemy.id),null);assert.equal(battleStatus(p,{...s,side:enemy.side,org:99,personnel:100,supply:1}),null);
// Existing directed replacement receipt, not a new natural campaign claim or replay of industry.
const receipt=JSON.parse(fs.readFileSync('evidence/grand-play-001/directed-replacement.json','utf8'));const paid=receipt.uses.find(u=>u.unitId==='G-013');assert.ok(paid);assert.equal(paid.paid.filter(x=>x.type==='P').reduce((n,x)=>n+x.qty,0),1);
const recovery=port(new Campaign()),v=recovery.data.continuous.units['G-013'];v.personnel=200;v.org=40;const before=ownStatus(recovery,'G-013');v.personnel=300;v.org=42;const after=ownStatus(recovery,'G-013');assert.equal(before.personnelRatio,2/3);assert.equal(after.personnelRatio,1);assert.ok(statusBars(before).includes('200/300'));assert.ok(statusBars(after).includes('300/300'));
const frozen=port(b);b.clock.paused=true;b.tick();assert.deepEqual(port(b).data.continuous.units,frozen.data.continuous.units);const restored=new Campaign();restored.restore(b.save());assert.deepEqual(port(restored).data.continuous.units,port(b).data.continuous.units);
fs.writeFileSync('evidence/grand-unit-001/check.json',JSON.stringify({baseline:'a9ed346a88f6b6308e2863af2f424b43fc37aaf4',actualTicks:rows,weightedPersonnel:varied.personnelRatio,orgMean:varied.orgRatio,threshold:18,enemyNoBars:true,selectionIndependent:true,snapshotOnlyPublicConstants:true,simulationStateEconomyRngAndFairViewsEqual:true,pauseAndRestore:true,replacement:{scope:'DISPLAY MAPPING ONLY, reuses old directed recovery receipt; not natural play, no new industrial settlement',before,after,paid}},null,2));console.log('PASS: actual T12–T16 loss/low-org, weighted stacks, selection, enemy isolation, pause/restore, existing directed recovery display mapping');

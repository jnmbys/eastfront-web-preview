import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,unit,host,G,defaultRules} from './helpers.mjs';
import {basicAgent,observationCandidates} from '../../.ai-dist/ai/fair/index.js';
import {createMoveScorer,ROUTE_UNIT_LIMIT,ROUTE_DECISION_LIMIT} from '../../.ai-dist/ai/fair/routing.js';
import {hexDistance,hexKey} from '../../.ai-dist/vendor/eastfront-digital-core/dist/core/hex.js';
import {makeEdge} from '../../.ai-dist/vendor/eastfront-digital-core/dist/core/edge.js';
const both={GERMAN:basicAgent,SOVIET:basicAgent};
function packet(cells,goal){
 const x=structuredClone(host(fixture(17,[unit('g','G-INF','GERMAN','INFANTRY',{q:0,r:0})])).observe(G));
 const open=new Set(cells.map(hexKey));for(const h of x.view.hexes)h.terrain=open.has(hexKey(h.coord))?'PLAIN':'LAKE';
 x.rules.objectives=[goal];return x;
}
const H=(q,r)=>({q,r});
const detour=[H(0,0),H(0,1),H(1,1),H(2,1),H(2,0)];
test('AI005 plans a non-greedy detour, one Action per view; fixed map has no revisits',()=>{
 const x=packet(detour,H(2,0)),seen=new Set(['0,0']);const first=basicAgent(x).intent;
 assert.equal(first.type,'MOVE');assert(hexDistance(first.path[0],H(2,0))>=hexDistance(H(0,0),H(2,0)));
 for(let n=0;n<10;n++){
  const d=basicAgent(x).intent;if(d.type==='READY_FOR_PHASE_END')break;
  assert.equal(d.path.length,1);assert(observationCandidates(x).some(a=>JSON.stringify(a)===JSON.stringify(d)));
  const k=hexKey(d.path[0]);assert(!seen.has(k));seen.add(k);x.view.units[0].hex=d.path[0];x.observationKey=`step-${n}`;
 }
 assert.deepEqual(x.view.units[0].hex,H(2,0));assert.equal(basicAgent(x).intent.type,'READY_FOR_PHASE_END');
});
test('AI005 avoids a nearer dead end and ends if the public goal is unreachable',()=>{
 const x=packet([...detour,H(1,-1)],H(2,0));assert.deepEqual(basicAgent(x).intent.path,[H(0,1)]);
 x.view.hexes.find(h=>hexKey(h.coord)==='1,1').terrain='LAKE';assert.equal(basicAgent(x).intent.type,'READY_FOR_PHASE_END');
});
test('AI005 target/terrain/authorized occupancy changes immediately invalidate the old route',()=>{
 const x=packet([...detour,H(-1,0)],H(2,0));assert.deepEqual(basicAgent(x).intent.path,[H(0,1)]);
 x.rules.objectives=[H(-1,0)];assert.deepEqual(basicAgent(x).intent.path,[H(-1,0)]);
 x.rules.objectives=[H(2,0)];
 const blocker=structuredClone(x.view.units[0]);blocker.id='friend';blocker.hex=H(0,1);blocker.friendly.hasMoved=true;x.view.units.push(blocker);x.rules.stackingLimit=1;
 assert.equal(basicAgent(x).intent.type,'READY_FOR_PHASE_END');x.view.units.pop();assert.deepEqual(basicAgent(x).intent.path,[H(0,1)]);
 x.view.contacts=[{contactId:'uncertain',side:'SOVIET',hex:H(0,1),status:'CONTACT'}];assert.equal(basicAgent(x).intent.type,'READY_FOR_PHASE_END');
 x.view.lastKnown=x.view.contacts;x.view.contacts=[];assert.deepEqual(basicAgent(x).intent.path,[H(0,1)]);
});
test('AI005 visible enemy goal replaces objective and disappearance restores public objective',()=>{
 const s=fixture(17,[unit('g','G-RECON','GERMAN','RECON',H(0,0)),unit('e','S-INF','SOVIET','INFANTRY',H(2,0))]);
 const x=structuredClone(host(s).observe(G));x.rules.objectives=[H(-4,0)];assert(x.view.units.some(u=>u.id==='e'));
 assert.equal(hexDistance(basicAgent(x).intent.path[0],H(2,0)),1);
 x.view.units=x.view.units.filter(u=>u.id!=='e');assert.equal(hexDistance(basicAgent(x).intent.path[0],H(-4,0)),3);
});
test('AI005 rejected edge stays suppressed after unrelated view change, resets on phase end',()=>{
 const x=packet([...detour,H(-1,0)],H(2,0)),first=basicAgent(x).intent;
 x.history.push({observationKey:x.observationKey,intent:first,outcome:'REJECTED'});x.observationKey='unrelated-unit-moved';
 assert.equal(basicAgent(x).intent.type,'READY_FOR_PHASE_END');
 x.history.push({observationKey:x.observationKey,intent:{type:'READY_FOR_PHASE_END'},outcome:'ACCEPTED'});
 assert.deepEqual(basicAgent(x).intent,first);
});
test('AI005 hidden ZOC has identical planning but can reject a road-bonus intent; replay and recovery stay bounded',()=>{
 const cells=[H(0,0),H(1,0),H(1,1),H(1,2),H(2,2),H(3,2),H(4,2),H(4,3),H(4,4),H(4,5),H(2,0),H(5,5)];
 const a=fixture(17,[unit('g','G-INF','GERMAN','INFANTRY',H(0,0)),unit('hidden','S-INF','SOVIET','INFANTRY',H(2,0))]);
 const open=new Set(cells.map(hexKey));for(const h of Object.values(a.hexes))h.terrain=open.has(hexKey(h.coord))?'PLAIN':'LAKE';
 a.units.g.supplyState='OUT_OF_SUPPLY';const edge=makeEdge(H(0,0),H(1,0),{road:true,river:'MAJOR'});a.edges[edge.key]=edge;
 const b=structuredClone(a);b.units.hidden.hex=H(5,5);b.random={...b.random,seed:888,state:999};
 // Explicit public test rule: production leaves this existing bonus disabled.
 const rules=structuredClone(defaultRules);rules.road.wholeMoveBonusEnabled=true;
 const x=host(a,'hidden-route',{rules}),y=host(b,'hidden-route',{rules}),replay=host(a,'hidden-route',{rules});assert.deepEqual(x.observe(G),y.observe(G));
 const d=basicAgent(x.observe(G));assert.deepEqual(d,basicAgent(y.observe(G)));assert.deepEqual(d.intent.path,[H(1,0)]);
 const before=x.auditOmniscient();assert.equal(x.step(both).status,'REJECTED');assert.deepEqual(x.auditOmniscient(),before);
 assert.equal(y.step(both).status,'ACCEPTED');assert.equal(replay.step(both).status,'REJECTED');
 assert.deepEqual(x.observe(G),replay.observe(G));assert.equal(basicAgent(x.observe(G)).intent.type,'READY_FOR_PHASE_END');
 assert.equal(x.step(both).status,'ACCEPTED');assert.equal(replay.step(both).status,'ACCEPTED');assert.deepEqual(x.auditOmniscient(),replay.auditOmniscient());
 assert(!JSON.stringify(x.observe(G)).includes('INSUFFICIENT_MP'));
});
test('AI005 bounded settled-node search ends safely; repeated input is identical and immutable',()=>{
 const x=packet(detour,H(2,0)),before=structuredClone(x),scorer=createMoveScorer(x);
 for(const a of observationCandidates(x))if(a.type==='MOVE')scorer.score(a);
 assert(scorer.metrics.expanded<=ROUTE_UNIT_LIMIT);assert.equal(scorer.metrics.searches,1);assert.deepEqual(x,before);
 const large=structuredClone(x);large.view.hexes=[];
 for(let q=0;q<2000;q++)large.view.hexes.push({coord:H(q,0),terrain:'PLAIN',control:null});large.rules.objectives=[H(1999,0)];
 const limited=createMoveScorer(large);assert.equal(limited.score({type:'MOVE',unitId:'g',path:[H(1,0)]}),-Infinity);
 assert(limited.metrics.exhausted);assert.equal(limited.metrics.expanded,ROUTE_UNIT_LIMIT);assert(limited.metrics.expanded<=ROUTE_DECISION_LIMIT);
 assert.equal(basicAgent(large).intent.type,'READY_FOR_PHASE_END');assert.deepEqual(basicAgent(x),basicAgent(before));
});

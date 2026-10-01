import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {basicAgent,scoreIntent} from '../../.ai-dist/ai/fair/basicAgent.js';
import {basicAgent as oldAgent} from '../../.evaluation/experiment017/.ai-dist/ai/fair/basicAgent.js';
import {observationCandidates,attackCandidatePool,CANDIDATE_LIMIT,ATTACK_COMBINATION_LIMIT} from '../../.ai-dist/ai/fair/candidates.js';
import {observationCandidates as oldCandidates} from '../../.evaluation/experiment017/.ai-dist/ai/fair/candidates.js';
import {createAttackReserve} from '../../.ai-dist/ai/fair/attackReserve.js';
import {createMoveScorer,ROUTE_UNIT_LIMIT,ROUTE_DECISION_LIMIT} from '../../.ai-dist/ai/fair/routing.js';
import {host,fixture,unit,G} from './helpers.mjs';
import {hash,atomic} from '../lab/common.mjs';
const checkpoints=JSON.parse(gunzipSync(readFileSync('evidence/ai-decision-018/checkpoints.json.gz'))),cp=(s,n)=>checkpoints.find(x=>x.seed===s&&x.n===n&&['before','last-carrier-before'].includes(x.kind)).input;
const guard=i=>createAttackReserve(i,scoreIntent),move=(id='g',hex={q:-1,r:0})=>({type:'MOVE',unitId:id,path:[hex]});
function view(backup=false){return host(fixture(101,[unit('g','G-INF','GERMAN','INFANTRY',{q:0,r:0}),...(backup?[unit('b','G-INF','GERMAN','INFANTRY',{q:1,r:-1})]:[]),unit('e','S-INF','SOVIET','INFANTRY',{q:1,r:0})])).observe(G);}
test('RESERVE019 frozen n942 allows I08; n945 protects last MOT01 and changes actual choice',()=>{
 const rows=[];
 for(const [n,id,blocked] of [[942,'G-I-08',false],[945,'G-MOT-01',true]]){
  const i=cp(1017,n),before=hash(i),old=oldAgent(i),g=guard(i);assert.equal(old.intent.unitId,id);const result=g.check(old.intent);assert.equal(result.blocked,blocked);assert.equal(hash(i),before);
  const chosen=basicAgent(i);if(blocked)assert.notDeepEqual(chosen,old);else assert.deepEqual(chosen,old);
  const scorer=createMoveScorer(i);for(const a of observationCandidates(i,false))if(a.type==='MOVE')scorer.score(a);assert(scorer.metrics.expanded<=ROUTE_DECISION_LIMIT);
  rows.push({n,inputHash:before,old,chosen,result,metrics:g.metrics});
 }
 atomic('evidence/ai-attack-reserve-019/frozen1017.json',rows);
});
test('RESERVE019 frozen1018 I05 loses personal attacks but target coverage survives',()=>{
 const i=cp(1018,956),old=oldAgent(i),g=guard(i);assert.equal(old.intent.unitId,'G-I-05');assert.equal(g.check(old.intent).blocked,false);assert.deepEqual(basicAgent(i),old);
 atomic('evidence/ai-attack-reserve-019/frozen1018.json',{inputHash:hash(i),old,chosen:basicAgent(i),metrics:g.metrics});
});
test('RESERVE019 no qualifying attack remains mobile; changing position can retain a qualifying combination',()=>{
 const weak=structuredClone(view());weak.view.units.find(u=>u.id==='g').stats.attack=1;assert.equal(guard(weak).check(move()).blocked,false);
 assert.equal(guard(view()).check(move()).blocked,true);
 assert.equal(guard(view()).check(move('g',{q:1,r:-1})).blocked,false);
});
test('RESERVE019 new post-move combination is evaluated with public crossing costs, not a fixed pre-move roster',()=>{
 const i=structuredClone(view(true));
 i.rules.riverAttackShift.TEST=-2;i.view.edges.push({a:{q:0,r:0},b:{q:1,r:0},river:'TEST'});
 const before=attackCandidatePool({...i,view:{...i.view,phase:'GERMAN_COMBAT'}}).intents.filter(a=>a.type==='ATTACK'&&Number.isFinite(scoreIntent(i,a)));assert(!before.some(a=>a.attackerUnitIds.length===1&&a.attackerUnitIds[0]==='g'));assert(before.some(a=>a.attackerUnitIds.length===2));
 const after=structuredClone(i);after.view.units.find(u=>u.id==='g').hex={q:0,r:1};
 // A newly qualifying singleton is created by the public crossing change.
 assert(attackCandidatePool({...after,view:{...after.view,phase:'GERMAN_COMBAT'}}).intents.some(a=>a.type==='ATTACK'&&a.attackerUnitIds.length===1&&a.attackerUnitIds[0]==='g'&&Number.isFinite(scoreIntent(after,a))));
 assert.equal(guard(i).check(move('g',{q:0,r:1})).blocked,false);
});
test('RESERVE019 current eligibility is reevaluated; unknown eligibility is not proof of loss',()=>{
 const i=structuredClone(view(true));assert.equal(guard(i).check(move()).blocked,false);
 i.view.units.find(u=>u.id==='b').friendly.hasAttacked=true;assert.equal(guard(i).check(move()).blocked,true);
 i.view.units.find(u=>u.id==='b').friendly.hasAttacked=false;assert.equal(guard(i).check(move()).blocked,false);
 delete i.view.units.find(u=>u.id==='b').friendly.hasAttacked;const r=guard(i).check(move());assert.equal(r.blocked,false);assert(r.unknownTargets.length);
});
test('RESERVE019 truncated candidate family is unknown, never absence; original budgets and order preserved',()=>{
 const i=structuredClone(view()),base=i.view.units.find(u=>u.id==='g');
 for(let n=0;n<12;n++){const b=structuredClone(base);b.id='weak'+n;b.friendly.id=b.id;b.hex={q:1,r:-1};b.friendly.hex=b.hex;b.stats.attack=.1;i.view.units.push(b);}
 const r=guard(i).check(move());assert.equal(r.blocked,false);assert(r.unknownTargets.includes('1,0'));
 const combat={...i,view:{...i.view,phase:'GERMAN_COMBAT'}};assert.deepEqual(observationCandidates(combat),oldCandidates(combat));assert(observationCandidates(combat).length<=CANDIDATE_LIMIT);
 assert.equal(CANDIDATE_LIMIT,128);assert.equal(ATTACK_COMBINATION_LIMIT,64);assert.equal(ROUTE_UNIT_LIMIT,768);assert.equal(ROUTE_DECISION_LIMIT,32768);
});
test('RESERVE019 hidden state/RNG paired projections yield identical guard and policy choices',()=>{
 const a=fixture(101,[unit('g','G-INF','GERMAN','INFANTRY',{q:0,r:0}),unit('e','S-INF','SOVIET','INFANTRY',{q:1,r:0}),unit('hidden','S-INF','SOVIET','INFANTRY',{q:5,r:0})]),b=structuredClone(a);
 b.units.hidden.hex={q:5,r:-1};b.units.hidden.step=2;b.random={seed:888,state:555,draws:99};
 const x=host(a).observe(G),y=host(b).observe(G);assert.deepEqual(x,y);assert.deepEqual(guard(x).check(move()),guard(y).check(move()));assert.deepEqual(basicAgent(x),basicAgent(y));
});
test('RESERVE019 nonadjacent/Soviet/pending flows bypass guard',()=>{
 const i=structuredClone(view());assert.equal(guard(i).check({type:'READY_FOR_PHASE_END'}).blocked,false);
 i.view.units.find(u=>u.id==='g').hex={q:-3,r:0};const g=guard(i);assert.equal(g.check(move()).blocked,false);assert.equal(g.metrics.pools,0);
 for(const mutate of [v=>{v.view.viewer='SOVIET';v.view.phase='SOVIET_MOVEMENT';},v=>v.view.pendingDecision={kind:'ADVANCE_AFTER_COMBAT'}]){const v=structuredClone(view());mutate(v);const h=guard(v);assert.equal(h.check(move()).blocked,false);assert.equal(h.metrics.pools,0);}
});

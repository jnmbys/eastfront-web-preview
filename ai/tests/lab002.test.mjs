import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,unit,host,G} from './helpers.mjs';
import {createBasicAgent,scoreIntent} from '../../.ai-dist/ai/fair/basicAgent.js';
import {basicAgent as frozen,scoreIntent as frozenScore} from '../../.ai-dist/ai/lab/frozenBasic.js';
import {parseParameters} from '../../.ai-dist/ai/fair/parameters.js';
import {validate} from '../lab/common.mjs';
function input(attack,defense,penalty=0){
 const state=fixture(17,[unit('g','G-PANZER','GERMAN','PANZER',{q:0,r:0}),unit('s','S-INF','SOVIET','INFANTRY',{q:1,r:0})],'GERMAN_COMBAT');
 const x=structuredClone(host(state).observe(G));x.view.units.find(u=>u.id==='g').stats.attack=attack;x.view.units.find(u=>u.id==='s').stats.defense=defense;
 x.rules.terrainAttackShift.PLAIN=-penalty;return x;
}
const attack={type:'ATTACK',attackerUnitIds:['g'],target:{q:1,r:0}};
test('LAB002 default coefficients and decisions equal frozen AI005 across threshold/terrain cases',()=>{
 const policy=createBasicAgent();
 for(const a of [1,3,5,6,8,12])for(const d of [1,2,4])for(const p of [0,1,2]){
  const x=input(a,d,p);assert.equal(scoreIntent(x,attack),frozenScore(x,attack));assert.deepEqual(policy(x),frozen(x));
 }
});
test('LAB002 each parameter independently changes actual selected intent',()=>{
 const ratio=input(5,4);assert.equal(frozen(ratio).intent.type,'READY_FOR_PHASE_END');assert.equal(createBasicAgent({attackRatio:1.25})(ratio).intent.type,'ATTACK');
 const terrain=input(8,4,1);assert.equal(frozen(terrain).intent.type,'READY_FOR_PHASE_END');assert.equal(createBasicAgent({penaltyWeight:0.25})(terrain).intent.type,'ATTACK');
});
test('LAB002 strict validation, normalized defaults, immutable baseline and disjoint splits',()=>{
 for(const bad of [{toString:1},{x:1},{attackRatio:NaN},{penaltyWeight:Infinity},{attackRatio:0.99},{attackRatio:3.01},{penaltyWeight:-1},{penaltyWeight:1.51},{attackRatio:'1.5'},{attackRatio:undefined},null,[]])assert.throws(()=>parseParameters(bad));
 const c=JSON.parse(readFileSync('ai/lab/candidate-002.json'));c.candidate.params={};assert.deepEqual(validate(c).candidate.params,{attackRatio:1.5,penaltyWeight:0.75});
 c.baseline.params={attackRatio:1.25};assert.throws(()=>validate(c));c.baseline.params={};c.seeds.holdout=[17];assert.throws(()=>validate(c));
});
test('LAB002 configured candidate ignores hidden composition and future combat RNG',()=>{
 const a=fixture(),b=structuredClone(a);delete b.units['secret-enemy'];b.units.hidden=unit('hidden','S-ARTY','SOVIET','ARTILLERY',{q:4,r:5});b.random={...b.random,seed:999,state:42};
 const x=host(a).observe(G),y=host(b).observe(G);assert.deepEqual(x,y);
 const candidate=createBasicAgent({attackRatio:1.25,penaltyWeight:0.5});assert.deepEqual(candidate(x),candidate(y));
});

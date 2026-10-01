import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {basicAgent,scoreIntent} from '../../.ai-dist/ai/fair/basicAgent.js';
import {basicAgent as oldAgent} from '../../.evaluation/baseline014/.ai-dist/ai/fair/basicAgent.js';
import {observationCandidates} from '../../.ai-dist/ai/fair/candidates.js';
import {createMoveScorer,ROUTE_UNIT_LIMIT,ROUTE_DECISION_LIMIT} from '../../.ai-dist/ai/fair/routing.js';
import {agentOrder} from '../../.ai-dist/ai/fair/minimalAgent.js';
import {host,G,RulesEngine,defaultRules,defaultScenario} from './helpers.mjs';
import {toCoreAction} from '../../.ai-dist/src/multiplayer/gameplayProtocol.js';
import {hexKey,hexDistance} from '../../.ai-dist/vendor/eastfront-digital-core/dist/core/hex.js';
import {hash,atomic} from '../lab/common.mjs';
const bytes=readFileSync('evidence/ai-midgame-015/checkpoints.json.gz');assert.equal(hash(bytes),'a41c1be9043c2dfc66ae2c037be916735293d46128299aca61f1104ae024ae62');
const cps=JSON.parse(gunzipSync(bytes)).checkpoints,cp=n=>cps.find(c=>c.n===n),x=cp(389).input,key=JSON.stringify;
test('MANEUVER017 n389 adjacent PZ04 gets a bounded prefix; unchanged ranking chooses PZ01',()=>{
 const before=hash(x),moves=createMoveScorer(x),base=observationCandidates(x,false),ranked=base.map((a,i)=>({intent:a,score:a.type==='MOVE'?moves.score(a):scoreIntent(x,a),tie:agentOrder(x.agentRandom.seed,i)})).filter(a=>Number.isFinite(a.score)).sort((a,b)=>b.score-a.score||a.tie-b.tie),choice=basicAgent(x),pz=ranked.filter(a=>a.intent.unitId==='G-PZ-04').map(a=>({...a,prefix:moves.prefix(a.intent)}));
 assert(pz.length>0);assert(pz.some(a=>a.prefix.path.length>1));assert.equal(oldAgent(x).intent.type,'READY_FOR_PHASE_END');assert.deepEqual(choice.intent,moves.prefix(ranked[0].intent));assert.equal(choice.intent.unitId,'G-PZ-01');assert(moves.metrics.expanded<=ROUTE_DECISION_LIMIT&&!moves.metrics.exhausted);assert.equal(hash(x),before);
 const candidates=observationCandidates(x),engine=new RulesEngine(defaultRules,defaultScenario),checked=[choice.intent,...pz.map(a=>a.prefix)].map(intent=>{assert(candidates.some(a=>key(a)===key(intent)));const r=engine.apply(cp(389).state,toCoreAction(intent,G));assert.deepEqual(r.state.random,cp(389).state.random);return {intent,accepted:r.accepted,issues:r.issues,events:r.events};});
 // A fair proposal is not an authority oracle: PZ01's first destination has no
 // identified adjacent enemy, yet unseen ZOC makes Core reject it. Do not tune
 // the policy against that hidden state. PZ04's independently checked route passes.
 assert.equal(checked[0].accepted,false);assert(checked[0].issues.some(i=>i.code==='ENEMY_ZOC_TO_ZOC'));
 assert(!x.view.units.some(e=>e.side!=='GERMAN'&&hexDistance(e.hex,choice.intent.path[0])===1));assert(checked.slice(1).every(c=>c.accepted));
 atomic('evidence/ai-maneuver-017/n389.json',{inputHash:hash(x),stateHash:hash(cp(389).state),original:oldAgent(x),choice,pz04:pz,finiteRanking:ranked,metrics:moves.metrics,hostCandidateCount:candidates.length,exact015WitnessPresent:candidates.some(a=>key(a)===key({type:'MOVE',unitId:'G-PZ-04',path:[{q:14,r:0},{q:15,r:0}]})),offlineChecks:checked,meaning:'PZ04 gains another route, not forced015witness; Core checks offline only.'});
});
test('MANEUVER017 known ZOC-to-ZOC first hops remain unscored; entry ends the prefix',()=>{
 const s=createMoveScorer(x);for(const h of [{q:15,r:0},{q:15,r:1},{q:13,r:2}])assert.equal(s.score({type:'MOVE',unitId:'G-PZ-04',path:[h]}),-Infinity);
 const a=s.prefix({type:'MOVE',unitId:'G-PZ-04',path:[{q:14,r:0}]}),enemies=x.view.units.filter(e=>e.side!=='GERMAN');assert.equal(a.path.length,2);assert(!enemies.some(e=>hexDistance(a.path[0],e.hex)===1));assert(enemies.some(e=>hexDistance(a.path.at(-1),e.hex)===1));
});
test('MANEUVER017 negative public risk, occupied destination and moved eligibility guards remain',()=>{
 const first={type:'MOVE',unitId:'G-PZ-04',path:[{q:14,r:0}]};
 for(const mutate of [v=>v.view.units.find(u=>u.id==='G-PZ-04').friendly.hasMoved=true,v=>v.view.contacts.push({contactId:'test',side:'SOVIET',hex:first.path[0],status:'CURRENT'}),v=>{const e=structuredClone(v.view.units.find(u=>u.side==='SOVIET'));Object.assign(e,{id:'test-visible-risk',hex:{q:14,r:-1},stats:{attack:999,defense:999,movement:2}});v.view.units.push(e);}]){const v=structuredClone(x);mutate(v);assert.equal(createMoveScorer(v).score(first),-Infinity);}
 const to={q:10,r:1};assert.equal(createMoveScorer(cp(373).input).safeDestination('G-I-04',to),false);assert.equal(createMoveScorer(cp(381).input).safeDestination('G-I-04',to),true);
});
test('MANEUVER017 nonadjacent decisions and midpoint stop are covered unchanged by MOVE006; budget caps unchanged',()=>{
 assert.equal(ROUTE_UNIT_LIMIT,768);assert.equal(ROUTE_DECISION_LIMIT,32768);
 for(const n of [373,381,383]){const s=createMoveScorer(cp(n).input);for(const a of observationCandidates(cp(n).input,false))if(a.type==='MOVE')s.score(a);assert(s.metrics.expanded<=ROUTE_DECISION_LIMIT);}
});
test('MANEUVER017 hidden enemy and future RNG changes leave equal projections, candidates and choices',()=>{
 const state=cp(389).state,other=structuredClone(state),seen=host(state).observe(G),hidden=Object.values(other.units).find(u=>u.alive&&u.side==='SOVIET'&&!seen.view.units.some(v=>v.id===u.id));assert(hidden);hidden.type='ARTILLERY';hidden.templateId='S-ARTY';other.random={seed:123,state:456,draws:77};
 const a=structuredClone(host(state).observe(G)),b=structuredClone(host(other).observe(G));assert.deepEqual(a,b);a.history=structuredClone(x.history);b.history=structuredClone(x.history);assert.deepEqual(observationCandidates(a),observationCandidates(b));assert.deepEqual(basicAgent(a),basicAgent(b));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {basicAgent,scoreIntent} from '../../.ai-dist/ai/fair/basicAgent.js';
import {basicAgent as oldAgent} from '../../.evaluation/baseline014/.ai-dist/ai/fair/basicAgent.js';
import {prioritizeMoveTies} from '../../.ai-dist/ai/fair/moveTie.js';
import {createMoveScorer,ROUTE_UNIT_LIMIT,ROUTE_DECISION_LIMIT,ROUTE_PATH_LIMIT} from '../../.ai-dist/ai/fair/routing.js';
import {observationCandidates} from '../../.ai-dist/ai/fair/candidates.js';
import {agentOrder} from '../../.ai-dist/ai/fair/minimalAgent.js';
import {hexDistance} from '../../.ai-dist/vendor/eastfront-digital-core/dist/core/hex.js';
import {host,G,RulesEngine,defaultRules,defaultScenario} from './helpers.mjs';
import {toCoreAction} from '../../.ai-dist/src/multiplayer/gameplayProtocol.js';
import {hash,atomic} from '../lab/common.mjs';
const raw=readFileSync('evidence/ai-move-tie-020/frozen015.json.gz');assert.equal(hash(raw),'a41c1be9043c2dfc66ae2c037be916735293d46128299aca61f1104ae024ae62');
const cps=JSON.parse(gunzipSync(raw)).checkpoints,cp=n=>cps.find(c=>c.n===n),x=cp(383).input;
const distance=(i,a)=>Math.min(...i.rules.objectives.map(h=>hexDistance(a.path.at(-1),h)));
const item=(score,id,r=0)=>({score,a:{type:'MOVE',unitId:id,path:[{q:0,r}]}});
test('MOVE-TIE020 n383 I08 exact-score tie changes full endpoint18 to17; original candidates and Core legality retained',()=>{
 const before=hash(x),moves=createMoveScorer(x),ranked=observationCandidates(x,false).map((a,i)=>({a,score:a.type==='MOVE'?moves.score(a):scoreIntent(x,a),tie:agentOrder(x.agentRandom.seed,i)})).filter(x=>Number.isFinite(x.score)).sort((a,b)=>b.score-a.score||a.tie-b.tie),old=oldAgent(x),choice=basicAgent(x);
 assert.equal(old.intent.unitId,'G-I-08');assert.equal(choice.intent.unitId,'G-I-08');assert.equal(distance(x,old.intent),18);assert.equal(distance(x,choice.intent),17);
 const tied=ranked.filter(r=>r.score===ranked[0].score).map(r=>({...r,prefix:moves.prefix(r.a)}));assert(tied.some(r=>JSON.stringify(r.prefix)===JSON.stringify(choice.intent)));assert(observationCandidates(x).some(a=>JSON.stringify(a)===JSON.stringify(choice.intent)));
 assert.equal(hash(x),before);assert(moves.metrics.expanded<=32768);const result=new RulesEngine(defaultRules,defaultScenario).apply(cp(383).state,toCoreAction(choice.intent,G));assert(result.accepted);assert.deepEqual(result.state.random,cp(383).state.random);
 atomic('evidence/ai-move-tie-020/frozen-I08.json',{archiveHash:hash(raw),inputHash:before,old,choice,tied,metrics:moves.metrics,offlineCore:{accepted:result.accepted,issues:result.issues},note:'Full prefix endpoint; identical primary score, existing Host candidate, Core offline only.'});
});
test('MOVE-TIE020 unequal primary scores, including tiny differences, cannot be overridden',()=>{
 const a=[item(3,'far',30),item(3-Number.EPSILON*2,'near',0)];assert.deepEqual(prioritizeMoveTies(a,()=>{throw Error('non-tie must not evaluate progress');}),a);
 const i=cp(384).input;assert.deepEqual(basicAgent(i),oldAgent(i));
});
test('MOVE-TIE020 equal secondary distance preserves original stable order; non-MOVE slots stay fixed',()=>{
 const a=[item(3,'far',3),{score:3,a:{type:'READY_FOR_PHASE_END'}},item(3,'near',1),item(2,'lower',0)];
 const before=structuredClone(a),b=prioritizeMoveTies(a,m=>m.path[0].r);assert.deepEqual(a,before);assert.equal(b[0].a.unitId,'near');assert.equal(b[1].a.type,'READY_FOR_PHASE_END');assert.equal(b[2].a.unitId,'far');assert.equal(b[3].a.unitId,'lower');
 assert.deepEqual(prioritizeMoveTies(a,()=>5),a);assert.deepEqual(prioritizeMoveTies(a,()=>Infinity),a);
});
test('MOVE-TIE020 risk/occupancy filters and014 adjacent-origin stop are unchanged',()=>{
 const first={type:'MOVE',unitId:'G-I-08',path:[{q:11,r:5}]},v=structuredClone(x);v.view.contacts.push({visibility:'CONTACT',contactId:'blocked-test',side:'SOVIET',hex:first.path[0],status:'CURRENT'});assert.equal(createMoveScorer(v).score(first),-Infinity);assert.notDeepEqual(basicAgent(v).intent.path?.[0],first.path[0]);
 const stop=cp(389).input;assert.deepEqual(basicAgent(stop),oldAgent(stop));assert.equal(basicAgent(stop).intent.type,'READY_FOR_PHASE_END');const s=createMoveScorer(stop);assert.equal(s.score({type:'MOVE',unitId:'G-PZ-04',path:[{q:14,r:0}]}),-Infinity);
 assert.equal(ROUTE_UNIT_LIMIT,768);assert.equal(ROUTE_DECISION_LIMIT,32768);assert.equal(ROUTE_PATH_LIMIT,16);
});
test('MOVE-TIE020 hidden units and future RNG paired inputs leave candidates and policy identical',()=>{
 const state=cp(383).state,other=structuredClone(state),seen=host(state).observe(G),hidden=Object.values(other.units).find(u=>u.alive&&u.side==='SOVIET'&&!seen.view.units.some(v=>v.id===u.id));assert(hidden);hidden.type='ARTILLERY';hidden.templateId='S-ARTY';other.random={seed:123,state:456,draws:77};
 const a=structuredClone(host(state).observe(G)),b=structuredClone(host(other).observe(G));assert.deepEqual(a,b);a.history=structuredClone(x.history);b.history=structuredClone(x.history);assert.deepEqual(observationCandidates(a),observationCandidates(b));assert.deepEqual(basicAgent(a),basicAgent(b));
});
test('MOVE-TIE020 Soviet movement and combat retain014 policy choices',()=>{
 const a=structuredClone(x);a.view.viewer='SOVIET';a.view.phase='SOVIET_MOVEMENT';assert.deepEqual(basicAgent(a),oldAgent(a));
 const b=structuredClone(x);b.view.phase='GERMAN_COMBAT';assert.deepEqual(basicAgent(b),oldAgent(b));
});

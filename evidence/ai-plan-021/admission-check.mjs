// Diagnostic only: no production policy/config changes and no new games.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {FairHost} from '../../.ai-dist/ai/authority/FairHost.js';
import {RulesEngine,defaultRules,defaultScenario} from '../../.ai-dist/vendor/eastfront-digital-core/dist/index.js';
import {hexDistance,hexKey,getNeighbors} from '../../.ai-dist/vendor/eastfront-digital-core/dist/core/hex.js';
import {observationCandidates} from '../../.ai-dist/ai/fair/candidates.js';
import {toCoreAction} from '../../.ai-dist/src/multiplayer/gameplayProtocol.js';
import {hash,atomic} from '../../ai/lab/common.mjs';
const out='evidence/ai-plan-021',cp=JSON.parse(gunzipSync(readFileSync(out+'/checkpoint.json.gz'))),input=cp.input,oldBuild=JSON.parse(readFileSync('evidence/ai-advance-014/build-identity.json'));
for(const [p,h] of oldBuild.experiment)assert.equal(hash(readFileSync('.ai-dist/'+p)),h);
const original=readFileSync('.ai-dist/ai/fair/routing.js','utf8'),line='const goals = enemies.length ? [...safe].filter(k => enemies.some(e => hexDistance(board.get(k).coord, e.hex) === 1)) : rules.objectives.map(hexKey).filter(k => safe.has(k));';assert(original.includes(line));
// Test-only generated sibling module: replacing the target set alone leaves
// public cost, risk, stopping, scoring and budgets unchanged. Never deployed.
const probeSource=original.replace(line,'const goals = rules.objectives.map(hexKey).filter(k => safe.has(k));').replace("from '../../vendor/","from '../../.ai-dist/vendor/");
mkdirSync('.evaluation/plan021-probe',{recursive:true});writeFileSync('.evaluation/plan021-probe/routing.mjs',probeSource);
const {createMoveScorer}=await import('../../.evaluation/plan021-probe/routing.mjs');
const permitted=observationCandidates(input),keys=new Set(permitted.map(JSON.stringify)),board=new Set(input.view.hexes.map(h=>hexKey(h.coord))),distance=h=>Math.min(...input.rules.objectives.map(g=>hexDistance(h,g)));
// Bounded search for one admission counterexample, not a selected policy/route.
const units=input.view.units.filter(u=>u.friendly&&!u.friendly.hasMoved&&u.stats.attack>0&&u.stats.movement>0).sort((a,b)=>a.id.localeCompare(b.id)).slice(0,12);
let checked=0,witness=null;
outer:for(const u of units){
 const centers=input.view.hexes.filter(h=>hexDistance(h.coord,u.hex)>=2&&hexDistance(h.coord,u.hex)<=4&&distance(h.coord)<distance(u.hex)).sort((a,b)=>distance(a.coord)-distance(b.coord)||hexKey(a.coord).localeCompare(hexKey(b.coord))).slice(0,12);
 for(const center of centers){const region=[center.coord,...getNeighbors(center.coord)].filter(h=>board.has(hexKey(h))),v={...input,rules:{...input.rules,objectives:region}},scorer=createMoveScorer(v);
  for(const first of permitted.filter(a=>a.type==='MOVE'&&a.unitId===u.id&&a.path.length===1)){
   checked++;const score=scorer.score(first);if(!Number.isFinite(score))continue;const intent=scorer.prefix(first);if(intent.path.length<2||keys.has(JSON.stringify(intent)))continue;
   const result=new RulesEngine(defaultRules,defaultScenario).apply(cp.state,toCoreAction(intent,input.scope.controllerId));if(!result.accepted)continue;
   witness={unitId:u.id,from:u.hex,region,first,score,intent,oldPrefixes:permitted.filter(a=>a.type==='MOVE'&&a.unitId===u.id),metrics:scorer.metrics,offlineCore:{accepted:result.accepted,issues:result.issues,rngUnchanged:JSON.stringify(cp.state.random)===JSON.stringify(result.state.random)}};break outer;
  }
 }
}
assert(witness,'No admission counterexample found within declared bound');
const host=new FairHost({matchId:'AI-PLAN-021-admission-only',initialState:cp.state,rules:defaultRules,scenario:defaultScenario,agentSeeds:{GERMAN:101,SOVIET:202}}),projected=host.observe(input.scope.controllerId);
assert.deepEqual(observationCandidates(projected),permitted,'Checkpoint Host has the exact same candidate menu; historical memory itself is not claimed identical');
const before=hash(host.auditOmniscient()),receipt=host.step({GERMAN:()=>({kind:'INTENT',intent:witness.intent}),SOVIET:()=>{throw Error('Unexpected seat');}});
assert.equal(receipt.status,'REJECTED');assert.equal(hash(host.auditOmniscient()),before);assert.equal(host.auditTransition().result,null);assert.equal(host.observe(input.scope.controllerId).history.at(-1).intent,null);
atomic(out+'/admission-proof.json',{checkpointInputHash:hash(input),checkpointStateHash:hash(cp.state),archiveHash:hash(readFileSync(out+'/checkpoint.json.gz')),limits:{units:12,centersPerUnit:12,firstHopsPerUnit:6,maximumProposalChecks:864},checked,witness,host:{candidateMenuIdentical:true,receipt,authorityNeverInvoked:true,stateUnchanged:true,admittedIntent:null},scope:'One frozen checkpoint; waypoint region is diagnostic, not an implemented plan or a selected victory route. No new games.'});
console.log(JSON.stringify({checked,unit:witness.unitId,region:witness.region,intent:witness.intent,offlineCoreAccepted:true,hostReceipt:receipt,stateUnchanged:true}));

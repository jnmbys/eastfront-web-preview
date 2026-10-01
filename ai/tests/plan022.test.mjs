import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {fixture,unit,host,G,S,defaultRules,defaultScenario} from './helpers.mjs';
import {FairHost} from '../../.ai-dist/ai/authority/FairHost.js';
import {basicAgent,observationCandidates} from '../../.ai-dist/ai/fair/index.js';
import {createMoveScorer,ROUTE_UNIT_LIMIT,ROUTE_DECISION_LIMIT,ROUTE_PATH_LIMIT} from '../../.ai-dist/ai/fair/routing.js';
import {planGoals,PLAN_UNIT_LIMIT,PLAN_REGION_LIMIT} from '../../.ai-dist/ai/fair/plan.js';
const H=(q,r=0)=>({q,r}),intent=a=>()=>({kind:'INTENT',intent:a}),both=a=>({GERMAN:a,SOVIET:a});
const cp=JSON.parse(gunzipSync(readFileSync(new URL('../../evidence/ai-plan-021/checkpoint.json.gz',import.meta.url))));
const proof=JSON.parse(readFileSync(new URL('../../evidence/ai-plan-021/admission-proof.json',import.meta.url)));
const spec={unitIds:[proof.witness.unitId],goals:proof.witness.region};
const checkpoint=planProviders=>new FairHost({matchId:'plan022-frozen',initialState:cp.state,rules:defaultRules,scenario:defaultScenario,agentSeeds:{GERMAN:101,SOVIET:202},...(planProviders?{planProviders}:{})});
const simple=()=>fixture(17,[unit('g','G-INF','GERMAN','INFANTRY',H(0))]);
const simplePlan=()=>({unitIds:['g'],goals:[H(4)]});

test('022 frozen 021 witness: old Host rejects before Core; shared snapshot admits exact new prefix via real Host',()=>{
 const old=checkpoint(),planned=checkpoint({GERMAN:()=>spec}),oldInput=old.observe(cp.input.scope.controllerId),input=planned.observe(cp.input.scope.controllerId);
 assert(!('plan' in oldInput));
 assert.deepEqual(observationCandidates(oldInput).filter(a=>a.type==='MOVE'&&a.unitId===spec.unitIds[0]),proof.witness.oldPrefixes);
 assert.deepEqual(createMoveScorer(input).prefix(proof.witness.first),proof.witness.intent);
 assert(observationCandidates(input).some(a=>JSON.stringify(a)===JSON.stringify(proof.witness.intent)));
 const before=old.auditOmniscient();assert.equal(old.step(both(intent(proof.witness.intent))).status,'REJECTED');
 assert.deepEqual(old.auditOmniscient(),before);assert.equal(old.auditTransition().result,null);
 const rng=planned.auditOmniscient().random;
 assert.equal(planned.step(both(intent(proof.witness.intent))).status,'ACCEPTED');
 assert(planned.auditTransition().result.accepted);
 assert.deepEqual(planned.auditOmniscient().units[proof.witness.unitId].hex,proof.witness.intent.path.at(-1));
 assert.deepEqual(planned.auditOmniscient().random,rng);
});

test('022 disabled/null provider retains original v1 input, menu, policy action and frozen transition',()=>{
 const disabled=checkpoint(),empty=checkpoint({GERMAN:()=>null});
 assert.deepEqual(disabled.observe(G),empty.observe(G));
 assert.deepEqual(observationCandidates(disabled.observe(G)),observationCandidates(empty.observe(G)));
 assert.deepEqual(basicAgent(disabled.observe(G)),basicAgent(empty.observe(G)));
 assert.deepEqual(disabled.step(both(basicAgent)),empty.step(both(basicAgent)));
 assert.deepEqual(disabled.auditOmniscient(),empty.auditOmniscient());
});

test('022 same observation/decision prepares once; provider receives copied frozen seat memory',()=>{
 let calls=0,previous=null;const returned=simplePlan();
 const h=host(simple(),'cache',{planProviders:{GERMAN:(input,prior)=>{calls++;previous=prior;assert(Object.isFrozen(input));assert(!('plan' in input));return returned;}}});
 const first=h.observe(G);returned.goals[0].q=3;
 assert.equal(h.observe(G),first);assert.equal(calls,1);assert.equal(first.plan.goals[0].q,4);
 assert.throws(()=>first.plan.goals[0].q=99,TypeError);
 assert.equal(h.step(both(intent({type:'MOVE',unitId:'g',path:[H(5)]}))).status,'REJECTED');
 const next=h.observe(G);assert.equal(calls,2);assert(Object.isFrozen(previous));assert.deepEqual(previous,first.plan);
 assert.equal(next.plan.decisionIndex,1);assert.equal(next.plan.revision,2);
 assert.throws(()=>previous.unitIds.push('forged'),TypeError);
});

test('022 changed goals affect only assigned unit; shared policy choice belongs to same Host menu',()=>{
 const state=fixture(17,[unit('g','G-INF','GERMAN','INFANTRY',H(0)),unit('other','G-INF','GERMAN','INFANTRY',H(-3,-3))]);
 const base=host(state).observe(G),h=host(state,'goal',{planProviders:{GERMAN:simplePlan}}),input=h.observe(G);
 const ownMenu=x=>observationCandidates(x).filter(a=>a.type==='MOVE'&&a.unitId==='other');
 assert.deepEqual(ownMenu(base),ownMenu(input));
 const choice=basicAgent(input);assert(observationCandidates(input).some(a=>JSON.stringify(a)===JSON.stringify(choice.intent)));
 assert.equal(h.step(both(basicAgent)).status,'ACCEPTED');
});

test('022 stale decision, changed observation and foreign scope cannot drive routing',()=>{
 const h=host(simple(),'stale',{planProviders:{GERMAN:simplePlan}}),input=h.observe(G);
 for(const mutate of [x=>x.plan.observationKey='old',x=>x.plan.decisionIndex--,x=>x.plan.scope.matchId='other',x=>x.plan.scope.controllerId=S,x=>x.plan.scope.side='SOVIET']){
  const copy=structuredClone(input);mutate(copy);assert.equal(planGoals(copy,'g'),null);
  const legacy=structuredClone(copy);delete legacy.plan;assert.deepEqual(observationCandidates(copy),observationCandidates(legacy));
 }
 const saved=structuredClone(input.plan);assert.equal(h.step(both(basicAgent)).status,'ACCEPTED');
 const later=structuredClone(h.observe(G));later.plan=saved;assert.equal(planGoals(later,'g'),null);
});

test('022 malformed/provider-forged snapshots fail closed without authority transition or RNG draw',()=>{
 const payloads=[{...simplePlan(),path:[H(1)]},{...simplePlan(),unitIds:['secret']},{...simplePlan(),goals:[H(999)]},
  {unitIds:Array(PLAN_UNIT_LIMIT+1).fill('g'),goals:[H(4)]},{...simplePlan(),goals:Array(PLAN_REGION_LIMIT+1).fill(H(4))},
  {unitIds:['g'],goals:[{q:4,r:0,hidden:true}]}];
 for(const payload of payloads){const h=host(simple(),'invalid',{planProviders:{GERMAN:()=>payload}}),before=h.auditOmniscient();
  assert.equal(h.step(both(basicAgent)).status,'AGENT_ERROR');assert.deepEqual(h.auditOmniscient(),before);assert.equal(h.auditTransition().result,null);
 }
 const h=host(simple(),'throw',{planProviders:{GERMAN:()=>{throw Error('provider');}}});assert.equal(h.step(both(basicAgent)).status,'AGENT_ERROR');
});

test('022 copied/tampered policy input cannot alter the Host-held exact admission menu',()=>{
 const h=checkpoint({GERMAN:()=>spec}),before=h.auditOmniscient();
 const result=h.step(both(input=>{assert.throws(()=>input.plan.goals.splice(0),TypeError);const copy=structuredClone(input);copy.plan.goals=[H(999)];
  return {kind:'INTENT',intent:{type:'MOVE',unitId:proof.witness.unitId,path:[H(999)]}};}));
 assert.equal(result.status,'REJECTED');assert.equal(h.auditTransition().result,null);assert.deepEqual(h.auditOmniscient(),before);
});

test('022 hidden-state pairs and hidden RNG generate identical snapshots, candidates and decisions',()=>{
 const a=fixture(17,[unit('g','G-INF','GERMAN','INFANTRY',H(0)),unit('secret','S-INF','SOVIET','INFANTRY',H(2))]);
 const b=structuredClone(a);b.units.secret.hex=H(5,5);b.random={seed:777,state:888,draws:0};
 const x=host(a,'hidden',{planProviders:{GERMAN:simplePlan}}),y=host(b,'hidden',{planProviders:{GERMAN:simplePlan}});
 assert.deepEqual(x.observe(G),y.observe(G));assert.deepEqual(observationCandidates(x.observe(G)),observationCandidates(y.observe(G)));
 assert.deepEqual(basicAgent(x.observe(G)),basicAgent(y.observe(G)));
 const before=x.auditOmniscient(),choice=basicAgent(x.observe(G));assert(choice.intent.type==='MOVE');
 assert.equal(x.step(both(intent(choice.intent))).status,'REJECTED');assert.deepEqual(x.auditOmniscient(),before);
 assert(!JSON.stringify(x.observe(G)).includes('ENEMY_ZOC_STOP'));assert(!JSON.stringify(x.observe(G)).includes('ENEMY_OCCUPIED_HEX'));
});

test('022 match and seat plans stay isolated; nonmovement clears plan, then next active seat starts empty',()=>{
 const seen=[];const provider=(input,previous)=>{seen.push({scope:input.scope,previous});const id=input.view.units.find(u=>'friendly' in u&&u.friendly.controllerId===input.scope.controllerId)?.id;return id?{unitIds:[id],goals:[H(4)]}:null;};
 const state=fixture(17,[unit('g','G-INF','GERMAN','INFANTRY',H(0)),unit('s','S-INF','SOVIET','INFANTRY',H(5,5))]);
 const a=host(state,'A',{planProviders:{GERMAN:provider,SOVIET:provider}}),b=host(state,'B',{planProviders:{GERMAN:provider,SOVIET:provider}});
 a.observe(G);b.observe(G);assert.equal(seen.length,2);assert(seen.every(x=>x.previous===null));assert.notDeepEqual(a.observe(G).plan.scope,b.observe(G).plan.scope);
 assert(!('plan' in a.observe(S)));assert.equal(a.step(both(intent({type:'READY_FOR_PHASE_END'}))).status,'ACCEPTED');assert(!('plan' in a.observe(G)));
 for(let i=0;i<5&&!a.auditOmniscient().phase.endsWith('SOVIET_MOVEMENT');i++)assert.equal(a.step(both(intent({type:'READY_FOR_PHASE_END'}))).status,'ACCEPTED');
 assert.equal(a.auditOmniscient().phase,'SOVIET_MOVEMENT');const sov=a.observe(S);assert.equal(sov.plan.scope.side,'SOVIET');assert.deepEqual(sov.plan.unitIds,['s']);assert.equal(seen.at(-1).previous,null);
});

test('022 original route bounds and finite candidate budget retained',()=>{
 assert.equal(ROUTE_UNIT_LIMIT,768);assert.equal(ROUTE_DECISION_LIMIT,32768);assert.equal(ROUTE_PATH_LIMIT,16);
 const input=checkpoint({GERMAN:()=>spec}).observe(G),scorer=createMoveScorer(input);
 for(const a of observationCandidates(input,false))scorer.prefix(a);
 assert(scorer.metrics.expanded<=ROUTE_DECISION_LIMIT);assert(observationCandidates(input).length<=255);
});

test('022 plan revision changes cannot reset the existing eight-rejection limit',()=>{
 let calls=0;const h=host(simple(),'bounded',{planProviders:{GERMAN:()=>{calls++;return simplePlan();}}});
 const bad=intent({type:'MOVE',unitId:'g',path:[H(999)]});
 for(let i=1;i<=8;i++)assert.equal(h.step(both(bad)).status,i===8?'REJECTION_LIMIT':'REJECTED');
 assert.equal(calls,8);assert.equal(h.step(both(bad)).status,'REJECTION_LIMIT');assert.equal(calls,8);
});

test('022 compiled fair-plan runtime dependency is only the existing public hex helper',()=>{
 const text=readFileSync(new URL('../../.ai-dist/ai/fair/plan.js',import.meta.url),'utf8');
 const imports=[...text.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map(m=>m[1]);
 assert.deepEqual(imports,['../../vendor/eastfront-digital-core/dist/core/hex.js']);
 assert(!/\b(?:RulesEngine|auditOmniscient|GameState|fetch|eval)\b/.test(text));
});

test('022 human phase changes clear old plans without observing the inactive AI seat',()=>{
 const prior=[];const provider=(_input,previous)=>{prior.push(previous);return simplePlan();};
 const state=fixture(17,[unit('g','G-INF','GERMAN','INFANTRY',H(0)),unit('s','S-INF','SOVIET','INFANTRY',H(5,5))]);
 const h=host(state,'human-boundary',{planProviders:{GERMAN:provider}});h.observe(G);
 let actions=0;
 do {const state=h.auditOmniscient(),owner=Object.values(state.controllers).find(c=>c.side===state.activeSide).id;
  assert(h.submitHuman(owner,{type:'READY_FOR_PHASE_END'}));actions++;
 }while(h.auditOmniscient().phase!=='GERMAN_MOVEMENT'&&actions<16);
 assert.equal(h.auditOmniscient().phase,'GERMAN_MOVEMENT');assert(actions>1);assert(h.auditOmniscient().turn>1);
 h.observe(G);assert.deepEqual(prior,[null,null]);
});

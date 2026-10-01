import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,unit,host,G,S,defaultRules} from './helpers.mjs';
import {mainAttackPlan,MAIN_ATTACK_LIMITS} from '../../.ai-dist/ai/fair/mainAttackPlan.js';
import {basicAgent,observationCandidates} from '../../.ai-dist/ai/fair/index.js';
import {createMoveScorer,ROUTE_DECISION_LIMIT} from '../../.ai-dist/ai/fair/routing.js';
import {getNeighbors,hexKey} from '../../.ai-dist/vendor/eastfront-digital-core/dist/core/hex.js';
const H=(q,r=0)=>({q,r}),both=a=>({GERMAN:a,SOVIET:a});
const pair=()=>[unit('a','G-PANZER','GERMAN','PANZER',H(0)),unit('b','G-PANZER','GERMAN','PANZER',H(0,1))];
const planned=s=>host(s,'plan023',{planProviders:{GERMAN:mainAttackPlan}});
const spec=p=>p?{unitIds:[...p.unitIds],goals:p.goals.map(g=>({...g}))}:null;

test('023 real provider changes exact menu and chosen route; Host/Core execute it without RNG use',()=>{
 const s=fixture(17,pair()),base=host(s,'plan023'),h=planned(s),input=h.observe(G),old=base.observe(G),choice=basicAgent(input);
 assert.equal(input.plan.unitIds.length,2);assert.notDeepEqual(observationCandidates(input),observationCandidates(old));
 assert.notDeepEqual(choice,basicAgent(old));assert(!observationCandidates(old).some(a=>JSON.stringify(a)===JSON.stringify(choice.intent)));
 assert(observationCandidates(input).some(a=>JSON.stringify(a)===JSON.stringify(choice.intent)));
 const rng=h.auditOmniscient().random;assert.equal(h.step(both(basicAgent)).status,'ACCEPTED');
 assert.deepEqual(h.auditOmniscient().units[choice.intent.unitId].hex,choice.intent.path.at(-1));assert.deepEqual(h.auditOmniscient().random,rng);
 assert(!h.observe(G).plan.unitIds.includes(choice.intent.unitId));
});

test('023 ungrouped artillery and opponent retain original menu/decision; provider disabled retains DTO',()=>{
 const s=fixture(17,[...pair(),unit('other','G-ARTY','GERMAN','ARTILLERY',H(-3,-3)),unit('s','S-INF','SOVIET','INFANTRY',H(5,5))]);
 const a=host(s,'plan023'),b=planned(s),plain=a.observe(G),input=b.observe(G);
 assert(!input.plan.unitIds.includes('other'));
 const moves=x=>observationCandidates(x).filter(a=>a.type==='MOVE'&&a.unitId==='other');assert.deepEqual(moves(plain),moves(input));
 assert.deepEqual(a.observe(S),b.observe(S));assert.deepEqual(basicAgent(a.observe(S)),basicAgent(b.observe(S)));
 assert.equal(mainAttackPlan(a.observe(S),null),null);assert(!('plan' in plain));
});

test('023 completion, engagement, lost membership and full goal congestion release without replacement',()=>{
 const h=planned(fixture(17,pair())),input=h.observe(G),prior=input.plan;
 for(const kind of ['complete','moved','dead','engaged','blocked','rejected']){
  const x=structuredClone(input);delete x.plan;
  if(kind==='blocked')for(const g of prior.goals)for(let i=0;i<defaultRules.stackingLimit;i++)x.view.units.push({...structuredClone(x.view.units[0]),id:`block-${hexKey(g)}-${i}`,hex:{...g},friendly:{...x.view.units[0].friendly,hasMoved:true}});
  else if(kind==='engaged')for(const u of [...x.view.units])x.view.units.push({visibility:'IDENTIFIED',id:'e'+u.id,side:'SOVIET',type:'INFANTRY',hex:getNeighbors(u.hex)[0],stats:{attack:1,defense:1,movement:1},supplyState:'SUPPLIED',entrenched:false,step:0});
  else for(const u of x.view.units){if(kind==='complete')u.hex={...prior.goals[0]};if(kind==='moved')u.friendly.hasMoved=true;if(kind==='dead')u.friendly.alive=false;if(kind==='rejected')x.history.push({observationKey:x.observationKey,outcome:'REJECTED',intent:{type:'MOVE',unitId:u.id,path:[prior.goals[0]]}});}
  assert.equal(mainAttackPlan(x,prior),null,kind);
 }
 const after=structuredClone(input);delete after.plan;after.agentRandom.decisionIndex+=3;
 assert.deepEqual(mainAttackPlan(after,prior),spec(prior),'unchanged goals have bounded phase inertia');
 after.history.push({observationKey:after.observationKey,outcome:'ACCEPTED',intent:{type:'MOVE',unitId:'a',path:[H(1)]}});
 assert.equal(mainAttackPlan(after,null),null,'no regroup after a move');
});

test('023 unreachable safe region cannot make Host wait forever: original READY clears phase plan',()=>{
 const s=fixture(17,pair());const occupied=new Set(pair().map(u=>hexKey(u.hex)));
 const terrain=Object.entries(defaultRules.terrain).find(([,v])=>v.movementCost==='IMPASSABLE')[0];
 for(const u of pair())for(const g of getNeighbors(u.hex))if(!occupied.has(hexKey(g)))s.hexes[hexKey(g)].terrain=terrain;
 const h=planned(s),input=h.observe(G);assert(input.plan);
 assert.equal(basicAgent(input).intent.type,'READY_FOR_PHASE_END');assert.equal(h.step(both(basicAgent)).status,'ACCEPTED');
 assert.notEqual(h.auditOmniscient().phase,'GERMAN_MOVEMENT');assert(!h.observe(G).plan);
});

test('023 actual provider hidden-state/RNG pairs and independent seats are deterministic and isolated',()=>{
 const a=fixture(17,[...pair(),unit('secret','S-INF','SOVIET','INFANTRY',H(-5,-5))]);
 const b=structuredClone(a);b.units.secret.hex=H(5,-5);b.random={seed:999,state:4321,draws:0};
 const x=planned(a),y=planned(b);assert.deepEqual(x.observe(G),y.observe(G));
 assert.deepEqual(observationCandidates(x.observe(G)),observationCandidates(y.observe(G)));assert.deepEqual(basicAgent(x.observe(G)),basicAgent(y.observe(G)));
 const z=host(a,'foreign',{planProviders:{GERMAN:mainAttackPlan,SOVIET:mainAttackPlan}});assert(!z.observe(S).plan);
 assert.equal(mainAttackPlan(z.observe(G),x.observe(G).plan),null);
});

test('023 phase lifecycle and fixed route/plan limits: two cohort moves then normal phase end',()=>{
 const h=planned(fixture(17,pair()));let steps=0;while(h.auditOmniscient().phase==='GERMAN_MOVEMENT'&&steps<4){const input=h.observe(G),scorer=createMoveScorer(input);for(const a of observationCandidates(input,false))scorer.prefix(a);
  assert(scorer.metrics.expanded<=ROUTE_DECISION_LIMIT);assert(observationCandidates(input).length<=255);if(input.plan){assert(input.plan.unitIds.length<=4);assert(input.plan.goals.length<=7);}assert.equal(h.step(both(basicAgent)).status,'ACCEPTED');steps++;}
 assert.equal(steps,3);assert(!h.observe(G).plan);assert.deepEqual(MAIN_ATTACK_LIMITS,{members:4,clusterRadius:2,targetRadius:3,cells:37,minimumMP:3});
 const code=readFileSync(new URL('../../.ai-dist/ai/fair/mainAttackPlan.js',import.meta.url),'utf8');
 assert(!/\b(?:RulesEngine|auditOmniscient|GameState|Math\.random|fetch|Date|performance)\b/.test(code));
 assert(!/risk\.(?:score|prefix)\(/.test(code));
});

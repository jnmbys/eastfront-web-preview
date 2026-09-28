import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,unit,host,production,attackFixture,G,S,defaultRules,defaultScenario,microScenario,RulesEngine} from './helpers.mjs';
import {minimalAgent,observationCandidates} from '../../.ai-dist/ai/fair/index.js';
import {validateGameStateIntegrity} from '../../.ai-dist/vendor/eastfront-digital-core/dist/index.js';
import {record,replay,save,battlePolicy,digest} from './flowHarness.mjs';
const both={GERMAN:minimalAgent,SOVIET:minimalAgent};
const chain=(seed=8246)=>fixture(seed,[unit('g','G-PANZER','GERMAN','PANZER',{q:-1,r:0}),unit('d','S-TANK','SOVIET','TANK',{q:0,r:0}),unit('d2','S-INF','SOVIET','INFANTRY',{q:2,r:0})],'GERMAN_COMBAT');
function check(initial,run){save('last-scenario',run.report);assert.equal(run.report.termination.status,'GAME_OVER');assert.deepEqual(validateGameStateIntegrity(run.end,defaultRules,initial.scenarioId===microScenario.id?microScenario:defaultScenario),[]);replay(initial,run);}

test('AI002 fixed-seed production full game: real turn-4 deployments, replay and deterministic trace',()=>{
 const initial=production(),a=record(initial),b=record(initial);save('production-seed17',a.report);save('production-seed17-repeat',{...b.report,trace:undefined,actions:undefined});check(initial,a);
 assert.deepEqual(a.report,b.report);assert(a.end.actionLog.some(e=>e.accepted&&e.turn===4&&e.action.type==='DEPLOY_REINFORCEMENT'));
 assert.equal(a.end.victory.checkedAtPhase,'GERMAN_ENTRENCHMENT');assert.equal(a.end.turn,defaultScenario.turnLimit);assert.deepEqual(a.end.random,initial.random);
 const receipt=a.report.actions.find(a=>a.type==='DEPLOY_REINFORCEMENT'),restored=structuredClone(a.end);restored.units[receipt.reinforcementId].alive=false;
 const resumed=host(restored,'resume-own-receipts');assert.deepEqual(resumed.observe(S).history,[]);assert(!resumed.observe(S).reinforcements.availableIds.includes(receipt.reinforcementId));assert.equal(resumed.observe(G).reinforcements,null);
 assert.equal(a.report.accepted,a.report.trace.filter(e=>e.result.status==='ACCEPTED'||e.result.status==='GAME_OVER').length);
});
test('AI002 real attack, retreat, advance, breakthrough, Schwerpunkt decline then natural terminal',()=>{
 const initial=chain(),a=record(initial,{policy:battlePolicy({advance:true,breakthrough:true})});save('combat-chain-seed8246',a.report);check(initial,a);
 const types=a.report.actions.map(a=>a.type);assert.deepEqual(types.slice(0,6),['ATTACK','PASS_REACTION','RETREAT','ADVANCE_AFTER_COMBAT','BREAKTHROUGH','PASS_SCHWERPUNKT']);
 assert(a.end.random.draws>initial.random.draws);assert.equal(Object.values(a.end.combatTransactions)[0].retreat.impossible,false);
 const b=record(initial,{policy:battlePolicy({advance:true,breakthrough:true}),seeds:{GERMAN:777,SOVIET:999}});assert.deepEqual(a.end,b.end);assert.deepEqual(a.report.actions,b.report.actions);
});
test('AI002 multi-unit losses and no-route retreat use actual Actions, never fabricated pending state',()=>{
 for(const sealed of [false,true]){
  const initial=sealed?chain():attackFixture();
  // Two damaged infantry defenders: current CRT seed 8246 gives D3R, requiring
  // an actual three-step allocation across units (not merely a two-unit roster).
  if(!sealed)for(const id of ['d','d2'])Object.assign(initial.units[id],{templateId:'S-INF',type:'INFANTRY',step:1});
  if(sealed)for(const [k,h] of Object.entries(initial.hexes))if(!['-1,0','0,0','2,0'].includes(k))h.terrain='LAKE';
  const run=record(initial,{policy:battlePolicy()});save(sealed?'combat-no-route':'combat-multi-loss',run.report);check(initial,run);
  const tx=Object.values(run.end.combatTransactions)[0];assert(tx.resolution);assert(tx.retreat.resolved);
  if(sealed){assert.equal(tx.retreat.impossible,true);assert.equal(tx.retreatImpossibleExtraLossApplied,true);assert.deepEqual(run.report.actions.find(a=>a.type==='RETREAT').retreats[0].path,[]);}
  else {const allocation=run.report.actions.find(a=>a.type==='ALLOCATE_LOSSES');assert(allocation);assert(tx.defenderUnitIds.length===2);assert(new Set(allocation.unitIdsByStep).size>=2,'actual losses allocated across different units');assert(run.report.trace.some(e=>e.pending==='LOSS_ALLOCATION'&&e.side==='SOVIET'));}
 }
});
test('AI002 actual Schwerpunkt second battle and required child decisions complete',()=>{
 const initial=chain(8253),run=record(initial,{policy:battlePolicy({advance:true,breakthrough:true,secondAttack:true})});save('combat-second-attack',run.report);check(initial,run);
 assert(run.report.actions.some(a=>a.type==='SCHWERPUNKT_ATTACK'));assert(Object.values(run.end.combatTransactions).some(t=>t.sourceBattleId&&t.stage==='CLOSED'));
});
test('AI002 reinforcement proposals are identical despite hidden entry blockers; own receipts are isolated',()=>{
 const initial=fixture(17,[unit('g-hidden','G-INF','GERMAN','INFANTRY',{q:5,r:0}),unit('s','S-INF','SOVIET','INFANTRY',{q:0,r:0})],'SOVIET_REINFORCEMENT_SUPPLY');initial.turn=4;
 const other=structuredClone(initial);other.units['g-hidden'].hex={q:5,r:5};other.random.state=123456;
 const x=host(initial),y=host(other),a=x.observe(S),b=y.observe(S);assert.deepEqual(a,b);assert.deepEqual(observationCandidates(a),observationCandidates(b));assert.deepEqual(minimalAgent(a),minimalAgent(b));
 assert.equal(x.observe(G).reinforcements,null);assert(!JSON.stringify(a).includes('g-hidden'));assert(!JSON.stringify(a).includes('123456'));
 assert.equal(x.step(both).status,'REJECTED');assert(!JSON.stringify(x.observe(S)).includes('ENEMY_OCCUPIED_HEX'));assert.deepEqual(x.auditOmniscient(),initial);
 assert.equal(x.step(both).status,'ACCEPTED','after rejected entry, engine may allow delay');assert.deepEqual(host(other,'new-room').observe(S).history,[]);
});
test('AI002 unsupported retreat distance stops explicitly; no oracle or forced-step bypass',()=>{
 const packet=structuredClone(host(chain()).observe(G));packet.view.pendingDecision={kind:'RETREAT',battleId:'synthetic-bound-test',side:'GERMAN',decisionOwnerControllerId:G,eligibleControllerIds:[G],unitIds:['g'],retreatSteps:3};
 assert.deepEqual(observationCandidates(packet),[]);assert.deepEqual(minimalAgent(packet),{kind:'STOP',reason:'NO_CANDIDATE'});
});

test('AI002 hidden retreat blockers preserve identical input/intent and recover only through actual adjudication',()=>{
 const make=blocked=>{
  const units=[unit('g','G-PANZER','GERMAN','PANZER',{q:-1,r:0}),unit('d','S-TANK','SOVIET','TANK',{q:0,r:0})];
  if(blocked)for(const [i,h] of [{q:2,r:0},{q:0,r:2},{q:2,r:-2}].entries())units.push(unit('secret-blocker-'+i,'G-INF','GERMAN','INFANTRY',h));
  const h=host(fixture(8246,units,'GERMAN_COMBAT'));
  assert.equal(h.step({...both,GERMAN:()=>({kind:'INTENT',intent:{type:'ATTACK',attackerUnitIds:['g'],target:{q:0,r:0}}})}).status,'ACCEPTED');assert.equal(h.step(both).status,'ACCEPTED');return h;
 };
 const a=make(false),b=make(true),x=a.observe(S),y=b.observe(S);assert.deepEqual(x,y);assert.deepEqual(minimalAgent(x),minimalAgent(y));assert.deepEqual(observationCandidates(x),observationCandidates(y));assert(!JSON.stringify(y).includes('secret-blocker'));
 assert.equal(a.step(both).status,'ACCEPTED');const before=b.auditOmniscient(),attempts=[];
 for(let i=0;i<8;i++){const decision=minimalAgent(b.observe(S)),result=b.step(both);attempts.push({decision,result});if(result.status!=='REJECTED')break;assert.deepEqual(b.auditOmniscient(),before);assert(!/INVALID_RETREAT|maximumLegalSteps|secret-blocker/.test(JSON.stringify(b.observe(S))));}
 save('hidden-retreat-recovery',{inputHash:digest(x),attempts});assert.equal(attempts.at(-1).result.status,'ACCEPTED');assert(attempts.length<=3);assert.equal(Object.values(b.auditOmniscient().combatTransactions)[0].retreat.impossible,true);
 assert.deepEqual(validateGameStateIntegrity(b.auditOmniscient(),defaultRules,microScenario),[]);
});

test('AI002 empty retreat is still rejected when an actual route exists; normal retry restores flow',()=>{
 const h=host(chain());h.step({...both,GERMAN:()=>({kind:'INTENT',intent:{type:'ATTACK',attackerUnitIds:['g'],target:{q:0,r:0}}})});h.step(both);
 const before=h.auditOmniscient(),input=h.observe(S),empty=observationCandidates(input).find(a=>a.type==='RETREAT'&&a.retreats.every(r=>r.path.length===0));assert(empty);
 assert.equal(h.step({...both,SOVIET:()=>({kind:'INTENT',intent:empty})}).status,'REJECTED');assert.deepEqual(h.auditOmniscient(),before);assert.equal(h.step(both).status,'ACCEPTED');assert.notEqual(h.auditOmniscient().pendingDecision?.kind,'RETREAT');
});

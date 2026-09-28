import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fixture,unit,host,intent,G,S,defaultRules,defaultScenario,microScenario,RulesEngine,germanDeployment,production,attackFixture} from './helpers.mjs';
import {minimalAgent,agentOrder,observationCandidates} from '../../.ai-dist/ai/fair/index.js';
import * as fairExports from '../../.ai-dist/ai/fair/index.js';
import {FairHost,runFairGame,REJECTION_LIMIT,HISTORY_LIMIT} from '../../.ai-dist/ai/authority/FairHost.js';
import {fairView,publicRules} from '../../.ai-dist/ai/authority/projection.js';
import {derivePlayerView,rememberPlayerView} from '../../.ai-dist/src/player-view/playerView.js';
import {validateMoveAction,validateGameStateIntegrity,getLegalRetreatStepOptions} from '../../.ai-dist/vendor/eastfront-digital-core/dist/index.js';
import {runOmniscientEvaluation} from '../../.ai-dist/ai/omniscient.js';
const both={GERMAN:minimalAgent,SOVIET:minimalAgent};
const json=JSON.stringify;
function equalBefore(a,b,cid=G){for(const h of [a,b]){const state=h.auditOmniscient();assert.deepEqual(validateGameStateIntegrity(state,defaultRules,state.scenarioId===microScenario.id?microScenario:defaultScenario),[],'paired authority states must be valid');}const x=a.observe(cid),y=b.observe(cid);assert.deepEqual(x,y);assert.deepEqual(observationCandidates(x),observationCandidates(y));assert.deepEqual(minimalAgent(x),minimalAgent(y));return x;}
function forbid(value,strings){const text=json(value);for(const s of strings)assert(!text.includes(s),`forbidden ${s}`);}
function dataOnly(value){if(value&&typeof value==='object'){assert(Object.isFrozen(value));for(const v of Object.values(value))dataOnly(v);}else assert.notEqual(typeof value,'function');}

test('AI001 hidden deployment paired states have identical input, candidates and pre-execution choice',()=>{
 const a=germanDeployment(),b=structuredClone(a);[b.units['S-I-01'].hex,b.units['S-TK-01'].hex]=[b.units['S-TK-01'].hex,b.units['S-I-01'].hex];
 b.random={seed:999,state:12345,draws:777};b.units['S-I-01'].artillerySupportUsed=true;
 const x=host(a),y=host(b),input=equalBefore(x,y);forbid(input,['S-I-01','S-TK-01','artillerySupportUsed":true','"random"','"draws"','"initialUnits"','authoritativeState']);
 assert.equal(minimalAgent(input).intent.type,'DEPLOY_INITIAL_UNIT');assert.equal(x.step(both).status,'ACCEPTED');assert.equal(y.step(both).status,'ACCEPTED');
});
test('AI001 hidden force composition, support, resources and future RNG do not affect fair policy',()=>{
 const a=fixture(),b=structuredClone(a);delete b.units['secret-enemy'];b.units['hidden-artillery']=unit('hidden-artillery','S-ARTY','SOVIET','ARTILLERY',{q:4,r:1});b.units['hidden-hq']=unit('hidden-hq','S-HQ','SOVIET','HQ',{q:4,r:2});b.cp.SOVIET=3;b.rp.SOVIET=100;b.random={seed:90871,state:314159,draws:88};
 const x=host(a),y=host(b),input=equalBefore(x,y);forbid(input,['secret-enemy','hidden-artillery','hidden-hq','"random"','"actionLog"','"combatTransactions"','"previousResult"','"state"','"seed":90871']);
 assert.deepEqual(Object.keys(input.view.resources),['GERMAN']);dataOnly(input);assert.deepEqual(structuredClone(input),JSON.parse(json(input)));
});
test('AI001 CONTACT stack/type anonymity and actual host Last Known retention match existing permission',()=>{
 const a=fixture(2722,[unit('recon','G-RECON','GERMAN','RECON',{q:0,r:0}),unit('secret-one','S-INF','SOVIET','INFANTRY',{q:3,r:0})]);
 const b=structuredClone(a);delete b.units['secret-one'];b.units['secret-two']=unit('secret-two','S-TANK','SOVIET','TANK',{q:3,r:0});b.units['secret-three']=unit('secret-three','S-ARTY','SOVIET','ARTILLERY',{q:3,r:0});
 const x=host(a),y=host(b),input=equalBefore(x,y);assert.equal(input.view.contacts.length,1);assert.equal(input.view.units.length,1);forbid(input,['secret-one','secret-two','secret-three']);
 const move=intent({type:'MOVE',unitId:'recon',path:[{q:-1,r:0}]});for(const h of [x,y])assert.equal(h.step({...both,GERMAN:move}).status,'ACCEPTED');
 const lost=equalBefore(x,y);assert.equal(lost.view.contacts.length,0);assert.equal(lost.view.lastKnown.length,1);assert.deepEqual(lost.view.lastKnown[0].hex,{q:3,r:0});forbid(lost,['secret-one','secret-two','secret-three']);
});
test('AI001 identified enemy fields and clearing stale observations are unchanged',()=>{
 const s=fixture();s.units['secret-enemy'].hex={q:1,r:0};const v=derivePlayerView(s,'GERMAN',defaultRules),memory=rememberPlayerView(v);
 const visible=fairView(v,'GERMAN').units.find(u=>u.side==='SOVIET');assert.deepEqual(Object.keys(visible).sort(),['entrenched','hex','id','side','stats','step','supplyState','type','visibility']);
 s.units['secret-enemy'].hex={q:5,r:0};assert.deepEqual(fairView(derivePlayerView(s,'GERMAN',defaultRules,memory),'GERMAN').lastKnown,[]);
 assert.throws(()=>fairView(derivePlayerView(s,'OBSERVER',defaultRules),'GERMAN'));
});
test('AI001 full-state legality is a real hidden-ZOC oracle, absent from fair candidate generation',()=>{
 const a=fixture(),b=structuredClone(a);a.units['secret-enemy'].hex={q:2,r:0};b.units['secret-enemy'].hex={q:5,r:5};
 const input=equalBefore(host(a),host(b));const action={type:'MOVE',controllerId:G,unitId:'g',path:[{q:1,r:0},{q:1,r:1}]};
 assert.notDeepEqual(validateMoveAction(a,defaultRules,action),validateMoveAction(b,defaultRules,action),'fixture must demonstrate the oracle, not merely assert a field is absent');
 forbid(input,['ENEMY_ZOC_STOP','ENEMY_ZOC_TO_ZOC','legalActions','preview','issues']);assert(observationCandidates(input).filter(c=>c.type==='MOVE').every(c=>c.path.length===1));
});
test('AI001 rejection details are constant, state/RNG unchanged, bounded recovery can continue',()=>{
 const a=fixture(),b=structuredClone(a);a.units['secret-enemy'].hex={q:2,r:0};b.units['secret-enemy'].hex={q:5,r:5};
 const x=host(a),y=host(b),probe=intent({type:'MOVE',unitId:'g',path:[{q:1,r:0},{q:1,r:1}]});
 for(const h of [x,y]){const old=h.auditOmniscient();assert.equal(h.step({...both,GERMAN:probe}).status,'REJECTED');assert.deepEqual(h.auditOmniscient(),old);}
 const after=equalBefore(x,y);assert.deepEqual(after.history,[{observationKey:after.observationKey,intent:null,outcome:'REJECTED'}]);
 for(const h of [x,y])assert.equal(h.step(both).status,'ACCEPTED');
});
test('AI001 even an admitted candidate uses real engine validation and returns no raw error',()=>{
 const s=fixture();s.hexes['1,0'].terrain='LAKE';const h=host(s),before=h.auditOmniscient(),move={type:'MOVE',unitId:'g',path:[{q:1,r:0}]};
 assert(observationCandidates(h.observe(G)).some(c=>json(c)===json(move)),'speculative candidate not prevalidated');
 assert.equal(h.step({...both,GERMAN:intent(move)}).status,'REJECTED');assert.deepEqual(h.auditOmniscient(),before);const input=h.observe(G);assert.deepEqual(input.history[0].intent,move);forbid(input,['IMPASSABLE_TERRAIN','issues','details','ActionRejected']);assert.equal(h.step(both).status,'ACCEPTED');
});
test('AI001 no forged controller, hidden target, support source, preallocated IDs or mutable authority capabilities',()=>{
 for(const attack of [{type:'ATTACK',attackerUnitIds:['g'],target:{q:5,r:0}},{type:'ATTACK',attackerUnitIds:['secret-enemy'],target:{q:0,r:0}},{type:'READY_FOR_PHASE_END',controllerId:S},{type:'READY_FOR_PHASE_END',actionId:'leak'},{type:'ATTACK',attackerUnitIds:['g'],target:{q:1,r:0},support:{attackerArtilleryUnitId:'secret-enemy'}}]){
  const h=host(fixture()),old=h.auditOmniscient();assert.equal(h.step({...both,GERMAN:intent(attack)}).status,'REJECTED');assert.deepEqual(h.auditOmniscient(),old);assert.equal(h.observe(G).history[0].intent,null);
 }
 const h=host(fixture());assert.equal(h.step({...both,GERMAN:input=>{input.view.units[0].hex.q=900;return minimalAgent(input);}}).status,'AGENT_ERROR');assert.equal(h.auditOmniscient().units.g.hex.q,0);assert.throws(()=>h.observe('OBSERVER'));
});
test('AI001 retries stop after fixed limit; terminal/exception paths never keep calling the policy',()=>{
 const h=host(fixture());let called=0;const bad=()=>{called++;return {kind:'INTENT',intent:{type:'bogus',details:'secret'}};};
 const result=runFairGame(h,{...both,GERMAN:bad},100);assert.equal(result.termination.status,'REJECTION_LIMIT');assert.equal(called,REJECTION_LIMIT);h.step({...both,GERMAN:bad});assert.equal(called,REJECTION_LIMIT);assert(h.observe(G).history.length<=HISTORY_LIMIT);
 const broken=host(fixture());assert.equal(broken.step({...both,GERMAN:()=>{throw new Error('secret error payload');}}).status,'AGENT_ERROR');assert.deepEqual(broken.observe(G).history,[]);
});
test('AI001 decision memory/seed partitions never cross seats or matches, including same controller IDs',()=>{
 const a=host(fixture(),'room-A');a.step({...both,GERMAN:intent({type:'bogus'})});assert.equal(a.observe(G).history.length,1);assert.deepEqual(a.observe(S).history,[]);assert.equal(a.observe(S).agentRandom.decisionIndex,0);
 const fresh=host(fixture(),'room-B');assert.deepEqual(fresh.observe(G).history,[]);assert.equal(fresh.observe(G).agentRandom.decisionIndex,0);assert.notEqual(a.observe(G).scope.matchId,fresh.observe(G).scope.matchId);
 assert.deepEqual(host(fixture(),'room-A').observe(G),host(fixture(),'room-A').observe(G),'no module-global cache');
});
test('AI001 agent tie breaking is repeatable, separate from combat RNG, and input-only',()=>{
 const h=host(germanDeployment()),input=h.observe(G),rng=h.auditOmniscient().random;const expected=minimalAgent(input);
 for(let i=0;i<100;i++){assert.deepEqual(minimalAgent(input),expected);assert.equal(agentOrder(42,i),agentOrder(42,i));}assert.deepEqual(h.auditOmniscient().random,rng);
 assert.notEqual(agentOrder(42,0),agentOrder(43,0));
});
test('AI001 explicit output allowlist strips unexpected view/rules fields rather than copying them',()=>{
 const state=fixture(),view=derivePlayerView(state,'GERMAN',defaultRules);view.authoritativeState=state;view.extra='secret';view.units[0].friendly.futureDice='secret';view.units[0].stats.secret='secret';view.edges.push({key:'0,0|1,0',a:{q:0,r:0,secret:'secret'},b:{q:1,r:0},road:false,railway:null,river:null,bridge:null});
 forbid(fairView(view,'GERMAN'),['authoritativeState','futureDice','"secret"','"extra"']);const rules=structuredClone(defaultRules);rules.secret=state;rules.unitTemplates['G-INF'].privateUnit='secret';const scenario={...defaultScenario,privateSeed:123};forbid(publicRules(rules,scenario),['"secret"','privateUnit','initialUnits','privateSeed','random']);
});
test('AI001 production deployment and alternating phases run until unsupported mandatory reinforcement, without bypass',()=>{
 const initial=production(),h=host(initial),result=runFairGame(h,both,1000),end=h.auditOmniscient();
 assert.equal(result.termination.status,'AGENT_STOP');assert.equal(result.termination.reason,'NO_CANDIDATE');
 assert(result.steps.some(s=>s.side==='GERMAN'));assert(result.steps.some(s=>s.side==='SOVIET'));assert(result.steps.filter(s=>s.status==='ACCEPTED').length>60);
 assert.equal(end.phase,'SOVIET_REINFORCEMENT_SUPPLY');assert.equal(end.turn,4);for(const cid of [G,S])assert(h.observe(cid).history.length<=HISTORY_LIMIT);assert.deepEqual(validateGameStateIntegrity(end,defaultRules,defaultScenario),[]);assert.deepEqual(end.random,initial.random);
});
test('AI001 terminal production checkpoint remains final German turn; terminal state never asks policy again',()=>{
 const h=host(production());runFairGame(h,both,1000);const state=h.auditOmniscient();
 // Privileged fixture construction, not a strategy capability or a rule change.
 state.turn=defaultScenario.turnLimit;state.phase='GERMAN_ENTRENCHMENT';state.activeSide='GERMAN';state.phaseReadyControllerIds=[];
 assert.deepEqual(validateGameStateIntegrity(state,defaultRules,defaultScenario),[]);
 const final=host(state),end=final.step(both);assert.equal(end.status,'GAME_OVER');
 assert.equal(final.auditOmniscient().victory.checkedAtPhase,'GERMAN_ENTRENCHMENT','preserve current final German checkpoint, not C3');
 assert.equal(final.auditOmniscient().victory.winner,'SOVIET');let called=false;const never=()=>{called=true;return {kind:'STOP',reason:'NO_CANDIDATE'};};
 assert.equal(final.step({GERMAN:never,SOVIET:never}).status,'GAME_OVER');assert.equal(host(final.auditOmniscient()).step({GERMAN:never,SOVIET:never}).status,'GAME_OVER');assert.equal(called,false);
});
test('AI001 actual battle submits via RulesEngine and routes reaction/loss to the correct side',()=>{
 const initial=attackFixture(),h=host(initial);const attack={type:'ATTACK',attackerUnitIds:['g'],target:{q:0,r:0}};
 assert.equal(h.step({...both,GERMAN:intent(attack)}).status,'ACCEPTED');let p=h.auditOmniscient().pendingDecision;assert.equal(p.kind,'DEFENDER_REACTION');assert.equal(p.decisionOwnerControllerId,S);assert.equal(h.observe(G).view.pendingDecision,null);
 let germanCalled=false;assert.equal(h.step({GERMAN:()=>{germanCalled=true;return minimalAgent(h.observe(G));},SOVIET:minimalAgent}).status,'ACCEPTED');assert.equal(germanCalled,false);p=h.auditOmniscient().pendingDecision;assert.equal(p.kind,'LOSS_ALLOCATION');
 const before=h.auditOmniscient(),choice=minimalAgent(h.observe(S));assert.equal(choice.intent.type,'ALLOCATE_LOSSES');const oracle=new RulesEngine(defaultRules,microScenario).apply(before,{...choice.intent,controllerId:S});assert(oracle.accepted);assert.equal(h.step(both).status,'ACCEPTED');assert.deepEqual(h.auditOmniscient(),oracle.state);assert.equal(h.auditOmniscient().pendingDecision.kind,'RETREAT');assert.equal(h.step(both).reason,'UNSUPPORTED_RETREAT');
});
test('AI001 optional combat passes use only authorized pending decision, not hidden previews',()=>{
 for(const [kind,type]of [['ADVANCE_AFTER_COMBAT','PASS_ADVANCE'],['BREAKTHROUGH_OPTION','PASS_BREAKTHROUGH'],['SCHWERPUNKT_OPTION','PASS_SCHWERPUNKT']]){
  const packet=structuredClone(host(fixture()).observe(G));packet.view.pendingDecision={kind,battleId:'B-known',side:'GERMAN',decisionOwnerControllerId:G,eligibleControllerIds:[G],eligibleUnitIds:['g']};
  assert.deepEqual(observationCandidates(packet),[{type,battleId:'B-known'}]);assert.deepEqual(minimalAgent(packet),{kind:'INTENT',intent:{type,battleId:'B-known'}});
 }
});
test('AI001 old headless entry remains explicitly omniscient and separate from the fair runtime graph',()=>{
 const s=fixture();let called=false;runOmniscientEvaluation(s,defaultRules,microScenario,context=>{called=true;assert.deepEqual(context.state.random,s.random);assert(context.state.units['secret-enemy']);return null;});assert(called);
 assert.deepEqual(Object.keys(fairExports).sort(),['CANDIDATE_LIMIT','agentOrder','minimalAgent','observationCandidates']);
 for(const file of readdirSync(new URL('../../.ai-dist/ai/fair/',import.meta.url)).filter(f=>f.endsWith('.js'))){const code=readFileSync(new URL('../../.ai-dist/ai/fair/'+file,import.meta.url),'utf8');for(const match of code.matchAll(/from ['"]([^'"]+)['"]/g))assert(['./candidates.js','./minimalAgent.js','../../vendor/eastfront-digital-core/dist/core/hex.js'].includes(match[1]),match[1]);}
});

 test('CORE-FIX-001 real breakthrough continues through fair host; corrupt positions still stop',()=>{
 let state=fixture(8246,[unit('g','G-PANZER','GERMAN','PANZER',{q:-1,r:0}),unit('d','S-TANK','SOVIET','TANK',{q:0,r:0}),unit('d2','S-INF','SOVIET','INFANTRY',{q:2,r:0})],'GERMAN_COMBAT');
 const engine=new RulesEngine(defaultRules,microScenario);
 const apply=action=>{const r=engine.apply(state,action);assert(r.accepted,json(r.issues));state=r.state;};
 // Privileged fixture setup queries are deliberately outside the fair policy import graph.
 apply({type:'ATTACK',controllerId:G,attackerUnitIds:['g'],target:{q:0,r:0}});apply({type:'PASS_REACTION',controllerId:S,battleId:state.pendingDecision.battleId});
 assert.equal(state.pendingDecision.kind,'RETREAT');let from=state.units.d.hex;const path=[];
 for(let i=0;i<state.pendingDecision.retreatSteps;i++){from=getLegalRetreatStepOptions(state,defaultRules,state.units.d,from).find(h=>h.q!==1||h.r!==0);assert(from);path.push(from);}
 apply({type:'RETREAT',controllerId:S,battleId:state.pendingDecision.battleId,retreats:[{unitId:'d',path}]});
 for(const [kind,pass,next] of [
   ['ADVANCE_AFTER_COMBAT','PASS_ADVANCE',{type:'ADVANCE_AFTER_COMBAT',unitId:'g'}],
   ['BREAKTHROUGH_OPTION','PASS_BREAKTHROUGH',{type:'BREAKTHROUGH',unitId:'g',path:[{q:1,r:0}]}]]){
  assert.equal(state.pendingDecision.kind,kind);assert.deepEqual(validateGameStateIntegrity(state,defaultRules,microScenario),[],kind+' initial integrity');const h=host(state),choice=minimalAgent(h.observe(G));assert.equal(choice.intent.type,pass);
  const oracle=engine.apply(state,{...choice.intent,controllerId:G});assert(oracle.accepted);assert.deepEqual(validateGameStateIntegrity(oracle.state,defaultRules,microScenario),[],kind+' resulting integrity');assert.equal(h.step(both).status,'ACCEPTED');assert.deepEqual(h.auditOmniscient(),oracle.state);assert.deepEqual(h.auditOmniscient().random,state.random);
  if(next)apply({...next,controllerId:G,battleId:state.pendingDecision.battleId});
 }
 assert.equal(state.pendingDecision.kind,'SCHWERPUNKT_OPTION');
 assert.deepEqual(validateGameStateIntegrity(state,defaultRules,microScenario),[]);
 const live=host(state);const pass=minimalAgent(live.observe(G));assert.equal(pass.intent.type,'PASS_SCHWERPUNKT');
 const oracle=engine.apply(state,{...pass.intent,controllerId:G});assert(oracle.accepted);
 assert.equal(live.step(both).status,'ACCEPTED');assert.deepEqual(live.auditOmniscient(),oracle.state);
 assert.equal(live.auditOmniscient().pendingDecision,null);
 const invalid=structuredClone(state);invalid.units.g.hex={q:4,r:0};
 assert(validateGameStateIntegrity(invalid,defaultRules,microScenario).some(i=>i.code==='COMBAT_BREAKTHROUGH_POSITION_INVALID'));
 const blocked=host(invalid);let called=false;const policy=input=>{called=true;return minimalAgent(input);};
 assert.equal(blocked.step({GERMAN:policy,SOVIET:policy}).status,'INTEGRITY_FAILURE');assert.equal(called,false);
});
test('AI001 accepted hidden artillery selection never enters the opposing policy packet',()=>{
 const make=id=>{
  let state=fixture(2722,[unit('g','G-INF','GERMAN','INFANTRY',{q:-1,r:0}),unit('d','S-INF','SOVIET','INFANTRY',{q:0,r:0}),unit(id,'S-ARTY','SOVIET','ARTILLERY',{q:0,r:2})],'GERMAN_COMBAT');
  const engine=new RulesEngine(defaultRules,microScenario);
  for(const action of [{type:'ATTACK',controllerId:G,attackerUnitIds:['g'],target:{q:0,r:0}},{type:'COMBAT_REACTION',controllerId:S,battleId:'B-000001',reaction:{kind:'DEFENDER_ARTILLERY',artilleryUnitId:id}}]){const r=engine.apply(state,action);assert(r.accepted,json(r.issues));state=r.state;}
  assert.deepEqual(validateGameStateIntegrity(state,defaultRules,microScenario),[]);return host(state);
 };
 const input=equalBefore(make('secret-support-A'),make('secret-support-B'));forbid(input,['secret-support-A','secret-support-B','defenderArtilleryUnitId','combatTransactions']);assert.equal(input.view.pendingDecision,null);
});

test('AI001 identical submitted combat intents preserve exact Core dice/state across different agent seeds',()=>{
 const initial=attackFixture(),a=host(initial,'rng-test',{agentSeeds:{GERMAN:1,SOVIET:2}}),b=host(initial,'rng-test',{agentSeeds:{GERMAN:333,SOVIET:444}});
 const attack={type:'ATTACK',attackerUnitIds:['g'],target:{q:0,r:0}},engine=new RulesEngine(defaultRules,microScenario);
 let expected=engine.apply(initial,{...attack,controllerId:G});assert(expected.accepted);
 for(const h of [a,b]){assert.equal(h.step({...both,GERMAN:intent(attack)}).status,'ACCEPTED');assert.deepEqual(h.auditOmniscient(),expected.state);}
 expected=engine.apply(expected.state,{type:'PASS_REACTION',controllerId:S,battleId:expected.state.pendingDecision.battleId});assert(expected.accepted);
 for(const h of [a,b]){assert.equal(h.step(both).status,'ACCEPTED');assert.deepEqual(h.auditOmniscient(),expected.state);}
 assert(expected.state.random.draws>initial.random.draws);assert.deepEqual(a.auditOmniscient().random,b.auditOmniscient().random);
});

test('AI001 policy receives exactly one data argument and no implicit host or other-seat receiver',()=>{
 const h=host(fixture());let called=false;function policy(input){called=true;assert.equal(this,undefined);assert.equal(arguments.length,1);dataOnly(input);return minimalAgent(input);}
 assert.equal(h.step({...both,GERMAN:policy}).status,'ACCEPTED');assert(called);
});

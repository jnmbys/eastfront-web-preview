import assert from 'node:assert/strict';
import {
  RulesEngine,createGameState,defaultRules,defaultScenario,beginPlayerTurn,
  continueCombatAfterLosses,analyzeLossRequirement,validateLossAllocationSequence,
  buildCombatContext,validateAttackAction,validateGameStateIntegrity
} from '../dist/index.js';

const G='G-HUMAN-1',S='S-AI-1',G2='G-AI-2';
const unit=(id,templateId,side,type,hex,controllerId=side==='GERMAN'?G:S)=>({
 id,templateId,side,type,step:0,alive:true,hex:{...hex},supplyState:'SUPPLIED',entrenched:false,
 hasMoved:false,hasAttacked:false,controllerId,temporarySupply:false,dedicatedRailRepair:false,
 reconZocIgnoreUsed:false,artillerySupportUsed:false,lastHQCommandTurn:null
});
const hexes=[];for(let q=-5;q<=5;q++)for(let r=-5;r<=5;r++)hexes.push({coord:{q,r},terrain:'PLAIN',control:null});
const engine=new RulesEngine(defaultRules,defaultScenario);
function make(units=[],seed=123){
 const st=createGameState({scenario:defaultScenario,rules:defaultRules,hexes,edges:[],units,seed});
 st.phase='GERMAN_COMBAT';st.activeSide='GERMAN';return st;
}
function txFor(st,{battleId='B-LOSS',attackers=[],defenders=[],losses=[]}={}){
 st.combatTransactions[battleId]={
  battleId,sourceBattleId:null,stage:'LOSS_ALLOCATION',declaredByActionId:'A-000001',declaringControllerId:G,
  attackerSide:'GERMAN',defenderSide:'SOVIET',attackerUnitIds:[...attackers],defenderUnitIds:[...defenders],targetHex:{q:0,r:0},commitmentIds:[],
  attackerArtilleryUnitId:null,defenderArtilleryUnitId:null,attackerHQEffect:null,defenderHQEffect:null,defenderReactionPassed:true,context:null,resolution:null,
  unresolvedLosses:structuredClone(losses),lossesApplied:{GERMAN:{},SOVIET:{}},retreat:null,retreatImpossibleExtraLossApplied:false,
  advance:null,breakthrough:null,schwerpunkt:null,isSchwerpunktSecondAttack:false,completedByActionId:null
 };
 return st.combatTransactions[battleId];
}
function resolveAuto(st,battleId='B-LOSS',actionId='A-000010'){
 const events=[];continueCombatAfterLosses(st,defaultRules,st.combatTransactions[battleId],actionId,events);return events;
}

// 1 artillery support window resets for both armies at every Player Turn boundary.
{
 const ga=unit('ga','G-ARTY','GERMAN','ARTILLERY',{q:-2,r:0});
 const sa=unit('sa','S-ARTY','SOVIET','ARTILLERY',{q:2,r:0});sa.artillerySupportUsed=true;ga.artillerySupportUsed=true;
 const st=make([ga,sa]);
 beginPlayerTurn(st,defaultRules,'GERMAN');
 assert.equal(st.units.sa.artillerySupportUsed,false);assert.equal(st.units.ga.artillerySupportUsed,false);
 st.units.sa.artillerySupportUsed=true;
 beginPlayerTurn(st,defaultRules,'SOVIET');
 assert.equal(st.units.sa.artillerySupportUsed,false);
}

// 2 exact replay restores deterministic idCounters as well as log/RNG/combat state.
{
 const factory=()=>make([unit('g','G-INF','GERMAN','INFANTRY',{q:-1,r:0}),unit('s','S-ELITE','SOVIET','ELITE_INFANTRY',{q:0,r:0})],2722);
 let live=factory();
 live=engine.apply(live,{type:'ATTACK',controllerId:G,attackerUnitIds:['g'],target:{q:0,r:0}}).state;
 live=engine.apply(live,{type:'PASS_REACTION',controllerId:S,battleId:Object.keys(live.combatTransactions)[0]}).state;
 const logged=live.actionLog.map(e=>structuredClone(e.action));
 let replay=factory();
 for(const action of logged)replay=engine.apply(replay,action).state;
 assert.deepEqual(replay.idCounters,live.idCounters);
 assert.deepEqual(replay.random,live.random);
 assert.deepEqual(replay.combatTransactions,live.combatTransactions);
 assert.deepEqual(replay.actionLog,live.actionLog);
 assert.deepEqual(replay,live);
}

// Loss helper cases: A1 one unit, A2 one unit, A2 across two, A3 across three.
{
 const cases=[
  {steps:1,ids:['a'],expected:{a:1}},
  {steps:2,ids:['a'],expected:{a:2}},
  {steps:2,ids:['a','b'],expected:{a:1,b:1}},
  {steps:3,ids:['a','b','c'],expected:{a:1,b:1,c:1}},
 ];
 for(const [i,c] of cases.entries()){
  const us=c.ids.map((id,n)=>unit(id,'G-INF','GERMAN','INFANTRY',{q:-1-n,r:n}));const st=make(us);
  const req={side:'GERMAN',steps:c.steps,eligibleUnitIds:c.ids,reason:'CRT'};
  const tx=txFor(st,{battleId:`B-U${i}`,attackers:c.ids,losses:[req]});
  const events=[];continueCombatAfterLosses(st,defaultRules,tx,`A-U${i}`,events);
  assert.deepEqual(tx.lossesApplied.GERMAN,c.expected);
  assert(events.some(e=>e.type==='LossesAllocated'&&e.automatic===true));
 }
}

// 4 losses across 3 has a player choice; concentrated first round is illegal, fair sequence legal.
{
 const us=['a','b','c'].map((id,n)=>unit(id,'G-INF','GERMAN','INFANTRY',{q:-1-n,r:n}));const st=make(us);
 const req={side:'GERMAN',steps:4,eligibleUnitIds:['a','b','c'],reason:'CRT'};
 txFor(st,{attackers:['a','b','c'],losses:[req]});resolveAuto(st);
 assert.equal(st.pendingDecision?.kind,'LOSS_ALLOCATION');
 assert(validateLossAllocationSequence(st,defaultRules,req,['a','a','b','c']).some(x=>x.code==='INVALID_LOSS_ALLOCATION'));
 const bad=engine.apply(st,{type:'ALLOCATE_LOSSES',controllerId:G,battleId:'B-LOSS',unitIdsByStep:['a','a','b','c']});assert.equal(bad.accepted,false);
 const good=engine.apply(st,{type:'ALLOCATE_LOSSES',controllerId:G,battleId:'B-LOSS',unitIdsByStep:['a','b','c','a']});assert.equal(good.accepted,true);assert.equal(good.state.units.a.step,2);assert.equal(good.state.units.b.step,1);assert.equal(good.state.units.c.step,1);
}

// Already damaged capacity is respected: step2 unit can take only one, remaining losses flow fairly.
{
 const a=unit('a','G-INF','GERMAN','INFANTRY',{q:-1,r:0});a.step=2;const b=unit('b','G-INF','GERMAN','INFANTRY',{q:-2,r:0});const st=make([a,b]);
 const req={side:'GERMAN',steps:3,eligibleUnitIds:['a','b'],reason:'CRT'};const analysis=analyzeLossRequirement(st,defaultRules,req);assert.equal(analysis.unique,true);assert.deepEqual(analysis.uniqueSequence,['a','b','b']);
 const tx=txFor(st,{attackers:['a','b'],losses:[req]});resolveAuto(st);assert.equal(st.units.a.alive,false);assert.equal(st.units.b.step,2);assert.deepEqual(tx.lossesApplied.GERMAN,{a:1,b:2});
}

// HQ maxDamageSteps=1 dies on its first loss; normal 3-step unit dies on third.
{
 const hq=unit('hq','G-HQ','GERMAN','HQ',{q:-1,r:0});const st=make([hq]);const tx=txFor(st,{attackers:['hq'],losses:[{side:'GERMAN',steps:1,eligibleUnitIds:['hq'],reason:'CRT'}]});const events=resolveAuto(st);assert.equal(st.units.hq.alive,false);assert(events.some(e=>e.type==='UnitDestroyed'&&e.unitId==='hq'));assert.deepEqual(tx.lossesApplied.GERMAN,{hq:1});
 const inf=unit('inf','G-INF','GERMAN','INFANTRY',{q:-1,r:0});const st2=make([inf]);txFor(st2,{attackers:['inf'],losses:[{side:'GERMAN',steps:3,eligibleUnitIds:['inf'],reason:'CRT'}]});const ev2=resolveAuto(st2);assert.equal(st2.units.inf.alive,false);assert.equal(ev2.filter(e=>e.type==='UnitStepLost'&&e.unitId==='inf').length,3);
}

// EX-style requirements process attacker first, then defender; both are applied before next stage.
{
 const g=unit('g','G-INF','GERMAN','INFANTRY',{q:-1,r:0});const s=unit('s','S-INF','SOVIET','INFANTRY',{q:0,r:0});const st=make([g,s]);const tx=txFor(st,{attackers:['g'],defenders:['s'],losses:[{side:'GERMAN',steps:1,eligibleUnitIds:['g'],reason:'CRT'},{side:'SOVIET',steps:1,eligibleUnitIds:['s'],reason:'CRT'}]});const events=resolveAuto(st);assert.equal(st.units.g.step,1);assert.equal(st.units.s.step,1);assert.deepEqual(tx.lossesApplied.GERMAN,{g:1});assert.deepEqual(tx.lossesApplied.SOVIET,{s:1});assert.equal(events.filter(e=>e.type==='LossesAllocated').length,2);
}

// Committed teammate attacker: declaring controller owns battle-scoped loss decision, not permanent unit ownership.
{
 const g1=unit('g1','G-INF','GERMAN','INFANTRY',{q:-1,r:0},G);const g2=unit('g2','G-INF','GERMAN','INFANTRY',{q:-2,r:0},G2);const s=unit('s','S-INF','SOVIET','INFANTRY',{q:0,r:0},S);const st=make([g1,g2,s]);st.controllers[G2]={id:G2,side:'GERMAN',controllerType:'AI'};
 st.unitCommitments.c={id:'c',grantActionId:'A-C',battleId:'B-COM',grantorControllerId:G2,authorizedControllerId:G,unitIds:['g2'],createdTurn:st.turn,createdPhase:st.phase,active:true};
 const tx=txFor(st,{battleId:'B-COM',attackers:['g1','g2'],defenders:['s'],losses:[{side:'GERMAN',steps:1,eligibleUnitIds:['g1','g2'],reason:'CRT'}]});tx.commitmentIds=['c'];const events=[];continueCombatAfterLosses(st,defaultRules,tx,'A-PREP',events);assert.equal(st.pendingDecision?.decisionOwnerControllerId,G);
 const r=engine.apply(st,{type:'ALLOCATE_LOSSES',controllerId:G,battleId:'B-COM',unitIdsByStep:['g2']});assert.equal(r.accepted,true);assert.equal(r.state.units.g2.step,1);assert.equal(r.state.units.g2.controllerId,G2);
}

// Unrelated commitment references are rejected even when the commitment exists.
{
 const g1=unit('g1','G-INF','GERMAN','INFANTRY',{q:-1,r:0},G);const g2=unit('g2','G-INF','GERMAN','INFANTRY',{q:-2,r:0},G2);const s=unit('s','S-INF','SOVIET','INFANTRY',{q:0,r:0},S);const st=make([g1,g2,s]);st.controllers[G2]={id:G2,side:'GERMAN',controllerType:'AI'};
 st.unitCommitments.c={id:'c',grantActionId:'A-C',battleId:'B-X',grantorControllerId:G2,authorizedControllerId:G,unitIds:['g2'],createdTurn:st.turn,createdPhase:st.phase,active:true};
 const issues=validateAttackAction(st,defaultRules,{type:'ATTACK',controllerId:G,battleId:'B-X',attackerUnitIds:['g1'],commitmentIds:['c'],target:{q:0,r:0}});assert(issues.some(x=>x.code==='UNAUTHORIZED_UNIT_COMMITMENT'));
}

// Last Stand shift is configuration-backed, not hard coded.
{
 const rules=structuredClone(defaultRules);rules.hqCommands.LAST_STAND.crtShift=-2;
 const st=make([unit('g','G-INF','GERMAN','INFANTRY',{q:-1,r:0}),unit('s','S-INF','SOVIET','INFANTRY',{q:0,r:0})]);
 const ctx=buildCombatContext(st,rules,{type:'ATTACK',controllerId:G,attackerUnitIds:['g'],target:{q:0,r:0}},{defenderHQCommand:'LAST_STAND'});assert.equal(ctx.modifiers.hqShift,-2);
}

// State remains internally valid after representative loss resolution.
{
 const a=unit('a','G-INF','GERMAN','INFANTRY',{q:-1,r:0});const b=unit('b','G-INF','GERMAN','INFANTRY',{q:-2,r:0});const s=unit('s','S-INF','SOVIET','INFANTRY',{q:0,r:0});const st=make([a,b,s]);const tx=txFor(st,{attackers:['a','b'],defenders:['s'],losses:[{side:'GERMAN',steps:2,eligibleUnitIds:['a','b'],reason:'CRT'}]});resolveAuto(st);assert.deepEqual(validateGameStateIntegrity(st,defaultRules),[]);
}

console.log('Digital Branch Task 002A-2A combat loss/preflight smoke checks passed.');

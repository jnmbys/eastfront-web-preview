import assert from 'node:assert/strict';
import {
  RulesEngine,createGameState,defaultRules,defaultScenario,validateGameStateIntegrity
} from '../dist/index.js';

const G='G-HUMAN-1',S='S-AI-1';
const engine=new RulesEngine(defaultRules,defaultScenario);
const plain=(q,r)=>({coord:{q,r},terrain:'PLAIN',control:null});
const lake=(q,r)=>({coord:{q,r},terrain:'LAKE',control:null});
const unit=(id,templateId,side,type,hex,controllerId=side==='GERMAN'?G:S)=>({
  id,templateId,side,type,step:0,alive:true,hex:{...hex},supplyState:'SUPPLIED',entrenched:false,
  hasMoved:false,hasAttacked:false,controllerId,temporarySupply:false,dedicatedRailRepair:false,
  reconZocIgnoreUsed:false,artillerySupportUsed:false,lastHQCommandTurn:null
});
const grid=(q0=-4,q1=4,r0=-4,r1=4)=>{const out=[];for(let q=q0;q<=q1;q++)for(let r=r0;r<=r1;r++)out.push(plain(q,r));return out;};
function make(units,hexes=grid()){
  const st=createGameState({scenario:defaultScenario,rules:defaultRules,hexes,edges:[],units,seed:123});
  for(const u of Object.values(st.units))if(u.alive&&u.side==='GERMAN')u.supplyState='SUPPLIED';
  st.phase='GERMAN_COMBAT';st.activeSide='GERMAN';return st;
}
function prepareRetreat(st,{battleId='B-R',attackers=['g'],defenders=['d'],side='SOVIET',steps=1}={}){
  const unitIds=side==='GERMAN'?attackers:defenders;
  const owner=side==='GERMAN'?G:S;
  st.combatTransactions[battleId]={
    battleId,sourceBattleId:null,stage:'RETREAT',declaredByActionId:'A-DECL',declaringControllerId:G,
    attackerSide:'GERMAN',defenderSide:'SOVIET',attackerUnitIds:[...attackers],defenderUnitIds:[...defenders],targetHex:{q:0,r:0},commitmentIds:[],
    attackerArtilleryUnitId:null,defenderArtilleryUnitId:null,attackerHQEffect:null,defenderHQEffect:null,defenderReactionPassed:true,context:null,
    resolution:null,unresolvedLosses:[],lossesApplied:{GERMAN:{},SOVIET:{}},retreat:{side,steps,unitIds:[...unitIds],resolved:false,impossible:false},
    retreatImpossibleExtraLossApplied:false,advance:null,breakthrough:null,schwerpunkt:null,isSchwerpunktSecondAttack:false,completedByActionId:null
  };
  st.pendingDecision={kind:'RETREAT',battleId,side,decisionOwnerControllerId:owner,eligibleControllerIds:[owner],retreatSteps:steps,unitIds:[...unitIds]};
  return st.combatTransactions[battleId];
}
const retreat=(st,battleId,controllerId,retreats)=>engine.apply(st,{type:'RETREAT',controllerId,battleId,retreats});
const codes=r=>r.issues.map(x=>x.code);


function reachRetreatFromAttack(seed,units,attackerUnitIds){
  let st=make(units,grid());
  st.random={seed,state:seed,draws:0};
  const attack=engine.apply(st,{type:'ATTACK',controllerId:G,attackerUnitIds,target:{q:0,r:0}});
  assert.equal(attack.accepted,true);
  const battleId=attack.battleId;
  assert(battleId);
  const resolved=engine.apply(attack.state,{type:'PASS_REACTION',controllerId:S,battleId});
  assert.equal(resolved.accepted,true);
  assert.equal(resolved.state.pendingDecision?.kind,'RETREAT');
  return{state:resolved.state,battleId,result:resolved.state.combatTransactions[battleId].resolution.crtResult};
}

// End-to-end integration from ATTACK -> reaction -> seeded CRT -> RETREAT: defender R1 (DR).
{
  const reached=reachRetreatFromAttack(11,[unit('g1','G-PANZER','GERMAN','PANZER',{q:-1,r:0}),unit('g2','G-PANZER','GERMAN','PANZER',{q:0,r:-1}),unit('d','S-INF','SOVIET','INFANTRY',{q:0,r:0})],['g1','g2']);
  assert.equal(reached.result,'DR');
  const r=retreat(reached.state,reached.battleId,S,[{unitId:'d',path:[{q:1,r:0}]}]);assert.equal(r.accepted,true);assert.deepEqual(r.state.units.d.hex,{q:1,r:0});
}

// End-to-end defender R2 (D2R) after existing Loss Engine auto-applies two defender steps.
{
  const reached=reachRetreatFromAttack(53,[unit('g1','G-PANZER','GERMAN','PANZER',{q:-1,r:0}),unit('g2','G-PANZER','GERMAN','PANZER',{q:0,r:-1}),unit('d','S-INF','SOVIET','INFANTRY',{q:0,r:0})],['g1','g2']);
  assert.equal(reached.result,'D2R');assert.equal(reached.state.units.d.step,2);
  const r=retreat(reached.state,reached.battleId,S,[{unitId:'d',path:[{q:1,r:0},{q:2,r:0}]}]);assert.equal(r.accepted,true);assert.deepEqual(r.state.units.d.hex,{q:2,r:0});
}

// End-to-end attacker R1 (AR).
{
  const reached=reachRetreatFromAttack(53,[unit('g','G-INF','GERMAN','INFANTRY',{q:-1,r:0}),unit('d','S-HEAVY','SOVIET','HEAVY_TANK',{q:0,r:0})],['g']);
  assert.equal(reached.result,'AR');
  const r=retreat(reached.state,reached.battleId,G,[{unitId:'g',path:[{q:-2,r:0}]}]);assert.equal(r.accepted,true);assert.deepEqual(r.state.units.g.hex,{q:-2,r:0});
}

// Defender R1: actual relocation, flags/events, target clears and only prepares Advance.
{
  const g=unit('g','G-INF','GERMAN','INFANTRY',{q:-1,r:0});
  const d=unit('d','S-INF','SOVIET','INFANTRY',{q:0,r:0});d.entrenched=true;
  const st=make([g,d]);prepareRetreat(st,{steps:1});
  const r=retreat(st,'B-R',S,[{unitId:'d',path:[{q:1,r:0}]}]);
  assert.equal(r.accepted,true);assert.deepEqual(r.state.units.d.hex,{q:1,r:0});
  assert.equal(r.state.units.d.entrenched,false);assert.equal(r.state.units.d.hasMoved,true);assert.equal(r.state.units.d.hasAttacked,false);
  const e=r.events.find(e=>e.type==='UnitRetreated');assert(e);assert.equal(e.requiredSteps,1);assert.equal(e.completedSteps,1);
  assert.equal(r.state.pendingDecision?.kind,'ADVANCE_AFTER_COMBAT');assert.equal(r.state.combatTransactions['B-R'].retreat.resolved,true);
  const passed=engine.apply(r.state,{type:'PASS_ADVANCE',controllerId:G,battleId:'B-R'});assert.equal(passed.accepted,true);assert.equal(passed.state.combatTransactions['B-R'].stage,'CLOSED');
  assert.deepEqual(validateGameStateIntegrity(r.state,defaultRules),[]);
}

// Defender R2 complete path.
{
  const st=make([unit('g','G-INF','GERMAN','INFANTRY',{q:-1,r:0}),unit('d','S-INF','SOVIET','INFANTRY',{q:0,r:0})]);prepareRetreat(st,{steps:2});
  const r=retreat(st,'B-R',S,[{unitId:'d',path:[{q:1,r:0},{q:2,r:0}]}]);
  assert.equal(r.accepted,true);assert.deepEqual(r.state.units.d.hex,{q:2,r:0});
  const e=r.events.find(e=>e.type==='UnitRetreated');assert.equal(e?.completedSteps,2);assert.equal(r.events.some(e=>e.type==='RetreatImpossible'),false);
}

// Attacker R1.
{
  const st=make([unit('g','G-INF','GERMAN','INFANTRY',{q:-1,r:0}),unit('d','S-INF','SOVIET','INFANTRY',{q:0,r:0})]);prepareRetreat(st,{side:'GERMAN',steps:1});
  const r=retreat(st,'B-R',G,[{unitId:'g',path:[{q:-2,r:0}]}]);
  assert.equal(r.accepted,true);assert.deepEqual(r.state.units.g.hex,{q:-2,r:0});assert.equal(r.state.combatTransactions['B-R'].stage,'CLOSED');
}

// Full R2 exists: deliberately submitting only R1 is rejected and authoritative position is unchanged.
{
  const st=make([unit('g','G-INF','GERMAN','INFANTRY',{q:-1,r:0}),unit('d','S-INF','SOVIET','INFANTRY',{q:0,r:0})]);prepareRetreat(st,{steps:2});
  const r=retreat(st,'B-R',S,[{unitId:'d',path:[{q:1,r:0}]}]);
  assert.equal(r.accepted,false);assert(codes(r).includes('INVALID_RETREAT'));assert.deepEqual(r.state.units.d.hex,{q:0,r:0});assert.equal(r.state.pendingDecision?.kind,'RETREAT');
}

// Maximal partial R2: only one legal step exists, so one step is mandatory and becomes failed retreat.
{
  const hexes=[plain(-1,0),plain(0,0),plain(1,0)];
  const d=unit('d','S-INF','SOVIET','INFANTRY',{q:0,r:0});d.entrenched=true;
  const st=make([unit('g','G-INF','GERMAN','INFANTRY',{q:-1,r:0}),d],hexes);prepareRetreat(st,{steps:2});
  const zero=retreat(st,'B-R',S,[{unitId:'d',path:[]}]);assert.equal(zero.accepted,false);assert(codes(zero).includes('INVALID_RETREAT'));
  const r=retreat(st,'B-R',S,[{unitId:'d',path:[{q:1,r:0}]}]);
  assert.equal(r.accepted,true);assert.deepEqual(r.state.units.d.hex,{q:1,r:0});assert.equal(r.state.units.d.step,1);
  assert.equal(r.state.units.d.entrenched,false);assert.equal(r.state.units.d.hasMoved,true);
  assert.equal(r.events.filter(e=>e.type==='RetreatImpossible').length,1);assert.equal(r.events.find(e=>e.type==='UnitRetreated')?.completedSteps,1);
  assert.equal(r.state.combatTransactions['B-R'].retreatImpossibleExtraLossApplied,true);
  assert.equal(r.state.pendingDecision?.kind,'ADVANCE_AFTER_COMBAT');
  assert.deepEqual(validateGameStateIntegrity(r.state,defaultRules),[]);
}

// R2 with zero legal steps: [] is required, no UnitRetreated, one RetreatImpossible + unique auto loss.
{
  const st=make([unit('g','G-INF','GERMAN','INFANTRY',{q:-1,r:0}),unit('d','S-INF','SOVIET','INFANTRY',{q:0,r:0})],[plain(-1,0),plain(0,0)]);prepareRetreat(st,{steps:2});
  const r=retreat(st,'B-R',S,[{unitId:'d',path:[]}]);assert.equal(r.accepted,true);assert.deepEqual(r.state.units.d.hex,{q:0,r:0});assert.equal(r.state.units.d.step,1);
  assert.equal(r.events.some(e=>e.type==='UnitRetreated'),false);assert.equal(r.events.filter(e=>e.type==='RetreatImpossible').length,1);
  assert.equal(r.events.some(e=>e.type==='LossesAllocated'&&e.automatic===true),true);assert.equal(r.state.combatTransactions['B-R'].stage,'CLOSED');
}

// Ordered multi-unit execution: every required retreater exactly once and action order is authoritative.
{
  const st=make([unit('g','G-INF','GERMAN','INFANTRY',{q:-1,r:0}),unit('d1','S-INF','SOVIET','INFANTRY',{q:0,r:0}),unit('d2','S-INF','SOVIET','INFANTRY',{q:0,r:0})]);prepareRetreat(st,{defenders:['d1','d2'],steps:1});
  const missing=retreat(st,'B-R',S,[{unitId:'d1',path:[{q:1,r:0}]}]);assert.equal(missing.accepted,false);assert(codes(missing).includes('INVALID_RETREAT'));
  const duplicate=retreat(st,'B-R',S,[{unitId:'d1',path:[{q:1,r:0}]},{unitId:'d1',path:[{q:1,r:-1}]}]);assert.equal(duplicate.accepted,false);assert(codes(duplicate).includes('INVALID_RETREAT'));
  const r=retreat(st,'B-R',S,[{unitId:'d1',path:[{q:1,r:0}]},{unitId:'d2',path:[{q:1,r:-1}]}]);assert.equal(r.accepted,true);
  assert.deepEqual(r.events.filter(e=>e.type==='UnitRetreated').map(e=>e.unitId),['d1','d2']);
}

// Earlier unit changes stacking for later unit: second attempt into newly full destination is illegal.
{
  const f=unit('f','S-INF','SOVIET','INFANTRY',{q:1,r:0});
  const st=make([unit('g','G-INF','GERMAN','INFANTRY',{q:-1,r:0}),unit('d1','S-INF','SOVIET','INFANTRY',{q:0,r:0}),unit('d2','S-INF','SOVIET','INFANTRY',{q:0,r:0}),f]);prepareRetreat(st,{defenders:['d1','d2'],steps:1});
  const r=retreat(st,'B-R',S,[{unitId:'d1',path:[{q:1,r:0}]},{unitId:'d2',path:[{q:1,r:0}]}]);
  assert.equal(r.accepted,false);assert(codes(r).includes('INVALID_RETREAT'));assert.deepEqual(r.state.units.d1.hex,{q:0,r:0});assert.deepEqual(r.state.units.d2.hex,{q:0,r:0});
}

// Multiple failed retreaters still generate only one extra loss; multiple eligible survivors require LOSS_ALLOCATION.
{
  const st=make([unit('g','G-INF','GERMAN','INFANTRY',{q:-1,r:0}),unit('d1','S-INF','SOVIET','INFANTRY',{q:0,r:0}),unit('d2','S-INF','SOVIET','INFANTRY',{q:0,r:0})],[plain(-1,0),plain(0,0)]);prepareRetreat(st,{defenders:['d1','d2'],steps:2});
  const r=retreat(st,'B-R',S,[{unitId:'d1',path:[]},{unitId:'d2',path:[]}]);assert.equal(r.accepted,true);
  assert.equal(r.events.filter(e=>e.type==='RetreatImpossible').length,1);assert.equal(r.state.combatTransactions['B-R'].retreatImpossibleExtraLossApplied,true);
  assert.equal(r.state.combatTransactions['B-R'].unresolvedLosses.filter(x=>x.reason==='RETREAT_IMPOSSIBLE').length,1);
  assert.equal(r.state.pendingDecision?.kind,'LOSS_ALLOCATION');assert.equal(r.state.combatTransactions['B-R'].retreat.resolved,true);
  assert.deepEqual(validateGameStateIntegrity(r.state,defaultRules),[]);
  const loss=engine.apply(r.state,{type:'ALLOCATE_LOSSES',controllerId:S,battleId:'B-R',unitIdsByStep:['d1']});assert.equal(loss.accepted,true);
  assert.notEqual(loss.state.pendingDecision?.kind,'RETREAT');assert.equal(loss.state.combatTransactions['B-R'].stage,'CLOSED');
  assert.equal(loss.state.combatTransactions['B-R'].retreatImpossibleExtraLossApplied,true);
  assert.deepEqual(validateGameStateIntegrity(loss.state,defaultRules),[]);
}

console.log('Digital Branch Task 002A-2B-2 ordered retreat / Retreat Impossible smoke checks passed.');

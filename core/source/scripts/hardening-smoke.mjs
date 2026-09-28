import assert from 'node:assert/strict';
import {
  RulesEngine, defaultRules, defaultScenario, createGameState, makeEdge,
  validateAttackAction, validateGameStateIntegrity, getControlledUnitIds,
  getRepairedRailEdgeKeys, validateHQCommand, validateRailRepairAction
} from '../dist/index.js';

const G='G-HUMAN-1', G2='G-AI-2', S='S-AI-1';
const unit=(id,templateId,side,type,hex,controllerId=side==='GERMAN'?G:S)=>({
  id,templateId,side,type,step:0,alive:true,hex:{...hex},supplyState:'SUPPLIED',entrenched:false,
  hasMoved:false,hasAttacked:false,controllerId,temporarySupply:false,dedicatedRailRepair:false,
  reconZocIgnoreUsed:false,artillerySupportUsed:false,lastHQCommandTurn:null
});
const hexes=[];
for(let q=-3;q<=4;q++) for(let r=-3;r<=4;r++) hexes.push({coord:{q,r},terrain:'PLAIN',control:null});
const make=(units=[],edges=[])=>{
  const s=createGameState({scenario:defaultScenario,rules:defaultRules,hexes,edges,units,seed:77});
  s.phase='GERMAN_MOVEMENT';s.activeSide='GERMAN';
  return s;
};
const addG2=(s)=>{s.controllers[G2]={id:G2,side:'GERMAN',controllerType:'AI',displayName:'German AI 2'};};
const combat=()=>{
  const s=make([
    unit('g1','G-INF','GERMAN','INFANTRY',{q:-1,r:0},G),
    unit('g2','G-INF','GERMAN','INFANTRY',{q:0,r:-1},G2),
    unit('s1','S-INF','SOVIET','INFANTRY',{q:0,r:0},S)
  ]);
  addG2(s);s.phase='GERMAN_COMBAT';return s;
};

const engine=new RulesEngine(defaultRules,defaultScenario);

// 1 empty move rejected without corrupting hex
{
  const s=make([unit('g','G-INF','GERMAN','INFANTRY',{q:0,r:0})]);
  const r=engine.apply(s,{type:'MOVE',controllerId:G,unitId:'g',path:[]});
  assert.equal(r.accepted,false);
  assert(r.issues.some(x=>x.code==='EMPTY_MOVE_PATH'));
  assert.deepEqual(r.state.units.g.hex,{q:0,r:0});
}

// 2 duplicate attackers rejected
{
  const s=combat();
  const issues=validateAttackAction(s,defaultRules,{type:'ATTACK',controllerId:G,battleId:'B-DUP',attackerUnitIds:['g1','g1','g1'],target:{q:0,r:0}});
  assert(issues.some(x=>x.code==='DUPLICATE_ID'));
}

// 3 lifecycle reset at next German player turn
{
  const g=unit('g','G-ARTY','GERMAN','ARTILLERY',{q:0,r:0});
  Object.assign(g,{hasMoved:true,hasAttacked:true,reconZocIgnoreUsed:true,artillerySupportUsed:true,temporarySupply:true,dedicatedRailRepair:true,supplyState:'TEMPORARY_SUPPLY'});
  const s=make([g]);s.phase='SOVIET_ENTRENCHMENT';s.activeSide='SOVIET';
  const oldCp=s.cp.GERMAN;
  const r=engine.apply(s,{type:'READY_FOR_PHASE_END',controllerId:S});
  assert.equal(r.accepted,true);assert.equal(r.state.turn,2);assert.equal(r.state.phase,'GERMAN_SUPPLY_RAIL');
  assert.deepEqual({m:r.state.units.g.hasMoved,a:r.state.units.g.hasAttacked,z:r.state.units.g.reconZocIgnoreUsed,art:r.state.units.g.artillerySupportUsed,t:r.state.units.g.temporarySupply,rr:r.state.units.g.dedicatedRailRepair},
    {m:false,a:false,z:false,art:false,t:false,rr:false});
  assert.equal(r.state.units.g.supplyState,'OUT_OF_SUPPLY');
  assert.equal(r.state.cp.GERMAN,Math.min(defaultRules.cp.maximum,oldCp+defaultRules.cp.gainPerOwnTurn));
}

// 4 ownership canonical + transfer integrity
{
  const s=make([unit('g','G-INF','GERMAN','INFANTRY',{q:0,r:0})]);addG2(s);
  assert.deepEqual(getControlledUnitIds(s,G),['g']);
  assert.equal(validateGameStateIntegrity(s,defaultRules).length,0);
  const r=engine.apply(s,{type:'TRANSFER_CONTROL',controllerId:G,assignment:{unitId:'g',fromControllerId:G,toControllerId:G2}});
  assert.equal(r.accepted,true);assert.equal(r.state.units.g.controllerId,G2);
  assert.deepEqual(getControlledUnitIds(r.state,G2),['g']);
  assert.equal(validateGameStateIntegrity(r.state,defaultRules).length,0);
}

// 5 cross-controller attack needs battle-scoped commitment
{
  const s=combat();
  let issues=validateAttackAction(s,defaultRules,{type:'ATTACK',controllerId:G,battleId:'B-JOINT',attackerUnitIds:['g1','g2'],target:{q:0,r:0}});
  assert(issues.some(x=>x.code==='UNAUTHORIZED_UNIT_COMMITMENT'));
  const grant=engine.apply(s,{type:'AUTHORIZE_UNIT_COMMITMENT',controllerId:G2,battleId:'B-JOINT',authorizedControllerId:G,unitIds:['g2']});
  assert.equal(grant.accepted,true);assert.equal(grant.state.units.g2.controllerId,G2);
  const cid=Object.keys(grant.state.unitCommitments)[0];
  issues=validateAttackAction(grant.state,defaultRules,{type:'ATTACK',controllerId:G,battleId:'B-JOINT',attackerUnitIds:['g1','g2'],commitmentIds:[cid],target:{q:0,r:0}});
  assert(!issues.some(x=>x.code==='UNAUTHORIZED_UNIT_COMMITMENT'));
}

// 6 multiplayer ready barrier
{
  const s=make([unit('g1','G-INF','GERMAN','INFANTRY',{q:0,r:0},G),unit('g2','G-INF','GERMAN','INFANTRY',{q:1,r:0},G2)]);addG2(s);
  const r1=engine.apply(s,{type:'READY_FOR_PHASE_END',controllerId:G});
  assert.equal(r1.state.phase,'GERMAN_MOVEMENT');assert.deepEqual(r1.state.phaseReadyControllerIds,[G]);
  const r2=engine.apply(r1.state,{type:'READY_FOR_PHASE_END',controllerId:G2});
  assert.equal(r2.state.phase,'GERMAN_COMBAT');assert.deepEqual(r2.state.phaseReadyControllerIds,[]);
}

// 7 PendingDecision owner validation
{
  const s=make([unit('g','G-INF','GERMAN','INFANTRY',{q:0,r:0})]);
  s.pendingDecision={kind:'LOSS_ALLOCATION',side:'GERMAN',battleId:'B-X',decisionOwnerControllerId:'MISSING',eligibleControllerIds:['MISSING'],lossSteps:1,eligibleUnitIds:['g']};
  const codes=validateGameStateIntegrity(s,defaultRules).map(x=>x.code);
  assert(codes.includes('PENDING_OWNER_INVALID'));assert(codes.includes('PENDING_ELIGIBLE_INVALID'));
}

// 8 deterministic action/battle ids
{
  const a=combat(),b=combat();
  const ra=engine.apply(a,{type:'ATTACK',controllerId:G,attackerUnitIds:['g1'],target:{q:0,r:0}});
  const rb=engine.apply(b,{type:'ATTACK',controllerId:G,attackerUnitIds:['g1'],target:{q:0,r:0}});
  assert.equal(ra.actionId,'A-000001');assert.equal(ra.actionId,rb.actionId);
  assert.equal(ra.battleId,'B-000001');assert.equal(ra.battleId,rb.battleId);
}

// 9 rail repair canonical only on edge; DR-001 removes authoritative railhead runtime state
{
  const a={q:0,r:0},b={q:1,r:0};
  const e=makeEdge(a,b,{railway:{present:true,repairedBy:'GERMAN',destroyed:false}});
  const s=make([], [e]);
  assert.deepEqual(getRepairedRailEdgeKeys(s,'GERMAN'),[e.key]);
  assert.equal('rail' in s,false);
  s.rail={railheadHexKeys:[]};
  assert(validateGameStateIntegrity(s,defaultRules).some(x=>x.code==='LEGACY_RAIL_RUNTIME_STATE'));
}

// 10 integrity catches corruption
{
  const s=make([unit('a','G-INF','GERMAN','INFANTRY',{q:0,r:0}),unit('b','G-INF','GERMAN','INFANTRY',{q:0,r:0}),unit('c','G-INF','GERMAN','INFANTRY',{q:0,r:0})]);
  s.units.a.controllerId='MISSING';
  const codes=validateGameStateIntegrity(s,defaultRules).map(x=>x.code);
  assert(codes.includes('STACKING_LIMIT'));assert(codes.includes('UNIT_CONTROLLER_INVALID'));
}

// 11 uniqueness hooks for unitIds / edgeKeys
{
  const s=make();
  assert(validateHQCommand(s,defaultRules,{type:'USE_HQ_COMMAND',controllerId:G,hqUnitId:'hq',command:'EXTRA_SUPPLIES',unitIds:['x','x']}).some(x=>x.code==='DUPLICATE_ID'));
  assert(validateRailRepairAction(s,defaultRules,defaultScenario,{type:'RAIL_REPAIR',controllerId:G,edgeKeys:['e','e']}).some(x=>x.code==='DUPLICATE_ID'));
}

console.log('Digital Branch Core Hardening 001.1 regression checks passed.');

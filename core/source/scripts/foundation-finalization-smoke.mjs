import assert from 'node:assert/strict';
import {
  RulesEngine,
  createGameState,
  defaultRules,
  defaultScenario,
  endPhase
} from '../dist/index.js';

const G='G-HUMAN-1', S='S-AI-1', S2='S-HUMAN-2';
const unit=(id,templateId,side,type,hex,controllerId=side==='GERMAN'?G:S)=>({
  id,templateId,side,type,step:0,alive:true,hex:{...hex},supplyState:'SUPPLIED',entrenched:false,
  hasMoved:false,hasAttacked:false,controllerId,temporarySupply:false,dedicatedRailRepair:false,
  reconZocIgnoreUsed:false,artillerySupportUsed:false,lastHQCommandTurn:null
});
const hexes=[];
for(let q=-2;q<=2;q++) for(let r=-2;r<=2;r++) hexes.push({coord:{q,r},terrain:'PLAIN',control:null});

// 001.3-1: eligibleControllerIds is not execution authority; only decisionOwnerControllerId may act.
{
  const state=createGameState({
    scenario:defaultScenario,rules:defaultRules,hexes,edges:[],
    units:[unit('g1','G-INF','GERMAN','INFANTRY',{q:-1,r:0},G),unit('s1','S-INF','SOVIET','INFANTRY',{q:0,r:0},S)],seed:17
  });
  state.controllers[S2]={id:S2,side:'SOVIET',controllerType:'HUMAN',displayName:'Soviet Controller 2'};
  state.phase='GERMAN_COMBAT';state.activeSide='GERMAN';
  state.pendingDecision={
    kind:'DEFENDER_REACTION',side:'SOVIET',battleId:'B-OWNER',decisionOwnerControllerId:S,
    eligibleControllerIds:[S,S2],eligibleHQUnitIds:[],eligibleArtilleryUnitIds:[]
  };
  const engine=new RulesEngine(defaultRules,defaultScenario);
  const b=engine.apply(state,{type:'PASS_REACTION',controllerId:S2,battleId:'B-OWNER'});
  assert.equal(b.accepted,false);
  assert(b.issues.some(x=>x.code==='PENDING_DECISION_CONTROLLER_MISMATCH'));
  const a=engine.apply(state,{type:'PASS_REACTION',controllerId:S,battleId:'B-OWNER'});
  assert.equal(a.accepted,false);
  assert(!a.issues.some(x=>x.code==='PENDING_DECISION_CONTROLLER_MISMATCH'));
  assert(a.issues.some(x=>x.code==='COMBAT_TRANSACTION_NOT_FOUND')); // global owner guard passed; 002A now owns the next validator
}

// 001.3-2: setup is already German Player Turn 1, so the player-turn-start hook has run.
{
  const state=createGameState({scenario:defaultScenario,rules:defaultRules,hexes,edges:[],units:[],seed:23});
  assert.equal(state.turn,1);
  assert.equal(state.phase,'GERMAN_SUPPLY_RAIL');
  assert.equal(state.activeSide,'GERMAN');
  assert.deepEqual(state.cp,{GERMAN:2,SOVIET:1});

  for(let i=0;i<5;i++) endPhase(state,defaultRules);
  assert.equal(state.phase,'SOVIET_REINFORCEMENT_SUPPLY');
  assert.deepEqual(state.cp,{GERMAN:2,SOVIET:2});

  for(let i=0;i<5;i++) endPhase(state,defaultRules);
  assert.equal(state.turn,2);
  assert.equal(state.phase,'GERMAN_SUPPLY_RAIL');
  assert.deepEqual(state.cp,{GERMAN:3,SOVIET:2});

  for(let i=0;i<10;i++) endPhase(state,defaultRules);
  assert.equal(state.turn,3);
  assert.equal(state.cp.GERMAN,3);
  assert.equal(state.cp.SOVIET,3);
}

console.log('Digital Branch Task 001.3 foundation-finalization regression checks passed.');

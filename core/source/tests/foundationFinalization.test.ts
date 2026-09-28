import { describe, expect, it } from 'vitest';
import {
  RulesEngine,
  createGameState,
  defaultRules,
  defaultScenario,
  endPhase,
  type HexState
} from '../src/index.js';
import { G, S, gridHexes, makeState, unit } from './helpers.js';

const S2='S-HUMAN-2';

function pendingReactionState() {
  const state=makeState([
    unit('g1','G-INF','GERMAN','INFANTRY',{q:-1,r:0},G),
    unit('s1','S-INF','SOVIET','INFANTRY',{q:0,r:0},S)
  ]);
  state.controllers[S2]={id:S2,side:'SOVIET',controllerType:'HUMAN',displayName:'Soviet Controller 2'};
  state.phase='GERMAN_COMBAT';
  state.activeSide='GERMAN';
  state.pendingDecision={
    kind:'DEFENDER_REACTION',
    side:'SOVIET',
    battleId:'B-OWNER',
    decisionOwnerControllerId:S,
    eligibleControllerIds:[S,S2],
    eligibleHQUnitIds:[],
    eligibleArtilleryUnitIds:[]
  };
  return state;
}

describe('Task 001.3 Foundation Finalization',()=>{
  it('only the PendingDecision owner may act even when another controller is eligible for future reassignment',()=>{
    const engine=new RulesEngine(defaultRules,defaultScenario);
    const state=pendingReactionState();

    const nonOwner=engine.apply(state,{type:'PASS_REACTION',controllerId:S2,battleId:'B-OWNER'});
    expect(nonOwner.accepted).toBe(false);
    expect(nonOwner.issues.map((x)=>x.code)).toContain('PENDING_DECISION_CONTROLLER_MISMATCH');

    const owner=engine.apply(state,{type:'PASS_REACTION',controllerId:S,battleId:'B-OWNER'});
    expect(owner.accepted).toBe(false); // owner passes the global guard; no real transaction exists in this synthetic Foundation fixture
    expect(owner.issues.map((x)=>x.code)).not.toContain('PENDING_DECISION_CONTROLLER_MISMATCH');
    expect(owner.issues.map((x)=>x.code)).toContain('COMBAT_TRANSACTION_NOT_FOUND');
  });

  it('applies initial reserve plus first German player-turn CP income through the normal lifecycle',()=>{
    const hexes:HexState[]=gridHexes(-1,1,-1,1);
    const state=createGameState({scenario:defaultScenario,rules:defaultRules,hexes,edges:[],units:[],seed:11});

    expect(state.turn).toBe(1);
    expect(state.phase).toBe('GERMAN_SUPPLY_RAIL');
    expect(state.activeSide).toBe('GERMAN');
    expect(state.cp).toEqual({GERMAN:2,SOVIET:1});

    // Finish the five German phases. Soviet T1 player-turn start earns its first CP.
    for (let i=0;i<5;i++) endPhase(state,defaultRules);
    expect(state.turn).toBe(1);
    expect(state.phase).toBe('SOVIET_REINFORCEMENT_SUPPLY');
    expect(state.activeSide).toBe('SOVIET');
    expect(state.cp).toEqual({GERMAN:2,SOVIET:2});

    // Finish Soviet T1. German T2 start earns another CP, capped at 3.
    for (let i=0;i<5;i++) endPhase(state,defaultRules);
    expect(state.turn).toBe(2);
    expect(state.phase).toBe('GERMAN_SUPPLY_RAIL');
    expect(state.activeSide).toBe('GERMAN');
    expect(state.cp).toEqual({GERMAN:3,SOVIET:2});

    // One more complete turn verifies the cap remains enforced.
    for (let i=0;i<10;i++) endPhase(state,defaultRules);
    expect(state.turn).toBe(3);
    expect(state.phase).toBe('GERMAN_SUPPLY_RAIL');
    expect(state.cp.GERMAN).toBe(defaultRules.cp.maximum);
    expect(state.cp.SOVIET).toBe(defaultRules.cp.maximum);
  });
});

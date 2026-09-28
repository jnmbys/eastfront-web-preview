import { describe, expect, it } from 'vitest';
import {
  RulesEngine,
  type Action,
  defaultRules,
  defaultScenario,
  getBattleIdLifecycle,
  validateGameStateIntegrity
} from '../src/index.js';
import { G, S, makeState, unit } from './helpers.js';

const G2='G-AI-2';

function addG2(state:ReturnType<typeof makeState>) {
  state.controllers[G2]={id:G2,side:'GERMAN',controllerType:'AI',displayName:'German AI 2'};
}

function combatState() {
  const state=makeState([
    unit('g1','G-INF','GERMAN','INFANTRY',{q:-1,r:0},G),
    unit('g2','G-INF','GERMAN','INFANTRY',{q:0,r:-1},G2),
    unit('s1','S-INF','SOVIET','INFANTRY',{q:0,r:0},S)
  ]);
  addG2(state);
  state.phase='GERMAN_COMBAT';
  state.activeSide='GERMAN';
  return state;
}

describe('Task 001.2 transaction integrity',()=>{
  it('rejects duplicate actionId without corrupting canonical actionLog',()=>{
    const engine=new RulesEngine(defaultRules,defaultScenario);
    const start=makeState([unit('g','G-INF','GERMAN','INFANTRY',{q:0,r:0},G)]);
    const first=engine.apply(start,{type:'MOVE',actionId:'X',controllerId:G,unitId:'g',path:[{q:1,r:0}]});
    expect(first.accepted).toBe(true);
    expect(first.state.actionLog.map((x)=>x.actionId)).toEqual(['X']);

    const second=engine.apply(first.state,{type:'MOVE',actionId:'X',controllerId:G,unitId:'g',path:[{q:2,r:0}]});
    expect(second.accepted).toBe(false);
    expect(second.issues.map((x)=>x.code)).toContain('ACTION_ID_DUPLICATE');
    expect(second.state.actionLog.map((x)=>x.actionId)).toEqual(['X']);
    expect(validateGameStateIntegrity(second.state,defaultRules)).toEqual([]);
  });

  it('allows rejected joint-attack proposal to be authorized and retried with same battleId',()=>{
    const engine=new RulesEngine(defaultRules,defaultScenario);
    const start=combatState();
    const proposal=engine.apply(start,{
      type:'ATTACK',actionId:'A-PROPOSE',battleId:'B-JOINT',controllerId:G,
      attackerUnitIds:['g1','g2'],target:{q:0,r:0}
    });
    expect(proposal.accepted).toBe(false);
    expect(proposal.issues.map((x)=>x.code)).toContain('UNAUTHORIZED_UNIT_COMMITMENT');
    expect(getBattleIdLifecycle(proposal.state,'B-JOINT')).toBe('REJECTED_PROPOSAL');

    const grant=engine.apply(proposal.state,{
      type:'AUTHORIZE_UNIT_COMMITMENT',actionId:'A-GRANT',controllerId:G2,
      battleId:'B-JOINT',authorizedControllerId:G,unitIds:['g2']
    });
    expect(grant.accepted).toBe(true);
    expect(getBattleIdLifecycle(grant.state,'B-JOINT')).toBe('RESERVED');
    const commitmentId=Object.keys(grant.state.unitCommitments)[0]!;

    const retry=engine.apply(grant.state,{
      type:'ATTACK',actionId:'A-RETRY',battleId:'B-JOINT',controllerId:G,
      attackerUnitIds:['g1','g2'],commitmentIds:[commitmentId],target:{q:0,r:0}
    });
    const codes=retry.issues.map((x)=>x.code);
    expect(retry.accepted).toBe(true); // 002A-1 establishes a canonical transaction.
    expect(codes).not.toContain('BATTLE_ID_DUPLICATE');
    expect(codes).not.toContain('UNAUTHORIZED_UNIT_COMMITMENT');
    expect(codes).toEqual([]);
    expect(retry.state.combatTransactions['B-JOINT']?.stage).toBe('DEFENDER_REACTION');
    expect(retry.state.combatTransactions['B-JOINT']?.commitmentIds).toEqual([commitmentId]);
    expect(retry.state.pendingDecision?.battleId).toBe('B-JOINT');
    expect(retry.state.pendingDecision?.decisionOwnerControllerId).toBe(S);
    expect(retry.events.some(e=>e.type==='CombatDeclared')).toBe(true);
  });

  it('PendingDecision globally blocks unrelated state-changing actions but lets matching decision action reach its validator',()=>{
    const engine=new RulesEngine(defaultRules,defaultScenario);
    const start=combatState();
    const grant=engine.apply(start,{
      type:'AUTHORIZE_UNIT_COMMITMENT',actionId:'A-RESERVE',controllerId:G2,
      battleId:'B-PENDING',authorizedControllerId:G,unitIds:['g2']
    });
    expect(grant.accepted).toBe(true);
    const commitmentId=Object.keys(grant.state.unitCommitments)[0]!;
    const declared=engine.apply(grant.state,{
      type:'ATTACK',actionId:'A-DECLARE',battleId:'B-PENDING',controllerId:G,
      attackerUnitIds:['g1','g2'],commitmentIds:[commitmentId],target:{q:0,r:0}
    });
    expect(declared.accepted).toBe(true);
    expect(declared.state.pendingDecision?.kind).toBe('DEFENDER_REACTION');
    expect(validateGameStateIntegrity(declared.state,defaultRules)).toEqual([]);
    const locked=declared.state;

    const blockedActions:Action[]=[
      {type:'MOVE',controllerId:G,unitId:'g1',path:[{q:-2,r:0}]},
      {type:'TRANSFER_CONTROL',controllerId:G,assignment:{unitId:'g1',fromControllerId:G,toControllerId:G2}},
      {type:'READY_FOR_PHASE_END',controllerId:G},
      {type:'ATTACK',controllerId:G,battleId:'B-OTHER',attackerUnitIds:['g1'],target:{q:0,r:0}}
    ];
    let current=locked;
    for (const action of blockedActions) {
      const result=engine.apply(current,action);
      expect(result.accepted).toBe(false);
      expect(result.issues.map((x)=>x.code)).toContain('PENDING_DECISION_BLOCKS_ACTION');
      current=result.state;
    }

    const matching=engine.apply(current,{type:'PASS_REACTION',controllerId:S,battleId:'B-PENDING'});
    expect(matching.accepted).toBe(true);
    expect(matching.issues.map((x)=>x.code)).not.toContain('PENDING_DECISION_BLOCKS_ACTION');
    expect(matching.events.some((x)=>x.type==='DiceRolled')).toBe(true);
    expect(matching.events.some((x)=>x.type==='CRTResolved')).toBe(true);
  });

  it('integrity validates unit template identity and activeSide/phase consistency',()=>{
    const state=makeState([unit('g','G-INF','GERMAN','INFANTRY',{q:0,r:0},G)]);
    state.units.g!.type='PANZER';
    state.activeSide='SOVIET';
    const codes=validateGameStateIntegrity(state,defaultRules).map((x)=>x.code);
    expect(codes).toContain('UNIT_TEMPLATE_TYPE_MISMATCH');
    expect(codes).toContain('ACTIVE_SIDE_PHASE_MISMATCH');
  });
});

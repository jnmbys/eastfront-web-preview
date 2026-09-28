import { describe,expect,it } from 'vitest';
import {
  RulesEngine,
  defaultRules,
  defaultScenario,
  getControlledUnitIds,
  getRepairedRailEdgeKeys,
  makeEdge,
  validateAttackAction,
  validateGameStateIntegrity,
  validateHQCommand,
  validateMoveAction,
  validateRailRepairAction
} from '../src/index.js';
import { G,S,gridHexes,makeState,unit } from './helpers.js';

const G2='G-AI-2';

function addGermanController(state:ReturnType<typeof makeState>) {
  state.controllers[G2]={id:G2,side:'GERMAN',controllerType:'AI',displayName:'German AI 2'};
}

function combatState() {
  const state=makeState([
    unit('g1','G-INF','GERMAN','INFANTRY',{q:-1,r:0},G),
    unit('g2','G-INF','GERMAN','INFANTRY',{q:0,r:-1},G2),
    unit('s1','S-INF','SOVIET','INFANTRY',{q:0,r:0},S)
  ],gridHexes(-3,3,-3,3));
  addGermanController(state);
  state.phase='GERMAN_COMBAT';state.activeSide='GERMAN';
  return state;
}

describe('Core Hardening 001.1',()=>{
  it('rejects an empty move path',()=>{
    const st=makeState([unit('g','G-INF','GERMAN','INFANTRY',{q:0,r:0})]);
    const result=new RulesEngine(defaultRules,defaultScenario).apply(st,{type:'MOVE',controllerId:G,unitId:'g',path:[]});
    expect(result.accepted).toBe(false);
    expect(result.issues.map(i=>i.code)).toContain('EMPTY_MOVE_PATH');
    expect(result.state.units.g!.hex).toEqual({q:0,r:0});
  });

  it('rejects duplicate attackers and never multiplies duplicate unit strength',()=>{
    const st=combatState();
    const action={type:'ATTACK' as const,controllerId:G,battleId:'B-DUP',attackerUnitIds:['g1','g1','g1'],target:{q:0,r:0}};
    expect(validateAttackAction(st,defaultRules,action).map(i=>i.code)).toContain('DUPLICATE_ID');
  });

  it('resets per-player-turn flags when the next player turn begins',()=>{
    const g=unit('g','G-ARTY','GERMAN','ARTILLERY',{q:0,r:0});
    g.hasMoved=true;g.hasAttacked=true;g.reconZocIgnoreUsed=true;g.artillerySupportUsed=true;g.temporarySupply=true;g.supplyState='TEMPORARY_SUPPLY';g.dedicatedRailRepair=true;
    const st=makeState([g]);
    st.phase='SOVIET_ENTRENCHMENT';st.activeSide='SOVIET';
    const oldCp=st.cp.GERMAN;
    const result=new RulesEngine(defaultRules,defaultScenario).apply(st,{type:'READY_FOR_PHASE_END',controllerId:S});
    expect(result.accepted).toBe(true);
    expect(result.state.turn).toBe(2);
    expect(result.state.phase).toBe('GERMAN_SUPPLY_RAIL');
    expect(result.state.units.g).toMatchObject({hasMoved:false,hasAttacked:false,reconZocIgnoreUsed:false,artillerySupportUsed:false,temporarySupply:false,dedicatedRailRepair:false,supplyState:'OUT_OF_SUPPLY'});
    expect(result.state.cp.GERMAN).toBe(Math.min(defaultRules.cp.maximum,oldCp+defaultRules.cp.gainPerOwnTurn));
  });

  it('uses Unit.controllerId as canonical ownership and derives controller unit lists',()=>{
    const st=makeState([unit('g','G-INF','GERMAN','INFANTRY',{q:0,r:0})]);
    addGermanController(st);
    expect(getControlledUnitIds(st,G)).toEqual(['g']);
    expect(validateGameStateIntegrity(st,defaultRules)).toHaveLength(0);
  });

  it('transfer control changes only canonical unit ownership and maintains integrity',()=>{
    const st=makeState([unit('g','G-INF','GERMAN','INFANTRY',{q:0,r:0})]);
    addGermanController(st);
    const result=new RulesEngine(defaultRules,defaultScenario).apply(st,{
      type:'TRANSFER_CONTROL',controllerId:G,assignment:{unitId:'g',fromControllerId:G,toControllerId:G2}
    });
    expect(result.accepted).toBe(true);
    expect(result.state.units.g!.controllerId).toBe(G2);
    expect(getControlledUnitIds(result.state,G)).toEqual([]);
    expect(getControlledUnitIds(result.state,G2)).toEqual(['g']);
    expect(validateGameStateIntegrity(result.state,defaultRules)).toHaveLength(0);
  });

  it('rejects unauthorized cross-controller attack participation',()=>{
    const st=combatState();
    const action={type:'ATTACK' as const,controllerId:G,battleId:'B-JOINT',attackerUnitIds:['g1','g2'],target:{q:0,r:0}};
    expect(validateAttackAction(st,defaultRules,action).map(i=>i.code)).toContain('UNAUTHORIZED_UNIT_COMMITMENT');
  });

  it('accepts a battle-scoped unit commitment without transferring ownership',()=>{
    const st=combatState();
    const engine=new RulesEngine(defaultRules,defaultScenario);
    const grant=engine.apply(st,{type:'AUTHORIZE_UNIT_COMMITMENT',controllerId:G2,battleId:'B-JOINT',authorizedControllerId:G,unitIds:['g2']});
    expect(grant.accepted).toBe(true);
    expect(grant.state.units.g2!.controllerId).toBe(G2);
    const commitmentId=Object.keys(grant.state.unitCommitments)[0]!;
    const issues=validateAttackAction(grant.state,defaultRules,{
      type:'ATTACK',controllerId:G,battleId:'B-JOINT',attackerUnitIds:['g1','g2'],commitmentIds:[commitmentId],target:{q:0,r:0}
    });
    expect(issues.map(i=>i.code)).not.toContain('UNAUTHORIZED_UNIT_COMMITMENT');
  });

  it('one controller cannot prematurely end an allied phase',()=>{
    const st=makeState([unit('g1','G-INF','GERMAN','INFANTRY',{q:0,r:0},G),unit('g2','G-INF','GERMAN','INFANTRY',{q:1,r:0},G2)]);
    addGermanController(st);
    const engine=new RulesEngine(defaultRules,defaultScenario);
    const first=engine.apply(st,{type:'READY_FOR_PHASE_END',controllerId:G});
    expect(first.accepted).toBe(true);
    expect(first.state.phase).toBe('GERMAN_MOVEMENT');
    expect(first.state.phaseReadyControllerIds).toEqual([G]);
    const second=engine.apply(first.state,{type:'READY_FOR_PHASE_END',controllerId:G2});
    expect(second.accepted).toBe(true);
    expect(second.state.phase).toBe('GERMAN_COMBAT');
    expect(second.state.phaseReadyControllerIds).toEqual([]);
  });

  it('validates PendingDecision controller ownership',()=>{
    const st=makeState([unit('g','G-INF','GERMAN','INFANTRY',{q:0,r:0})]);
    st.pendingDecision={kind:'LOSS_ALLOCATION',side:'GERMAN',battleId:'B-X',decisionOwnerControllerId:'MISSING',eligibleControllerIds:['MISSING'],lossSteps:1,eligibleUnitIds:['g']};
    const codes=validateGameStateIntegrity(st,defaultRules).map(i=>i.code);
    expect(codes).toContain('PENDING_OWNER_INVALID');
    expect(codes).toContain('PENDING_ELIGIBLE_INVALID');
  });

  it('assigns deterministic actionId and battleId',()=>{
    const a=combatState(),b=combatState();
    const ea=new RulesEngine(defaultRules,defaultScenario),eb=new RulesEngine(defaultRules,defaultScenario);
    const ra=ea.apply(a,{type:'ATTACK',controllerId:G,attackerUnitIds:['g1'],target:{q:0,r:0}});
    const rb=eb.apply(b,{type:'ATTACK',controllerId:G,attackerUnitIds:['g1'],target:{q:0,r:0}});
    expect(ra.actionId).toBe(rb.actionId);
    expect(ra.battleId).toBe(rb.battleId);
    expect(ra.actionId).toBe('A-000001');
    expect(ra.battleId).toBe('B-000001');
  });

  it('keeps railway repair state canonical on HexEdge and rejects legacy rail runtime state',()=>{
    const a={q:0,r:0},b={q:1,r:0};
    const edge=makeEdge(a,b,{railway:{present:true,repairedBy:'GERMAN',destroyed:false}});
    const st=makeState([],gridHexes(),[edge]);
    expect(getRepairedRailEdgeKeys(st,'GERMAN')).toEqual([edge.key]);
    expect('rail' in st).toBe(false);
    (st as unknown as Record<string,unknown>).rail={railheadHexKeys:[]};
    expect(validateGameStateIntegrity(st,defaultRules).map(i=>i.code)).toContain('LEGACY_RAIL_RUNTIME_STATE');
  });

  it('integrity validator catches deliberate corruption',()=>{
    const st=makeState([
      unit('a','G-INF','GERMAN','INFANTRY',{q:0,r:0}),
      unit('b','G-INF','GERMAN','INFANTRY',{q:0,r:0}),
      unit('c','G-INF','GERMAN','INFANTRY',{q:0,r:0})
    ]);
    st.units.a!.controllerId='MISSING';
    const codes=validateGameStateIntegrity(st,defaultRules).map(i=>i.code);
    expect(codes).toContain('STACKING_LIMIT');
    expect(codes).toContain('UNIT_CONTROLLER_INVALID');
  });

  it('validates uniqueness for HQ unitIds and rail edgeKeys',()=>{
    const st=makeState([]);
    expect(validateHQCommand(st,defaultRules,{type:'USE_HQ_COMMAND',controllerId:G,hqUnitId:'hq',command:'EXTRA_SUPPLIES',unitIds:['x','x']}).map(i=>i.code)).toContain('DUPLICATE_ID');
    expect(validateRailRepairAction(st,defaultRules,defaultScenario,{type:'RAIL_REPAIR',controllerId:G,edgeKeys:['e','e']}).map(i=>i.code)).toContain('DUPLICATE_ID');
  });
});

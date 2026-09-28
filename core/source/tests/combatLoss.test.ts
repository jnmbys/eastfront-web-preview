import {describe,expect,it} from 'vitest';
import {
  RulesEngine,analyzeLossRequirement,beginPlayerTurn,buildCombatContext,continueCombatAfterLosses,
  createGameState,defaultRules,defaultScenario,validateAttackAction,validateLossAllocationSequence,
  type CombatLossRequirement,type CombatTransaction,type GameEvent,type GameState,type UnitState
} from '../src/index.js';
import {G,S,gridHexes,unit} from './helpers.js';

const G2='G-AI-2';
const engine=new RulesEngine(defaultRules,defaultScenario);
function state(units:UnitState[],seed=123):GameState{
  const st=createGameState({scenario:defaultScenario,rules:defaultRules,hexes:gridHexes(-5,5,-5,5),edges:[],units,seed});
  st.phase='GERMAN_COMBAT';st.activeSide='GERMAN';return st;
}
function tx(st:GameState,battleId:string,attackers:string[],defenders:string[],losses:CombatLossRequirement[]):CombatTransaction{
  const t:CombatTransaction={battleId,sourceBattleId:null,stage:'LOSS_ALLOCATION',declaredByActionId:'A-000001',declaringControllerId:G,attackerSide:'GERMAN',defenderSide:'SOVIET',attackerUnitIds:[...attackers],defenderUnitIds:[...defenders],targetHex:{q:0,r:0},commitmentIds:[],attackerArtilleryUnitId:null,defenderArtilleryUnitId:null,attackerHQEffect:null,defenderHQEffect:null,defenderReactionPassed:true,context:null,resolution:null,unresolvedLosses:structuredClone(losses),lossesApplied:{GERMAN:{},SOVIET:{}},retreat:null,retreatImpossibleExtraLossApplied:false,advance:null,breakthrough:null,schwerpunkt:null,isSchwerpunktSecondAttack:false,completedByActionId:null};
  st.combatTransactions[battleId]=t;return t;
}

describe('Task 002A-2A loss engine',()=>{
  it('resets both sides artillery support windows at every player-turn start',()=>{
    const ga=unit('ga','G-ARTY','GERMAN','ARTILLERY',{q:-2,r:0},G);const sa=unit('sa','S-ARTY','SOVIET','ARTILLERY',{q:2,r:0},S);ga.artillerySupportUsed=true;sa.artillerySupportUsed=true;const st=state([ga,sa]);beginPlayerTurn(st,defaultRules,'GERMAN');expect(st.units.ga?.artillerySupportUsed).toBe(false);expect(st.units.sa?.artillerySupportUsed).toBe(false);
  });

  it('implements round-based fairness and capacity',()=>{
    const units=['a','b','c'].map((id,n)=>unit(id,'G-INF','GERMAN','INFANTRY',{q:-1-n,r:n},G));const st=state(units);const req:CombatLossRequirement={side:'GERMAN',steps:4,eligibleUnitIds:['a','b','c'],reason:'CRT'};
    expect(analyzeLossRequirement(st,defaultRules,req).unique).toBe(false);
    expect(validateLossAllocationSequence(st,defaultRules,req,['a','a','b','c']).map(x=>x.code)).toContain('INVALID_LOSS_ALLOCATION');
    expect(validateLossAllocationSequence(st,defaultRules,req,['a','b','c','a'])).toEqual([]);
  });

  it('auto-resolves unique distribution and honors damaged capacity',()=>{
    const a=unit('a','G-INF','GERMAN','INFANTRY',{q:-1,r:0},G);a.step=2;const b=unit('b','G-INF','GERMAN','INFANTRY',{q:-2,r:0},G);const st=state([a,b]);const req:CombatLossRequirement={side:'GERMAN',steps:3,eligibleUnitIds:['a','b'],reason:'CRT'};const t=tx(st,'B-CAP',['a','b'],[],[req]);const events:GameEvent[]=[];continueCombatAfterLosses(st,defaultRules,t,'A-LOSS',events);expect(st.units.a?.alive).toBe(false);expect(st.units.b?.step).toBe(2);expect(t.lossesApplied.GERMAN).toEqual({a:1,b:2});expect(events.some(e=>e.type==='LossesAllocated'&&e.automatic)).toBe(true);
  });

  it('honors maxDamageSteps=1 HQ destruction',()=>{
    const hq=unit('hq','G-HQ','GERMAN','HQ',{q:-1,r:0},G);const st=state([hq]);const t=tx(st,'B-HQ',['hq'],[],[{side:'GERMAN',steps:3,eligibleUnitIds:['hq'],reason:'CRT'}]);const events:GameEvent[]=[];continueCombatAfterLosses(st,defaultRules,t,'A-HQ',events);expect(st.units.hq?.alive).toBe(false);expect(t.lossesApplied.GERMAN).toEqual({hq:1});expect(events.filter(e=>e.type==='UnitDestroyed')).toHaveLength(1);
  });

  it('lets declaring controller allocate a committed teammate attacker loss',()=>{
    const g1=unit('g1','G-INF','GERMAN','INFANTRY',{q:-1,r:0},G);const g2=unit('g2','G-INF','GERMAN','INFANTRY',{q:-2,r:0},G2);const d=unit('d','S-INF','SOVIET','INFANTRY',{q:0,r:0},S);const st=state([g1,g2,d]);st.controllers[G2]={id:G2,side:'GERMAN',controllerType:'AI'};st.unitCommitments.c={id:'c',grantActionId:'A-C',battleId:'B-J',grantorControllerId:G2,authorizedControllerId:G,unitIds:['g2'],createdTurn:st.turn,createdPhase:st.phase,active:true};const t=tx(st,'B-J',['g1','g2'],['d'],[{side:'GERMAN',steps:1,eligibleUnitIds:['g1','g2'],reason:'CRT'}]);t.commitmentIds=['c'];const events:GameEvent[]=[];continueCombatAfterLosses(st,defaultRules,t,'A-P',events);expect(st.pendingDecision?.decisionOwnerControllerId).toBe(G);const r=engine.apply(st,{type:'ALLOCATE_LOSSES',controllerId:G,battleId:'B-J',unitIdsByStep:['g2']});expect(r.accepted).toBe(true);expect(r.state.units.g2?.step).toBe(1);expect(r.state.units.g2?.controllerId).toBe(G2);
  });
});

describe('Task 002A-2A preflight corrections',()=>{

  it('replays canonical action/battle ids into identical idCounters and combat state',()=>{
    const factory=()=>state([unit('g','G-INF','GERMAN','INFANTRY',{q:-1,r:0},G),unit('d','S-ELITE','SOVIET','ELITE_INFANTRY',{q:0,r:0},S)],2722);
    let live=factory();live=engine.apply(live,{type:'ATTACK',controllerId:G,attackerUnitIds:['g'],target:{q:0,r:0}}).state;const battleId=Object.keys(live.combatTransactions)[0]!;live=engine.apply(live,{type:'PASS_REACTION',controllerId:S,battleId}).state;
    const actions=live.actionLog.map(e=>structuredClone(e.action));let replay=factory();for(const action of actions)replay=engine.apply(replay,action).state;
    expect(replay.idCounters).toEqual(live.idCounters);expect(replay.random).toEqual(live.random);expect(replay.combatTransactions).toEqual(live.combatTransactions);expect(replay.actionLog).toEqual(live.actionLog);
  });
  it('rejects unrelated commitment references',()=>{
    const g1=unit('g1','G-INF','GERMAN','INFANTRY',{q:-1,r:0},G);const g2=unit('g2','G-INF','GERMAN','INFANTRY',{q:-2,r:0},G2);const d=unit('d','S-INF','SOVIET','INFANTRY',{q:0,r:0},S);const st=state([g1,g2,d]);st.controllers[G2]={id:G2,side:'GERMAN',controllerType:'AI'};st.unitCommitments.c={id:'c',grantActionId:'A-C',battleId:'B-X',grantorControllerId:G2,authorizedControllerId:G,unitIds:['g2'],createdTurn:st.turn,createdPhase:st.phase,active:true};const issues=validateAttackAction(st,defaultRules,{type:'ATTACK',controllerId:G,battleId:'B-X',attackerUnitIds:['g1'],commitmentIds:['c'],target:{q:0,r:0}});expect(issues.map(x=>x.code)).toContain('UNAUTHORIZED_UNIT_COMMITMENT');
  });
  it('reads Last Stand shift from GameRules',()=>{
    const rules=structuredClone(defaultRules);rules.hqCommands.LAST_STAND.crtShift=-2;const st=state([unit('g','G-INF','GERMAN','INFANTRY',{q:-1,r:0},G),unit('d','S-INF','SOVIET','INFANTRY',{q:0,r:0},S)]);expect(buildCombatContext(st,rules,{type:'ATTACK',controllerId:G,attackerUnitIds:['g'],target:{q:0,r:0}},{defenderHQCommand:'LAST_STAND'}).modifiers.hqShift).toBe(-2);
  });
});

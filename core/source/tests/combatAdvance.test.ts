import {describe,expect,it} from 'vitest';
import {
  RulesEngine,continueCombatAfterLosses,createGameState,defaultRules,defaultScenario,validateGameStateIntegrity,
  type CombatTransaction,type GameState,type UnitState
} from '../src/index.js';
import {declaredSupplySnapshot,G,S,gridHexes,unit} from './helpers.js';

const G2='G-AI-2';
const engine=new RulesEngine(defaultRules,defaultScenario);
function state(units:UnitState[]):GameState{
  const st=createGameState({scenario:defaultScenario,rules:defaultRules,hexes:gridHexes(-5,5,-5,5),edges:[],units,seed:123});
  declaredSupplySnapshot(st,units);
 st.phase='GERMAN_COMBAT';st.activeSide='GERMAN';return st;
}
function resolution(crtResult:'DR'|'D1R'|'D2R'|'D3R'='DR'){
  return {dice:{die1:4,die2:4,total:8},crtResult,attackerLossSteps:0,defenderLossSteps:0,attackerRetreatSteps:0,defenderRetreatSteps:crtResult==='DR'?1:0,retreatConvertedToLoss:false};
}
function prepareAdvance(st:GameState,{battleId='B-A',attackers=['g'],defenders=['d'],eligible=attackers,result='DR' as 'DR'|'D1R'|'D2R'|'D3R',commitmentIds=[] as string[]}={}):CombatTransaction{
  const tx:CombatTransaction={battleId,sourceBattleId:null,stage:'ADVANCE_AFTER_COMBAT',declaredByActionId:'A-D',declaringControllerId:G,attackerSide:'GERMAN',defenderSide:'SOVIET',attackerUnitIds:[...attackers],defenderUnitIds:[...defenders],targetHex:{q:0,r:0},commitmentIds:[...commitmentIds],attackerArtilleryUnitId:null,defenderArtilleryUnitId:null,attackerHQEffect:null,defenderHQEffect:null,defenderReactionPassed:true,context:null,resolution:resolution(result),unresolvedLosses:[],lossesApplied:{GERMAN:{},SOVIET:{}},retreat:result==='DR'?{side:'SOVIET',steps:1,unitIds:[...defenders],resolved:true,impossible:false}:null,retreatImpossibleExtraLossApplied:false,advance:{eligibleUnitIds:[...eligible],advancedUnitIds:[],resolved:false},breakthrough:null,schwerpunkt:null,isSchwerpunktSecondAttack:false,completedByActionId:null};
  st.combatTransactions[battleId]=tx;
  const owners=[...new Set(eligible.map(id=>st.units[id]?.controllerId).filter((x):x is string=>Boolean(x)))];
  st.pendingDecision={kind:'ADVANCE_AFTER_COMBAT',battleId,side:'GERMAN',decisionOwnerControllerId:G,eligibleControllerIds:[...new Set([G,...owners])].sort(),eligibleUnitIds:[...eligible]};
  return tx;
}
function commitment(st:GameState,battleId:string,unitId:string){
  st.controllers[G2]={id:G2,side:'GERMAN',controllerType:'AI'};
  st.unitCommitments.c={id:'c',grantActionId:'A-C',battleId,grantorControllerId:G2,authorizedControllerId:G,unitIds:[unitId],createdTurn:st.turn,createdPhase:st.phase,active:true};
}

describe('Task 002A-2B-3 Advance After Combat',()=>{
  it('executes one normal advance and PASS_ADVANCE closes a non-breakthrough combat',()=>{
    const g=unit('g','G-INF','GERMAN','INFANTRY',{q:-1,r:0},G);g.entrenched=true;
    const d=unit('d','S-INF','SOVIET','INFANTRY',{q:2,r:0},S);
    let st=state([g,d]);prepareAdvance(st);
    let r=engine.apply(st,{type:'ADVANCE_AFTER_COMBAT',controllerId:G,battleId:'B-A',unitId:'g'});
    expect(r.accepted).toBe(true);expect(r.state.units.g?.hex).toEqual({q:0,r:0});expect(r.state.units.g?.hasMoved).toBe(true);expect(r.state.units.g?.entrenched).toBe(false);expect(r.events.some(e=>e.type==='UnitAdvanced')).toBe(true);expect(r.state.combatTransactions['B-A']?.stage).toBe('CLOSED');expect(validateGameStateIntegrity(r.state,defaultRules)).toEqual([]);

    const g2=unit('g','G-INF','GERMAN','INFANTRY',{q:-1,r:0},G);st=state([g2,d]);prepareAdvance(st);r=engine.apply(st,{type:'PASS_ADVANCE',controllerId:G,battleId:'B-A'});
    expect(r.accepted).toBe(true);expect(r.state.units.g?.hex).toEqual({q:-1,r:0});expect(r.events.some(e=>e.type==='UnitAdvanced')).toBe(false);expect(r.state.combatTransactions['B-A']?.stage).toBe('CLOSED');
  });

  it('rejects non-eligible, destroyed, non-adjacent and stacked advance choices',()=>{
    const g=unit('g','G-INF','GERMAN','INFANTRY',{q:-1,r:0},G),x=unit('x','G-INF','GERMAN','INFANTRY',{q:-1,r:1},G),d=unit('d','S-INF','SOVIET','INFANTRY',{q:2,r:0},S);
    let st=state([g,x,d]);prepareAdvance(st,{eligible:['g']});let r=engine.apply(st,{type:'ADVANCE_AFTER_COMBAT',controllerId:G,battleId:'B-A',unitId:'x'});expect(r.issues.map(i=>i.code)).toContain('INVALID_ADVANCE');
    st=state([g,d]);st.units.g!.alive=false;prepareAdvance(st);r=engine.apply(st,{type:'ADVANCE_AFTER_COMBAT',controllerId:G,battleId:'B-A',unitId:'g'});expect(r.issues.map(i=>i.code)).toContain('UNIT_DESTROYED');
    const far=unit('g','G-INF','GERMAN','INFANTRY',{q:-2,r:0},G);st=state([far,d]);prepareAdvance(st);r=engine.apply(st,{type:'ADVANCE_AFTER_COMBAT',controllerId:G,battleId:'B-A',unitId:'g'});expect(r.issues.map(i=>i.code)).toContain('NOT_ADJACENT_TO_TARGET');
    const f1=unit('f1','G-INF','GERMAN','INFANTRY',{q:0,r:0},G),f2=unit('f2','G-INF','GERMAN','INFANTRY',{q:0,r:0},G);st=state([g,d,f1,f2]);prepareAdvance(st);r=engine.apply(st,{type:'ADVANCE_AFTER_COMBAT',controllerId:G,battleId:'B-A',unitId:'g'});expect(r.issues.map(i=>i.code)).toContain('STACKING_LIMIT');
  });

  it('keeps battle-scoped tactical authority with declaring controller for committed teammate retreat/advance',()=>{
    const own=unit('own','G-INF','GERMAN','INFANTRY',{q:-1,r:0},G);own.step=2;
    const loan=unit('loan','G-PANZER','GERMAN','PANZER',{q:-1,r:1},G2),d=unit('d','S-INF','SOVIET','INFANTRY',{q:0,r:0},S);
    const st=state([own,loan,d]);commitment(st,'B-AUTH','loan');
    const tx:CombatTransaction={battleId:'B-AUTH',sourceBattleId:null,stage:'LOSS_ALLOCATION',declaredByActionId:'A-D',declaringControllerId:G,attackerSide:'GERMAN',defenderSide:'SOVIET',attackerUnitIds:['own','loan'],defenderUnitIds:['d'],targetHex:{q:0,r:0},commitmentIds:['c'],attackerArtilleryUnitId:null,defenderArtilleryUnitId:null,attackerHQEffect:null,defenderHQEffect:null,defenderReactionPassed:true,context:null,resolution:{dice:{die1:1,die2:1,total:2},crtResult:'A3R',attackerLossSteps:1,defenderLossSteps:0,attackerRetreatSteps:1,defenderRetreatSteps:0,retreatConvertedToLoss:false},unresolvedLosses:[{side:'GERMAN',steps:1,eligibleUnitIds:['own'],reason:'CRT'}],lossesApplied:{GERMAN:{},SOVIET:{}},retreat:{side:'GERMAN',steps:1,unitIds:['own','loan'],resolved:false,impossible:false},retreatImpossibleExtraLossApplied:false,advance:null,breakthrough:null,schwerpunkt:null,isSchwerpunktSecondAttack:false,completedByActionId:null};
    st.combatTransactions['B-AUTH']=tx;const events=[];continueCombatAfterLosses(st,defaultRules,tx,'A-L',events);
    expect(st.units.own?.alive).toBe(false);expect(st.pendingDecision?.kind).toBe('RETREAT');expect(st.pendingDecision?.decisionOwnerControllerId).toBe(G);expect(st.pendingDecision?.eligibleControllerIds).toContain(G2);
  });

  it('lets declaring controller advance a committed teammate without changing controllerId',()=>{
    const loan=unit('loan','G-PANZER','GERMAN','PANZER',{q:-1,r:0},G2),d=unit('d','S-INF','SOVIET','INFANTRY',{q:2,r:0},S);
    const st=state([loan,d]);commitment(st,'B-A','loan');prepareAdvance(st,{attackers:['loan'],defenders:['d'],eligible:['loan'],commitmentIds:['c']});
    const r=engine.apply(st,{type:'ADVANCE_AFTER_COMBAT',controllerId:G,battleId:'B-A',unitId:'loan'});expect(r.accepted).toBe(true);expect(r.state.units.loan?.controllerId).toBe(G2);expect(r.state.unitCommitments.c?.active).toBe(false);
  });

  it('prepares multi-unit breakthrough boundary with per-step max distance, but does not execute it',()=>{
    const p0=unit('p0','G-PANZER','GERMAN','PANZER',{q:-1,r:0},G),p2=unit('p2','G-PANZER','GERMAN','PANZER',{q:0,r:-1},G);p2.step=2;const d=unit('d','S-INF','SOVIET','INFANTRY',{q:2,r:0},S);
    const st=state([p0,p2,d]);prepareAdvance(st,{attackers:['p0','p2'],defenders:['d'],eligible:['p0','p2'],result:'D2R'});
    const r=engine.apply(st,{type:'PASS_ADVANCE',controllerId:G,battleId:'B-A'});expect(r.accepted).toBe(true);expect(r.state.combatTransactions['B-A']?.stage).toBe('BREAKTHROUGH_OPTION');expect(r.state.combatTransactions['B-A']?.breakthrough?.eligibleUnitIds).toEqual(['p0','p2']);expect(r.state.combatTransactions['B-A']?.breakthrough?.maxHexesByUnitId).toEqual({p0:2,p2:1});expect(validateGameStateIntegrity(r.state,defaultRules)).toEqual([]);
  });

  it('suppresses breakthrough for OOS armor and MARSH targets',()=>{
    const p=unit('p','G-PANZER','GERMAN','PANZER',{q:-1,r:0},G),d=unit('d','S-INF','SOVIET','INFANTRY',{q:2,r:0},S);p.supplyState='OUT_OF_SUPPLY';
    let st=state([p,d]);prepareAdvance(st,{attackers:['p'],defenders:['d'],eligible:['p'],result:'D1R'});let r=engine.apply(st,{type:'PASS_ADVANCE',controllerId:G,battleId:'B-A'});expect(r.state.combatTransactions['B-A']?.stage).toBe('CLOSED');
    const p2=unit('p','G-PANZER','GERMAN','PANZER',{q:-1,r:0},G);st=state([p2,d]);st.hexes['0,0']!.terrain='MARSH';prepareAdvance(st,{attackers:['p'],defenders:['d'],eligible:['p'],result:'D1R'});r=engine.apply(st,{type:'PASS_ADVANCE',controllerId:G,battleId:'B-A'});expect(r.state.combatTransactions['B-A']?.stage).toBe('CLOSED');
  });
});

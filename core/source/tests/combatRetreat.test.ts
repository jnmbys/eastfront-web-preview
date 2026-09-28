import {describe,expect,it} from 'vitest';
import {RulesEngine,createGameState,defaultRules,defaultScenario,validateGameStateIntegrity,type GameState,type HexState,type UnitState} from '../src/index.js';
import {G,S,gridHexes,unit} from './helpers.js';

const engine=new RulesEngine(defaultRules,defaultScenario);
const plain=(q:number,r:number):HexState=>({coord:{q,r},terrain:'PLAIN',control:null});
function state(units:UnitState[],hexes:HexState[]=gridHexes(-4,4,-4,4)):GameState{
  const st=createGameState({scenario:defaultScenario,rules:defaultRules,hexes,edges:[],units,seed:123});st.phase='GERMAN_COMBAT';st.activeSide='GERMAN';return st;
}
function retreatTx(st:GameState,opts:{battleId?:string;attackers?:string[];defenders?:string[];side?:'GERMAN'|'SOVIET';steps?:number}={}){
  const battleId=opts.battleId??'B-R',attackers=opts.attackers??['g'],defenders=opts.defenders??['d'],side=opts.side??'SOVIET',steps=opts.steps??1;
  const ids=side==='GERMAN'?attackers:defenders,owner=side==='GERMAN'?G:S;
  st.combatTransactions[battleId]={battleId,sourceBattleId:null,stage:'RETREAT',declaredByActionId:'A-D',declaringControllerId:G,attackerSide:'GERMAN',defenderSide:'SOVIET',attackerUnitIds:[...attackers],defenderUnitIds:[...defenders],targetHex:{q:0,r:0},commitmentIds:[],attackerArtilleryUnitId:null,defenderArtilleryUnitId:null,attackerHQEffect:null,defenderHQEffect:null,defenderReactionPassed:true,context:null,resolution:null,unresolvedLosses:[],lossesApplied:{GERMAN:{},SOVIET:{}},retreat:{side,steps,unitIds:[...ids],resolved:false,impossible:false},retreatImpossibleExtraLossApplied:false,advance:null,breakthrough:null,schwerpunkt:null,isSchwerpunktSecondAttack:false,completedByActionId:null};
  st.pendingDecision={kind:'RETREAT',battleId,side,decisionOwnerControllerId:owner,eligibleControllerIds:[owner],retreatSteps:steps,unitIds:[...ids]};
}

describe('Task 002A-2B-2 ordered retreat execution',()=>{
  it('executes full defender R2 and prepares Advance without implementing it',()=>{
    const d=unit('d','S-INF','SOVIET','INFANTRY',{q:0,r:0},S);d.entrenched=true;const st=state([unit('g','G-INF','GERMAN','INFANTRY',{q:-1,r:0},G),d]);retreatTx(st,{steps:2});
    const r=engine.apply(st,{type:'RETREAT',controllerId:S,battleId:'B-R',retreats:[{unitId:'d',path:[{q:1,r:0},{q:2,r:0}]}]});
    expect(r.accepted).toBe(true);expect(r.state.units.d?.hex).toEqual({q:2,r:0});expect(r.state.units.d?.entrenched).toBe(false);expect(r.state.units.d?.hasMoved).toBe(true);expect(r.state.pendingDecision?.kind).toBe('ADVANCE_AFTER_COMBAT');
    expect(r.events.find(e=>e.type==='UnitRetreated')).toMatchObject({unitId:'d',requiredSteps:2,completedSteps:2});expect(validateGameStateIntegrity(r.state,defaultRules)).toEqual([]);
  });

  it('rejects non-maximal partial when a full R2 path exists',()=>{
    const st=state([unit('g','G-INF','GERMAN','INFANTRY',{q:-1,r:0},G),unit('d','S-INF','SOVIET','INFANTRY',{q:0,r:0},S)]);retreatTx(st,{steps:2});
    const r=engine.apply(st,{type:'RETREAT',controllerId:S,battleId:'B-R',retreats:[{unitId:'d',path:[{q:1,r:0}]}]});expect(r.accepted).toBe(false);expect(r.issues.map(x=>x.code)).toContain('INVALID_RETREAT');expect(r.state.units.d?.hex).toEqual({q:0,r:0});
  });

  it('accepts maximal partial, emits one impossible event, and auto-applies unique extra loss',()=>{
    const st=state([unit('g','G-INF','GERMAN','INFANTRY',{q:-1,r:0},G),unit('d','S-INF','SOVIET','INFANTRY',{q:0,r:0},S)],[plain(-1,0),plain(0,0),plain(1,0)]);retreatTx(st,{steps:2});
    const r=engine.apply(st,{type:'RETREAT',controllerId:S,battleId:'B-R',retreats:[{unitId:'d',path:[{q:1,r:0}]}]});expect(r.accepted).toBe(true);expect(r.state.units.d?.step).toBe(1);expect(r.events.filter(e=>e.type==='RetreatImpossible')).toHaveLength(1);expect(r.state.combatTransactions['B-R']?.retreatImpossibleExtraLossApplied).toBe(true);expect(r.state.pendingDecision?.kind).toBe('ADVANCE_AFTER_COMBAT');
  });

  it('uses submitted order so earlier movement changes later stacking legality',()=>{
    const f=unit('f','S-INF','SOVIET','INFANTRY',{q:1,r:0},S);const st=state([unit('g','G-INF','GERMAN','INFANTRY',{q:-1,r:0},G),unit('d1','S-INF','SOVIET','INFANTRY',{q:0,r:0},S),unit('d2','S-INF','SOVIET','INFANTRY',{q:0,r:0},S),f]);retreatTx(st,{defenders:['d1','d2']});
    const r=engine.apply(st,{type:'RETREAT',controllerId:S,battleId:'B-R',retreats:[{unitId:'d1',path:[{q:1,r:0}]},{unitId:'d2',path:[{q:1,r:0}]}]});expect(r.accepted).toBe(false);expect(r.issues.map(x=>x.code)).toContain('INVALID_RETREAT');expect(r.state.units.d1?.hex).toEqual({q:0,r:0});
  });

  it('routes one extra loss choice through LOSS_ALLOCATION and never returns to RETREAT',()=>{
    const st=state([unit('g','G-INF','GERMAN','INFANTRY',{q:-1,r:0},G),unit('d1','S-INF','SOVIET','INFANTRY',{q:0,r:0},S),unit('d2','S-INF','SOVIET','INFANTRY',{q:0,r:0},S)],[plain(-1,0),plain(0,0)]);retreatTx(st,{defenders:['d1','d2'],steps:2});
    const r=engine.apply(st,{type:'RETREAT',controllerId:S,battleId:'B-R',retreats:[{unitId:'d1',path:[]},{unitId:'d2',path:[]}]});expect(r.accepted).toBe(true);expect(r.state.pendingDecision?.kind).toBe('LOSS_ALLOCATION');expect(r.state.combatTransactions['B-R']?.retreat?.resolved).toBe(true);
    const loss=engine.apply(r.state,{type:'ALLOCATE_LOSSES',controllerId:S,battleId:'B-R',unitIdsByStep:['d1']});expect(loss.accepted).toBe(true);expect(loss.state.pendingDecision?.kind).not.toBe('RETREAT');expect(loss.state.combatTransactions['B-R']?.stage).toBe('CLOSED');expect(validateGameStateIntegrity(loss.state,defaultRules)).toEqual([]);
  });
});

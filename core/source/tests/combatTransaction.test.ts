import {describe,expect,it} from 'vitest';
import {RulesEngine,createGameState,defaultRules,defaultScenario,validateGameStateIntegrity,type GameState,type UnitState} from '../src/index.js';
import {G,S,gridHexes,unit} from './helpers.js';

const engine=new RulesEngine(defaultRules,defaultScenario);
function state(seed:number,extra:UnitState[]=[]):GameState{
 const units=[unit('g','G-INF','GERMAN','INFANTRY',{q:-1,r:0},G),unit('s','S-ELITE','SOVIET','ELITE_INFANTRY',{q:0,r:0},S),...extra];
 const st=createGameState({scenario:defaultScenario,rules:defaultRules,hexes:gridHexes(-4,4,-4,4),edges:[],units,seed});
 st.phase='GERMAN_COMBAT';st.activeSide='GERMAN';return st;
}
const attack=(st:GameState,battleId:string)=>engine.apply(st,{type:'ATTACK',controllerId:G,battleId,attackerUnitIds:['g'],target:{q:0,r:0}});

describe('Task 002A-1 combat vertical slice',()=>{
 it('declares a transaction and freezes unrelated actions',()=>{
   const d=attack(state(2722),'B-X');expect(d.accepted).toBe(true);expect(d.state.combatTransactions['B-X']?.stage).toBe('DEFENDER_REACTION');expect(d.state.pendingDecision?.kind).toBe('DEFENDER_REACTION');
   const blocked=engine.apply(d.state,{type:'MOVE',controllerId:G,unitId:'g',path:[{q:-2,r:0}]});expect(blocked.issues.map(x=>x.code)).toContain('PENDING_DECISION_BLOCKS_ACTION');
 });
 it('resolves deterministic 2D6 + CRT and closes NE',()=>{
   const a=attack(state(2722),'B-D');const b=attack(state(2722),'B-D');
   const ra=engine.apply(a.state,{type:'PASS_REACTION',controllerId:S,battleId:'B-D'});const rb=engine.apply(b.state,{type:'PASS_REACTION',controllerId:S,battleId:'B-D'});
   expect(ra.state.combatTransactions['B-D']?.resolution).toEqual(rb.state.combatTransactions['B-D']?.resolution);expect(ra.events).toEqual(rb.events);expect(ra.state.combatTransactions['B-D']?.resolution?.crtResult).toBe('NE');expect(ra.state.combatTransactions['B-D']?.stage).toBe('CLOSED');expect(validateGameStateIntegrity(ra.state,defaultRules)).toEqual([]);
 });
 it('auto-resolves a unique damage allocation and routes retreat-only to retreat pending',()=>{
   let d=attack(state(22),'B-L');let r=engine.apply(d.state,{type:'PASS_REACTION',controllerId:S,battleId:'B-L'});expect(r.state.units.g?.step).toBe(1);expect(r.state.combatTransactions['B-L']?.stage).toBe('CLOSED');expect(r.state.pendingDecision).toBeNull();
   d=attack(state(5392),'B-R');r=engine.apply(d.state,{type:'PASS_REACTION',controllerId:S,battleId:'B-R'});expect(r.state.pendingDecision?.kind).toBe('RETREAT');
 });
 it('applies defensive artillery exactly once',()=>{
   const art=unit('sa','S-ARTY','SOVIET','ARTILLERY',{q:0,r:2},S);const d=attack(state(2722,[art]),'B-A');
   const use=engine.apply(d.state,{type:'COMBAT_REACTION',controllerId:S,battleId:'B-A',reaction:{kind:'DEFENDER_ARTILLERY',artilleryUnitId:'sa'}});expect(use.accepted).toBe(true);expect(use.state.units.sa?.artillerySupportUsed).toBe(true);
   const dup=engine.apply(use.state,{type:'COMBAT_REACTION',controllerId:S,battleId:'B-A',reaction:{kind:'DEFENDER_ARTILLERY',artilleryUnitId:'sa'}});expect(dup.accepted).toBe(false);
   const pass=engine.apply(use.state,{type:'PASS_REACTION',controllerId:S,battleId:'B-A'});expect(pass.state.combatTransactions['B-A']?.context?.modifiers.defenderArtilleryShift).toBe(-1);
 });
 it('validates Last Stand, spends CP, marks HQ and converts defender retreat to one loss',()=>{
   const hq=unit('shq','S-HQ','SOVIET','HQ',{q:1,r:0},S);const st=state(8246,[hq]);st.cp.SOVIET=2;const d=attack(st,'B-H');
   const use=engine.apply(d.state,{type:'COMBAT_REACTION',controllerId:S,battleId:'B-H',reaction:{kind:'DEFENDER_HQ_COMMAND',hqUnitId:'shq',command:'LAST_STAND'}});expect(use.accepted).toBe(true);expect(use.state.cp.SOVIET).toBe(0);expect(use.state.units.shq?.lastHQCommandTurn).toBe(use.state.turn);
   const pass=engine.apply(use.state,{type:'PASS_REACTION',controllerId:S,battleId:'B-H'});const tx=pass.state.combatTransactions['B-H']!;expect(tx.context?.modifiers.hqShift).toBe(-1);expect(tx.resolution?.defenderRetreatSteps).toBe(0);expect(tx.resolution?.retreatConvertedToLoss).toBe(true);expect(pass.state.units.s?.step).toBe(1);expect(tx.stage).toBe('CLOSED');
 });
 it('rejects unvalidated attacker HQ effects in ATTACK payload',()=>{
   const r=engine.apply(state(22),{type:'ATTACK',controllerId:G,battleId:'B-HQ',attackerUnitIds:['g'],target:{q:0,r:0},support:{attackerHQCommand:'FORCE_ATTACK'}});expect(r.accepted).toBe(false);expect(r.issues.map(x=>x.code)).toContain('RULE_NOT_IMPLEMENTED');expect(r.state.combatTransactions['B-HQ']).toBeUndefined();
 });
 it('integrity validator catches transaction/pending corruption',()=>{
   const d=attack(state(22),'B-I');const bad=structuredClone(d.state);bad.combatTransactions['WRONG']=bad.combatTransactions['B-I']!;delete bad.combatTransactions['B-I'];const codes=validateGameStateIntegrity(bad,defaultRules).map(x=>x.code);expect(codes).toContain('COMBAT_KEY_ID_MISMATCH');expect(codes).toContain('PENDING_COMBAT_TRANSACTION_INVALID');
 });
});

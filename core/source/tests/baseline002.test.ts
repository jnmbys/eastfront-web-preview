import {it,expect} from 'vitest';
import {RulesEngine,defaultRules,defaultScenario,validateGameStateIntegrity} from '../src/index.js';
import {G,S,makeState,unit,declaredSupplySnapshot} from './helpers.js';
it('BASELINE002 setup supply refresh remains authoritative; combat fixtures opt in to declared snapshots',()=>{
 const g=unit('g','G-INF','GERMAN','INFANTRY',{q:-1,r:0});
 const d=unit('d','S-INF','SOVIET','INFANTRY',{q:0,r:0});d.supplyState='TEMPORARY_SUPPLY';d.temporarySupply=true;
 const state=makeState([g,d]);
 expect(state.units.g!.supplyState).toBe('OUT_OF_SUPPLY');expect(state.units.d!.supplyState).toBe('OUT_OF_SUPPLY');
 const random=structuredClone(state.random);declaredSupplySnapshot(state,[g,d]);
 expect(state.units.g!.supplyState).toBe('SUPPLIED');expect(state.units.d!.supplyState).toBe('TEMPORARY_SUPPLY');expect(state.units.d!.temporarySupply).toBe(true);expect(state.random).toEqual(random);
});
it('BASELINE002 a hand-written pending without its transaction is still rejected',()=>{
 const state=makeState([unit('g','G-INF','GERMAN','INFANTRY',{q:-1,r:0}),unit('d','S-INF','SOVIET','INFANTRY',{q:0,r:0})]);
 state.phase='GERMAN_COMBAT';state.activeSide='GERMAN';
 state.pendingDecision={kind:'DEFENDER_REACTION',battleId:'MISSING',side:'SOVIET',decisionOwnerControllerId:S,eligibleControllerIds:[S],eligibleHQUnitIds:[],eligibleArtilleryUnitIds:[]};
 expect(validateGameStateIntegrity(state,defaultRules).map(i=>i.code)).toContain('PENDING_COMBAT_TRANSACTION_INVALID');
 const result=new RulesEngine(defaultRules,defaultScenario).apply(state,{type:'PASS_REACTION',controllerId:S,battleId:'MISSING'});
 expect(result.accepted).toBe(false);expect(result.issues.map(i=>i.code)).toContain('COMBAT_TRANSACTION_NOT_FOUND');expect(result.events.some(e=>e.type==='DiceRolled')).toBe(false);expect(result.state.random).toEqual(state.random);
});

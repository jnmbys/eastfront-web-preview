import assert from 'node:assert/strict';
import {
  RulesEngine,
  computeSovietEastRailSupplyProjection,
  computeSovietSupplyProjection,
  computeSupply,
  createGameState,
  defaultRules,
  defaultScenario,
  endPhase,
  hexKey,
  makeEdge,
  refreshSovietSupplyState
} from '../dist/index.js';

const G='G-HUMAN-1',S='S-AI-1',S2='S-HUMAN-2';
const H=(q,r)=>({q,r});
const hk=(h)=>hexKey(h);
const rail=(a,b,{repairedBy='GERMAN',destroyed=false}={})=>makeEdge(a,b,{railway:{present:true,repairedBy,destroyed}});
const hexes=(coords)=>coords.map((coord)=>({coord:{...coord},terrain:'PLAIN',control:null}));
const unit=(id,side,hex,{alive=true,supplyState='SUPPLIED',temporarySupply=false,controllerId=side==='GERMAN'?G:S}={})=>({
  id,templateId:side==='GERMAN'?'G-INF':'S-INF',side,type:'INFANTRY',step:0,alive,hex:{...hex},supplyState,
  entrenched:false,hasMoved:false,hasAttacked:false,controllerId,temporarySupply,dedicatedRailRepair:false,
  reconZocIgnoreUsed:false,artillerySupportUsed:false,lastHQCommandTurn:null
});
const cloneRules=({germanRadius=1,sovietRadius=1}={})=>{
  const rules=structuredClone(defaultRules);
  rules.supply.germanRadius=germanRadius;
  rules.supply.sovietRadius=sovietRadius;
  return rules;
};
function scenarioFor({germanEntry,sovietSources=[],sovietExits=[],controllers}={}) {
  return {
    ...defaultScenario,
    id:'soviet-supply-refresh-smoke',
    displayName:'Soviet Supply Refresh Smoke',
    germanWestRailEntries:germanEntry?[{...germanEntry}]:[],
    sovietEastRailExits:sovietExits.map((h)=>({...h})),
    sovietSupplySources:sovietSources.map((h)=>({...h})),
    controllers:controllers??defaultScenario.controllers.map((c)=>({...c})),
    capitalCoreHexes:[],capitalOuterHexes:[],initialUnits:[],deployment:undefined
  };
}
function makeState({coords,edges=[],units=[],germanEntry,sovietSources=[],sovietExits=[],rules=cloneRules(),controllers}={}) {
  const scenario=scenarioFor({germanEntry,sovietSources,sovietExits,controllers});
  const state=createGameState({scenario,rules,hexes:hexes(coords),edges,units,seed:517});
  return {state,scenario,rules};
}
function setPhase(state,phase,side){state.phase=phase;state.activeSide=side;state.phaseReadyControllerIds=[];state.pendingDecision=null;}
function endWith(engine,state,controllerId){
  const result=engine.apply(state,{type:'END_PHASE',controllerId});
  assert.equal(result.accepted,true,`END_PHASE should be accepted for ${controllerId} from ${state.phase}`);
  return result.state;
}

const GS=H(-5,0),GA=H(-4,0),GFAR=H(-1,3);
const SS=H(0,0),SNEAR=H(1,0),SFAR=H(4,0),MOVE_TO=H(1,-1),S2SRC=H(7,0);
const BASE_COORDS=[GS,GA,GFAR,SS,SNEAR,SFAR,MOVE_TO,S2SRC];
const GRAIL=[rail(GS,GA)];

// A-F/S — helper overwrites stale living-Soviet snapshots only, preserves German/dead/temp and is idempotent.
{
  const units=[
    unit('s-near','SOVIET',SNEAR,{supplyState:'OUT_OF_SUPPLY',temporarySupply:true}),
    unit('s-far','SOVIET',SFAR,{supplyState:'SUPPLIED'}),
    unit('s-dead','SOVIET',SNEAR,{alive:false,supplyState:'TEMPORARY_SUPPLY'}),
    unit('g-live','GERMAN',GA,{supplyState:'OUT_OF_SUPPLY',temporarySupply:true})
  ];
  const built=makeState({coords:BASE_COORDS,edges:GRAIL,units,germanEntry:GS,sovietSources:[SS],rules:cloneRules({sovietRadius:1})});
  built.state.units['s-near'].supplyState='OUT_OF_SUPPLY';
  built.state.units['s-near'].temporarySupply=true;
  built.state.units['s-far'].supplyState='SUPPLIED';
  built.state.units['s-dead'].supplyState='TEMPORARY_SUPPLY';
  built.state.units['g-live'].supplyState='OUT_OF_SUPPLY';
  built.state.units['g-live'].temporarySupply=true;
  const before=structuredClone(built.state);
  const computation=refreshSovietSupplyState(built.state,built.rules,built.scenario);
  assert.equal(computation.unitSupply['s-near'],'SUPPLIED');
  assert.equal(computation.unitSupply['s-far'],'OUT_OF_SUPPLY');
  assert.equal(built.state.units['s-near'].supplyState,'SUPPLIED');
  assert.equal(built.state.units['s-far'].supplyState,'OUT_OF_SUPPLY');
  assert.equal(built.state.units['s-dead'].supplyState,'TEMPORARY_SUPPLY');
  assert.equal(built.state.units['g-live'].supplyState,'OUT_OF_SUPPLY');
  assert.equal(built.state.units['s-near'].temporarySupply,true);
  assert.equal(built.state.units['g-live'].temporarySupply,true);
  const expected=structuredClone(before);
  expected.units['s-near'].supplyState='SUPPLIED';
  expected.units['s-far'].supplyState='OUT_OF_SUPPLY';
  assert.deepEqual(built.state,expected);
  const once=structuredClone(built.state);
  const second=refreshSovietSupplyState(built.state,built.rules,built.scenario);
  assert.deepEqual(second,computation);
  assert.deepEqual(built.state,once);
}

// G/S — Turn 1 createGameState initializes both sides, and Soviet refresh uses full 5C independent sources (not East-only API).
{
  const rules=cloneRules({germanRadius:0,sovietRadius:0});
  const units=[
    unit('g-in','GERMAN',GS,{supplyState:'OUT_OF_SUPPLY'}),
    unit('g-out','GERMAN',GFAR,{supplyState:'SUPPLIED'}),
    unit('s-in','SOVIET',SS,{supplyState:'OUT_OF_SUPPLY'}),
    unit('s-out','SOVIET',SFAR,{supplyState:'SUPPLIED'})
  ];
  const built=makeState({coords:BASE_COORDS,edges:GRAIL,units,germanEntry:GS,sovietSources:[SS],sovietExits:[],rules});
  assert.equal(built.state.units['g-in'].supplyState,'SUPPLIED');
  assert.equal(built.state.units['g-out'].supplyState,'OUT_OF_SUPPLY');
  assert.equal(built.state.units['s-in'].supplyState,'SUPPLIED');
  assert.equal(built.state.units['s-out'].supplyState,'OUT_OF_SUPPLY');
  assert.equal(computeSovietEastRailSupplyProjection(built.state,rules,built.scenario).unitSupply['s-in'],'OUT_OF_SUPPLY');
  assert.equal(computeSovietSupplyProjection(built.state,rules,built.scenario).unitSupply['s-in'],'SUPPLIED');
}

// H/I/J/P — German source occupation changes pure projection immediately, not snapshot on Soviet-turn entry; refresh occurs only on leaving reinforcement/supply.
{
  const rules=cloneRules({sovietRadius:1});
  const defender=unit('s-front','SOVIET',SNEAR,{supplyState:'SUPPLIED'});
  const blocker=unit('g-block','GERMAN',SS,{supplyState:'SUPPLIED'});
  const built=makeState({coords:BASE_COORDS,edges:GRAIL,units:[defender,blocker],germanEntry:GS,sovietSources:[SS],rules});
  const engine=new RulesEngine(rules,built.scenario);
  // createGameState saw the occupied source, so deliberately model a still-authoritative old snapshot from before the German cut.
  built.state.units['s-front'].supplyState='SUPPLIED';
  setPhase(built.state,'GERMAN_ENTRENCHMENT','GERMAN');
  assert.equal(computeSupply(built.state,'SOVIET',rules,built.scenario).unitSupply['s-front'],'OUT_OF_SUPPLY');
  assert.equal(built.state.units['s-front'].supplyState,'SUPPLIED');
  let state=endWith(engine,built.state,G);
  assert.equal(state.phase,'SOVIET_REINFORCEMENT_SUPPLY');
  assert.equal(state.units['s-front'].supplyState,'SUPPLIED'); // entry does not refresh
  state=endWith(engine,state,S);
  assert.equal(state.phase,'SOVIET_MOVEMENT');
  assert.equal(state.units['s-front'].supplyState,'OUT_OF_SUPPLY');
}

// K — reconnect also waits through entry and is applied only when reinforcement/supply ends.
{
  const rules=cloneRules({sovietRadius:1});
  const blocker=unit('g-block','GERMAN',SS,{alive:false}),defender=unit('s-front','SOVIET',SNEAR,{supplyState:'OUT_OF_SUPPLY'});
  const built=makeState({coords:BASE_COORDS,edges:GRAIL,units:[blocker,defender],germanEntry:GS,sovietSources:[SS],rules});
  const engine=new RulesEngine(rules,built.scenario);
  built.state.units['s-front'].supplyState='OUT_OF_SUPPLY';
  setPhase(built.state,'GERMAN_ENTRENCHMENT','GERMAN');
  assert.equal(computeSupply(built.state,'SOVIET',rules,built.scenario).unitSupply['s-front'],'SUPPLIED');
  let state=endWith(engine,built.state,G);
  assert.equal(state.phase,'SOVIET_REINFORCEMENT_SUPPLY');
  assert.equal(state.units['s-front'].supplyState,'OUT_OF_SUPPLY');
  state=endWith(engine,state,S);
  assert.equal(state.units['s-front'].supplyState,'SUPPLIED');
}

// L — a future reinforcement inserted during the combined phase is included by the phase-exit refresh.
{
  const rules=cloneRules({sovietRadius:0});
  const built=makeState({coords:BASE_COORDS,edges:GRAIL,units:[],germanEntry:GS,sovietSources:[SS],rules});
  const engine=new RulesEngine(rules,built.scenario);
  setPhase(built.state,'SOVIET_REINFORCEMENT_SUPPLY','SOVIET');
  built.state.units['s-reinf']=unit('s-reinf','SOVIET',SS,{supplyState:'OUT_OF_SUPPLY'});
  const state=endWith(engine,built.state,S);
  assert.equal(state.phase,'SOVIET_MOVEMENT');
  assert.equal(state.units['s-reinf'].supplyState,'SUPPLIED');
}

// M — multiplayer Ready barrier refreshes once, only when the final required Soviet controller completes the transition.
{
  const rules=cloneRules({sovietRadius:0});
  const controllers=[...defaultScenario.controllers.map((c)=>({...c})),{id:S2,side:'SOVIET',controllerType:'HUMAN',displayName:'Soviet 2'}];
  const units=[unit('s1','SOVIET',SS,{supplyState:'OUT_OF_SUPPLY'}),unit('s2','SOVIET',S2SRC,{supplyState:'SUPPLIED',controllerId:S2})];
  const built=makeState({coords:BASE_COORDS,edges:GRAIL,units,germanEntry:GS,sovietSources:[SS],rules,controllers});
  const engine=new RulesEngine(rules,built.scenario);
  setPhase(built.state,'SOVIET_REINFORCEMENT_SUPPLY','SOVIET');
  built.state.units.s1.supplyState='OUT_OF_SUPPLY'; // should become supplied only after final Ready
  built.state.units.s2.supplyState='SUPPLIED';      // should become OOS only after final Ready
  const first=engine.apply(built.state,{type:'READY_FOR_PHASE_END',controllerId:S});
  assert.equal(first.accepted,true);
  assert.equal(first.state.phase,'SOVIET_REINFORCEMENT_SUPPLY');
  assert.equal(first.state.units.s1.supplyState,'OUT_OF_SUPPLY');
  assert.equal(first.state.units.s2.supplyState,'SUPPLIED');
  const second=engine.apply(first.state,{type:'READY_FOR_PHASE_END',controllerId:S2});
  assert.equal(second.accepted,true);
  assert.equal(second.state.phase,'SOVIET_MOVEMENT');
  assert.equal(second.state.units.s1.supplyState,'SUPPLIED');
  assert.equal(second.state.units.s2.supplyState,'OUT_OF_SUPPLY');
}

// N — low-level endPhase remains supply-agnostic.
{
  const rules=cloneRules({sovietRadius:0});
  const built=makeState({coords:BASE_COORDS,edges:GRAIL,units:[unit('s','SOVIET',SS,{supplyState:'OUT_OF_SUPPLY'})],germanEntry:GS,sovietSources:[SS],rules});
  setPhase(built.state,'SOVIET_REINFORCEMENT_SUPPLY','SOVIET');
  built.state.units.s.supplyState='OUT_OF_SUPPLY';
  const transition=endPhase(built.state,rules);
  assert.equal(transition.nextPhase,'SOVIET_MOVEMENT');
  assert.equal(built.state.units.s.supplyState,'OUT_OF_SUPPLY');
}

// O — Soviet MOVE does not live-refresh the authoritative snapshot after leaving a radius-0 source.
{
  const rules=cloneRules({sovietRadius:0});
  const built=makeState({coords:BASE_COORDS,edges:GRAIL,units:[unit('s-move','SOVIET',SS)],germanEntry:GS,sovietSources:[SS],rules});
  const engine=new RulesEngine(rules,built.scenario);
  setPhase(built.state,'SOVIET_REINFORCEMENT_SUPPLY','SOVIET');
  let state=endWith(engine,built.state,S);
  assert.equal(state.units['s-move'].supplyState,'SUPPLIED');
  const move=engine.apply(state,{type:'MOVE',controllerId:S,unitId:'s-move',path:[MOVE_TO]});
  assert.equal(move.accepted,true);
  state=move.state;
  assert.equal(computeSupply(state,'SOVIET',rules,built.scenario).unitSupply['s-move'],'OUT_OF_SUPPLY');
  assert.equal(state.units['s-move'].supplyState,'SUPPLIED');
}

// Q — occupying one independent source does not disable another; refresh consumes the full 5C projection.
{
  const rules=cloneRules({sovietRadius:0});
  const units=[unit('g-block','GERMAN',SS),unit('s-second','SOVIET',S2SRC,{supplyState:'OUT_OF_SUPPLY'})];
  const built=makeState({coords:BASE_COORDS,edges:GRAIL,units,germanEntry:GS,sovietSources:[SS,S2SRC],rules});
  built.state.units['s-second'].supplyState='OUT_OF_SUPPLY';
  const result=refreshSovietSupplyState(built.state,rules,built.scenario);
  assert.equal(result.unitSupply['s-second'],'SUPPLIED');
  assert.equal(built.state.units['s-second'].supplyState,'SUPPLIED');
}

// R — generic full Soviet computeSupply remains pure after lifecycle integration.
{
  const rules=cloneRules({sovietRadius:0});
  const built=makeState({coords:BASE_COORDS,edges:GRAIL,units:[unit('s','SOVIET',SS)],germanEntry:GS,sovietSources:[SS],rules});
  built.state.units.s.supplyState='OUT_OF_SUPPLY';
  const before=structuredClone(built.state);
  const result=computeSupply(built.state,'SOVIET',rules,built.scenario);
  assert.equal(result.unitSupply.s,'SUPPLIED');
  assert.deepEqual(built.state,before);
}

console.log('Digital Branch Task 002B-5D Soviet Supply Snapshot Lifecycle smoke checks passed.');

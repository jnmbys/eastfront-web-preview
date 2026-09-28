import assert from 'node:assert/strict';
import {
  RulesEngine,
  computeSupply,
  createGameState,
  defaultRules,
  defaultScenario,
  hexKey,
  makeEdge,
  refreshGermanSupplyState
} from '../dist/index.js';

const G='G-HUMAN-1',S='S-AI-1';
const H=(q,r)=>({q,r});
const hk=(h)=>hexKey(h);
const rail=(a,b,{repairedBy='GERMAN',destroyed=false}={})=>makeEdge(a,b,{railway:{present:true,repairedBy,destroyed}});
const hexes=(coords)=>coords.map((coord)=>({coord:{...coord},terrain:'PLAIN',control:null}));
const unit=(id,side,hex,{alive=true,supplyState='SUPPLIED',temporarySupply=false}={})=>({
  id,templateId:side==='GERMAN'?'G-INF':'S-INF',side,type:'INFANTRY',step:0,alive,hex:{...hex},supplyState,
  entrenched:false,hasMoved:false,hasAttacked:false,controllerId:side==='GERMAN'?G:S,temporarySupply,
  dedicatedRailRepair:false,reconZocIgnoreUsed:false,artillerySupportUsed:false,lastHQCommandTurn:null
});
const rulesWithRadius=(radius)=>{const rules=structuredClone(defaultRules);rules.supply.germanRadius=radius;return rules;};
const scenarioFor=(entry)=>({...defaultScenario,id:'german-supply-refresh-smoke',displayName:'German Supply Refresh Smoke',germanWestRailEntries:[{...entry}],sovietSupplySources:[],initialUnits:[],deployment:undefined});
function makeState({entry,coords,edges,units,rules=rulesWithRadius(1)}) {
  const scenario=scenarioFor(entry);
  const state=createGameState({scenario,rules,hexes:hexes(coords),edges,units,seed:211});
  return {state,scenario,rules};
}
function setPhase(state,phase,side){state.phase=phase;state.activeSide=side;state.phaseReadyControllerIds=[];state.pendingDecision=null;}
function endCurrentPhase(engine,state){
  const controllerId=state.activeSide==='GERMAN'?G:S;
  const result=engine.apply(state,{type:'END_PHASE',controllerId});
  assert.equal(result.accepted,true,`END_PHASE should be accepted from ${state.phase}`);
  return result.state;
}

// Shared rail geometry: when B is blocked, C is beyond radius from the last active source A.
const E=H(0,0),A=H(1,0),B=H(2,0),C=H(3,0),FAR=H(8,0);
const LINE=[rail(E,A),rail(A,B),rail(B,C)];

// A/B/C/D/L/M — direct helper overwrites stale living-German snapshots only, preserves everything else.
{
  const units=[
    unit('g-near','GERMAN',A,{supplyState:'OUT_OF_SUPPLY',temporarySupply:true}),
    unit('g-far','GERMAN',FAR,{supplyState:'SUPPLIED'}),
    unit('g-dead','GERMAN',A,{alive:false,supplyState:'OUT_OF_SUPPLY'}),
    unit('s-live','SOVIET',FAR,{supplyState:'TEMPORARY_SUPPLY',temporarySupply:true})
  ];
  const {state,scenario,rules}=makeState({entry:E,coords:[E,A,B,C,FAR],edges:LINE,units});
  // createGameState has already performed Turn-1 refresh; make the two living German values stale on purpose.
  state.units['g-near'].supplyState='OUT_OF_SUPPLY';
  state.units['g-near'].temporarySupply=true;
  state.units['g-far'].supplyState='SUPPLIED';
  state.units['g-dead'].supplyState='TEMPORARY_SUPPLY';
  state.units['s-live'].supplyState='TEMPORARY_SUPPLY';
  state.units['s-live'].temporarySupply=true;

  const before=structuredClone(state);
  const computation=refreshGermanSupplyState(state,rules,scenario);
  assert.equal(computation.unitSupply['g-near'],'SUPPLIED');
  assert.equal(computation.unitSupply['g-far'],'OUT_OF_SUPPLY');
  assert.equal(state.units['g-near'].supplyState,'SUPPLIED');
  assert.equal(state.units['g-far'].supplyState,'OUT_OF_SUPPLY');
  assert.equal(state.units['g-dead'].supplyState,'TEMPORARY_SUPPLY');
  assert.equal(state.units['s-live'].supplyState,'TEMPORARY_SUPPLY');
  assert.equal(state.units['g-near'].temporarySupply,true);
  assert.equal(state.units['s-live'].temporarySupply,true);

  const expected=structuredClone(before);
  expected.units['g-near'].supplyState='SUPPLIED';
  expected.units['g-far'].supplyState='OUT_OF_SUPPLY';
  assert.deepEqual(state,expected);

  const once=structuredClone(state);
  const second=refreshGermanSupplyState(state,rules,scenario);
  assert.deepEqual(second,computation);
  assert.deepEqual(state,once); // idempotent / deterministic
}

// E — Turn 1 createGameState returns an already-refreshed German normal-supply snapshot.
{
  const units=[unit('near','GERMAN',A,{supplyState:'OUT_OF_SUPPLY'}),unit('far','GERMAN',FAR,{supplyState:'SUPPLIED'})];
  const {state}=makeState({entry:E,coords:[E,A,B,C,FAR],edges:LINE,units});
  assert.equal(state.phase,'GERMAN_SUPPLY_RAIL');
  assert.equal(state.units.near.supplyState,'SUPPLIED');
  assert.equal(state.units.far.supplyState,'OUT_OF_SUPPLY');
}

// F/H — rail is cut during Soviet turn; current snapshot stays stale until real entry into next German supply phase.
{
  const blocker=unit('s-block','SOVIET',B),g=unit('g-front','GERMAN',C,{supplyState:'SUPPLIED'});
  const {state:initial,scenario,rules}=makeState({entry:E,coords:[E,A,B,C],edges:LINE,units:[blocker,g]});
  const engine=new RulesEngine(rules,scenario);
  setPhase(initial,'SOVIET_ENTRENCHMENT','SOVIET');
  initial.units['g-front'].supplyState='SUPPLIED'; // stale snapshot from prior German turn
  assert.equal(computeSupply(initial,'GERMAN',rules,scenario).unitSupply['g-front'],'OUT_OF_SUPPLY');
  assert.equal(initial.units['g-front'].supplyState,'SUPPLIED'); // no live synchronization
  const next=endCurrentPhase(engine,initial);
  assert.equal(next.phase,'GERMAN_SUPPLY_RAIL');
  assert.equal(next.activeSide,'GERMAN');
  assert.equal(next.units['g-front'].supplyState,'OUT_OF_SUPPLY');
}

// G/H — reconnect during Soviet turn also waits until entry to next German supply phase.
{
  const blocker=unit('s-block','SOVIET',B,{alive:false}),g=unit('g-front','GERMAN',C,{supplyState:'OUT_OF_SUPPLY'});
  const {state:initial,scenario,rules}=makeState({entry:E,coords:[E,A,B,C],edges:LINE,units:[blocker,g]});
  const engine=new RulesEngine(rules,scenario);
  setPhase(initial,'SOVIET_ENTRENCHMENT','SOVIET');
  initial.units['g-front'].supplyState='OUT_OF_SUPPLY';
  assert.equal(computeSupply(initial,'GERMAN',rules,scenario).unitSupply['g-front'],'SUPPLIED');
  assert.equal(initial.units['g-front'].supplyState,'OUT_OF_SUPPLY');
  const next=endCurrentPhase(engine,initial);
  assert.equal(next.units['g-front'].supplyState,'SUPPLIED');
}

// I/J — leaving GERMAN_SUPPLY_RAIL never refreshes. A same-turn rail change waits through the entire turn and applies next German start.
{
  const blocker=unit('s-block','SOVIET',B),g=unit('g-front','GERMAN',C,{supplyState:'OUT_OF_SUPPLY'});
  const {state:initial,scenario,rules}=makeState({entry:E,coords:[E,A,B,C],edges:LINE,units:[blocker,g]});
  const engine=new RulesEngine(rules,scenario);
  // Initial refresh sees the cut and makes the front unit OOS.
  assert.equal(initial.units['g-front'].supplyState,'OUT_OF_SUPPLY');
  // Simulate a future rail/occupation change during the German supply/rail phase.
  initial.units['s-block'].alive=false;
  assert.equal(computeSupply(initial,'GERMAN',rules,scenario).unitSupply['g-front'],'SUPPLIED');
  let state=endCurrentPhase(engine,initial);
  assert.equal(state.phase,'GERMAN_MOVEMENT');
  assert.equal(state.units['g-front'].supplyState,'OUT_OF_SUPPLY'); // critically, no refresh on leaving the phase

  while (state.phase!=='SOVIET_ENTRENCHMENT') state=endCurrentPhase(engine,state);
  assert.equal(state.units['g-front'].supplyState,'OUT_OF_SUPPLY');
  state=endCurrentPhase(engine,state);
  assert.equal(state.phase,'GERMAN_SUPPLY_RAIL');
  assert.equal(state.units['g-front'].supplyState,'SUPPLIED');
}

// K — computeSupply remains a pure projection after lifecycle integration.
{
  const {state,scenario,rules}=makeState({entry:E,coords:[E,A,B,C],edges:LINE,units:[unit('g','GERMAN',C)]});
  state.units.g.supplyState='OUT_OF_SUPPLY';
  const before=structuredClone(state);
  const result=computeSupply(state,'GERMAN',rules,scenario);
  assert.equal(result.unitSupply.g,'SUPPLIED');
  assert.deepEqual(state,before);
}

console.log('Digital Branch Task 002B-3 German Supply State Refresh / lifecycle smoke checks passed.');

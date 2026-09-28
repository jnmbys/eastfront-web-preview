import assert from 'node:assert/strict';
import {
  createGameState,defaultRules,defaultScenario,makeEdge,hexKey,
  evaluateGermanCapitalVictoryCondition,evaluateVictoryAtCheckpoint,
  validateGameStateIntegrity
} from '../dist/index.js';

const H=(q,r)=>({q,r});
const W=H(0,0),C1=H(1,0),C2=H(2,0),OUT=H(3,0),OUTER=H(2,1),PLAINCITY=H(3,1),EAST=H(5,0),SBASE=H(5,1),INVALID=H(99,99);
const hk=hexKey;
const controllers=[
  {id:'G1',side:'GERMAN',controllerType:'HUMAN'},
  {id:'S1',side:'SOVIET',controllerType:'HUMAN'}
];
const allCoords=[W,C1,C2,OUT,OUTER,PLAINCITY,EAST,SBASE];
const rail=(a,b,{destroyed=false,repairedBy='GERMAN'}={})=>makeEdge(a,b,{railway:{present:true,destroyed,repairedBy}});
const templateId=(side,type)=>({
  GERMAN:{INFANTRY:'G-INF',JAGER:'G-JAGER',PANZER:'G-PANZER',MOTORIZED:'G-MOT',ARTILLERY:'G-ARTY',ENGINEER:'G-ENG',RECON:'G-RECON',HQ:'G-HQ'},
  SOVIET:{INFANTRY:'S-INF',ARTILLERY:'S-ARTY',ENGINEER:'S-ENG',HQ:'S-HQ'}
})[side][type];
const unit=(id,side,type,hex,{alive=true,supplyState='OUT_OF_SUPPLY',temporarySupply=false,controllerId}={})=>({
  id,templateId:templateId(side,type),side,type,step:0,alive,hex:{...hex},supplyState,entrenched:false,hasMoved:false,hasAttacked:false,
  controllerId:controllerId??(side==='GERMAN'?'G1':'S1'),temporarySupply,dedicatedRailRepair:false,reconZocIgnoreUsed:false,artillerySupportUsed:false,lastHQCommandTurn:null
});
const scenarioFor=(overrides={})=>({
  ...defaultScenario,id:'victory-eval-smoke',displayName:'Victory Eval Smoke',controllers,initialUnits:[],deployment:undefined,
  germanWestRailEntries:[W],sovietEastRailExits:[EAST],sovietSupplySources:[SBASE],
  capitalCoreHexes:[C1,C2],capitalOuterHexes:[OUTER],...overrides
});
const rulesFor=(germanRadius=5)=>{const r=structuredClone(defaultRules);r.supply.germanRadius=germanRadius;return r;};
const hexesFor=(terrain={})=>allCoords.map(coord=>({coord:{...coord},terrain:terrain[hk(coord)]??'PLAIN',control:null}));
function build({units=[unit('g1','GERMAN','INFANTRY',C1),unit('g2','GERMAN','INFANTRY',C2)],edges=[rail(W,C1),rail(C1,C2)],scenario=scenarioFor(),rules=rulesFor(),terrain={}}={}){
  const state=createGameState({scenario,rules,hexes:hexesFor(terrain),edges,units,seed:20201});
  return {state,rules,scenario};
}
const condition=(b)=>evaluateGermanCapitalVictoryCondition(b.state,b.rules,b.scenario);
const hasIssue=(issues,code)=>issues.some((x)=>x.code===code);

// Basic capital success, one-core-empty, Soviet presence, and dead Soviet semantics.
{
  let b=build();assert.equal(condition(b).satisfied,true);
  b=build({units:[unit('g1','GERMAN','INFANTRY',C1)]});assert.equal(condition(b).satisfied,false);
  b=build({units:[unit('g1','GERMAN','INFANTRY',C1),unit('g2','GERMAN','INFANTRY',C2),unit('s','SOVIET','HQ',C2)]});
  b.state.hexes[hk(C2)].control='GERMAN';assert.equal(condition(b).satisfied,false);
  b=build({units:[unit('g1','GERMAN','INFANTRY',C1),unit('g2','GERMAN','INFANTRY',C2),unit('s','SOVIET','HQ',C2,{alive:false})]});assert.equal(condition(b).satisfied,true);
}

// Support and Recon cannot satisfy regular occupancy alone.
for(const type of ['ARTILLERY','ENGINEER','HQ','RECON']){
  const b=build({units:[unit('g1','GERMAN','INFANTRY',C1),unit(`g-${type}`,'GERMAN',type,C2)]});
  const c=condition(b);assert.equal(c.satisfied,false);assert.deepEqual(c.regularGermanUnitIdsByCore[hk(C2)],[]);
}

// Regular + support stack is valid; support may be a supplied capital occupant without being a regular occupier.
{
  const b=build({units:[unit('b','GERMAN','INFANTRY',C2),unit('a','GERMAN','INFANTRY',C1),unit('eng','GERMAN','ENGINEER',C2)]});
  const c=condition(b);assert.equal(c.satisfied,true);assert.deepEqual(c.regularGermanUnitIdsByCore[hk(C2)],['b']);assert(c.liveSuppliedGermanCapitalUnitIds.includes('eng'));
}

// Victory supply uses live normal projection, not stale UnitState snapshot or TEMPORARY_SUPPLY.
{
  let b=build();for(const u of Object.values(b.state.units))u.supplyState='OUT_OF_SUPPLY';assert.equal(condition(b).satisfied,true);
  b=build({edges:[rail(W,C1,{destroyed:true}),rail(C1,C2)]});for(const u of Object.values(b.state.units))u.supplyState='SUPPLIED';let c=condition(b);assert.equal(c.atLeastOneLiveSuppliedGermanCapitalUnit,false);assert.equal(c.satisfied,false);
  b=build({edges:[rail(W,C1,{destroyed:true}),rail(C1,C2)]});for(const u of Object.values(b.state.units)){u.supplyState='TEMPORARY_SUPPLY';u.temporarySupply=true;}c=condition(b);assert.equal(c.atLeastOneLiveSuppliedGermanCapitalUnit,false);
}

// Supplied German outside the capital does not satisfy the capital supply condition.
{
  const rules=rulesFor(0);const b=build({rules,edges:[rail(W,OUT)],units:[unit('g1','GERMAN','INFANTRY',C1,{supplyState:'SUPPLIED'}),unit('g2','GERMAN','INFANTRY',C2,{supplyState:'SUPPLIED'}),unit('outside','GERMAN','INFANTRY',OUT)]});
  const c=condition(b);assert.equal(c.atLeastOneLiveSuppliedGermanCapitalUnit,false);assert.equal(c.satisfied,false);
}

// Outer city/plain city are not targets unless explicitly configured; HexState.control is ignored.
{
  let b=build({units:[unit('g1','GERMAN','INFANTRY',C1),unit('outer','GERMAN','INFANTRY',OUTER)]});assert.equal(condition(b).satisfied,false);
  b=build({terrain:{[hk(PLAINCITY)]:'MAIN_CITY'},units:[unit('g1','GERMAN','INFANTRY',C1),unit('g2','GERMAN','INFANTRY',C2),unit('city','SOVIET','INFANTRY',PLAINCITY)]});assert.equal(condition(b).satisfied,true);
  b.state.hexes[hk(C1)].control='SOVIET';b.state.hexes[hk(C2)].control='SOVIET';assert.equal(condition(b).satisfied,true);
}

// Explainability is canonical and deterministic under core duplicates/order and unit insertion order.
{
  const scenario=scenarioFor({capitalCoreHexes:[C2,C1,C1]});
  const b1=build({scenario,units:[unit('z','GERMAN','ARTILLERY',C2),unit('b','GERMAN','INFANTRY',C2),unit('a','GERMAN','INFANTRY',C1)]});
  const b2=build({scenario,units:[unit('a','GERMAN','INFANTRY',C1),unit('b','GERMAN','INFANTRY',C2),unit('z','GERMAN','ARTILLERY',C2)]});
  const c1=condition(b1),c2=condition(b2);assert.deepEqual(c1,c2);assert.deepEqual(c1.coreHexKeys,[hk(C1),hk(C2)].sort());assert.deepEqual(c1.germanUnitIdsByCore[hk(C2)],['b','z']);
}

// Both pure APIs leave GameState unchanged, including state.victory when returning a winner.
{
  const b=build();b.state.turn=b.scenario.turnLimit;const before=structuredClone(b.state);
  const c=evaluateGermanCapitalVictoryCondition(b.state,b.rules,b.scenario);const v=evaluateVictoryAtCheckpoint(b.state,b.rules,b.scenario,'GERMAN_PLAYER_TURN_END');
  assert.equal(c.satisfied,true);assert.equal(v.winner,'GERMAN');assert.deepEqual(b.state,before);assert.deepEqual(b.state.victory,before.victory);
}

// Checkpoint timing before final turn and on final turn.
{
  let b=build();b.state.turn=b.scenario.turnLimit-1;
  let v=evaluateVictoryAtCheckpoint(b.state,b.rules,b.scenario,'GERMAN_PLAYER_TURN_END');assert.deepEqual(v,{winner:null,reason:null,turn:null,checkedAtPhase:b.state.phase});
  v=evaluateVictoryAtCheckpoint(b.state,b.rules,b.scenario,'SOVIET_PLAYER_TURN_END');assert.equal(v.winner,'GERMAN');assert.equal(v.reason,'GERMAN_CAPITAL_HELD_THROUGH_SOVIET_TURN');
  b=build({units:[unit('g1','GERMAN','INFANTRY',C1)]});b.state.turn=b.scenario.turnLimit-1;v=evaluateVictoryAtCheckpoint(b.state,b.rules,b.scenario,'SOVIET_PLAYER_TURN_END');assert.equal(v.winner,null);
  b=build();b.state.turn=b.scenario.turnLimit;v=evaluateVictoryAtCheckpoint(b.state,b.rules,b.scenario,'GERMAN_PLAYER_TURN_END');assert.equal(v.winner,'GERMAN');assert.equal(v.reason,'GERMAN_CAPITAL_CAPTURE_FINAL_TURN');
  b=build({units:[unit('g1','GERMAN','INFANTRY',C1)]});b.state.turn=b.scenario.turnLimit;v=evaluateVictoryAtCheckpoint(b.state,b.rules,b.scenario,'GERMAN_PLAYER_TURN_END');assert.equal(v.winner,'SOVIET');assert.equal(v.reason,'SOVIET_CAPITAL_DEFENDED_TO_TURN_LIMIT');
  b.state.turn=b.scenario.turnLimit+1;v=evaluateVictoryAtCheckpoint(b.state,b.rules,b.scenario,'GERMAN_PLAYER_TURN_END');assert.equal(v.winner,'SOVIET');
  b=build();b.state.turn=b.scenario.turnLimit;v=evaluateVictoryAtCheckpoint(b.state,b.rules,b.scenario,'SOVIET_PLAYER_TURN_END');assert.equal(v.winner,'SOVIET');assert.equal(v.reason,'SOVIET_CAPITAL_DEFENDED_TO_TURN_LIMIT');
}

// Custom turnLimit drives timing; default production limit stays 16.
{
  assert.equal(defaultScenario.turnLimit,16);
  const scenario=scenarioFor({turnLimit:3});let b=build({scenario});b.state.turn=2;
  assert.equal(evaluateVictoryAtCheckpoint(b.state,b.rules,scenario,'GERMAN_PLAYER_TURN_END').winner,null);
  assert.equal(evaluateVictoryAtCheckpoint(b.state,b.rules,scenario,'SOVIET_PLAYER_TURN_END').winner,'GERMAN');
  b.state.turn=3;assert.equal(evaluateVictoryAtCheckpoint(b.state,b.rules,scenario,'GERMAN_PLAYER_TURN_END').winner,'GERMAN');
  const fail=build({scenario,units:[unit('g1','GERMAN','INFANTRY',C1)]});fail.state.turn=3;assert.equal(evaluateVictoryAtCheckpoint(fail.state,fail.rules,scenario,'GERMAN_PLAYER_TURN_END').winner,'SOVIET');
}

// Empty/missing capital configuration and invalid turnLimit integrity. Duplicate core is harmless.
{
  let scenario=scenarioFor({capitalCoreHexes:[]});let b=build({scenario});assert.equal(condition(b).satisfied,false);assert(hasIssue(validateGameStateIntegrity(b.state,b.rules,scenario),'CAPITAL_CORE_HEXES_EMPTY'));
  scenario=scenarioFor({capitalCoreHexes:[C1,INVALID]});b=build({scenario});assert.equal(condition(b).satisfied,false);let issues=validateGameStateIntegrity(b.state,b.rules,scenario);assert(hasIssue(issues,'CAPITAL_CORE_HEX_INVALID'));assert(issues.find(x=>x.code==='CAPITAL_CORE_HEX_INVALID')?.details?.coreHexKey===hk(INVALID));
  for(const turnLimit of [0,-1,1.5]){scenario=scenarioFor({turnLimit});b=build({scenario});issues=validateGameStateIntegrity(b.state,b.rules,scenario);assert(hasIssue(issues,'TURN_LIMIT_INVALID'));}
  const dup=scenarioFor({capitalCoreHexes:[C1,C2,C1]});b=build({scenario:dup});assert.equal(condition(b).satisfied,true);assert.deepEqual(condition(b).coreHexKeys,[hk(C1),hk(C2)].sort());
}

console.log('Digital Branch Task 002E-1 Capital Victory Evaluation Core smoke checks passed.');

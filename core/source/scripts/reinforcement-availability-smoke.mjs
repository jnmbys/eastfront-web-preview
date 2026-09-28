import assert from 'node:assert/strict';
import {
  RulesEngine,
  computeLegalSovietReinforcementEntryHexKeys,
  createGameState,
  defaultRules,
  defaultScenario,
  deriveSovietReinforcementSlots,
  getAvailableSovietReinforcements,
  getCurrentTurnSovietReinforcements,
  getDelayedSovietReinforcements,
  getDeployedSovietReinforcementIds,
  hasDeployableSovietReinforcement,
  hexKey,
  makeEdge,
  validateGameStateIntegrity
} from '../dist/index.js';

const G='G-HUMAN-1',S='S-AI-1';
const H=(q,r)=>({q,r});
const hk=(h)=>hexKey(h);
const E=H(3,0),A=H(2,0),W=H(0,0),Z=H(3,-1),E2=H(3,3),A2=H(2,3),C=H(0,3),D=H(1,3);
const unique=(coords)=>[...new Map(coords.map(h=>[hk(h),h])).values()];
const hexes=(coords)=>unique(coords).map(coord=>({coord:{...coord},terrain:'PLAIN',control:null}));
const rail=(a,b,{destroyed=false,repairedBy=null,present=true}={})=>makeEdge(a,b,{railway:{present,destroyed,repairedBy}});
const controllers=[
  {id:G,side:'GERMAN',controllerType:'HUMAN'},
  {id:S,side:'SOVIET',controllerType:'AI'}
];
const scenarioFor=({exits=[E],sources=[],reinforcements=[{turn:4,units:['INFANTRY','INFANTRY']}],coords=[W,E,A,Z,C,D]}={})=>({
  ...defaultScenario,
  id:'reinforcement-availability-smoke',displayName:'Reinforcement Availability Smoke',
  board:{paperColumns:8,paperRows:8},controllers,initialUnits:[],deployment:undefined,
  germanWestRailEntries:[{...W}],sovietEastRailExits:exits.map(x=>({...x})),sovietSupplySources:sources.map(x=>({...x})),
  capitalCoreHexes:[],capitalOuterHexes:[],reinforcements:structuredClone(reinforcements)
});
const templateFor=(side,type)=>Object.values(defaultRules.unitTemplates).find(t=>t.side===side&&t.type===type);
function unit(id,side,type,hex,{alive=true,controllerId=side==='GERMAN'?G:S}={}){
  const t=templateFor(side,type);assert(t,`missing template ${side}/${type}`);
  return {id,templateId:t.id,side,type,step:0,alive,hex:{...hex},supplyState:'SUPPLIED',entrenched:false,hasMoved:false,hasAttacked:false,
    controllerId,temporarySupply:false,dedicatedRailRepair:false,reconZocIgnoreUsed:false,artillerySupportUsed:false,lastHQCommandTurn:null};
}
function build({coords=[W,E,A,Z,C,D],edges=[rail(E,A)],units=[],scenario=scenarioFor({coords}),rules=defaultRules,turn=4}={}){
  const state=createGameState({scenario,rules,hexes:hexes(coords),edges,units,seed:90210});
  state.turn=turn;state.phase='SOVIET_REINFORCEMENT_SUPPLY';state.activeSide='SOVIET';state.phaseReadyControllerIds=[];
  return {state,scenario,rules,engine:new RulesEngine(rules,scenario)};
}
function logDeploy(state,{reinforcementId,accepted,actionId='A-900001',entryHex=E,turn=state.turn}){
  state.actionLog.push({index:state.actionLog.length,actionId,turn,phase:'SOVIET_REINFORCEMENT_SUPPLY',
    action:{type:'DEPLOY_REINFORCEMENT',actionId,controllerId:S,reinforcementId,entryHex:{...entryHex}},accepted,
    validationCodes:accepted?[]:['RULE_NOT_IMPLEMENTED']});
}

// Default schedule expands to 13 unique deterministic slots with the locked turn distribution/IDs.
{
  const slots=deriveSovietReinforcementSlots(defaultScenario);
  assert.equal(slots.length,13);
  assert.equal(new Set(slots.map(s=>s.id)).size,13);
  assert.deepEqual([...new Set(slots.filter(s=>s.scheduledTurn===4).map(s=>s.id))].sort(),['S-R-T04-G01-U01','S-R-T04-G01-U02']);
  assert.deepEqual(Object.fromEntries([4,7,10,13,15].map(turn=>[turn,slots.filter(s=>s.scheduledTurn===turn).length])),{4:2,7:3,10:3,13:3,15:2});
  assert.deepEqual(deriveSovietReinforcementSlots(defaultScenario),slots);
}

// Availability is turn-based, persistent when delayed, schedule-order independent, and excludes future slots.
{
  const schedule=structuredClone(defaultScenario.reinforcements);
  const scenario={...defaultScenario,reinforcements:[schedule[2],schedule[0],schedule[1],schedule[3],schedule[4]]};
  const {state}=build({scenario:scenarioFor({reinforcements:scenario.reinforcements}),turn:3});
  assert.equal(getAvailableSovietReinforcements(state,scenarioFor({reinforcements:scenario.reinforcements})).length,0);
  state.turn=4;assert.equal(getAvailableSovietReinforcements(state,scenarioFor({reinforcements:scenario.reinforcements})).length,2);
  state.turn=7;
  const available=getAvailableSovietReinforcements(state,scenarioFor({reinforcements:scenario.reinforcements}));
  assert.equal(available.length,5);assert(available.every(s=>s.scheduledTurn<=7));assert(!available.some(s=>s.scheduledTurn===10));
  assert.equal(getDelayedSovietReinforcements(state,scenarioFor({reinforcements:scenario.reinforcements})).length,2);
  assert.equal(getCurrentTurnSovietReinforcements(state,scenarioFor({reinforcements:scenario.reinforcements})).length,3);
}

// Accepted deploy consumes permanently; rejected deploy does not. Unit death never returns an accepted slot.
{
  const {state,scenario}=build({turn:7});
  const id='S-R-T04-G01-U01';
  logDeploy(state,{reinforcementId:id,accepted:false,actionId:'A-900001'});
  assert(getAvailableSovietReinforcements(state,scenario).some(s=>s.id===id));
  logDeploy(state,{reinforcementId:id,accepted:true,actionId:'A-900002'});
  assert.deepEqual(getDeployedSovietReinforcementIds(state),[id]);
  assert(!getAvailableSovietReinforcements(state,scenario).some(s=>s.id===id));
  state.units[id]=unit(id,'SOVIET','INFANTRY',A,{alive:false});
  assert(!getAvailableSovietReinforcements(state,scenario).some(s=>s.id===id));
}

// Connected active East Exit with capacity is legal; no intact railway adjacency is inactive.
{
  let b=build();assert.deepEqual(computeLegalSovietReinforcementEntryHexKeys(b.state,b.rules,b.scenario),[hk(E)]);
  b=build({edges:[]});assert.deepEqual(computeLegalSovietReinforcementEntryHexKeys(b.state,b.rules,b.scenario),[]);
  b=build({edges:[rail(E,A,{destroyed:true})]});assert.deepEqual(computeLegalSovietReinforcementEntryHexKeys(b.state,b.rules,b.scenario),[]);
}

// Live German occupation blocks; dead/removed occupation reconnects automatically.
{
  let b=build({units:[unit('g-occ','GERMAN','INFANTRY',E)]});
  assert.deepEqual(computeLegalSovietReinforcementEntryHexKeys(b.state,b.rules,b.scenario),[]);
  b.state.units['g-occ'].alive=false;
  assert.deepEqual(computeLegalSovietReinforcementEntryHexKeys(b.state,b.rules,b.scenario),[hk(E)]);
}

// Canonical German ZOC blocks; a non-ZOC support unit adjacent to exit does not.
{
  let b=build({units:[unit('g-zoc','GERMAN','INFANTRY',Z)]});
  assert.deepEqual(computeLegalSovietReinforcementEntryHexKeys(b.state,b.rules,b.scenario),[]);
  b=build({units:[unit('g-art','GERMAN','ARTILLERY',Z)]});
  assert.equal(defaultRules.unitTemplates['G-ARTY'].exertsZoc,false);
  assert.deepEqual(computeLegalSovietReinforcementEntryHexKeys(b.state,b.rules,b.scenario),[hk(E)]);
}

// Stacking counts living units only and reads rules.stackingLimit rather than hard-coding 2.
{
  let b=build();assert.deepEqual(computeLegalSovietReinforcementEntryHexKeys(b.state,b.rules,b.scenario),[hk(E)]);
  b=build({units:[unit('s1','SOVIET','INFANTRY',E)]});assert.deepEqual(computeLegalSovietReinforcementEntryHexKeys(b.state,b.rules,b.scenario),[hk(E)]);
  b=build({units:[unit('s1','SOVIET','INFANTRY',E),unit('s2','SOVIET','INFANTRY',E)]});assert.deepEqual(computeLegalSovietReinforcementEntryHexKeys(b.state,b.rules,b.scenario),[]);
  b=build({units:[unit('dead','SOVIET','INFANTRY',E,{alive:false})]});assert.deepEqual(computeLegalSovietReinforcementEntryHexKeys(b.state,b.rules,b.scenario),[hk(E)]);
  const rules=structuredClone(defaultRules);rules.stackingLimit=1;
  b=build({rules,units:[unit('s1','SOVIET','INFANTRY',E)]});assert.deepEqual(computeLegalSovietReinforcementEntryHexKeys(b.state,rules,b.scenario),[]);
}

// Multiple exits produce unique sorted legal results; only the blocked exit disappears.
{
  const coords=[W,E,A,E2,A2,Z,C,D];const scenario=scenarioFor({exits:[E2,E],coords});
  const b=build({coords,scenario,edges:[rail(E,A),rail(E2,A2)],units:[unit('g-zoc','GERMAN','INFANTRY',Z)]});
  assert.deepEqual(computeLegalSovietReinforcementEntryHexKeys(b.state,b.rules,b.scenario),[hk(E2)]);
}

// Independent source/rail seed is not an entry unless Scenario also lists it as an East Exit.
{
  const scenario=scenarioFor({exits:[E],sources:[C],coords:[W,E,A,C,D]});
  const b=build({coords:[W,E,A,C,D],scenario,edges:[rail(E,A),rail(C,D)]});
  const legal=computeLegalSovietReinforcementEntryHexKeys(b.state,b.rules,b.scenario);
  assert.deepEqual(legal,[hk(E)]);assert(!legal.includes(hk(C)));
}

// All reinforcement queries are pure; deployability only combines schedule availability + board entry capacity.
{
  const b=build({turn:4});const before=structuredClone(b.state);
  deriveSovietReinforcementSlots(b.scenario);getAvailableSovietReinforcements(b.state,b.scenario);getDelayedSovietReinforcements(b.state,b.scenario);
  computeLegalSovietReinforcementEntryHexKeys(b.state,b.rules,b.scenario);assert.equal(hasDeployableSovietReinforcement(b.state,b.rules,b.scenario),true);
  assert.deepEqual(b.state,before);
  const noEntry=build({turn:4,edges:[]});assert.equal(hasDeployableSovietReinforcement(noEntry.state,noEntry.rules,noEntry.scenario),false);
  const noAvailable=build({turn:3});assert.equal(hasDeployableSovietReinforcement(noAvailable.state,noAvailable.rules,noAvailable.scenario),false);
}

// FA-002 protocol is recognized and 002D-2 now performs the canonical deployment transition.
{
  const b=build({turn:4});const beforeControllers=structuredClone(b.state.controllers);
  const input={type:'DEPLOY_REINFORCEMENT',controllerId:S,reinforcementId:'S-R-T04-G01-U01',entryHex:{...E}};
  const r=b.engine.apply(b.state,input);
  assert.equal(r.accepted,true);assert(r.state.units['S-R-T04-G01-U01']);assert.deepEqual(r.state.controllers,beforeControllers);
  assert.equal(r.state.actionLog.length,1);assert.equal(r.state.actionLog[0].action.type,'DEPLOY_REINFORCEMENT');assert.equal(r.state.actionLog[0].accepted,true);

  // Canonical accepted-action replay preserves action identity/counters/log/state deterministically.
  const fresh=build({turn:4});const replay=fresh.engine.apply(fresh.state,r.action);
  assert.equal(replay.accepted,true);assert.deepEqual(replay.events,r.events);assert.deepEqual(replay.state,r.state);assert.deepEqual(replay.state.idCounters,r.state.idCounters);
}

// Reinforcement schedule integrity: default resolves uniquely; unresolved/ambiguous template and invalid turn are explicit issues.
{
  const baseScenario=scenarioFor({reinforcements:defaultScenario.reinforcements});
  const b=build({scenario:baseScenario,coords:[W,E,A,Z,C,D],edges:[rail(E,A)]});
  const baseIssues=validateGameStateIntegrity(b.state,defaultRules,baseScenario).filter(i=>i.code.startsWith('SOVIET_REINFORCEMENT_'));
  assert.deepEqual(baseIssues,[]);

  const missingRules=structuredClone(defaultRules);delete missingRules.unitTemplates['S-INF'];
  const unresolved=validateGameStateIntegrity(b.state,missingRules,baseScenario);
  assert(unresolved.some(i=>i.code==='SOVIET_REINFORCEMENT_TEMPLATE_UNRESOLVED'&&i.details?.unitType==='INFANTRY'&&i.details?.reinforcementId));

  const ambiguousRules=structuredClone(defaultRules);ambiguousRules.unitTemplates['S-INF-ALT']={...ambiguousRules.unitTemplates['S-INF'],id:'S-INF-ALT'};
  const ambiguous=validateGameStateIntegrity(b.state,ambiguousRules,baseScenario);
  assert(ambiguous.some(i=>i.code==='SOVIET_REINFORCEMENT_TEMPLATE_AMBIGUOUS'&&i.details?.unitType==='INFANTRY'));

  const invalidScenario=scenarioFor({reinforcements:[{turn:0,units:['INFANTRY']}]});
  const invalidState=build({scenario:invalidScenario}).state;
  const invalid=validateGameStateIntegrity(invalidState,defaultRules,invalidScenario);
  assert(invalid.some(i=>i.code==='SOVIET_REINFORCEMENT_TURN_INVALID'));
}

console.log('Digital Branch Task 002D-1 Reinforcement Availability / FA-002 smoke checks passed.');

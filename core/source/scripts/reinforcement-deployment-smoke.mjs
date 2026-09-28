import assert from 'node:assert/strict';
import {
  RulesEngine,
  computeLegalSovietReinforcementEntryHexKeys,
  createGameState,
  defaultRules,
  defaultScenario,
  getAvailableSovietReinforcements,
  hasDeployableSovietReinforcement,
  hexKey,
  makeEdge
} from '../dist/index.js';

const G='G-HUMAN-1',S1='S-1',S2='S-2';
const H=(q,r)=>({q,r});
const E=H(3,0),A=H(2,0),W=H(0,0),Z=H(3,-1),C=H(0,3),D=H(1,3),X=H(5,5);
const hk=(h)=>hexKey(h);
const unique=(coords)=>[...new Map(coords.map(h=>[hk(h),h])).values()];
const hexes=(coords)=>unique(coords).map(coord=>({coord:{...coord},terrain:'PLAIN',control:null}));
const rail=(a,b,{destroyed=false,repairedBy=null,present=true}={})=>makeEdge(a,b,{railway:{present,destroyed,repairedBy}});
const controllers=(two=true)=>[
  {id:G,side:'GERMAN',controllerType:'HUMAN'},
  {id:S1,side:'SOVIET',controllerType:'HUMAN'},
  ...(two?[{id:S2,side:'SOVIET',controllerType:'AI'}]:[])
];
const scenarioFor=({reinforcements=[{turn:4,units:['INFANTRY']}],exits=[E],sources=[],twoControllers=true,coords=[W,E,A,Z,C,D,X]}={})=>({
  ...defaultScenario,
  id:'reinforcement-deployment-smoke',displayName:'Reinforcement Deployment Smoke',
  board:{paperColumns:10,paperRows:10},controllers:controllers(twoControllers),initialUnits:[],deployment:undefined,
  germanWestRailEntries:[{...W}],sovietEastRailExits:exits.map(x=>({...x})),sovietSupplySources:sources.map(x=>({...x})),
  capitalCoreHexes:[],capitalOuterHexes:[],reinforcements:structuredClone(reinforcements)
});
const templateFor=(side,type,rules=defaultRules)=>Object.values(rules.unitTemplates).find(t=>t.side===side&&t.type===type);
function unit(id,side,type,hex,{alive=true,controllerId=side==='GERMAN'?G:S1,supplyState='SUPPLIED'}={}){
  const t=templateFor(side,type);assert(t,`missing template ${side}/${type}`);
  return {id,templateId:t.id,side,type,step:0,alive,hex:{...hex},supplyState,entrenched:false,hasMoved:false,hasAttacked:false,
    controllerId,temporarySupply:false,dedicatedRailRepair:false,reconZocIgnoreUsed:false,artillerySupportUsed:false,lastHQCommandTurn:null};
}
function build({
  coords=[W,E,A,Z,C,D,X],edges=[rail(E,A)],units=[],scenario=scenarioFor(),rules=defaultRules,turn=4,twoControllers=true
}={}){
  if (!scenario) scenario=scenarioFor({twoControllers});
  const state=createGameState({scenario,rules,hexes:hexes(coords),edges,units,seed:424242});
  state.turn=turn;state.phase='SOVIET_REINFORCEMENT_SUPPLY';state.activeSide='SOVIET';state.phaseReadyControllerIds=[];
  return {state,scenario,rules,engine:new RulesEngine(rules,scenario)};
}
function deploy(engine,state,{controllerId=S1,reinforcementId='S-R-T04-G01-U01',entryHex=E,actionId}={}){
  return engine.apply(state,{type:'DEPLOY_REINFORCEMENT',...(actionId?{actionId}:{}),controllerId,reinforcementId,entryHex:{...entryHex}});
}
function reason(result,value){return result.issues.some(i=>i.details?.reason===value);}

// Basic deployment, exact UnitState initialization, slot consumption, and actor ownership (including a 0-live-unit controller).
{
  const b=build();
  assert.equal(Object.values(b.state.units).filter(u=>u.controllerId===S2&&u.alive).length,0);
  const r=deploy(b.engine,b.state,{controllerId:S2});
  assert.equal(r.accepted,true);assert.deepEqual(r.events,[]);
  const t=templateFor('SOVIET','INFANTRY');
  assert.deepEqual(r.state.units['S-R-T04-G01-U01'],{
    id:'S-R-T04-G01-U01',templateId:t.id,side:'SOVIET',type:'INFANTRY',step:0,alive:true,hex:{...E},supplyState:'OUT_OF_SUPPLY',
    entrenched:false,hasMoved:false,hasAttacked:false,controllerId:S2,temporarySupply:false,dedicatedRailRepair:false,reconZocIgnoreUsed:false,
    artillerySupportUsed:false,lastHQCommandTurn:null
  });
  assert(!getAvailableSovietReinforcements(r.state,b.scenario).some(x=>x.id==='S-R-T04-G01-U01'));
  assert.equal(r.state.idCounters.nextBattle,b.state.idCounters.nextBattle);
}

// Shared side-wide pool: different controllers permanently own the different slots they deploy.
{
  const scenario=scenarioFor({reinforcements:[{turn:4,units:['INFANTRY','INFANTRY']} ]});
  let b=build({scenario});
  let r=deploy(b.engine,b.state,{controllerId:S1,reinforcementId:'S-R-T04-G01-U01'});assert.equal(r.accepted,true);
  r=deploy(b.engine,r.state,{controllerId:S2,reinforcementId:'S-R-T04-G01-U02'});assert.equal(r.accepted,true);
  assert.equal(r.state.units['S-R-T04-G01-U01'].controllerId,S1);
  assert.equal(r.state.units['S-R-T04-G01-U02'].controllerId,S2);
}

// Unknown/future/already-deployed/collision are atomic and do not consume a slot on rejection.
{
  const scenario=scenarioFor({reinforcements:[{turn:4,units:['INFANTRY']},{turn:7,units:['TANK']}]});
  let b=build({scenario});
  let r=deploy(b.engine,b.state,{reinforcementId:'NO-SUCH-SLOT'});assert.equal(r.accepted,false);assert(reason(r,'REINFORCEMENT_SLOT_UNKNOWN'));
  r=deploy(b.engine,b.state,{reinforcementId:'S-R-T07-G02-U01'});assert.equal(r.accepted,false);assert(reason(r,'REINFORCEMENT_NOT_YET_AVAILABLE'));
  assert.equal(Object.keys(r.state.units).length,Object.keys(b.state.units).length);

  const good=deploy(b.engine,b.state);assert.equal(good.accepted,true);
  const again=deploy(b.engine,good.state);assert.equal(again.accepted,false);assert(reason(again,'REINFORCEMENT_ALREADY_DEPLOYED'));

  b=build({scenario});
  b.state.units['S-R-T04-G01-U01']=unit('S-R-T04-G01-U01','SOVIET','INFANTRY',C,{controllerId:S1});
  r=deploy(b.engine,b.state);assert.equal(r.accepted,false);assert(r.issues.some(i=>i.code==='DUPLICATE_ID'));
  assert(getAvailableSovietReinforcements(r.state,b.scenario).some(x=>x.id==='S-R-T04-G01-U01'));
}

// Wrong phase/controller/side.
{
  let b=build();
  let r=deploy(b.engine,b.state,{controllerId:'UNKNOWN'});assert.equal(r.accepted,false);assert(r.issues.some(i=>i.code==='INVALID_CONTROLLER'));
  r=deploy(b.engine,b.state,{controllerId:G});assert.equal(r.accepted,false);assert(r.issues.some(i=>i.code==='WRONG_SIDE'));
  b.state.phase='SOVIET_MOVEMENT';
  r=deploy(b.engine,b.state,{controllerId:S1});assert.equal(r.accepted,false);assert(r.issues.some(i=>i.code==='WRONG_PHASE'));
}

// Non-East entry (including an independent source), inactive East exit, occupation, ZOC, and non-ZOC support behavior.
{
  const scenario=scenarioFor({sources:[C]});
  let b=build({scenario,edges:[rail(E,A),rail(C,D)]});
  let r=deploy(b.engine,b.state,{entryHex:C});assert.equal(r.accepted,false);assert(reason(r,'REINFORCEMENT_ENTRY_NOT_EAST_EXIT'));

  b=build({scenario,edges:[rail(E,A,{destroyed:true}),rail(C,D)]});
  r=deploy(b.engine,b.state);assert.equal(r.accepted,false);assert(reason(r,'REINFORCEMENT_ENTRY_INACTIVE'));

  b=build({scenario,edges:[rail(E,A),rail(C,D)],units:[unit('g-occ','GERMAN','INFANTRY',E)]});
  r=deploy(b.engine,b.state);assert.equal(r.accepted,false);assert(r.issues.some(i=>i.code==='ENEMY_OCCUPIED_HEX'));

  b=build({scenario,edges:[rail(E,A),rail(C,D)],units:[unit('g-zoc','GERMAN','INFANTRY',Z)]});
  r=deploy(b.engine,b.state);assert.equal(r.accepted,false);assert(reason(r,'REINFORCEMENT_ENTRY_IN_GERMAN_ZOC'));

  b=build({scenario,edges:[rail(E,A),rail(C,D)],units:[unit('g-art','GERMAN','ARTILLERY',Z)]});
  assert.equal(defaultRules.unitTemplates['G-ARTY'].exertsZoc,false);
  r=deploy(b.engine,b.state);assert.equal(r.accepted,true);
}

// Sequential stacking reads current authoritative state; custom limit and dead units are handled correctly.
{
  const scenario=scenarioFor({reinforcements:[{turn:4,units:['INFANTRY','INFANTRY','INFANTRY']} ]});
  let b=build({scenario});
  let r=deploy(b.engine,b.state,{reinforcementId:'S-R-T04-G01-U01'});assert.equal(r.accepted,true);
  r=deploy(b.engine,r.state,{reinforcementId:'S-R-T04-G01-U02'});assert.equal(r.accepted,true);
  r=deploy(b.engine,r.state,{reinforcementId:'S-R-T04-G01-U03'});assert.equal(r.accepted,false);assert(r.issues.some(i=>i.code==='STACKING_LIMIT'));
  assert(getAvailableSovietReinforcements(r.state,scenario).some(x=>x.id==='S-R-T04-G01-U03'));

  const rules=structuredClone(defaultRules);rules.stackingLimit=1;
  b=build({rules,units:[unit('s-present','SOVIET','INFANTRY',E)]});
  r=deploy(b.engine,b.state);assert.equal(r.accepted,false);assert(r.issues.some(i=>i.code==='STACKING_LIMIT'));

  b=build({rules,units:[unit('s-dead','SOVIET','INFANTRY',E,{alive:false})]});
  r=deploy(b.engine,b.state);assert.equal(r.accepted,true);
}

// Rejected deployment does not consume the slot: retrying the same canonical reinforcement at a legal entry succeeds.
{
  const b=build();
  const bad=deploy(b.engine,b.state,{entryHex:C});assert.equal(bad.accepted,false);
  assert(getAvailableSovietReinforcements(bad.state,b.scenario).some(x=>x.id==='S-R-T04-G01-U01'));
  const good=deploy(b.engine,bad.state,{entryHex:E});assert.equal(good.accepted,true);
}

// Accepted deployment has narrow mutation scope and never performs an immediate Soviet supply refresh.
{
  const existing=unit('s-existing','SOVIET','INFANTRY',C,{supplyState:'OUT_OF_SUPPLY'});
  const b=build({units:[existing]});
  // Restore an intentionally stale snapshot after createGameState lifecycle normalization.
  b.state.units['s-existing'].supplyState='OUT_OF_SUPPLY';
  const before={edges:structuredClone(b.state.edges),existing:structuredClone(b.state.units['s-existing']),rp:structuredClone(b.state.rp),cp:structuredClone(b.state.cp),random:structuredClone(b.state.random),victory:structuredClone(b.state.victory)};
  const r=deploy(b.engine,b.state);assert.equal(r.accepted,true);
  assert.deepEqual(r.state.edges,before.edges);assert.deepEqual(r.state.units['s-existing'],before.existing);
  assert.deepEqual(r.state.rp,before.rp);assert.deepEqual(r.state.cp,before.cp);assert.deepEqual(r.state.random,before.random);assert.deepEqual(r.state.victory,before.victory);
  assert.equal(r.state.units['S-R-T04-G01-U01'].supplyState,'OUT_OF_SUPPLY');
  assert.equal(r.state.units['s-existing'].supplyState,'OUT_OF_SUPPLY');
}

// Ready/END_PHASE are rejected while any available reinforcement has a legal entry, without touching the barrier.
{
  for (const type of ['READY_FOR_PHASE_END','END_PHASE']) {
    const b=build();const before=[...b.state.phaseReadyControllerIds];
    const r=b.engine.apply(b.state,{type,controllerId:S1});
    assert.equal(r.accepted,false);assert(r.issues.some(i=>i.code==='INVALID_SUPPORT'));assert(reason(r,'DEPLOYABLE_REINFORCEMENT_REMAINS'));
    assert.deepEqual(r.state.phaseReadyControllerIds,before);
  }
}

// Available reinforcement with no legal entry may be delayed; Ready is accepted and slot stays available.
{
  const b=build({edges:[],twoControllers:false,scenario:scenarioFor({twoControllers:false})});
  assert.equal(hasDeployableSovietReinforcement(b.state,b.rules,b.scenario),false);
  const r=b.engine.apply(b.state,{type:'READY_FOR_PHASE_END',controllerId:S1});
  assert.equal(r.accepted,true);assert.equal(r.state.phase,'SOVIET_MOVEMENT');
  assert(getAvailableSovietReinforcements(r.state,b.scenario).some(x=>x.id==='S-R-T04-G01-U01'));
}

// Capacity can exhaust before the pool: remaining slot delays and Ready becomes legal.
{
  const rules=structuredClone(defaultRules);rules.stackingLimit=1;
  const scenario=scenarioFor({reinforcements:[{turn:4,units:['INFANTRY','INFANTRY']}],twoControllers:false});
  let b=build({rules,scenario,twoControllers:false});
  let r=deploy(b.engine,b.state,{reinforcementId:'S-R-T04-G01-U01'});assert.equal(r.accepted,true);
  assert.equal(hasDeployableSovietReinforcement(r.state,rules,scenario),false);
  assert(getAvailableSovietReinforcements(r.state,scenario).some(x=>x.id==='S-R-T04-G01-U02'));
  r=b.engine.apply(r.state,{type:'READY_FOR_PHASE_END',controllerId:S1});assert.equal(r.accepted,true);assert.equal(r.state.phase,'SOVIET_MOVEMENT');
}

// Reinforcement phase requires ALL Soviet controllers, even a 0-live-unit controller; other phases retain legacy live-owner semantics.
{
  const scenario=scenarioFor({reinforcements:[]});
  const b=build({scenario,units:[unit('s-live','SOVIET','INFANTRY',C,{controllerId:S1})]});
  let r=b.engine.apply(b.state,{type:'READY_FOR_PHASE_END',controllerId:S1});
  assert.equal(r.accepted,true);assert.equal(r.state.phase,'SOVIET_REINFORCEMENT_SUPPLY');
  r=b.engine.apply(r.state,{type:'READY_FOR_PHASE_END',controllerId:S2});
  assert.equal(r.accepted,true);assert.equal(r.state.phase,'SOVIET_MOVEMENT');
  // S2 still owns no live unit, so Movement requires only S1 and transitions immediately on S1 Ready.
  r=b.engine.apply(r.state,{type:'READY_FOR_PHASE_END',controllerId:S1});
  assert.equal(r.accepted,true);assert.equal(r.state.phase,'SOVIET_COMBAT');
}

// Controller receiving a reinforcement participates naturally in the following movement barrier; phase-exit refresh supplies the new unit.
{
  const scenario=scenarioFor({reinforcements:[{turn:4,units:['INFANTRY']} ]});
  let b=build({scenario,units:[unit('s-live','SOVIET','INFANTRY',C,{controllerId:S1})]});
  let r=deploy(b.engine,b.state,{controllerId:S2});assert.equal(r.accepted,true);
  assert.equal(r.state.units['S-R-T04-G01-U01'].supplyState,'OUT_OF_SUPPLY');
  r=b.engine.apply(r.state,{type:'READY_FOR_PHASE_END',controllerId:S1});assert.equal(r.accepted,true);assert.equal(r.state.phase,'SOVIET_REINFORCEMENT_SUPPLY');
  r=b.engine.apply(r.state,{type:'READY_FOR_PHASE_END',controllerId:S2});assert.equal(r.accepted,true);assert.equal(r.state.phase,'SOVIET_MOVEMENT');
  assert.equal(r.state.units['S-R-T04-G01-U01'].supplyState,'SUPPLIED');assert.equal(r.state.units['S-R-T04-G01-U01'].controllerId,S2);
  // Both now own live units, so S1 alone cannot end Movement.
  r=b.engine.apply(r.state,{type:'READY_FOR_PHASE_END',controllerId:S1});assert.equal(r.accepted,true);assert.equal(r.state.phase,'SOVIET_MOVEMENT');
  r=b.engine.apply(r.state,{type:'READY_FOR_PHASE_END',controllerId:S2});assert.equal(r.accepted,true);assert.equal(r.state.phase,'SOVIET_COMBAT');
}

// Canonical accepted deployment replay is deterministic and consumes only normal action identity.
{
  const b1=build({twoControllers:false,scenario:scenarioFor({twoControllers:false})});
  const first=deploy(b1.engine,b1.state,{controllerId:S1});assert.equal(first.accepted,true);
  const b2=build({twoControllers:false,scenario:scenarioFor({twoControllers:false})});
  const replay=b2.engine.apply(b2.state,first.action);
  assert.equal(replay.accepted,true);assert.deepEqual(replay.events,first.events);assert.deepEqual(replay.state,first.state);
  assert.deepEqual(replay.state.idCounters,first.state.idCounters);
  assert.equal(Object.keys(replay.state.idCounters).sort().join(','),'nextAction,nextBattle');
}

// Template resolution follows slot.type across all default reinforcement types, not an Infantry hard-code.
{
  for (const type of ['INFANTRY','ANTI_TANK','TANK','MOTORIZED','ELITE_INFANTRY']) {
    const scenario=scenarioFor({reinforcements:[{turn:4,units:[type]}],twoControllers:false});
    const b=build({scenario,twoControllers:false});
    const r=deploy(b.engine,b.state,{controllerId:S1});assert.equal(r.accepted,true,`deploy ${type}`);
    const u=r.state.units['S-R-T04-G01-U01'];
    assert.equal(u.type,type);assert.equal(u.templateId,templateFor('SOVIET',type).id);
  }
}

// Delayed reinforcement needs no queue: if an exit is blocked at T4 and restored later, the same slot deploys normally.
{
  const scenario=scenarioFor({twoControllers:false});
  let b=build({scenario,twoControllers:false,edges:[]});
  assert(getAvailableSovietReinforcements(b.state,scenario).some(x=>x.id==='S-R-T04-G01-U01'));
  const ready=b.engine.apply(b.state,{type:'READY_FOR_PHASE_END',controllerId:S1});assert.equal(ready.accepted,true);
  const later=structuredClone(ready.state);later.turn=7;later.phase='SOVIET_REINFORCEMENT_SUPPLY';later.activeSide='SOVIET';later.phaseReadyControllerIds=[];later.edges={};
  const e=rail(E,A);later.edges[e.key]=e;
  const engine=new RulesEngine(defaultRules,scenario);
  const r=deploy(engine,later,{controllerId:S1,reinforcementId:'S-R-T04-G01-U01'});assert.equal(r.accepted,true);
}

console.log('Digital Branch Task 002D-2 Reinforcement Deployment / Ready Barrier smoke checks passed.');

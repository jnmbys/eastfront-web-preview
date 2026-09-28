import assert from 'node:assert/strict';
import {
  RulesEngine,
  createGameState,
  defaultRules,
  defaultScenario,
  hexKey,
  makeEdge,
  replayHeadlessActions,
  runHeadlessGame
} from '../dist/index.js';

const H=(q,r)=>({q,r});
const W=H(0,0),C1=H(1,0),C2=H(2,0),X=H(3,0),E=H(4,0),GSAFE=H(0,2),SSAFE=H(4,2),MOVE_TO=H(0,1);
const G1='G1',G2='G2',S1='S1';
const allCoords=[W,C1,C2,X,E,GSAFE,SSAFE,MOVE_TO];
const rail=(a,b,{destroyed=false,repairedBy='GERMAN'}={})=>makeEdge(a,b,{railway:{present:true,destroyed,repairedBy}});
const edges=()=>[rail(W,C1),rail(C1,C2),rail(C2,X),rail(X,E)];
const hexes=()=>allCoords.map(coord=>({coord:{...coord},terrain:'PLAIN',control:null}));
const templateId=(side,type)=>({GERMAN:{INFANTRY:'G-INF'},SOVIET:{INFANTRY:'S-INF'}})[side][type];
function unit(id,side,hex,{controllerId=side==='GERMAN'?G1:S1,alive=true}={}){
  return {id,templateId:templateId(side,'INFANTRY'),side,type:'INFANTRY',step:0,alive,hex:{...hex},supplyState:'OUT_OF_SUPPLY',entrenched:false,hasMoved:false,hasAttacked:false,
    controllerId,temporarySupply:false,dedicatedRailRepair:false,reconZocIgnoreUsed:false,artillerySupportUsed:false,lastHQCommandTurn:null};
}
function controllers({g2=false}={}){
  return [
    {id:G1,side:'GERMAN',controllerType:'HUMAN'},
    ...(g2?[{id:G2,side:'GERMAN',controllerType:'AI'}]:[]),
    {id:S1,side:'SOVIET',controllerType:'HUMAN'}
  ];
}
function scenarioFor({turnLimit=2,g2=false,reinforcements=[]}={}){
  return {...defaultScenario,id:'headless-full-game-smoke',displayName:'Headless Full Game Smoke',board:{paperColumns:8,paperRows:6},turnLimit,
    controllers:controllers({g2}),initialUnits:[],deployment:undefined,germanWestRailEntries:[W],sovietEastRailExits:[E],sovietSupplySources:[E],capitalCoreHexes:[C1,C2],capitalOuterHexes:[],reinforcements};
}
function build({scenario=scenarioFor(),rules=structuredClone(defaultRules),units=[unit('g-safe','GERMAN',GSAFE),unit('s-c1','SOVIET',C1),unit('s-c2','SOVIET',C2)]}={}){
  const state=createGameState({scenario,rules,hexes:hexes(),edges:edges(),units,seed:22022});
  return {state,rules,scenario};
}
function readyForCurrentSide({state}){
  const ids=Object.values(state.controllers).filter(c=>c.side===state.activeSide).map(c=>c.id).sort();
  const controllerId=ids.find(id=>!state.phaseReadyControllerIds.includes(id));
  return controllerId?{type:'READY_FOR_PHASE_END',controllerId}:null;
}
const phasesOneTurn=[
  'GERMAN_SUPPLY_RAIL','GERMAN_MOVEMENT','GERMAN_COMBAT','GERMAN_RECOVERY','GERMAN_ENTRENCHMENT',
  'SOVIET_REINFORCEMENT_SUPPLY','SOVIET_MOVEMENT','SOVIET_COMBAT','SOVIET_RECOVERY','SOVIET_ENTRENCHMENT'
];

// 1. Complete lifecycle to Soviet GAME_OVER at final German checkpoint, with every phase reached through canonical Ready Actions.
let sovietRun;
let sovietInitial;
{
  const b=build({scenario:scenarioFor({turnLimit:2})});
  sovietInitial=structuredClone(b.state);
  const visited=[];
  sovietRun=runHeadlessGame(b.state,b.rules,b.scenario,(ctx)=>{visited.push(ctx.state.phase);return readyForCurrentSide(ctx);});
  assert.equal(sovietRun.terminationReason,'GAME_OVER');
  assert.equal(sovietRun.finalState.phase,'GAME_OVER');
  assert.equal(sovietRun.finalState.victory.winner,'SOVIET');
  assert.equal(sovietRun.finalState.victory.reason,'SOVIET_CAPITAL_DEFENDED_TO_TURN_LIMIT');
  assert.deepEqual(visited,[...phasesOneTurn,...phasesOneTurn.slice(0,5)]);
  assert.equal(sovietRun.actionsProcessed,15);
}

// 2. German full-game victory uses the same ready-only provider and respects 002E timing: German-end pre-final does not win; Soviet-end hold does.
let germanRun;
let germanInitial;
{
  const scenario=scenarioFor({turnLimit:2});
  const b=build({scenario,units:[unit('g-c1','GERMAN',C1),unit('g-c2','GERMAN',C2),unit('s-safe','SOVIET',SSAFE)]});
  germanInitial=structuredClone(b.state);
  const visited=[];
  germanRun=runHeadlessGame(b.state,b.rules,b.scenario,(ctx)=>{visited.push(ctx.state.phase);return readyForCurrentSide(ctx);});
  assert.equal(germanRun.terminationReason,'GAME_OVER');
  assert.equal(germanRun.finalState.victory.winner,'GERMAN');
  assert.equal(germanRun.finalState.victory.reason,'GERMAN_CAPITAL_HELD_THROUGH_SOVIET_TURN');
  assert.equal(germanRun.finalState.victory.turn,1);
  assert.deepEqual(visited,phasesOneTurn);
}

// 3. Aggregation invariants and canonical returned actions.
{
  const run=sovietRun;
  assert.equal(run.actionsProcessed,run.actionResults.length);
  assert.equal(run.canonicalActions.length,run.actionResults.length);
  assert.deepEqual(run.events,run.actionResults.flatMap(r=>r.events));
  assert.equal(run.acceptedActions+run.rejectedActions,run.actionsProcessed);
  assert.equal(run.rejectedActions,0);
  assert(run.canonicalActions.every(a=>typeof a.actionId==='string'&&a.actionId.length>0));
  assert.doesNotThrow(()=>JSON.stringify(run));
}

// 4. Provider receives defensive clones of state and previousResult; mutations cannot alter authoritative session state.
{
  const b=build();const original=structuredClone(b.state);let calls=0;
  const run=runHeadlessGame(b.state,b.rules,b.scenario,(ctx)=>{
    calls++;
    if(calls===1){const controllerId=ctx.state.activeSide==='GERMAN'?G1:S1;ctx.state.turn=999;delete ctx.state.units['g-safe'];return {type:'READY_FOR_PHASE_END',controllerId};}
    if(ctx.previousResult){ctx.previousResult.state.turn=888;delete ctx.previousResult.state.units['g-safe'];}
    return null;
  });
  assert.equal(run.terminationReason,'NO_ACTION');assert.equal(run.actionsProcessed,1);assert.equal(run.finalState.turn,1);assert(run.finalState.units['g-safe']);
  assert.deepEqual(b.state,original);
}

// 5. NO_ACTION before any intent.
{
  const b=build();let calls=0;const initial=structuredClone(b.state);
  const run=runHeadlessGame(b.state,b.rules,b.scenario,()=>{calls++;return null;});
  assert.equal(run.terminationReason,'NO_ACTION');assert.equal(run.actionsProcessed,0);assert.equal(calls,1);assert.deepEqual(run.finalState,initial);assert.deepEqual(b.state,initial);
}

// 6. ACTION_LIMIT terminates exactly at the configured accepted-action boundary when no GAME_OVER occurred.
{
  const b=build({scenario:scenarioFor({turnLimit:3})});
  const run=runHeadlessGame(b.state,b.rules,b.scenario,readyForCurrentSide,{maxActions:3});
  assert.equal(run.terminationReason,'ACTION_LIMIT');assert.equal(run.actionsProcessed,3);assert.notEqual(run.finalState.phase,'GAME_OVER');
  assert.throws(()=>runHeadlessGame(b.state,b.rules,b.scenario,()=>null,{maxActions:0}),/positive integer/);
  assert.throws(()=>runHeadlessGame(b.state,b.rules,b.scenario,()=>null,{maxActions:1.5}),/positive integer/);
}

// 7. GAME_OVER wins priority when the action that reaches it is exactly maxActions.
{
  const scenario=scenarioFor({turnLimit:2});const b=build({scenario,units:[unit('g-c1','GERMAN',C1),unit('g-c2','GERMAN',C2),unit('s-safe','SOVIET',SSAFE)]});
  b.state.turn=2;b.state.phase='GERMAN_COMBAT';b.state.activeSide='GERMAN';b.state.phaseReadyControllerIds=[];
  const run=runHeadlessGame(b.state,b.rules,b.scenario,readyForCurrentSide,{maxActions:3});
  assert.equal(run.actionsProcessed,3);assert.equal(run.terminationReason,'GAME_OVER');assert.equal(run.finalState.victory.winner,'GERMAN');
}

// 8. Rejected Actions remain canonical history by default and the session continues to the next legal Action.
let rejectedRun;
let rejectedInitial;
{
  const b=build();rejectedInitial=structuredClone(b.state);let i=0;
  rejectedRun=runHeadlessGame(b.state,b.rules,b.scenario,(ctx)=>{
    if(i++===0)return {type:'READY_FOR_PHASE_END',controllerId:'UNKNOWN'};
    if(i===2)return readyForCurrentSide(ctx);
    return null;
  });
  assert.equal(rejectedRun.terminationReason,'NO_ACTION');assert.equal(rejectedRun.actionsProcessed,2);assert.equal(rejectedRun.rejectedActions,1);assert.equal(rejectedRun.acceptedActions,1);
  assert.equal(rejectedRun.actionResults[0].accepted,false);assert.equal(rejectedRun.actionResults[1].accepted,true);
  assert(rejectedRun.events.some(e=>e.type==='ActionRejected'));
}

// 9. stopOnRejectedAction stops on the first rejection.
{
  const b=build();const run=runHeadlessGame(b.state,b.rules,b.scenario,()=>({type:'READY_FOR_PHASE_END',controllerId:'UNKNOWN'}),{stopOnRejectedAction:true});
  assert.equal(run.terminationReason,'REJECTED_ACTION');assert.equal(run.actionsProcessed,1);assert.equal(run.rejectedActions,1);
}

// 10. Initial GAME_OVER/winner terminates without calling the provider.
{
  const b=build();b.state.phase='GAME_OVER';b.state.victory={winner:'SOVIET',reason:'TEST',turn:1,checkedAtPhase:'GERMAN_ENTRENCHMENT'};let calls=0;
  const run=runHeadlessGame(b.state,b.rules,b.scenario,()=>{calls++;return null;});
  assert.equal(run.terminationReason,'GAME_OVER');assert.equal(run.actionsProcessed,0);assert.equal(calls,0);
}

// 11. Integrity policy stops invalid initial state when enabled and can be explicitly disabled.
{
  const b=build();const invalid=structuredClone(b.state);invalid.units['g-safe'].hex={q:99,r:99};let calls=0;
  let run=runHeadlessGame(invalid,b.rules,b.scenario,()=>{calls++;return null;});
  assert.equal(run.terminationReason,'INTEGRITY_FAILURE');assert.equal(run.actionsProcessed,0);assert(run.integrityIssues.length>0);assert.equal(calls,0);
  run=runHeadlessGame(invalid,b.rules,b.scenario,()=>null,{validateIntegrityAfterEachAction:false});
  assert.equal(run.terminationReason,'NO_ACTION');assert.equal(run.integrityIssues.length,0);
}

// 12. Exact replay of a complete full game reproduces state, results, events, RNG, ids, log, and victory without mutating caller inputs.
{
  const canonicalBefore=structuredClone(sovietRun.canonicalActions);const initialBefore=structuredClone(sovietInitial);
  const replay=replayHeadlessActions(sovietInitial,defaultRules,scenarioFor({turnLimit:2}),sovietRun.canonicalActions);
  assert.deepEqual(replay.finalState,sovietRun.finalState);assert.deepEqual(replay.events,sovietRun.events);assert.deepEqual(replay.actionResults,sovietRun.actionResults);
  assert.deepEqual(replay.finalState.random,sovietRun.finalState.random);assert.deepEqual(replay.finalState.idCounters,sovietRun.finalState.idCounters);
  assert.deepEqual(replay.finalState.actionLog,sovietRun.finalState.actionLog);assert.deepEqual(replay.finalState.victory,sovietRun.finalState.victory);
  assert.deepEqual(sovietRun.canonicalActions,canonicalBefore);assert.deepEqual(sovietInitial,initialBefore);
}

// 13. Rejected canonical intent also replays exactly.
{
  const b=build();const replay=replayHeadlessActions(rejectedInitial,b.rules,b.scenario,rejectedRun.canonicalActions);
  assert.deepEqual(replay.finalState,rejectedRun.finalState);assert.deepEqual(replay.events,rejectedRun.events);assert.deepEqual(replay.actionResults,rejectedRun.actionResults);
}

// 14. Replay does not truncate a canonical list after GAME_OVER; post-game rejection is replayed too.
{
  const scenario=scenarioFor({turnLimit:2});const b=build({scenario,units:[unit('g-c1','GERMAN',C1),unit('g-c2','GERMAN',C2),unit('s-safe','SOVIET',SSAFE)]});
  b.state.turn=2;b.state.phase='GERMAN_ENTRENCHMENT';b.state.activeSide='GERMAN';b.state.phaseReadyControllerIds=[];
  const initial=structuredClone(b.state);const engine=new RulesEngine(b.rules,b.scenario);
  const win=engine.apply(b.state,{type:'READY_FOR_PHASE_END',controllerId:G1});assert.equal(win.state.phase,'GAME_OVER');
  const post=engine.apply(win.state,{type:'MOVE',controllerId:G1,unitId:'g-c1',path:[C2]});assert.equal(post.accepted,false);
  const replay=replayHeadlessActions(initial,b.rules,b.scenario,[win.action,post.action]);
  assert.equal(replay.actionResults.length,2);assert.deepEqual(replay.finalState,post.state);assert.deepEqual(replay.events,[...win.events,...post.events]);
}

// 15. Multiplayer Ready remains entirely RulesEngine-owned: runner/provider must submit both German controllers separately.
{
  const scenario=scenarioFor({turnLimit:3,g2:true});const units=[unit('g1','GERMAN',GSAFE,{controllerId:G1}),unit('g2','GERMAN',MOVE_TO,{controllerId:G2}),unit('s1','SOVIET',C1)];
  const b=build({scenario,units});const seen=[];
  const run=runHeadlessGame(b.state,b.rules,b.scenario,(ctx)=>{seen.push(ctx.state.phase);return readyForCurrentSide(ctx);},{maxActions:2});
  assert.deepEqual(seen,['GERMAN_SUPPLY_RAIL','GERMAN_SUPPLY_RAIL']);assert.equal(run.actionsProcessed,2);assert.equal(run.finalState.phase,'GERMAN_MOVEMENT');
}

// 16. Reinforcement blocker regression: runner records RulesEngine rejection and never auto-deploys/skips it.
{
  const scenario=scenarioFor({turnLimit:3,reinforcements:[{turn:1,units:['INFANTRY']}]});const b=build({scenario,units:[unit('g-safe','GERMAN',GSAFE),unit('s-safe','SOVIET',SSAFE)]});
  b.state.phase='SOVIET_REINFORCEMENT_SUPPLY';b.state.activeSide='SOVIET';b.state.phaseReadyControllerIds=[];let i=0;
  const run=runHeadlessGame(b.state,b.rules,b.scenario,()=>i++===0?{type:'READY_FOR_PHASE_END',controllerId:S1}:null);
  assert.equal(run.terminationReason,'NO_ACTION');assert.equal(run.actionsProcessed,1);assert.equal(run.rejectedActions,1);assert.equal(run.actionResults[0].accepted,false);
  assert(run.actionResults[0].issues.some(x=>x.details?.reason==='DEPLOYABLE_REINFORCEMENT_REMAINS'));assert.equal(run.finalState.units['S-R-T01-G01-U01'],undefined);
}

console.log('Digital Branch Task 002F-1 Headless Full Game Session Harness smoke checks passed.');

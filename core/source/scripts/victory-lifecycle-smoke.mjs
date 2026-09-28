import assert from 'node:assert/strict';
import {
  RulesEngine,
  createGameState,
  defaultRules,
  defaultScenario,
  hexKey,
  makeEdge
} from '../dist/index.js';

const H=(q,r)=>({q,r});
const W=H(0,0),C1=H(1,0),C2=H(2,0),E=H(6,0),EA=H(5,0),GSAFE=H(0,2),SSAFE=H(6,2),MOVE_TO=H(0,1);
const hk=hexKey;
const G1='G1',G2='G2',S1='S1',S2='S2';
const allCoords=[W,C1,C2,E,EA,GSAFE,SSAFE,MOVE_TO];
const rail=(a,b,{destroyed=false,repairedBy='GERMAN'}={})=>makeEdge(a,b,{railway:{present:true,destroyed,repairedBy}});
const controllers=({g2=false,s2=false}={})=>[
  {id:G1,side:'GERMAN',controllerType:'HUMAN'},
  ...(g2?[{id:G2,side:'GERMAN',controllerType:'AI'}]:[]),
  {id:S1,side:'SOVIET',controllerType:'HUMAN'},
  ...(s2?[{id:S2,side:'SOVIET',controllerType:'AI'}]:[])
];
const templateId=(side,type)=>({
  GERMAN:{INFANTRY:'G-INF',ARTILLERY:'G-ARTY'},
  SOVIET:{INFANTRY:'S-INF',ARTILLERY:'S-ARTY'}
})[side][type];
function unit(id,side,type,hex,{controllerId=side==='GERMAN'?G1:S1,alive=true,supplyState='OUT_OF_SUPPLY',temporarySupply=false}={}){
  return {id,templateId:templateId(side,type),side,type,step:0,alive,hex:{...hex},supplyState,entrenched:false,hasMoved:false,hasAttacked:false,
    controllerId,temporarySupply,dedicatedRailRepair:false,reconZocIgnoreUsed:false,artillerySupportUsed:false,lastHQCommandTurn:null};
}
const scenarioFor=(overrides={})=>({
  ...defaultScenario,
  id:'victory-lifecycle-smoke',displayName:'Victory Lifecycle Smoke',board:{paperColumns:10,paperRows:10},
  controllers:controllers(),initialUnits:[],deployment:undefined,germanWestRailEntries:[W],sovietEastRailExits:[E],sovietSupplySources:[],
  capitalCoreHexes:[C1,C2],capitalOuterHexes:[],reinforcements:[],...overrides
});
const hexes=()=>allCoords.map(coord=>({coord:{...coord},terrain:'PLAIN',control:null}));
const defaultEdges=()=>[rail(W,C1),rail(C1,C2),rail(E,EA,{repairedBy:null})];
const capitalUnits=({g2=false,s2=false,includeSovietRemote=true}={})=>[
  unit('g-c1','GERMAN','INFANTRY',C1,{controllerId:G1}),
  unit('g-c2','GERMAN','INFANTRY',C2,{controllerId:g2?G2:G1}),
  unit('g-safe','GERMAN','INFANTRY',GSAFE,{controllerId:G1}),
  ...(includeSovietRemote?[unit('s-safe','SOVIET','INFANTRY',SSAFE,{controllerId:S1})]:[]),
  ...(s2?[unit('s2-safe','SOVIET','INFANTRY',E,{controllerId:S2})]:[])
];
function build({scenario=scenarioFor(),rules=structuredClone(defaultRules),units=capitalUnits(),edges=defaultEdges(),turn=1,phase='GERMAN_ENTRENCHMENT',activeSide='GERMAN'}={}){
  const state=createGameState({scenario,rules,hexes:hexes(),edges,units,seed:22021});
  state.turn=turn;state.phase=phase;state.activeSide=activeSide;state.phaseReadyControllerIds=[];state.victory={winner:null,reason:null,turn:null,checkedAtPhase:null};
  return {state,rules,scenario,engine:new RulesEngine(rules,scenario)};
}
const ready=(b,state,controllerId,type='READY_FOR_PHASE_END',actionId)=>b.engine.apply(state,{type,controllerId,...(actionId?{actionId}:{})});
const reason=(r,name)=>r.issues.some(i=>i.details?.reason===name);
const eventTypes=(r)=>r.events.map(e=>e.type);
const phaseEnded=(r)=>r.events.find(e=>e.type==='PhaseEnded');

// 1. Pre-final German-end success does not end the game.
{
  const scenario=scenarioFor({turnLimit:3});const b=build({scenario,turn:2});
  const r=ready(b,b.state,G1);assert.equal(r.accepted,true);assert.equal(r.state.victory.winner,null);assert.equal(r.state.phase,'SOVIET_REINFORCEMENT_SUPPLY');
}

// 2. Pre-final Soviet-end hold wins without turn increment.
{
  const scenario=scenarioFor({turnLimit:3});const b=build({scenario,turn:2,phase:'SOVIET_ENTRENCHMENT',activeSide:'SOVIET'});
  const r=ready(b,b.state,S1);assert.equal(r.accepted,true);assert.equal(r.state.victory.winner,'GERMAN');assert.equal(r.state.victory.reason,'GERMAN_CAPITAL_HELD_THROUGH_SOVIET_TURN');
  assert.equal(r.state.phase,'GAME_OVER');assert.equal(r.state.turn,2);
}

// 3. Soviet breaks the condition: normal next German turn starts.
{
  const scenario=scenarioFor({turnLimit:3});const units=[...capitalUnits(),unit('s-core','SOVIET','INFANTRY',C2)];
  const b=build({scenario,units,turn:2,phase:'SOVIET_ENTRENCHMENT',activeSide:'SOVIET'});
  const r=ready(b,b.state,S1);assert.equal(r.accepted,true);assert.equal(r.state.victory.winner,null);assert.equal(r.state.turn,3);assert.equal(r.state.phase,'GERMAN_SUPPLY_RAIL');
  assert(eventTypes(r).includes('GameTurnStarted'));assert(eventTypes(r).includes('PlayerTurnStarted'));
}

// 4-5. Final German success/failure immediately ends the game.
{
  const scenario=scenarioFor({turnLimit:3});let b=build({scenario,turn:3});let r=ready(b,b.state,G1);
  assert.equal(r.state.victory.winner,'GERMAN');assert.equal(r.state.victory.reason,'GERMAN_CAPITAL_CAPTURE_FINAL_TURN');assert.equal(r.state.phase,'GAME_OVER');
  b=build({scenario,turn:3,units:[unit('g-c1','GERMAN','INFANTRY',C1),unit('s-safe','SOVIET','INFANTRY',SSAFE)]});r=ready(b,b.state,G1);
  assert.equal(r.state.victory.winner,'SOVIET');assert.equal(r.state.victory.reason,'SOVIET_CAPITAL_DEFENDED_TO_TURN_LIMIT');assert.equal(r.state.phase,'GAME_OVER');
}

// 6. German multiplayer barrier checks victory only on the final required Ready.
{
  const scenario=scenarioFor({turnLimit:3,controllers:controllers({g2:true})});const b=build({scenario,turn:3,units:capitalUnits({g2:true})});
  let r=ready(b,b.state,G1);assert.equal(r.accepted,true);assert.equal(r.state.phase,'GERMAN_ENTRENCHMENT');assert.equal(r.state.victory.winner,null);
  r=ready(b,r.state,G2);assert.equal(r.accepted,true);assert.equal(r.state.phase,'GAME_OVER');assert.equal(r.state.victory.winner,'GERMAN');
}

// 7. Soviet multiplayer barrier checks victory only on the final required Ready.
{
  const scenario=scenarioFor({turnLimit:3,controllers:controllers({s2:true})});const b=build({scenario,turn:2,phase:'SOVIET_ENTRENCHMENT',activeSide:'SOVIET',units:capitalUnits({s2:true})});
  let r=ready(b,b.state,S1);assert.equal(r.accepted,true);assert.equal(r.state.phase,'SOVIET_ENTRENCHMENT');assert.equal(r.state.victory.winner,null);
  r=ready(b,r.state,S2);assert.equal(r.accepted,true);assert.equal(r.state.phase,'GAME_OVER');assert.equal(r.state.victory.winner,'GERMAN');
}

// 8-14. Winning event/state semantics: PhaseEnded->GAME_OVER, no turn-start events, Ready first, checkpoint preserved, barrier cleared, activeSide preserved.
for (const cfg of [
  {phase:'GERMAN_ENTRENCHMENT',activeSide:'GERMAN',turn:3,controller:G1,winner:'GERMAN'},
  {phase:'SOVIET_ENTRENCHMENT',activeSide:'SOVIET',turn:2,controller:S1,winner:'GERMAN'}
]) {
  const scenario=scenarioFor({turnLimit:3});const b=build({scenario,turn:cfg.turn,phase:cfg.phase,activeSide:cfg.activeSide});const r=ready(b,b.state,cfg.controller);
  assert.equal(r.state.victory.winner,cfg.winner);assert.deepEqual(phaseEnded(r),{type:'PhaseEnded',actionId:r.actionId,previousPhase:cfg.phase,nextPhase:'GAME_OVER',turn:cfg.turn});
  assert(!eventTypes(r).includes('PlayerTurnStarted'));assert(!eventTypes(r).includes('GameTurnStarted'));
  assert.deepEqual(eventTypes(r).slice(0,2),['ControllerReadyForPhaseEnd','PhaseEnded']);
  assert.equal(r.state.victory.checkedAtPhase,cfg.phase);assert.deepEqual(r.state.phaseReadyControllerIds,[]);assert.equal(r.state.activeSide,cfg.activeSide);
}

// 15. Winning checkpoint calls endPlayerTurn() and deactivates current-side commitments.
{
  const scenario=scenarioFor({turnLimit:3});const b=build({scenario,turn:3});
  b.state.unitCommitments.c={id:'c',grantActionId:'A-C',battleId:'B-C',grantorControllerId:G1,authorizedControllerId:G1,unitIds:['g-c1'],createdTurn:3,createdPhase:'GERMAN_COMBAT',active:true};
  const r=ready(b,b.state,G1);assert.equal(r.state.unitCommitments.c.active,false);
}

// 16. Winning short-circuit does not run next-side supply/player-turn hooks.
{
  const scenario=scenarioFor({turnLimit:3});let b=build({scenario,turn:3});
  b.state.units['s-safe'].supplyState='TEMPORARY_SUPPLY';b.state.units['s-safe'].temporarySupply=true;
  let r=ready(b,b.state,G1);assert.equal(r.state.phase,'GAME_OVER');assert.equal(r.state.units['s-safe'].supplyState,'TEMPORARY_SUPPLY');assert.equal(r.state.units['s-safe'].temporarySupply,true);
  b=build({scenario,turn:2,phase:'SOVIET_ENTRENCHMENT',activeSide:'SOVIET'});b.state.units['g-c1'].supplyState='OUT_OF_SUPPLY';
  r=ready(b,b.state,S1);assert.equal(r.state.phase,'GAME_OVER');assert.equal(r.state.units['g-c1'].supplyState,'OUT_OF_SUPPLY');
}

// 17-18. Lifecycle uses live supply: stale OOS can win when live supplied; stale SUPPLIED loses when live disconnected.
{
  const scenario=scenarioFor({turnLimit:3});let b=build({scenario,turn:3});for(const u of Object.values(b.state.units))if(u.side==='GERMAN')u.supplyState='OUT_OF_SUPPLY';
  let r=ready(b,b.state,G1);assert.equal(r.state.victory.winner,'GERMAN');
  b=build({scenario,turn:3,edges:[rail(W,C1,{destroyed:true}),rail(C1,C2),rail(E,EA,{repairedBy:null})]});for(const u of Object.values(b.state.units))if(u.side==='GERMAN')u.supplyState='SUPPLIED';
  r=ready(b,b.state,G1);assert.equal(r.state.victory.winner,'SOVIET');assert.equal(r.state.victory.reason,'SOVIET_CAPITAL_DEFENDED_TO_TURN_LIMIT');
}

// 19-22. GAME_OVER is terminal for MOVE/READY/DEPLOY and even for a winner-bearing state with a non-GAME_OVER phase.
{
  const scenario=scenarioFor({turnLimit:3,reinforcements:[{turn:3,units:['INFANTRY']}]});const b=build({scenario,turn:3});const win=ready(b,b.state,G1);assert.equal(win.state.phase,'GAME_OVER');
  const beforePos=structuredClone(win.state.units['g-safe'].hex);let r=b.engine.apply(win.state,{type:'MOVE',controllerId:G1,unitId:'g-safe',path:[MOVE_TO]});
  assert.equal(r.accepted,false);assert(r.issues.some(i=>i.code==='WRONG_PHASE'));assert(reason(r,'GAME_OVER'));assert.deepEqual(r.state.units['g-safe'].hex,beforePos);
  r=b.engine.apply(win.state,{type:'READY_FOR_PHASE_END',controllerId:G1});assert.equal(r.accepted,false);assert(reason(r,'GAME_OVER'));
  r=b.engine.apply(win.state,{type:'DEPLOY_REINFORCEMENT',controllerId:S1,reinforcementId:'S-R-T03-G01-U01',entryHex:E});assert.equal(r.accepted,false);assert(reason(r,'GAME_OVER'));assert.equal(r.state.units['S-R-T03-G01-U01'],undefined);
  const defensive=structuredClone(win.state);defensive.phase='GERMAN_MOVEMENT';defensive.activeSide='GERMAN';
  r=b.engine.apply(defensive,{type:'MOVE',controllerId:G1,unitId:'g-safe',path:[MOVE_TO]});assert.equal(r.accepted,false);assert(reason(r,'GAME_OVER'));
}

// 23. Rejected post-game action is deterministic across fresh copies.
{
  const scenario=scenarioFor({turnLimit:3});const b=build({scenario,turn:3});const win=ready(b,b.state,G1);const initial=structuredClone(win.state);
  const a={type:'MOVE',controllerId:G1,unitId:'g-safe',path:[MOVE_TO]};const r1=b.engine.apply(structuredClone(initial),a);const r2=b.engine.apply(structuredClone(initial),r1.action);
  assert.equal(r1.accepted,false);assert.deepEqual(r2.events,r1.events);assert.deepEqual(r2.state,r1.state);assert.deepEqual(r2.action,r1.action);
}

// 24. Duplicate canonical actionId keeps Foundation ACTION_ID_DUPLICATE semantics and does not append a second log entry.
{
  const scenario=scenarioFor({turnLimit:3});const b=build({scenario,turn:3});const win=ready(b,b.state,G1);const first=b.engine.apply(win.state,{type:'MOVE',controllerId:G1,unitId:'g-safe',path:[MOVE_TO]});
  const logLength=first.state.actionLog.length;const dup=b.engine.apply(first.state,first.action);assert.equal(dup.accepted,false);assert(dup.issues.some(i=>i.code==='ACTION_ID_DUPLICATE'));assert.equal(dup.state.actionLog.length,logLength);
}

// 25. Non-final phases never evaluate/write Victory even when the capital condition is already satisfied at the final turn.
for (const cfg of [
  {phase:'GERMAN_RECOVERY',side:'GERMAN',controller:G1,next:'GERMAN_ENTRENCHMENT'},
  {phase:'SOVIET_COMBAT',side:'SOVIET',controller:S1,next:'SOVIET_RECOVERY'}
]) {
  const scenario=scenarioFor({turnLimit:3});const b=build({scenario,turn:3,phase:cfg.phase,activeSide:cfg.side});const r=ready(b,b.state,cfg.controller);
  assert.equal(r.accepted,true);assert.equal(r.state.victory.winner,null);assert.equal(r.state.phase,cfg.next);
}

// 26. PendingDecision blocks final phase-end before Victory evaluation.
{
  const scenario=scenarioFor({turnLimit:3});const b=build({scenario,turn:3});
  b.state.pendingDecision={battleId:'B-P',side:'GERMAN',decisionOwnerControllerId:G1,eligibleControllerIds:[G1],kind:'ADVANCE_AFTER_COMBAT',eligibleUnitIds:['g-c1']};
  const r=ready(b,b.state,G1);assert.equal(r.accepted,false);assert(r.issues.some(i=>i.code==='PENDING_DECISION_BLOCKS_ACTION'));assert.equal(r.state.victory.winner,null);assert.equal(r.state.phase,'GERMAN_ENTRENCHMENT');
}

// 27. Custom turnLimit lifecycle is read from scenario, never hard-coded.
{
  const scenario=scenarioFor({turnLimit:3});
  let b=build({scenario,turn:2});let r=ready(b,b.state,G1);assert.equal(r.state.phase,'SOVIET_REINFORCEMENT_SUPPLY');assert.equal(r.state.victory.winner,null);
  b=build({scenario,turn:2,phase:'SOVIET_ENTRENCHMENT',activeSide:'SOVIET'});r=ready(b,b.state,S1);assert.equal(r.state.phase,'GAME_OVER');assert.equal(r.state.victory.winner,'GERMAN');
  b=build({scenario,turn:3});r=ready(b,b.state,G1);assert.equal(r.state.victory.winner,'GERMAN');
  b=build({scenario,turn:3,units:[unit('g-c1','GERMAN','INFANTRY',C1),unit('s-safe','SOVIET','INFANTRY',SSAFE)]});r=ready(b,b.state,G1);assert.equal(r.state.victory.winner,'SOVIET');
}

// 28. Canonical replay of a winning final Ready is fully deterministic.
{
  const scenario=scenarioFor({turnLimit:3});const b1=build({scenario,turn:3});const first=ready(b1,b1.state,G1);assert.equal(first.accepted,true);assert.equal(first.state.phase,'GAME_OVER');
  const b2=build({scenario,turn:3});const replay=b2.engine.apply(b2.state,first.action);assert.equal(replay.accepted,true);assert.deepEqual(replay.state,first.state);assert.deepEqual(replay.events,first.events);assert.deepEqual(replay.state.idCounters,first.state.idCounters);
}

console.log('Digital Branch Task 002E-2 Victory Lifecycle / GAME_OVER smoke checks passed.');

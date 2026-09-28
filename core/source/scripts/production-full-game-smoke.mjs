import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  computeLegalSovietReinforcementEntryHexKeys,
  createDeploymentGameState,
  defaultRules,
  defaultScenario,
  deploymentHexKeysForSide,
  deriveSovietReinforcementSlots,
  getAvailableSovietReinforcements,
  getDeployedSovietReinforcementIds,
  importLegacyMap,
  replayHeadlessActions,
  runHeadlessGame,
  validateGameStateIntegrity
} from '../dist/index.js';

const raw=JSON.parse(fs.readFileSync(new URL('../reference/strategic-reset-f-map.json',import.meta.url),'utf8'));
const imported=importLegacyMap(raw);
const scenario=defaultScenario;
const rules=defaultRules;
assert(scenario.deployment,'defaultScenario.deployment must be configured');
assert.equal(scenario.turnLimit,16,'production full-game smoke must use the real turn limit');

const roster=[...scenario.deployment.units];
const sovietRosterIds=roster.filter((u)=>u.side==='SOVIET').map((u)=>u.id).sort();
const germanRosterIds=roster.filter((u)=>u.side==='GERMAN').map((u)=>u.id).sort();
assert.equal(sovietRosterIds.length,32);
assert.equal(germanRosterIds.length,26);

const fresh=()=>createDeploymentGameState({
  scenario,
  rules,
  hexes:imported.hexes,
  edges:imported.edges,
  seed:17
});

const planFor=(state,side,ids)=>{
  const zone=deploymentHexKeysForSide(state,scenario,side);
  assert(zone.length*rules.stackingLimit>=ids.length,`${side} setup zone lacks stacking capacity`);
  const plan={};
  ids.forEach((id,index)=>{
    const key=zone[Math.floor(index/rules.stackingLimit)];
    assert(key&&state.hexes[key],`missing setup hex for ${id}`);
    plan[id]={...state.hexes[key].coord};
  });
  return plan;
};

const initialTemplate=fresh();
assert.deepEqual(validateGameStateIntegrity(initialTemplate,rules,scenario),[]);
const sovietPlan=planFor(initialTemplate,'SOVIET',sovietRosterIds);
const germanPlan=planFor(initialTemplate,'GERMAN',germanRosterIds);

function controllerIdsForSide(state,side) {
  return Object.values(state.controllers).filter((c)=>c.side===side).map((c)=>c.id).sort();
}

function makePassiveProvider() {
  const reinforcementDecisions=[];
  return {
    reinforcementDecisions,
    provider:({state})=>{
      if (state.phase==='SOVIET_DEPLOYMENT') {
        const next=sovietRosterIds.find((id)=>!state.units[id]);
        if (next) {
          const controllerId=controllerIdsForSide(state,'SOVIET')[0];
          assert(controllerId,'production scenario requires a Soviet controller');
          return {type:'DEPLOY_INITIAL_UNIT',controllerId,deploymentUnitId:next,hex:{...sovietPlan[next]}};
        }
      }
      if (state.phase==='GERMAN_DEPLOYMENT') {
        const next=germanRosterIds.find((id)=>!state.units[id]);
        if (next) {
          const controllerId=controllerIdsForSide(state,'GERMAN')[0];
          assert(controllerId,'production scenario requires a German controller');
          return {type:'DEPLOY_INITIAL_UNIT',controllerId,deploymentUnitId:next,hex:{...germanPlan[next]}};
        }
      }

      if (state.phase==='SOVIET_REINFORCEMENT_SUPPLY') {
        const available=getAvailableSovietReinforcements(state,scenario);
        const legalEntries=computeLegalSovietReinforcementEntryHexKeys(state,rules,scenario);
        if (available.length>0&&legalEntries.length>0) {
          const slot=available[0];
          const entryKey=legalEntries[0];
          assert(slot.scheduledTurn<=state.turn,'future reinforcement selected');
          assert(state.hexes[entryKey],'legal reinforcement entry must exist');
          reinforcementDecisions.push({
            reinforcementId:slot.id,
            scheduledTurn:slot.scheduledTurn,
            deployedTurn:state.turn,
            entryHexKey:entryKey
          });
          const controllerId=controllerIdsForSide(state,'SOVIET')[0];
          assert(controllerId,'production scenario requires a Soviet controller');
          return {
            type:'DEPLOY_REINFORCEMENT',
            controllerId,
            reinforcementId:slot.id,
            entryHex:{...state.hexes[entryKey].coord}
          };
        }
      }

      const sideControllers=controllerIdsForSide(state,state.activeSide);
      const nextReady=sideControllers.find((id)=>!state.phaseReadyControllerIds.includes(id));
      if (nextReady) return {type:'READY_FOR_PHASE_END',controllerId:nextReady};
      return null;
    }
  };
}

function runProductionGame() {
  const initial=fresh();
  const providerBundle=makePassiveProvider();
  const run=runHeadlessGame(initial,rules,scenario,providerBundle.provider,{
    maxActions:1000,
    stopOnRejectedAction:true,
    validateIntegrityAfterEachAction:true
  });
  if (run.rejectedActions!==0||run.terminationReason==='REJECTED_ACTION') {
    const failed=run.actionResults.find((result)=>!result.accepted);
    assert.fail(`Unexpected rejected production action: ${JSON.stringify({
      action:failed?.action,
      issues:failed?.issues,
      turn:failed?.state.turn,
      phase:failed?.state.phase
    })}`);
  }
  return {initial,run,reinforcementDecisions:providerBundle.reinforcementDecisions};
}

const first=runProductionGame();
const run=first.run;
assert.equal(run.terminationReason,'GAME_OVER');
assert.equal(run.rejectedActions,0);
assert(run.actionsProcessed<1000);
assert.deepEqual(run.integrityIssues,[]);
assert.deepEqual(validateGameStateIntegrity(run.finalState,rules,scenario),[]);

assert.equal(run.finalState.turn,16);
assert.equal(run.finalState.phase,'GAME_OVER');
assert.equal(run.finalState.victory.winner,'SOVIET');
assert.equal(run.finalState.victory.reason,'SOVIET_CAPITAL_DEFENDED_TO_TURN_LIMIT');

const log=run.finalState.actionLog;
assert(log.some((entry)=>entry.phase==='SOVIET_DEPLOYMENT'));
assert(log.some((entry)=>entry.phase==='GERMAN_DEPLOYMENT'));
assert(log.some((entry)=>entry.turn===1&&entry.phase==='GERMAN_SUPPLY_RAIL'));
assert(log.some((entry)=>entry.phase==='SOVIET_REINFORCEMENT_SUPPLY'));
assert(log.some((entry)=>entry.turn===16&&entry.phase==='GERMAN_ENTRENCHMENT'));
assert(run.events.some((event)=>event.type==='GameTurnStarted'&&event.turn>1));
assert(run.events.some((event)=>event.type==='PhaseEnded'&&event.previousPhase==='GERMAN_ENTRENCHMENT'&&event.nextPhase==='GAME_OVER'&&event.turn===16));
assert(!run.events.some((event)=>event.type==='GameTurnStarted'&&event.turn===17));
assert(!run.events.some((event)=>event.type==='PlayerTurnStarted'&&event.side==='SOVIET'&&event.turn===16));
const finalResult=run.actionResults.at(-1);
assert(finalResult?.accepted);
assert.equal(finalResult.state.phase,'GAME_OVER');
assert(!finalResult.events.some((event)=>event.type==='PlayerTurnStarted'||event.type==='GameTurnStarted'));

const slots=deriveSovietReinforcementSlots(scenario);
assert.equal(slots.length,13);
const deployedIds=getDeployedSovietReinforcementIds(run.finalState);
const deployedSet=new Set(deployedIds);
const delayedIds=slots.filter((slot)=>!deployedSet.has(slot.id)).map((slot)=>slot.id).sort();
assert.equal(deployedIds.length+delayedIds.length,13);
assert.equal(new Set(deployedIds).size,deployedIds.length);
assert.equal(new Set(first.reinforcementDecisions.map((x)=>x.reinforcementId)).size,first.reinforcementDecisions.length);
assert.deepEqual(first.reinforcementDecisions.map((x)=>x.reinforcementId).sort(),[...deployedIds].sort());
for (const decision of first.reinforcementDecisions) {
  assert(decision.scheduledTurn<=decision.deployedTurn);
  assert(slots.some((slot)=>slot.id===decision.reinforcementId&&slot.scheduledTurn===decision.scheduledTurn));
}
for (const delayedId of delayedIds) {
  assert(slots.some((slot)=>slot.id===delayedId&&slot.scheduledTurn<=16));
}

const replay=replayHeadlessActions(first.initial,rules,scenario,run.canonicalActions,{validateIntegrityAfterEachAction:true});
assert.deepEqual(replay.integrityIssues,[]);
assert.deepEqual(replay.finalState,run.finalState);
assert.deepEqual(replay.finalState.actionLog,run.finalState.actionLog);
assert.deepEqual(replay.finalState.idCounters,run.finalState.idCounters);
assert.deepEqual(replay.finalState.victory,run.finalState.victory);

const second=runProductionGame();
assert.deepEqual(second.run.canonicalActions,run.canonicalActions);
assert.deepEqual(second.run.finalState,run.finalState);
assert.deepEqual(second.reinforcementDecisions,first.reinforcementDecisions);
assert.deepEqual(second.run.finalState.victory,run.finalState.victory);

console.log('Production full-game start: PASS');
console.log(`Turn limit reached: ${run.finalState.turn}`);
console.log(`Final phase: ${run.finalState.phase}`);
console.log(`Winner: ${run.finalState.victory.winner}`);
console.log(`Victory reason: ${run.finalState.victory.reason}`);
console.log(`Rejected actions: ${run.rejectedActions}`);
console.log(`Reinforcements deployed: ${deployedIds.length}`);
console.log(`Reinforcements delayed: ${delayedIds.length}`);
console.log('Integrity: PASS');
console.log('Replay: PASS');
console.log('Repeat determinism: PASS');

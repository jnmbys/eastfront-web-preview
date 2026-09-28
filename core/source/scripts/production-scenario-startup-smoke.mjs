import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  RulesEngine,
  createDeploymentGameState,
  defaultRules,
  defaultScenario,
  deploymentHexKeysForSide,
  deriveSovietReinforcementSlots,
  importLegacyMap,
  projectDeploymentView,
  replayHeadlessActions,
  runHeadlessGame,
  validateGameStateIntegrity
} from '../dist/index.js';

const raw=JSON.parse(fs.readFileSync(new URL('../reference/strategic-reset-f-map.json',import.meta.url),'utf8'));
const imported=importLegacyMap(raw);
const scenario=defaultScenario;
const rules=defaultRules;
assert(scenario.deployment,'defaultScenario.deployment must be configured');
assert.deepEqual(scenario.initialUnits,[]);

const roster=[...scenario.deployment.units];
const german=roster.filter(u=>u.side==='GERMAN');
const soviet=roster.filter(u=>u.side==='SOVIET');
assert.equal(german.length,26);
assert.equal(soviet.length,32);
assert.equal(roster.length,58);
assert.equal(new Set(roster.map(u=>u.id)).size,58);
const expectedCounts={
  GERMAN:{'G-INF':11,'G-JAGER':2,'G-PANZER':4,'G-MOT':3,'G-ARTY':2,'G-ENG':2,'G-RECON':2},
  SOVIET:{'S-INF':16,'S-ELITE':2,'S-TANK':3,'S-MOT':2,'S-HEAVY':1,'S-AT':3,'S-ARTY':3,'S-ENG':2}
};
for (const side of ['GERMAN','SOVIET']) {
  const counts={};
  for (const u of roster.filter(x=>x.side===side)) counts[u.templateId]=(counts[u.templateId]??0)+1;
  assert.deepEqual(counts,expectedCounts[side]);
}
for (const u of roster) {
  const t=rules.unitTemplates[u.templateId];
  assert(t,`missing template ${u.templateId}`);
  assert.equal(t.side,u.side);
  assert.notEqual(t.type,'HQ');
}
const reinforcementIds=new Set(deriveSovietReinforcementSlots(scenario).map(s=>s.id));
for (const u of roster) assert(!reinforcementIds.has(u.id),`deployment id collides with reinforcement id ${u.id}`);

const fresh=()=>createDeploymentGameState({scenario,rules,hexes:imported.hexes,edges:imported.edges,seed:17});
const initial=fresh();
assert.deepEqual(validateGameStateIntegrity(initial,rules,scenario),[]);
assert.equal(initial.phase,'SOVIET_DEPLOYMENT');
assert.equal(initial.activeSide,'SOVIET');

const gZone=deploymentHexKeysForSide(initial,scenario,'GERMAN');
const sZone=deploymentHexKeysForSide(initial,scenario,'SOVIET');
const allDeployable=Object.entries(initial.hexes).filter(([,h])=>h.terrain!=='LAKE').map(([k])=>k).sort();
assert(gZone.every(k=>initial.hexes[k]&&initial.hexes[k].terrain!=='LAKE'));
assert(sZone.every(k=>initial.hexes[k]&&initial.hexes[k].terrain!=='LAKE'));
assert.equal(gZone.filter(k=>new Set(sZone).has(k)).length,0);
assert.deepEqual([...new Set([...gZone,...sZone])].sort(),allDeployable);
const actualQs=[...new Set(Object.values(initial.hexes).map(h=>h.coord.q))].sort((a,b)=>a-b);
const west3=actualQs.slice(0,3);
const gQs=[...new Set(gZone.map(k=>initial.hexes[k].coord.q))].sort((a,b)=>a-b);
assert.deepEqual(gQs,west3);
assert(gZone.length*rules.stackingLimit>=26);
assert(sZone.length*rules.stackingLimit>=32);

const controllerFor=(side)=>scenario.controllers.find(c=>c.side===side)?.id;
const gController=controllerFor('GERMAN'); const sController=controllerFor('SOVIET');
assert(gController&&sController);
const planFor=(side,zone)=>{
  const ids=roster.filter(u=>u.side===side).map(u=>u.id).sort();
  const plan={};
  ids.forEach((id,i)=>{ plan[id]=initial.hexes[zone[Math.floor(i/rules.stackingLimit)]].coord; });
  return plan;
};
const sPlan=planFor('SOVIET',sZone); const gPlan=planFor('GERMAN',gZone);

let state=initial; const engine=new RulesEngine(rules,scenario); const canonical=[];
for (const id of soviet.map(u=>u.id).sort()) {
  const r=engine.apply(state,{type:'DEPLOY_INITIAL_UNIT',controllerId:sController,deploymentUnitId:id,hex:sPlan[id]});
  assert(r.accepted,`Soviet placement rejected ${id}: ${JSON.stringify(r.issues)}`); state=r.state; canonical.push(r.action);
}
let r=engine.apply(state,{type:'READY_FOR_PHASE_END',controllerId:sController}); assert(r.accepted); state=r.state; canonical.push(r.action);
assert.equal(state.phase,'GERMAN_DEPLOYMENT');
assert.deepEqual(validateGameStateIntegrity(state,rules,scenario),[]);

for (const id of german.map(u=>u.id).sort()) {
  const rr=engine.apply(state,{type:'DEPLOY_INITIAL_UNIT',controllerId:gController,deploymentUnitId:id,hex:gPlan[id]});
  assert(rr.accepted,`German placement rejected ${id}: ${JSON.stringify(rr.issues)}`); state=rr.state; canonical.push(rr.action);
}
const gView=projectDeploymentView(state,scenario,gController);
const sView=projectDeploymentView(state,scenario,sController);
assert.equal(Object.values(gView.units).every(u=>u.side==='GERMAN'),true);
assert.equal(Object.values(sView.units).every(u=>u.side==='SOVIET'),true);
assert.equal(Object.values(gView.units).some(u=>u.side==='SOVIET'),false);
assert.equal(Object.values(sView.units).some(u=>u.side==='GERMAN'),false);

r=engine.apply(state,{type:'READY_FOR_PHASE_END',controllerId:gController}); assert(r.accepted); state=r.state; canonical.push(r.action);
assert.equal(state.phase,'GERMAN_SUPPLY_RAIL');
assert.equal(state.activeSide,'GERMAN');
assert.equal(state.turn,1);
assert.equal(Object.keys(state.units).length,58);
for (const u of roster) {
  const st=state.units[u.id]; assert(st); assert.equal(st.side,u.side); assert.equal(st.templateId,u.templateId);
  assert.equal(st.controllerId,u.side==='GERMAN'?gController:sController);
}
assert.deepEqual(validateGameStateIntegrity(state,rules,scenario),[]);

const replay=replayHeadlessActions(initial,rules,scenario,canonical);
assert.deepEqual(replay.integrityIssues,[]);
assert.deepEqual(replay.finalState,state);

const headlessInitial=fresh();
const provider=({state:ctx})=>{
  if (ctx.phase==='SOVIET_DEPLOYMENT') {
    const next=soviet.map(u=>u.id).sort().find(id=>!ctx.units[id]);
    return next?{type:'DEPLOY_INITIAL_UNIT',controllerId:sController,deploymentUnitId:next,hex:sPlan[next]}:{type:'READY_FOR_PHASE_END',controllerId:sController};
  }
  if (ctx.phase==='GERMAN_DEPLOYMENT') {
    const next=german.map(u=>u.id).sort().find(id=>!ctx.units[id]);
    return next?{type:'DEPLOY_INITIAL_UNIT',controllerId:gController,deploymentUnitId:next,hex:gPlan[next]}:{type:'READY_FOR_PHASE_END',controllerId:gController};
  }
  return null;
};
const run=runHeadlessGame(headlessInitial,rules,scenario,provider,{maxActions:100});
assert.equal(run.terminationReason,'NO_ACTION');
assert.equal(run.finalState.phase,'GERMAN_SUPPLY_RAIL');
assert.equal(Object.keys(run.finalState.units).length,58);
assert.deepEqual(run.integrityIssues,[]);

console.log('German initial roster: 26');
console.log('Soviet initial roster: 32');
console.log(`German zone hexes: ${gZone.length}; capacity: ${gZone.length*rules.stackingLimit}`);
console.log(`Soviet zone hexes: ${sZone.length}; capacity: ${sZone.length*rules.stackingLimit}`);
console.log('Production setup: PASS');
console.log('Production Turn 1 entry: PASS');
console.log('Production hidden view: PASS');
console.log('Production integrity: PASS');
console.log('Production replay: PASS');
console.log('Production headless start: PASS');

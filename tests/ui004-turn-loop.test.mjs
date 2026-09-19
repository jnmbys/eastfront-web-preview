import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  computeLegalSovietReinforcementEntryHexKeys,
  computeRecoveryBaseHexKeys,
  deploymentHexKeysForSide,
  deriveSovietReinforcementSlots,
  getAvailableSovietReinforcements,
  getDeployedSovietReinforcementIds,
  getNeighbors,
  validateEntrenchAction,
  validateMoveAction,
  validateRailRepairAction,
  validateRecoveryAction,
} from '../dist/vendor/eastfront-digital-core/dist/index.js';
import { controllerIdForSide, createLocalGameSession, dispatchGameAction, setActiveViewer } from '../dist/app/core-adapter/session.js';
import {
  cancelMoveDraft, commitMoveDraft, commitRailRepair, confirmPrivacyGate, entrenchSelectedUnit, extendMoveDraft,
  readyForPhase, recoverSelectedUnit, selectCounter, selectReinforcement, deploySelectedReinforcement,
  toggleRailRepairEdge,
} from '../dist/app/interaction/intents.js';
import { deriveBrowserRenderModel } from '../dist/app/render/coreModel.js';
import { coreSvgMarkup } from '../dist/app/render/coreSvg.js';
import { createPresentationState } from '../dist/app/state/presentation.js';

const raw=JSON.parse(await readFile(new URL('../vendor/eastfront-digital-core/reference/strategic-reset-f-map.json',import.meta.url),'utf8'));
const fresh=()=>createLocalGameSession(raw,17);
const stateJson=(state)=>JSON.stringify(state);
const key=(h)=>`${h.q},${h.r}`;

function planFor(session,side){
  const ids=session.scenario.deployment.units.filter((u)=>u.side===side).map((u)=>u.id).sort();
  const zone=deploymentHexKeysForSide(session.state,session.scenario,side);const plan={};
  ids.forEach((id,i)=>plan[id]={...session.state.hexes[zone[Math.floor(i/session.rules.stackingLimit)]].coord});return {ids,plan};
}
function deployAll(session,side){const cid=controllerIdForSide(session,side);const {ids,plan}=planFor(session,side);for(const id of ids){const r=dispatchGameAction(session,{type:'DEPLOY_INITIAL_UNIT',controllerId:cid,deploymentUnitId:id,hex:plan[id]}).result;assert.equal(r.accepted,true,JSON.stringify(r.issues));}}
function ready(session,side=session.state.activeSide){const r=dispatchGameAction(session,{type:'READY_FOR_PHASE_END',controllerId:controllerIdForSide(session,side)}).result;assert.equal(r.accepted,true,`${session.state.phase}: ${JSON.stringify(r.issues)}`);return r;}
function started(){const s=fresh();deployAll(s,'SOVIET');ready(s,'SOVIET');setActiveViewer(s,controllerIdForSide(s,'GERMAN'));deployAll(s,'GERMAN');ready(s,'GERMAN');return s;}
function advanceTo(session,target){let guard=80;while(session.state.phase!==target&&session.state.phase!=='GAME_OVER'&&guard-->0){ready(session);}assert.equal(session.state.phase,target);}
function findMultiStepMove(session){
  const cid=controllerIdForSide(session,session.state.activeSide);
  for(const unit of Object.values(session.state.units).filter((u)=>u.alive&&u.controllerId===cid).sort((a,b)=>a.id.localeCompare(b.id))){
    for(const a of getNeighbors(unit.hex)){if(!session.state.hexes[key(a)])continue;for(const b of getNeighbors(a)){if(!session.state.hexes[key(b)]||key(b)===key(unit.hex))continue;const path=[a,b].map((h)=>({...h}));const action={type:'MOVE',controllerId:cid,unitId:unit.id,path};const v=validateMoveAction(session.state,session.rules,action);if(v.issues.length===0)return {unit,action,validation:v};}}
  }
  throw new Error('No legal two-step MOVE found');
}
function findRailRepair(session){
  const cid=controllerIdForSide(session,'GERMAN');const rails=Object.values(session.state.edges).filter((e)=>e.railway?.present).sort((a,b)=>a.key.localeCompare(b.key));const engineers=Object.values(session.state.units).filter((u)=>u.alive&&u.side==='GERMAN'&&u.type==='ENGINEER'&&u.controllerId===cid).map((u)=>u.id).sort();
  for(const edge of rails)for(const engineerUnitId of [undefined,...engineers]){const action={type:'RAIL_REPAIR',controllerId:cid,edgeKeys:[edge.key],...(engineerUnitId?{engineerUnitId}:{})};if(validateRailRepairAction(session.state,session.rules,session.scenario,action).length===0)return action;}
  throw new Error('No legal production rail repair plan');
}

// 1-3 movement drafting/accept/reject
test('multi-step movement draft is presentation-only until accepted commit, then rerenders final Core Hex',()=>{
  const s=started();ready(s,'GERMAN');assert.equal(s.state.phase,'GERMAN_MOVEMENT');setActiveViewer(s,controllerIdForSide(s,'GERMAN'));
  const p=createPresentationState(false,false);const cand=findMultiStepMove(s);selectCounter(s,p,cand.unit.id);const before=stateJson(s.state);
  extendMoveDraft(s,p,cand.action.path[0]);extendMoveDraft(s,p,cand.action.path[1]);assert.equal(stateJson(s.state),before);assert.deepEqual(p.pathDraft,cand.action.path);
  let model=deriveBrowserRenderModel(s,p);assert.equal(model.movement.path.length,2);assert.equal(model.selectedCounter.id,cand.unit.id);assert.deepEqual(model.selectedCounter.hex,cand.unit.hex);
  commitMoveDraft(s,p);assert.equal(s.lastResult.accepted,true);assert.deepEqual(s.state.units[cand.unit.id].hex,cand.action.path.at(-1));assert.equal(p.pathDraft.length,0);
  model=deriveBrowserRenderModel(s,p);assert.deepEqual(model.selectedCounter.hex,cand.action.path.at(-1));
});

test('rejected MOVE preserves authoritative state and leaves Counter at real Hex',()=>{
  const s=started();ready(s,'GERMAN');const p=createPresentationState(false,false);const unit=Object.values(s.state.units).find((u)=>u.side==='GERMAN');selectCounter(s,p,unit.id);p.pathDraft=[{q:99,r:99}];const before=stateJson(s.state);commitMoveDraft(s,p);assert.equal(s.lastResult.accepted,false);assert.equal(stateJson(s.state),before);assert.deepEqual(s.state.units[unit.id].hex,unit.hex);
});

// 4-5 rail repair draft / accepted action
test('rail-repair draft does not mutate state and accepted repair comes only from result.state',()=>{
  const s=started();assert.equal(s.state.phase,'GERMAN_SUPPLY_RAIL');const p=createPresentationState(false,false);const action=findRailRepair(s);const before=stateJson(s.state);
  toggleRailRepairEdge(s,p,action.edgeKeys[0]);p.selectedEngineerUnitId=action.engineerUnitId??null;assert.equal(stateJson(s.state),before);
  commitRailRepair(s,p);assert.equal(s.lastResult.accepted,true,JSON.stringify(s.lastResult.issues));assert.equal(s.state,s.lastResult.state);assert.equal(s.state.edges[action.edgeKeys[0]].railway.repairedBy,'GERMAN');
});

// 6-8 reinforcement list, blocker, deployment
test('Soviet reinforcement phase derives list from Core, Ready blocker is real, and legal deployment succeeds',()=>{
  const s=started();advanceTo(s,'SOVIET_REINFORCEMENT_SUPPLY');setActiveViewer(s,controllerIdForSide(s,'SOVIET'));const p=createPresentationState(false,false);
  const model=deriveBrowserRenderModel(s,p);assert(model.reinforcement);assert.deepEqual(model.reinforcement.available.map((x)=>x.id),getAvailableSovietReinforcements(s.state,s.scenario).map((x)=>x.id));
  if(model.reinforcement.deployable){const before=stateJson(s.state);const blocked=dispatchGameAction(s,{type:'READY_FOR_PHASE_END',controllerId:controllerIdForSide(s,'SOVIET')});assert.equal(blocked.result.accepted,false);assert.equal(stateJson(s.state),before);assert(blocked.result.issues.length>0);
    const slot=getAvailableSovietReinforcements(s.state,s.scenario)[0];const entry=computeLegalSovietReinforcementEntryHexKeys(s.state,s.rules,s.scenario)[0];assert(slot&&entry);selectReinforcement(p,slot.id);deploySelectedReinforcement(s,p,s.state.hexes[entry].coord);assert.equal(s.lastResult.accepted,true,JSON.stringify(s.lastResult.issues));assert(getDeployedSovietReinforcementIds(s.state).includes(slot.id));}
});

// 9 recovery via targeted damaged production-state fixture
test('Recovery preview is Core-derived and accepted REPAIR_UNIT mutates only through Action result',()=>{
  const s=started();advanceTo(s,'SOVIET_RECOVERY');setActiveViewer(s,controllerIdForSide(s,'SOVIET'));const cid=controllerIdForSide(s,'SOVIET');let chosen=null;
  const bases=computeRecoveryBaseHexKeys(s.state,'SOVIET',s.scenario);
  for(const original of Object.values(s.state.units).filter((u)=>u.alive&&u.side==='SOVIET'&&u.controllerId===cid)){
    const prior={step:original.step,hex:{...original.hex},supplyState:original.supplyState,hasMoved:original.hasMoved,hasAttacked:original.hasAttacked,dedicatedRailRepair:original.dedicatedRailRepair,artillerySupportUsed:original.artillerySupportUsed};
    for(const baseKey of bases){
      original.step=1;original.hex={...s.state.hexes[baseKey].coord};original.supplyState='SUPPLIED';original.hasMoved=false;original.hasAttacked=false;original.dedicatedRailRepair=false;original.artillerySupportUsed=false;
      const issues=validateRecoveryAction(s.state,s.rules,s.scenario,{type:'REPAIR_UNIT',controllerId:cid,unitId:original.id});if(!issues.length){chosen=original;break;}
    }
    if(chosen)break;
    Object.assign(original,prior,{hex:prior.hex});
  }
  assert(chosen,'fixture must find recoverable production unit at a Core-derived Recovery Base');const p=createPresentationState(false,false);selectCounter(s,p,chosen.id);const model=deriveBrowserRenderModel(s,p);assert(model.recovery);assert.equal(model.recovery.selectedIssues.length,0);const beforeStep=s.state.units[chosen.id].step;recoverSelectedUnit(s,p);assert.equal(s.lastResult.accepted,true,JSON.stringify(s.lastResult.issues));assert.equal(s.state.units[chosen.id].step,beforeStep-1);assert.equal(s.state,s.lastResult.state);
});

// 10 entrench
test('Entrench preview and accepted ENTRENCH use frozen Core authority',()=>{
  const s=started();advanceTo(s,'GERMAN_ENTRENCHMENT');setActiveViewer(s,controllerIdForSide(s,'GERMAN'));const cid=controllerIdForSide(s,'GERMAN');const unit=Object.values(s.state.units).filter((u)=>u.alive&&u.side==='GERMAN'&&u.controllerId===cid).find((u)=>validateEntrenchAction(s.state,s.rules,s.scenario,{type:'ENTRENCH',controllerId:cid,unitId:u.id}).length===0);assert(unit);
  const p=createPresentationState(false,false);selectCounter(s,p,unit.id);assert.equal(deriveBrowserRenderModel(s,p).entrench.selectedIssues.length,0);entrenchSelectedUnit(s,p);assert.equal(s.lastResult.accepted,true,JSON.stringify(s.lastResult.issues));assert.equal(s.state.units[unit.id].entrenched,true);assert(coreSvgMarkup(deriveBrowserRenderModel(s,p),{debug:false}).includes('entrench-icon'));
});

// 11 handoff presentation gate
test('hot-seat side handoff changes viewer only after confirmation and never mutates GameState',()=>{
  const s=started();advanceTo(s,'GERMAN_ENTRENCHMENT');setActiveViewer(s,controllerIdForSide(s,'GERMAN'));const p=createPresentationState(false,false);const before=stateJson(s.state);readyForPhase(s,p);assert.equal(s.state.phase,'SOVIET_REINFORCEMENT_SUPPLY');assert.equal(p.privacyGate,'PASS_TURN_TO_SOVIET');const afterAction=stateJson(s.state);assert.notEqual(afterAction,before);const stateBeforeConfirm=stateJson(s.state);confirmPrivacyGate(s,p);assert.equal(stateJson(s.state),stateBeforeConfirm);assert.equal(s.state.controllers[s.activeViewerControllerId].side,'SOVIET');
});

// 12-13 passive full production lifecycle + reinforcement counts
test('browser/session passive production loop reaches Turn 16 GAME_OVER with frozen reinforcement behavior',()=>{
  const s=fresh();deployAll(s,'SOVIET');ready(s,'SOVIET');setActiveViewer(s,controllerIdForSide(s,'GERMAN'));deployAll(s,'GERMAN');ready(s,'GERMAN');
  let guard=1000;while(s.state.phase!=='GAME_OVER'&&guard-->0){
    if(s.state.phase==='SOVIET_REINFORCEMENT_SUPPLY'){
      const available=getAvailableSovietReinforcements(s.state,s.scenario);const entries=computeLegalSovietReinforcementEntryHexKeys(s.state,s.rules,s.scenario);
      if(available.length&&entries.length){setActiveViewer(s,controllerIdForSide(s,'SOVIET'));const r=dispatchGameAction(s,{type:'DEPLOY_REINFORCEMENT',controllerId:controllerIdForSide(s,'SOVIET'),reinforcementId:available[0].id,entryHex:{...s.state.hexes[entries[0]].coord}}).result;assert.equal(r.accepted,true,JSON.stringify(r.issues));continue;}
    }
    setActiveViewer(s,controllerIdForSide(s,s.state.activeSide));ready(s);
  }
  assert(guard>0);assert.equal(s.state.turn,16);assert.equal(s.state.phase,'GAME_OVER');assert.equal(s.state.victory.winner,'SOVIET');assert.equal(s.state.victory.reason,'SOVIET_CAPITAL_DEFENDED_TO_TURN_LIMIT');assert.equal(s.integrityIssues.length,0);
  const slots=deriveSovietReinforcementSlots(s.scenario),deployed=getDeployedSovietReinforcementIds(s.state),delayed=slots.filter((slot)=>!new Set(deployed).has(slot.id));assert.equal(slots.length,13);assert.equal(deployed.length,6);assert.equal(delayed.length,7);
});

// 14 hidden zero leak survives generic model additions
test('UI-004 generic phase additions preserve UI-003 hidden deployment zero-leak',()=>{
  const s=fresh();const p=createPresentationState(true,false);deployAll(s,'SOVIET');ready(s,'SOVIET');setActiveViewer(s,controllerIdForSide(s,'GERMAN'));const model=deriveBrowserRenderModel(s,p);assert.equal(model.counters.some((c)=>c.side==='SOVIET'),false);const svg=coreSvgMarkup(model,{debug:true});for(const id of s.scenario.deployment.units.filter((u)=>u.side==='SOVIET').map((u)=>u.id))assert.equal(svg.includes(`data-unit-id="${id}"`),false);
});

// 15 geometry lock
test('UI-004 keeps frozen geometry SHA exactly locked',async()=>{const bytes=await readFile(new URL('../src/geometry/hex.ts',import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),'283b0445e3bff1bc412dd76536ce49e517ffa1dd35dc26c1f8c194b88ba9ab7a');});

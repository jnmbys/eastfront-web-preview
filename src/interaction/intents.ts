import { msg, enumMessage, phaseMessage, type Message } from '../localization/index.js';
import { joinIssues } from '../localization/issues.js';
import { continueCombatFlow } from './combatFlow.js';
import { additionalAttackerIssues, isCombatTargetSelection, primaryAttackerId } from './attackGroup.js';
export { isCombatTargetSelection } from './attackGroup.js';
import {
  analyzeBreakthroughAction,
  validateAttackAction,
  coreHexKey,
  getLegalRetreatStepOptions,
  getNeighbors,
  type AllocateLossesAction,
  type AttackAction,
  type BreakthroughAction,
  type CombatReactionAction,
  type DeployInitialUnitAction,
  type DeployReinforcementAction,
  type EntityId,
  type EntrenchAction,
  type HexCoord,
  type MoveAction,
  type RetreatAction,
  type SchwerpunktAttackAction,
  type RailRepairAction,
  type RepairUnitAction,
  type Side,
} from '../core-adapter/core.js';
import { controllerIdForSide, dispatchGameAction, setActiveViewer, type LocalGameSession } from '../core-adapter/session.js';
import { clearActionDrafts, clearCombatDrafts, type PresentationState } from '../state/presentation.js';

function issuesMessage(issues:readonly {code:string;message:string}[]):Message {
  return joinIssues(issues);
}
function sameHex(a:HexCoord,b:HexCoord):boolean{return a.q===b.q&&a.r===b.r;}
function adjacent(a:HexCoord,b:HexCoord):boolean{return getNeighbors(a).some((candidate)=>sameHex(candidate,b));}

export function selectCounter(session:LocalGameSession,presentation:PresentationState,unitId:EntityId):void {
  const clicked=session.state.units[unitId];
  const retreat=session.state.pendingDecision;
  if(retreat?.kind==='RETREAT'&&clicked?.alive&&!presentation.privacyGate
    &&retreat.decisionOwnerControllerId===session.activeViewerControllerId){
    const active=presentation.activeRetreaterId??retreat.unitIds[0];
    const mover=active?session.state.units[active]:null;
    const path=active?presentation.retreatDrafts[active]??[]:[];
    if(mover&&path.length<retreat.retreatSteps&&getLegalRetreatStepOptions(session.state,session.rules,mover,path.at(-1)??mover.hex).some(h=>sameHex(h,clicked.hex))){
      extendRetreatDraft(session,presentation,clicked.hex);return;
    }
    if(retreat.unitIds.includes(unitId)){selectRetreater(presentation,unitId);return;}
  }
  const viewerSide=session.state.controllers[session.activeViewerControllerId]?.side;
  if(clicked?.alive&&clicked.side!==viewerSide&&isCombatTargetSelection(session,presentation)){
    routeCombatTarget(session,presentation,clicked.hex);return;
  }
  if(clicked?.side===viewerSide&&isCombatTargetSelection(session,presentation)&&presentation.attackTarget){
    toggleSupportingAttacker(session,presentation,unitId);return;
  }
  const unit=session.state.units[unitId];
  if(!unit)return;
  presentation.selectedUnitId=unitId;
  if(session.state.phase==='SOVIET_DEPLOYMENT'||session.state.phase==='GERMAN_DEPLOYMENT') presentation.selectedDeploymentUnitId=unitId;
  presentation.pathDraft=[];
  if(session.state.phase==='GERMAN_MOVEMENT'||session.state.phase==='SOVIET_MOVEMENT') presentation.interactionMode='MOVE_PATH';
  else if(session.state.phase==='GERMAN_RECOVERY'||session.state.phase==='SOVIET_RECOVERY') presentation.interactionMode='RECOVERY';
  else if(session.state.phase==='GERMAN_ENTRENCHMENT'||session.state.phase==='SOVIET_ENTRENCHMENT') presentation.interactionMode='ENTRENCH';
  else if((session.state.phase==='GERMAN_COMBAT'||session.state.phase==='SOVIET_COMBAT')&&!session.state.pendingDecision) presentation.interactionMode='ATTACK';
  else presentation.interactionMode='SELECT';
  presentation.message=null;
  if(presentation.interactionMode==='ATTACK'&&!presentation.privacyGate&&presentation.attackUnitIds.length===0
    &&unit.alive&&unit.controllerId===session.activeViewerControllerId&&viewerSide===session.state.activeSide){
    const legal=getNeighbors(unit.hex).some(target=>validateAttackAction(session.state,session.rules,
      {type:'ATTACK',controllerId:session.activeViewerControllerId,attackerUnitIds:[unitId],target}).length===0);
    if(legal){presentation.attackUnitIds=[unitId];presentation.primaryAttackerId=unitId;presentation.attackTarget=null;presentation.attackerArtilleryUnitId=null;presentation.message=msg('feedback.chooseEnemy');}
    else presentation.message=msg('feedback.noLegalAttack');
  }
}

export function selectDeploymentRosterUnit(presentation:PresentationState,unitId:EntityId):void {
  presentation.selectedDeploymentUnitId=unitId;
  presentation.selectedUnitId=null;
  presentation.message=null;
}

export function deploySelectedUnit(session:LocalGameSession,presentation:PresentationState,hex:HexCoord):void {
  const id=presentation.selectedDeploymentUnitId;
  if(!id){presentation.message=msg('feedback.selectDeployment');return;}
  const action:DeployInitialUnitAction={type:'DEPLOY_INITIAL_UNIT',controllerId:session.activeViewerControllerId,deploymentUnitId:id,hex};
  const outcome=dispatchGameAction(session,action);
  if(!outcome.result.accepted){presentation.message=issuesMessage(outcome.result.issues);return;}
  presentation.message=msg('feedback.deployed',{id,hex:coreHexKey(hex)});
  presentation.selectedUnitId=id;
  const roster=session.scenario.deployment?.units.filter((unit)=>unit.side===session.state.controllers[session.activeViewerControllerId]?.side)??[];
  const next=roster.find((unit)=>!session.state.units[unit.id]);
  presentation.selectedDeploymentUnitId=next?.id??id;
}

export function readyForPhase(session:LocalGameSession,presentation:PresentationState):void {
  const beforePhase=session.state.phase;
  const beforeSide=session.state.activeSide;
  const outcome=dispatchGameAction(session,{type:'READY_FOR_PHASE_END',controllerId:session.activeViewerControllerId});
  if(!outcome.result.accepted){presentation.message=issuesMessage(outcome.result.issues);return;}
  presentation.message=msg('feedback.phaseComplete',{phase:phaseMessage(beforePhase)});
  presentation.selectedUnitId=null;
  presentation.selectedDeploymentUnitId=null;
  clearActionDrafts(presentation);
  if(beforePhase==='SOVIET_DEPLOYMENT'&&session.state.phase==='GERMAN_DEPLOYMENT') presentation.privacyGate='PASS_TO_GERMAN';
  else if(beforePhase==='GERMAN_DEPLOYMENT'&&session.state.phase==='GERMAN_SUPPLY_RAIL') presentation.privacyGate='REVEAL_BOTH';
  else if(session.state.phase!=='GAME_OVER'&&beforeSide!==session.state.activeSide) presentation.privacyGate=session.state.activeSide==='GERMAN'?'PASS_TURN_TO_GERMAN':'PASS_TURN_TO_SOVIET';
}

export function confirmPrivacyGate(session:LocalGameSession,presentation:PresentationState):void {
  const gate=presentation.privacyGate;
  if(!gate)return;
  if(gate==='COMBAT_DECISION'){const owner=session.state.pendingDecision?.decisionOwnerControllerId;if(owner)setActiveViewer(session,owner);}
  else if(gate==='PASS_TO_GERMAN'||gate==='REVEAL_BOTH'||gate==='PASS_TURN_TO_GERMAN') setActiveViewer(session,controllerIdForSide(session,'GERMAN'));
  else setActiveViewer(session,controllerIdForSide(session,'SOVIET'));
  presentation.privacyGate=null;
  clearActionDrafts(presentation);
  presentation.message=gate==='REVEAL_BOTH'?msg('feedback.deploymentRevealed'):msg('feedback.sideActive',{side:enumMessage(session.state.activeSide)});
}

export function switchViewerForDevelopment(session:LocalGameSession,presentation:PresentationState,side:Side):void {
  setActiveViewer(session,controllerIdForSide(session,side));
  presentation.selectedUnitId=null;
  presentation.selectedDeploymentUnitId=null;
  clearActionDrafts(presentation);
  presentation.message=msg('feedback.developerViewer',{side:enumMessage(side)});
}

/** Presentation-only path drafting. Counter remains at authoritative Core hex until commit. */
export function extendMoveDraft(session:LocalGameSession,presentation:PresentationState,destination:HexCoord):void {
  const id=presentation.selectedUnitId;
  if(!id){presentation.message=msg('feedback.selectControlled');return;}
  const unit=session.state.units[id];
  if(!unit){presentation.message=msg('feedback.unitUnavailable');return;}
  const tail=presentation.pathDraft.at(-1)??unit.hex;
  if(presentation.pathDraft.length>0){
    const previous=presentation.pathDraft.length>1?presentation.pathDraft.at(-2)!:unit.hex;
    if(sameHex(destination,previous)){presentation.pathDraft.pop();presentation.message=msg('feedback.undoPath');return;}
  }
  if(!adjacent(tail,destination)){presentation.message=msg('feedback.adjacentOnly');return;}
  presentation.pathDraft.push({...destination});
  presentation.interactionMode='MOVE_PATH';
  presentation.message=msg('feedback.pathDraft',{hex:coreHexKey(destination)});
}

export function undoMoveDraft(presentation:PresentationState):void {
  if(presentation.pathDraft.length>0)presentation.pathDraft.pop();
  presentation.message=presentation.pathDraft.length?msg('feedback.undoPath'):msg('feedback.pathCleared');
}
export function cancelMoveDraft(presentation:PresentationState):void {presentation.pathDraft=[];presentation.message=msg('feedback.moveCancelled');}

export function commitMoveDraft(session:LocalGameSession,presentation:PresentationState):void {
  const id=presentation.selectedUnitId;
  if(!id||presentation.pathDraft.length===0){presentation.message=msg('feedback.needPath');return;}
  const action:MoveAction={type:'MOVE',controllerId:session.activeViewerControllerId,unitId:id,path:presentation.pathDraft.map((hex)=>({...hex}))};
  const outcome=dispatchGameAction(session,action);
  if(!outcome.result.accepted){presentation.message=issuesMessage(outcome.result.issues);return;}
  const finalHex=action.path.at(-1)!;
  presentation.pathDraft=[];
  presentation.message=msg('feedback.moved',{id,hex:coreHexKey(finalHex),count:action.path.length});
}

/** UI-003 compatibility: single tap now drafts one step rather than mutating state immediately. */
export function attemptMove(session:LocalGameSession,presentation:PresentationState,destination:HexCoord):void {extendMoveDraft(session,presentation,destination);}

export function enterRailRepairMode(presentation:PresentationState):void {presentation.interactionMode='RAIL_REPAIR';presentation.message=msg('feedback.railMode');}
export function toggleRailRepairEdge(session:LocalGameSession,presentation:PresentationState,edgeKey:string):void {
  const edge=session.state.edges[edgeKey];
  if(!edge?.railway?.present){presentation.message=msg('feedback.notRailway');return;}
  const set=new Set(presentation.railRepairEdgeKeys);
  if(set.has(edgeKey))set.delete(edgeKey);else set.add(edgeKey);
  presentation.railRepairEdgeKeys=[...set].sort();
  presentation.interactionMode='RAIL_REPAIR';
  presentation.message=msg('feedback.railPlan',{count:presentation.railRepairEdgeKeys.length});
}
export function selectRailEngineer(presentation:PresentationState,unitId:EntityId|null):void {presentation.selectedEngineerUnitId=unitId;presentation.interactionMode='RAIL_REPAIR';}
export function cancelRailRepair(presentation:PresentationState):void {presentation.railRepairEdgeKeys=[];presentation.selectedEngineerUnitId=null;presentation.message=msg('feedback.railCleared');}
export function commitRailRepair(session:LocalGameSession,presentation:PresentationState):void {
  if(presentation.railRepairEdgeKeys.length===0){presentation.message=msg('feedback.needRail');return;}
  const action:RailRepairAction={type:'RAIL_REPAIR',controllerId:session.activeViewerControllerId,edgeKeys:[...presentation.railRepairEdgeKeys],...(presentation.selectedEngineerUnitId?{engineerUnitId:presentation.selectedEngineerUnitId}:{})};
  const outcome=dispatchGameAction(session,action);
  if(!outcome.result.accepted){presentation.message=issuesMessage(outcome.result.issues);return;}
  presentation.message=msg('feedback.railAccepted',{count:action.edgeKeys.length});
  presentation.railRepairEdgeKeys=[];presentation.selectedEngineerUnitId=null;
}

export function selectReinforcement(presentation:PresentationState,id:EntityId):void {presentation.selectedReinforcementId=id;presentation.interactionMode='REINFORCEMENT';presentation.message=null;}
export function deploySelectedReinforcement(session:LocalGameSession,presentation:PresentationState,entryHex:HexCoord):void {
  const id=presentation.selectedReinforcementId;
  if(!id){presentation.message=msg('feedback.needReinforcement');return;}
  const action:DeployReinforcementAction={type:'DEPLOY_REINFORCEMENT',controllerId:session.activeViewerControllerId,reinforcementId:id,entryHex};
  const outcome=dispatchGameAction(session,action);
  if(!outcome.result.accepted){presentation.message=issuesMessage(outcome.result.issues);return;}
  presentation.message=msg('feedback.reinforced',{id,hex:coreHexKey(entryHex)});
  presentation.selectedReinforcementId=null;
}

export function recoverSelectedUnit(session:LocalGameSession,presentation:PresentationState):void {
  const id=presentation.selectedUnitId;
  if(!id){presentation.message=msg('feedback.needDamaged');return;}
  const action:RepairUnitAction={type:'REPAIR_UNIT',controllerId:session.activeViewerControllerId,unitId:id};
  const outcome=dispatchGameAction(session,action);
  presentation.message=outcome.result.accepted?msg('feedback.recovered',{id}):issuesMessage(outcome.result.issues);
}

export function entrenchSelectedUnit(session:LocalGameSession,presentation:PresentationState):void {
  const id=presentation.selectedUnitId;
  if(!id){presentation.message=msg('feedback.selectControlled');return;}
  const action:EntrenchAction={type:'ENTRENCH',controllerId:session.activeViewerControllerId,unitId:id};
  const outcome=dispatchGameAction(session,action);
  presentation.message=outcome.result.accepted?msg('feedback.entrenched',{id}):issuesMessage(outcome.result.issues);
}

function syncCombatDecisionHandoff(session:LocalGameSession,presentation:PresentationState):void {
  const owner=session.state.pendingDecision?.decisionOwnerControllerId;
  if(owner&&owner!==session.activeViewerControllerId){presentation.privacyGate='COMBAT_DECISION';return;}
  if(!owner){
    const activeController=controllerIdForSide(session,session.state.activeSide);
    if(activeController!==session.activeViewerControllerId){
      presentation.privacyGate=session.state.activeSide==='GERMAN'?'PASS_TURN_TO_GERMAN':'PASS_TURN_TO_SOVIET';
    }
  }
}
function combatOutcomeMessage(action:string,accepted:boolean,issues:readonly {code:string;message:string}[]):Message {
  return accepted?msg('feedback.combatAccepted',{action:enumMessage(action)}):issuesMessage(issues);
}

export function toggleAttackUnit(session:LocalGameSession,presentation:PresentationState,unitId:EntityId):void {
  if(isCombatTargetSelection(session,presentation)&&presentation.attackTarget&&unitId!==primaryAttackerId(presentation)){
    toggleSupportingAttacker(session,presentation,unitId);return;
  }
  if(session.state.pendingDecision){presentation.message=msg('feedback.pendingCombat');return;}
  const unit=session.state.units[unitId];if(!unit||!unit.alive){presentation.message=msg('feedback.unavailable');return;}
  const side=session.state.controllers[session.activeViewerControllerId]?.side;
  if(unit.side!==side||unit.controllerId!==session.activeViewerControllerId){presentation.message=msg('feedback.needAttacker');return;}
  const set=new Set(presentation.attackUnitIds);if(set.has(unitId))set.delete(unitId);else set.add(unitId);
  const primary=primaryAttackerId(presentation);
  presentation.attackUnitIds=[...set].sort();presentation.primaryAttackerId=primary&&set.has(primary)?primary:presentation.attackUnitIds[0]??null;
  if(unitId===primary&&!set.has(unitId)&&presentation.primaryAttackerId)presentation.selectedUnitId=presentation.primaryAttackerId;
  presentation.interactionMode='ATTACK';presentation.message=msg('feedback.attackDraft',{count:presentation.attackUnitIds.length});
}
/** Map and compact chips edit the same draft; never dispatch or consume RNG. */
export function toggleSupportingAttacker(session:LocalGameSession,presentation:PresentationState,unitId:EntityId):void {
  if(!isCombatTargetSelection(session,presentation)||!presentation.attackTarget)return;
  const primary=primaryAttackerId(presentation);
  if(unitId===primary){presentation.selectedUnitId=primary;presentation.message=msg('combat.group.primaryHelp');return;}
  const selected=presentation.attackUnitIds.includes(unitId);
  if(!selected){
    const issues=additionalAttackerIssues(session,presentation,unitId);
    if(issues.length){presentation.message=msg('combat.group.unavailable',{issues:issuesMessage(issues)});return;}
  }
  presentation.primaryAttackerId=primary;
  presentation.attackUnitIds=selected?presentation.attackUnitIds.filter(id=>id!==unitId):[...presentation.attackUnitIds,unitId].sort();
  presentation.selectedUnitId=primary;
  presentation.message=msg(selected?'combat.group.removed':'combat.group.added',{id:unitId,count:presentation.attackUnitIds.length});
}
export function combatTargetIssues(session:LocalGameSession,presentation:PresentationState,target:HexCoord){
  return validateAttackAction(session.state,session.rules,{type:'ATTACK',controllerId:session.activeViewerControllerId,
    attackerUnitIds:[...presentation.attackUnitIds],target:{...target},
    ...(presentation.attackerArtilleryUnitId?{support:{attackerArtilleryUnitId:presentation.attackerArtilleryUnitId}}:{})});
}
export function routeCombatTarget(session:LocalGameSession,presentation:PresentationState,target:HexCoord):boolean {
  if(!isCombatTargetSelection(session,presentation))return false;
  const issues=combatTargetIssues(session,presentation,target);
  if(issues.length){presentation.message=msg('feedback.invalidTarget',{issues:issuesMessage(issues)});return true;}
  selectAttackTarget(presentation,target);return true;
}
export function selectAttackTarget(presentation:PresentationState,target:HexCoord):void {presentation.attackTarget={...target};presentation.interactionMode='ATTACK';presentation.message=msg('feedback.targetSelected',{hex:coreHexKey(target)});}
export function selectAttackerArtillery(presentation:PresentationState,unitId:EntityId|null):void {presentation.attackerArtilleryUnitId=unitId;presentation.interactionMode='ATTACK';}
export function clearAttackDraft(presentation:PresentationState):void {presentation.attackUnitIds=[];presentation.primaryAttackerId=null;presentation.attackTarget=null;presentation.attackerArtilleryUnitId=null;presentation.message=msg('feedback.attackCleared');}
export function declareAttack(session:LocalGameSession,presentation:PresentationState):void {
  if(!presentation.attackTarget||presentation.attackUnitIds.length===0){presentation.message=msg('feedback.needTarget');return;}
  const action:AttackAction={type:'ATTACK',controllerId:session.activeViewerControllerId,attackerUnitIds:[...presentation.attackUnitIds],target:{...presentation.attackTarget},...(presentation.attackerArtilleryUnitId?{support:{attackerArtilleryUnitId:presentation.attackerArtilleryUnitId}}:{})};
  const outcome=dispatchGameAction(session,action);presentation.message=combatOutcomeMessage('ATTACK',outcome.result.accepted,outcome.result.issues);
  if(!outcome.result.accepted)return;
  presentation.selectedBattleId=outcome.result.battleId??session.state.pendingDecision?.battleId??null;clearCombatDrafts(presentation);syncCombatDecisionHandoff(session,presentation);
}
/** One primary ATTACK command; all transitions still dispatch canonical Core actions. */
export function attackAndContinue(session:LocalGameSession,presentation:PresentationState):void {
  const before=session.state;
  declareAttack(session,presentation);
  if(session.state!==before)continueCombatFlow(session,presentation);
}
export function passCombatReaction(session:LocalGameSession,presentation:PresentationState):void {
  const pending=session.state.pendingDecision;if(pending?.kind!=='DEFENDER_REACTION'){presentation.message=msg('feedback.noReaction');return;}
  const outcome=dispatchGameAction(session,{type:'PASS_REACTION',controllerId:session.activeViewerControllerId,battleId:pending.battleId});presentation.message=combatOutcomeMessage('PASS_REACTION',outcome.result.accepted,outcome.result.issues);if(outcome.result.accepted){presentation.selectedBattleId=pending.battleId;syncCombatDecisionHandoff(session,presentation);}
}
export function useDefenderArtillery(session:LocalGameSession,presentation:PresentationState,artilleryUnitId:EntityId):void {
  const pending=session.state.pendingDecision;if(pending?.kind!=='DEFENDER_REACTION'){presentation.message=msg('feedback.noReaction');return;}
  const action:CombatReactionAction={type:'COMBAT_REACTION',controllerId:session.activeViewerControllerId,battleId:pending.battleId,reaction:{kind:'DEFENDER_ARTILLERY',artilleryUnitId}};
  const outcome=dispatchGameAction(session,action);presentation.message=combatOutcomeMessage('COMBAT_REACTION',outcome.result.accepted,outcome.result.issues);if(outcome.result.accepted){presentation.selectedBattleId=pending.battleId;syncCombatDecisionHandoff(session,presentation);}
}
export function appendLossDraft(session:LocalGameSession,presentation:PresentationState,unitId:EntityId):void {
  const pending=session.state.pendingDecision;if(pending?.kind!=='LOSS_ALLOCATION'||!pending.eligibleUnitIds.includes(unitId)){presentation.message=msg('feedback.invalidLossUnit');return;}
  presentation.lossDraft.push(unitId);presentation.interactionMode='LOSS_ALLOCATION';presentation.message=msg('feedback.lossDraft',{count:presentation.lossDraft.length,steps:pending.lossSteps});
}
export function chooseLossAndContinue(session:LocalGameSession,presentation:PresentationState,unitId:EntityId):void {
  const p=session.state.pendingDecision;
  if(p?.kind!=='LOSS_ALLOCATION'||presentation.privacyGate||p.decisionOwnerControllerId!==session.activeViewerControllerId)return;
  appendLossDraft(session,presentation,unitId);
  if(presentation.lossDraft.length===p.lossSteps){
    commitLosses(session,presentation);
    if(session.lastResult?.accepted)continueCombatFlow(session,presentation);
  }
}
export function undoLossDraft(presentation:PresentationState):void {presentation.lossDraft.pop();presentation.message=msg('feedback.undoLoss');}
export function clearLossDraft(presentation:PresentationState):void {presentation.lossDraft=[];presentation.message=msg('feedback.lossCleared');}
export function commitLosses(session:LocalGameSession,presentation:PresentationState):void {
  const pending=session.state.pendingDecision;if(pending?.kind!=='LOSS_ALLOCATION'){presentation.message=msg('feedback.noLoss');return;}
  const action:AllocateLossesAction={type:'ALLOCATE_LOSSES',controllerId:session.activeViewerControllerId,battleId:pending.battleId,unitIdsByStep:[...presentation.lossDraft]};
  const outcome=dispatchGameAction(session,action);presentation.message=combatOutcomeMessage('ALLOCATE_LOSSES',outcome.result.accepted,outcome.result.issues);if(outcome.result.accepted){presentation.lossDraft=[];syncCombatDecisionHandoff(session,presentation);}
}
export function selectRetreater(presentation:PresentationState,unitId:EntityId):void {presentation.activeRetreaterId=unitId;if(!presentation.retreatOrder.includes(unitId))presentation.retreatOrder.push(unitId);presentation.interactionMode='RETREAT';}
export function extendRetreatDraft(session:LocalGameSession,presentation:PresentationState,destination:HexCoord):void {
  const pending=session.state.pendingDecision,id=presentation.activeRetreaterId??(pending?.kind==='RETREAT'?pending.unitIds[0]:null);if(pending?.kind!=='RETREAT'||!id){presentation.message=msg('feedback.needRetreater');return;}
  const unit=session.state.units[id];if(!unit){presentation.message=msg('feedback.retreaterUnavailable');return;}
  const path=presentation.retreatDrafts[id]??[];if(path.length>=pending.retreatSteps){presentation.message=msg('feedback.retreatComplete');return;}const from=path.at(-1)??unit.hex;
  const legal=getLegalRetreatStepOptions(session.state,session.rules,unit,from).some((hex)=>sameHex(hex,destination));if(!legal){presentation.message=msg('feedback.illegalRetreat');return;}
  selectRetreater(presentation,id);
  presentation.retreatDrafts[id]=[...path,{...destination}];presentation.message=msg('feedback.retreatDraft',{id,count:presentation.retreatDrafts[id].length});
}
export function undoRetreatStep(presentation:PresentationState):void {const id=presentation.activeRetreaterId;if(id)presentation.retreatDrafts[id]?.pop();}
export function commitRetreat(session:LocalGameSession,presentation:PresentationState):void {
  const pending=session.state.pendingDecision;if(pending?.kind!=='RETREAT'){presentation.message=msg('feedback.noRetreat');return;}
  const ordered=[...presentation.retreatOrder,...pending.unitIds.filter((id)=>!presentation.retreatOrder.includes(id))];
  const action:RetreatAction={type:'RETREAT',controllerId:session.activeViewerControllerId,battleId:pending.battleId,retreats:ordered.map((unitId)=>({unitId,path:(presentation.retreatDrafts[unitId]??[]).map((hex)=>({...hex}))}))};
  const outcome=dispatchGameAction(session,action);presentation.message=combatOutcomeMessage('RETREAT',outcome.result.accepted,outcome.result.issues);if(outcome.result.accepted){presentation.retreatDrafts={};presentation.retreatOrder=[];presentation.activeRetreaterId=null;syncCombatDecisionHandoff(session,presentation);}
}
export function advanceAfterCombat(session:LocalGameSession,presentation:PresentationState,unitId:EntityId):void {const p=session.state.pendingDecision;if(p?.kind!=='ADVANCE_AFTER_COMBAT')return;const o=dispatchGameAction(session,{type:'ADVANCE_AFTER_COMBAT',controllerId:session.activeViewerControllerId,battleId:p.battleId,unitId});presentation.message=combatOutcomeMessage('ADVANCE_AFTER_COMBAT',o.result.accepted,o.result.issues);if(o.result.accepted)syncCombatDecisionHandoff(session,presentation);}
export function passAdvance(session:LocalGameSession,presentation:PresentationState):void {const p=session.state.pendingDecision;if(p?.kind!=='ADVANCE_AFTER_COMBAT')return;const o=dispatchGameAction(session,{type:'PASS_ADVANCE',controllerId:session.activeViewerControllerId,battleId:p.battleId});presentation.message=combatOutcomeMessage('PASS_ADVANCE',o.result.accepted,o.result.issues);if(o.result.accepted)syncCombatDecisionHandoff(session,presentation);}
export function selectBreakthroughUnit(presentation:PresentationState,unitId:EntityId):void {presentation.breakthroughUnitId=unitId;presentation.breakthroughPath=[];presentation.interactionMode='BREAKTHROUGH';}
export function extendBreakthroughDraft(session:LocalGameSession,presentation:PresentationState,destination:HexCoord):void {
  const p=session.state.pendingDecision,id=presentation.breakthroughUnitId;if(p?.kind!=='BREAKTHROUGH_OPTION'||!id)return;const action:BreakthroughAction={type:'BREAKTHROUGH',controllerId:session.activeViewerControllerId,battleId:p.battleId,unitId:id,path:[...presentation.breakthroughPath,{...destination}]};const checked=analyzeBreakthroughAction(session.state,session.rules,action);if(checked.issues.length){presentation.message=issuesMessage(checked.issues);return;}presentation.breakthroughPath=[...action.path];presentation.message=msg('feedback.breakthroughDraft',{count:action.path.length});}
export function undoBreakthroughDraft(presentation:PresentationState):void {presentation.breakthroughPath.pop();}
export function commitBreakthrough(session:LocalGameSession,presentation:PresentationState):void {const p=session.state.pendingDecision,id=presentation.breakthroughUnitId;if(p?.kind!=='BREAKTHROUGH_OPTION'||!id)return;const action:BreakthroughAction={type:'BREAKTHROUGH',controllerId:session.activeViewerControllerId,battleId:p.battleId,unitId:id,path:presentation.breakthroughPath.map((h)=>({...h}))};const o=dispatchGameAction(session,action);presentation.message=combatOutcomeMessage('BREAKTHROUGH',o.result.accepted,o.result.issues);if(o.result.accepted){presentation.breakthroughPath=[];presentation.breakthroughUnitId=null;syncCombatDecisionHandoff(session,presentation);}}
export function passBreakthrough(session:LocalGameSession,presentation:PresentationState):void {const p=session.state.pendingDecision;if(p?.kind!=='BREAKTHROUGH_OPTION')return;const o=dispatchGameAction(session,{type:'PASS_BREAKTHROUGH',controllerId:session.activeViewerControllerId,battleId:p.battleId});presentation.message=combatOutcomeMessage('PASS_BREAKTHROUGH',o.result.accepted,o.result.issues);if(o.result.accepted)syncCombatDecisionHandoff(session,presentation);}
export function selectSchwerpunktTarget(presentation:PresentationState,target:HexCoord):void {presentation.schwerpunktTarget={...target};presentation.interactionMode='SCHWERPUNKT';}
export function commitSchwerpunkt(session:LocalGameSession,presentation:PresentationState,unitId:EntityId):void {const p=session.state.pendingDecision,target=presentation.schwerpunktTarget;if(p?.kind!=='SCHWERPUNKT_OPTION'||!target)return;const action:SchwerpunktAttackAction={type:'SCHWERPUNKT_ATTACK',controllerId:session.activeViewerControllerId,sourceBattleId:p.battleId,unitId,target:{...target}};const o=dispatchGameAction(session,action);presentation.message=combatOutcomeMessage('SCHWERPUNKT_ATTACK',o.result.accepted,o.result.issues);if(o.result.accepted){presentation.selectedBattleId=o.result.battleId??null;presentation.schwerpunktTarget=null;syncCombatDecisionHandoff(session,presentation);}}
export function passSchwerpunkt(session:LocalGameSession,presentation:PresentationState):void {const p=session.state.pendingDecision;if(p?.kind!=='SCHWERPUNKT_OPTION')return;const o=dispatchGameAction(session,{type:'PASS_SCHWERPUNKT',controllerId:session.activeViewerControllerId,battleId:p.battleId});presentation.message=combatOutcomeMessage('PASS_SCHWERPUNKT',o.result.accepted,o.result.issues);if(o.result.accepted)syncCombatDecisionHandoff(session,presentation);}

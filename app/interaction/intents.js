import { analyzeBreakthroughAction, validateAttackAction, coreHexKey, getLegalRetreatStepOptions, getNeighbors, } from '../core-adapter/core.js';
import { controllerIdForSide, dispatchGameAction, setActiveViewer } from '../core-adapter/session.js';
import { clearActionDrafts, clearCombatDrafts } from '../state/presentation.js';
function issuesMessage(issues) {
    return issues.map((issue) => `${issue.code}: ${issue.message}`).join(' · ');
}
function sameHex(a, b) { return a.q === b.q && a.r === b.r; }
function adjacent(a, b) { return getNeighbors(a).some((candidate) => sameHex(candidate, b)); }
export function selectCounter(session, presentation, unitId) {
    const clicked = session.state.units[unitId];
    const retreat = session.state.pendingDecision;
    if (retreat?.kind === 'RETREAT' && clicked?.alive && !presentation.privacyGate
        && retreat.decisionOwnerControllerId === session.activeViewerControllerId) {
        const active = presentation.activeRetreaterId ?? retreat.unitIds[0];
        const mover = active ? session.state.units[active] : null;
        const path = active ? presentation.retreatDrafts[active] ?? [] : [];
        if (mover && path.length < retreat.retreatSteps && getLegalRetreatStepOptions(session.state, session.rules, mover, path.at(-1) ?? mover.hex).some(h => sameHex(h, clicked.hex))) {
            extendRetreatDraft(session, presentation, clicked.hex);
            return;
        }
        if (retreat.unitIds.includes(unitId)) {
            selectRetreater(presentation, unitId);
            return;
        }
    }
    const viewerSide = session.state.controllers[session.activeViewerControllerId]?.side;
    if (clicked?.alive && clicked.side !== viewerSide && isCombatTargetSelection(session, presentation)) {
        routeCombatTarget(session, presentation, clicked.hex);
        return;
    }
    const unit = session.state.units[unitId];
    if (!unit)
        return;
    presentation.selectedUnitId = unitId;
    if (session.state.phase === 'SOVIET_DEPLOYMENT' || session.state.phase === 'GERMAN_DEPLOYMENT')
        presentation.selectedDeploymentUnitId = unitId;
    presentation.pathDraft = [];
    if (session.state.phase === 'GERMAN_MOVEMENT' || session.state.phase === 'SOVIET_MOVEMENT')
        presentation.interactionMode = 'MOVE_PATH';
    else if (session.state.phase === 'GERMAN_RECOVERY' || session.state.phase === 'SOVIET_RECOVERY')
        presentation.interactionMode = 'RECOVERY';
    else if (session.state.phase === 'GERMAN_ENTRENCHMENT' || session.state.phase === 'SOVIET_ENTRENCHMENT')
        presentation.interactionMode = 'ENTRENCH';
    else if ((session.state.phase === 'GERMAN_COMBAT' || session.state.phase === 'SOVIET_COMBAT') && !session.state.pendingDecision)
        presentation.interactionMode = 'ATTACK';
    else
        presentation.interactionMode = 'SELECT';
    presentation.message = null;
    if (presentation.interactionMode === 'ATTACK' && !presentation.privacyGate && presentation.attackUnitIds.length === 0
        && unit.alive && unit.controllerId === session.activeViewerControllerId && viewerSide === session.state.activeSide) {
        const legal = getNeighbors(unit.hex).some(target => validateAttackAction(session.state, session.rules, { type: 'ATTACK', controllerId: session.activeViewerControllerId, attackerUnitIds: [unitId], target }).length === 0);
        if (legal) {
            presentation.attackUnitIds = [unitId];
            presentation.attackTarget = null;
            presentation.attackerArtilleryUnitId = null;
            presentation.message = 'Choose a highlighted enemy to preview your attack.';
        }
        else
            presentation.message = 'This unit has no legal attack available. Select another unit.';
    }
}
export function selectDeploymentRosterUnit(presentation, unitId) {
    presentation.selectedDeploymentUnitId = unitId;
    presentation.selectedUnitId = null;
    presentation.message = null;
}
export function deploySelectedUnit(session, presentation, hex) {
    const id = presentation.selectedDeploymentUnitId;
    if (!id) {
        presentation.message = 'Select a deployment unit first.';
        return;
    }
    const action = { type: 'DEPLOY_INITIAL_UNIT', controllerId: session.activeViewerControllerId, deploymentUnitId: id, hex };
    const outcome = dispatchGameAction(session, action);
    if (!outcome.result.accepted) {
        presentation.message = issuesMessage(outcome.result.issues);
        return;
    }
    presentation.message = `${id} deployed to ${coreHexKey(hex)}.`;
    presentation.selectedUnitId = id;
    const roster = session.scenario.deployment?.units.filter((unit) => unit.side === session.state.controllers[session.activeViewerControllerId]?.side) ?? [];
    const next = roster.find((unit) => !session.state.units[unit.id]);
    presentation.selectedDeploymentUnitId = next?.id ?? id;
}
export function readyForPhase(session, presentation) {
    const beforePhase = session.state.phase;
    const beforeSide = session.state.activeSide;
    const outcome = dispatchGameAction(session, { type: 'READY_FOR_PHASE_END', controllerId: session.activeViewerControllerId });
    if (!outcome.result.accepted) {
        presentation.message = issuesMessage(outcome.result.issues);
        return;
    }
    presentation.message = `${beforePhase} complete.`;
    presentation.selectedUnitId = null;
    presentation.selectedDeploymentUnitId = null;
    clearActionDrafts(presentation);
    if (beforePhase === 'SOVIET_DEPLOYMENT' && session.state.phase === 'GERMAN_DEPLOYMENT')
        presentation.privacyGate = 'PASS_TO_GERMAN';
    else if (beforePhase === 'GERMAN_DEPLOYMENT' && session.state.phase === 'GERMAN_SUPPLY_RAIL')
        presentation.privacyGate = 'REVEAL_BOTH';
    else if (session.state.phase !== 'GAME_OVER' && beforeSide !== session.state.activeSide)
        presentation.privacyGate = session.state.activeSide === 'GERMAN' ? 'PASS_TURN_TO_GERMAN' : 'PASS_TURN_TO_SOVIET';
}
export function confirmPrivacyGate(session, presentation) {
    const gate = presentation.privacyGate;
    if (!gate)
        return;
    if (gate === 'COMBAT_DECISION') {
        const owner = session.state.pendingDecision?.decisionOwnerControllerId;
        if (owner)
            setActiveViewer(session, owner);
    }
    else if (gate === 'PASS_TO_GERMAN' || gate === 'REVEAL_BOTH' || gate === 'PASS_TURN_TO_GERMAN')
        setActiveViewer(session, controllerIdForSide(session, 'GERMAN'));
    else
        setActiveViewer(session, controllerIdForSide(session, 'SOVIET'));
    presentation.privacyGate = null;
    clearActionDrafts(presentation);
    presentation.message = gate === 'REVEAL_BOTH' ? 'Deployment revealed. German Turn 1.' : `${session.state.activeSide} interface active.`;
}
export function switchViewerForDevelopment(session, presentation, side) {
    setActiveViewer(session, controllerIdForSide(session, side));
    presentation.selectedUnitId = null;
    presentation.selectedDeploymentUnitId = null;
    clearActionDrafts(presentation);
    presentation.message = `Development viewer switched to ${side}.`;
}
/** Presentation-only path drafting. Counter remains at authoritative Core hex until commit. */
export function extendMoveDraft(session, presentation, destination) {
    const id = presentation.selectedUnitId;
    if (!id) {
        presentation.message = 'Select a controlled unit first.';
        return;
    }
    const unit = session.state.units[id];
    if (!unit) {
        presentation.message = 'Selected unit is unavailable.';
        return;
    }
    const tail = presentation.pathDraft.at(-1) ?? unit.hex;
    if (presentation.pathDraft.length > 0) {
        const previous = presentation.pathDraft.length > 1 ? presentation.pathDraft.at(-2) : unit.hex;
        if (sameHex(destination, previous)) {
            presentation.pathDraft.pop();
            presentation.message = 'Removed last path step.';
            return;
        }
    }
    if (!adjacent(tail, destination)) {
        presentation.message = 'Path draft can only extend to an adjacent Hex.';
        return;
    }
    presentation.pathDraft.push({ ...destination });
    presentation.interactionMode = 'MOVE_PATH';
    presentation.message = `Path drafted to ${coreHexKey(destination)}. Commit only when ready.`;
}
export function undoMoveDraft(presentation) {
    if (presentation.pathDraft.length > 0)
        presentation.pathDraft.pop();
    presentation.message = presentation.pathDraft.length ? 'Removed last path step.' : 'Path draft cleared.';
}
export function cancelMoveDraft(presentation) { presentation.pathDraft = []; presentation.message = 'Movement draft cancelled.'; }
export function commitMoveDraft(session, presentation) {
    const id = presentation.selectedUnitId;
    if (!id || presentation.pathDraft.length === 0) {
        presentation.message = 'Draft at least one movement step first.';
        return;
    }
    const action = { type: 'MOVE', controllerId: session.activeViewerControllerId, unitId: id, path: presentation.pathDraft.map((hex) => ({ ...hex })) };
    const outcome = dispatchGameAction(session, action);
    if (!outcome.result.accepted) {
        presentation.message = issuesMessage(outcome.result.issues);
        return;
    }
    const finalHex = action.path.at(-1);
    presentation.pathDraft = [];
    presentation.message = `${id} moved to ${coreHexKey(finalHex)} through ${action.path.length} step${action.path.length === 1 ? '' : 's'}.`;
}
/** UI-003 compatibility: single tap now drafts one step rather than mutating state immediately. */
export function attemptMove(session, presentation, destination) { extendMoveDraft(session, presentation, destination); }
export function enterRailRepairMode(presentation) { presentation.interactionMode = 'RAIL_REPAIR'; presentation.message = 'Tap railway edges to add/remove them from the repair plan.'; }
export function toggleRailRepairEdge(session, presentation, edgeKey) {
    const edge = session.state.edges[edgeKey];
    if (!edge?.railway?.present) {
        presentation.message = 'That edge is not railway.';
        return;
    }
    const set = new Set(presentation.railRepairEdgeKeys);
    if (set.has(edgeKey))
        set.delete(edgeKey);
    else
        set.add(edgeKey);
    presentation.railRepairEdgeKeys = [...set].sort();
    presentation.interactionMode = 'RAIL_REPAIR';
    presentation.message = `Rail plan: ${presentation.railRepairEdgeKeys.length} edge${presentation.railRepairEdgeKeys.length === 1 ? '' : 's'} selected.`;
}
export function selectRailEngineer(presentation, unitId) { presentation.selectedEngineerUnitId = unitId; presentation.interactionMode = 'RAIL_REPAIR'; }
export function cancelRailRepair(presentation) { presentation.railRepairEdgeKeys = []; presentation.selectedEngineerUnitId = null; presentation.message = 'Rail Repair plan cleared.'; }
export function commitRailRepair(session, presentation) {
    if (presentation.railRepairEdgeKeys.length === 0) {
        presentation.message = 'Select at least one railway edge.';
        return;
    }
    const action = { type: 'RAIL_REPAIR', controllerId: session.activeViewerControllerId, edgeKeys: [...presentation.railRepairEdgeKeys], ...(presentation.selectedEngineerUnitId ? { engineerUnitId: presentation.selectedEngineerUnitId } : {}) };
    const outcome = dispatchGameAction(session, action);
    if (!outcome.result.accepted) {
        presentation.message = issuesMessage(outcome.result.issues);
        return;
    }
    presentation.message = `Rail Repair accepted: ${action.edgeKeys.length} edge${action.edgeKeys.length === 1 ? '' : 's'}.`;
    presentation.railRepairEdgeKeys = [];
    presentation.selectedEngineerUnitId = null;
}
export function selectReinforcement(presentation, id) { presentation.selectedReinforcementId = id; presentation.interactionMode = 'REINFORCEMENT'; presentation.message = null; }
export function deploySelectedReinforcement(session, presentation, entryHex) {
    const id = presentation.selectedReinforcementId;
    if (!id) {
        presentation.message = 'Select a Soviet reinforcement first.';
        return;
    }
    const action = { type: 'DEPLOY_REINFORCEMENT', controllerId: session.activeViewerControllerId, reinforcementId: id, entryHex };
    const outcome = dispatchGameAction(session, action);
    if (!outcome.result.accepted) {
        presentation.message = issuesMessage(outcome.result.issues);
        return;
    }
    presentation.message = `${id} deployed at ${coreHexKey(entryHex)}.`;
    presentation.selectedReinforcementId = null;
}
export function recoverSelectedUnit(session, presentation) {
    const id = presentation.selectedUnitId;
    if (!id) {
        presentation.message = 'Select a damaged controlled unit first.';
        return;
    }
    const action = { type: 'REPAIR_UNIT', controllerId: session.activeViewerControllerId, unitId: id };
    const outcome = dispatchGameAction(session, action);
    presentation.message = outcome.result.accepted ? `${id} recovered one damage step.` : issuesMessage(outcome.result.issues);
}
export function entrenchSelectedUnit(session, presentation) {
    const id = presentation.selectedUnitId;
    if (!id) {
        presentation.message = 'Select a controlled unit first.';
        return;
    }
    const action = { type: 'ENTRENCH', controllerId: session.activeViewerControllerId, unitId: id };
    const outcome = dispatchGameAction(session, action);
    presentation.message = outcome.result.accepted ? `${id} entrenched.` : issuesMessage(outcome.result.issues);
}
function syncCombatDecisionHandoff(session, presentation) {
    const owner = session.state.pendingDecision?.decisionOwnerControllerId;
    if (owner && owner !== session.activeViewerControllerId) {
        presentation.privacyGate = 'COMBAT_DECISION';
        return;
    }
    if (!owner) {
        const activeController = controllerIdForSide(session, session.state.activeSide);
        if (activeController !== session.activeViewerControllerId) {
            presentation.privacyGate = session.state.activeSide === 'GERMAN' ? 'PASS_TURN_TO_GERMAN' : 'PASS_TURN_TO_SOVIET';
        }
    }
}
function combatOutcomeMessage(action, accepted, issues) {
    return accepted ? `${action} accepted by Core.` : issuesMessage(issues);
}
export function toggleAttackUnit(session, presentation, unitId) {
    if (session.state.pendingDecision) {
        presentation.message = 'Resolve the current combat decision before declaring another attack.';
        return;
    }
    const unit = session.state.units[unitId];
    if (!unit || !unit.alive) {
        presentation.message = 'Unit unavailable.';
        return;
    }
    const side = session.state.controllers[session.activeViewerControllerId]?.side;
    if (unit.side !== side || unit.controllerId !== session.activeViewerControllerId) {
        presentation.message = 'Select a controlled attacker.';
        return;
    }
    const set = new Set(presentation.attackUnitIds);
    if (set.has(unitId))
        set.delete(unitId);
    else
        set.add(unitId);
    presentation.attackUnitIds = [...set].sort();
    presentation.interactionMode = 'ATTACK';
    presentation.message = `Attack draft: ${presentation.attackUnitIds.length} direct attacker(s).`;
}
export function isCombatTargetSelection(session, presentation) {
    return (session.state.phase === 'GERMAN_COMBAT' || session.state.phase === 'SOVIET_COMBAT')
        && presentation.interactionMode === 'ATTACK' && presentation.attackUnitIds.length > 0
        && !session.state.pendingDecision && !presentation.privacyGate
        && session.state.controllers[session.activeViewerControllerId]?.side === session.state.activeSide;
}
export function combatTargetIssues(session, presentation, target) {
    return validateAttackAction(session.state, session.rules, { type: 'ATTACK', controllerId: session.activeViewerControllerId,
        attackerUnitIds: [...presentation.attackUnitIds], target: { ...target },
        ...(presentation.attackerArtilleryUnitId ? { support: { attackerArtilleryUnitId: presentation.attackerArtilleryUnitId } } : {}) });
}
export function routeCombatTarget(session, presentation, target) {
    if (!isCombatTargetSelection(session, presentation))
        return false;
    const issues = combatTargetIssues(session, presentation, target);
    if (issues.length) {
        presentation.message = `Cannot select attack target: ${issuesMessage(issues)}`;
        return true;
    }
    selectAttackTarget(presentation, target);
    return true;
}
export function selectAttackTarget(presentation, target) { presentation.attackTarget = { ...target }; presentation.interactionMode = 'ATTACK'; presentation.message = `Target ${coreHexKey(target)} selected.`; }
export function selectAttackerArtillery(presentation, unitId) { presentation.attackerArtilleryUnitId = unitId; presentation.interactionMode = 'ATTACK'; }
export function clearAttackDraft(presentation) { presentation.attackUnitIds = []; presentation.attackTarget = null; presentation.attackerArtilleryUnitId = null; presentation.message = 'Attack draft cleared.'; }
export function declareAttack(session, presentation) {
    if (!presentation.attackTarget || presentation.attackUnitIds.length === 0) {
        presentation.message = 'Choose attacker(s) and an enemy target Hex first.';
        return;
    }
    const action = { type: 'ATTACK', controllerId: session.activeViewerControllerId, attackerUnitIds: [...presentation.attackUnitIds], target: { ...presentation.attackTarget }, ...(presentation.attackerArtilleryUnitId ? { support: { attackerArtilleryUnitId: presentation.attackerArtilleryUnitId } } : {}) };
    const outcome = dispatchGameAction(session, action);
    presentation.message = combatOutcomeMessage('ATTACK', outcome.result.accepted, outcome.result.issues);
    if (!outcome.result.accepted)
        return;
    presentation.selectedBattleId = outcome.result.battleId ?? session.state.pendingDecision?.battleId ?? null;
    clearCombatDrafts(presentation);
    syncCombatDecisionHandoff(session, presentation);
}
export function passCombatReaction(session, presentation) {
    const pending = session.state.pendingDecision;
    if (pending?.kind !== 'DEFENDER_REACTION') {
        presentation.message = 'No defender reaction is pending.';
        return;
    }
    const outcome = dispatchGameAction(session, { type: 'PASS_REACTION', controllerId: session.activeViewerControllerId, battleId: pending.battleId });
    presentation.message = combatOutcomeMessage('PASS_REACTION', outcome.result.accepted, outcome.result.issues);
    if (outcome.result.accepted) {
        presentation.selectedBattleId = pending.battleId;
        syncCombatDecisionHandoff(session, presentation);
    }
}
export function useDefenderArtillery(session, presentation, artilleryUnitId) {
    const pending = session.state.pendingDecision;
    if (pending?.kind !== 'DEFENDER_REACTION') {
        presentation.message = 'No defender reaction is pending.';
        return;
    }
    const action = { type: 'COMBAT_REACTION', controllerId: session.activeViewerControllerId, battleId: pending.battleId, reaction: { kind: 'DEFENDER_ARTILLERY', artilleryUnitId } };
    const outcome = dispatchGameAction(session, action);
    presentation.message = combatOutcomeMessage('COMBAT_REACTION', outcome.result.accepted, outcome.result.issues);
    if (outcome.result.accepted) {
        presentation.selectedBattleId = pending.battleId;
        syncCombatDecisionHandoff(session, presentation);
    }
}
export function appendLossDraft(session, presentation, unitId) {
    const pending = session.state.pendingDecision;
    if (pending?.kind !== 'LOSS_ALLOCATION' || !pending.eligibleUnitIds.includes(unitId)) {
        presentation.message = 'Unit is not eligible for this loss allocation.';
        return;
    }
    presentation.lossDraft.push(unitId);
    presentation.interactionMode = 'LOSS_ALLOCATION';
    presentation.message = `Loss draft: ${presentation.lossDraft.length}/${pending.lossSteps} step(s).`;
}
export function undoLossDraft(presentation) { presentation.lossDraft.pop(); presentation.message = 'Removed last drafted loss.'; }
export function clearLossDraft(presentation) { presentation.lossDraft = []; presentation.message = 'Loss draft cleared.'; }
export function commitLosses(session, presentation) {
    const pending = session.state.pendingDecision;
    if (pending?.kind !== 'LOSS_ALLOCATION') {
        presentation.message = 'No loss allocation is pending.';
        return;
    }
    const action = { type: 'ALLOCATE_LOSSES', controllerId: session.activeViewerControllerId, battleId: pending.battleId, unitIdsByStep: [...presentation.lossDraft] };
    const outcome = dispatchGameAction(session, action);
    presentation.message = combatOutcomeMessage('ALLOCATE_LOSSES', outcome.result.accepted, outcome.result.issues);
    if (outcome.result.accepted) {
        presentation.lossDraft = [];
        syncCombatDecisionHandoff(session, presentation);
    }
}
export function selectRetreater(presentation, unitId) { presentation.activeRetreaterId = unitId; if (!presentation.retreatOrder.includes(unitId))
    presentation.retreatOrder.push(unitId); presentation.interactionMode = 'RETREAT'; }
export function extendRetreatDraft(session, presentation, destination) {
    const pending = session.state.pendingDecision, id = presentation.activeRetreaterId ?? (pending?.kind === 'RETREAT' ? pending.unitIds[0] : null);
    if (pending?.kind !== 'RETREAT' || !id) {
        presentation.message = 'Choose a required retreater first.';
        return;
    }
    const unit = session.state.units[id];
    if (!unit) {
        presentation.message = 'Retreater unavailable.';
        return;
    }
    const path = presentation.retreatDrafts[id] ?? [];
    if (path.length >= pending.retreatSteps) {
        presentation.message = 'Required retreat distance already planned. Choose the next unit or commit.';
        return;
    }
    const from = path.at(-1) ?? unit.hex;
    const legal = getLegalRetreatStepOptions(session.state, session.rules, unit, from).some((hex) => sameHex(hex, destination));
    if (!legal) {
        presentation.message = 'Core retreat helper marks that next Hex illegal.';
        return;
    }
    selectRetreater(presentation, id);
    presentation.retreatDrafts[id] = [...path, { ...destination }];
    presentation.message = `${id} retreat draft: ${presentation.retreatDrafts[id].length} step(s).`;
}
export function undoRetreatStep(presentation) { const id = presentation.activeRetreaterId; if (id)
    presentation.retreatDrafts[id]?.pop(); }
export function commitRetreat(session, presentation) {
    const pending = session.state.pendingDecision;
    if (pending?.kind !== 'RETREAT') {
        presentation.message = 'No retreat is pending.';
        return;
    }
    const ordered = [...presentation.retreatOrder, ...pending.unitIds.filter((id) => !presentation.retreatOrder.includes(id))];
    const action = { type: 'RETREAT', controllerId: session.activeViewerControllerId, battleId: pending.battleId, retreats: ordered.map((unitId) => ({ unitId, path: (presentation.retreatDrafts[unitId] ?? []).map((hex) => ({ ...hex })) })) };
    const outcome = dispatchGameAction(session, action);
    presentation.message = combatOutcomeMessage('RETREAT', outcome.result.accepted, outcome.result.issues);
    if (outcome.result.accepted) {
        presentation.retreatDrafts = {};
        presentation.retreatOrder = [];
        presentation.activeRetreaterId = null;
        syncCombatDecisionHandoff(session, presentation);
    }
}
export function advanceAfterCombat(session, presentation, unitId) { const p = session.state.pendingDecision; if (p?.kind !== 'ADVANCE_AFTER_COMBAT')
    return; const o = dispatchGameAction(session, { type: 'ADVANCE_AFTER_COMBAT', controllerId: session.activeViewerControllerId, battleId: p.battleId, unitId }); presentation.message = combatOutcomeMessage('ADVANCE_AFTER_COMBAT', o.result.accepted, o.result.issues); if (o.result.accepted)
    syncCombatDecisionHandoff(session, presentation); }
export function passAdvance(session, presentation) { const p = session.state.pendingDecision; if (p?.kind !== 'ADVANCE_AFTER_COMBAT')
    return; const o = dispatchGameAction(session, { type: 'PASS_ADVANCE', controllerId: session.activeViewerControllerId, battleId: p.battleId }); presentation.message = combatOutcomeMessage('PASS_ADVANCE', o.result.accepted, o.result.issues); if (o.result.accepted)
    syncCombatDecisionHandoff(session, presentation); }
export function selectBreakthroughUnit(presentation, unitId) { presentation.breakthroughUnitId = unitId; presentation.breakthroughPath = []; presentation.interactionMode = 'BREAKTHROUGH'; }
export function extendBreakthroughDraft(session, presentation, destination) {
    const p = session.state.pendingDecision, id = presentation.breakthroughUnitId;
    if (p?.kind !== 'BREAKTHROUGH_OPTION' || !id)
        return;
    const action = { type: 'BREAKTHROUGH', controllerId: session.activeViewerControllerId, battleId: p.battleId, unitId: id, path: [...presentation.breakthroughPath, { ...destination }] };
    const checked = analyzeBreakthroughAction(session.state, session.rules, action);
    if (checked.issues.length) {
        presentation.message = issuesMessage(checked.issues);
        return;
    }
    presentation.breakthroughPath = [...action.path];
    presentation.message = `Breakthrough draft: ${action.path.length} extra Hex(es).`;
}
export function undoBreakthroughDraft(presentation) { presentation.breakthroughPath.pop(); }
export function commitBreakthrough(session, presentation) { const p = session.state.pendingDecision, id = presentation.breakthroughUnitId; if (p?.kind !== 'BREAKTHROUGH_OPTION' || !id)
    return; const action = { type: 'BREAKTHROUGH', controllerId: session.activeViewerControllerId, battleId: p.battleId, unitId: id, path: presentation.breakthroughPath.map((h) => ({ ...h })) }; const o = dispatchGameAction(session, action); presentation.message = combatOutcomeMessage('BREAKTHROUGH', o.result.accepted, o.result.issues); if (o.result.accepted) {
    presentation.breakthroughPath = [];
    presentation.breakthroughUnitId = null;
    syncCombatDecisionHandoff(session, presentation);
} }
export function passBreakthrough(session, presentation) { const p = session.state.pendingDecision; if (p?.kind !== 'BREAKTHROUGH_OPTION')
    return; const o = dispatchGameAction(session, { type: 'PASS_BREAKTHROUGH', controllerId: session.activeViewerControllerId, battleId: p.battleId }); presentation.message = combatOutcomeMessage('PASS_BREAKTHROUGH', o.result.accepted, o.result.issues); if (o.result.accepted)
    syncCombatDecisionHandoff(session, presentation); }
export function selectSchwerpunktTarget(presentation, target) { presentation.schwerpunktTarget = { ...target }; presentation.interactionMode = 'SCHWERPUNKT'; }
export function commitSchwerpunkt(session, presentation, unitId) { const p = session.state.pendingDecision, target = presentation.schwerpunktTarget; if (p?.kind !== 'SCHWERPUNKT_OPTION' || !target)
    return; const action = { type: 'SCHWERPUNKT_ATTACK', controllerId: session.activeViewerControllerId, sourceBattleId: p.battleId, unitId, target: { ...target } }; const o = dispatchGameAction(session, action); presentation.message = combatOutcomeMessage('SCHWERPUNKT_ATTACK', o.result.accepted, o.result.issues); if (o.result.accepted) {
    presentation.selectedBattleId = o.result.battleId ?? null;
    presentation.schwerpunktTarget = null;
    syncCombatDecisionHandoff(session, presentation);
} }
export function passSchwerpunkt(session, presentation) { const p = session.state.pendingDecision; if (p?.kind !== 'SCHWERPUNKT_OPTION')
    return; const o = dispatchGameAction(session, { type: 'PASS_SCHWERPUNKT', controllerId: session.activeViewerControllerId, battleId: p.battleId }); presentation.message = combatOutcomeMessage('PASS_SCHWERPUNKT', o.result.accepted, o.result.issues); if (o.result.accepted)
    syncCombatDecisionHandoff(session, presentation); }

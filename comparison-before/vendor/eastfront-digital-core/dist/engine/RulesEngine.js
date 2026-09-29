import { validateMoveAction } from '../rules/movement.js';
import { validateAttackAction } from '../rules/combat.js';
import { applyAdvanceAfterCombat, applyBreakthrough, applyCombatReaction, applyLossAllocation, applyOrderedRetreat, applyPassAdvance, applyPassBreakthrough, applyPassSchwerpunkt, declareCombat, declareSchwerpunktCombat, passDefenderReactionAndResolve } from '../rules/combatTransaction.js';
import { validateEntrenchAction } from '../rules/entrenchment.js';
import { refreshGermanSupplyState, refreshSovietSupplyState } from '../rules/supply.js';
import { beginGameTurn, beginPhase, beginPlayerTurn, endPhase, endPlayerTurn } from '../rules/turn.js';
import { applyGermanRailRepair, validateRailRepairAction } from '../rules/rail.js';
import { validateHQCommand } from '../rules/hq.js';
import { applyRecoveryAction, validateRecoveryAction } from '../rules/recovery.js';
import { applyDeploySovietReinforcement, hasDeployableSovietReinforcement, validateDeploySovietReinforcementAction } from '../rules/reinforcement.js';
import { validateAuthorizeUnitCommitment } from '../rules/commitment.js';
import { evaluateVictoryAtCheckpoint, victoryCheckpointForPhase } from '../rules/victory.js';
import { cloneGameState } from './state.js';
import { resolveActionIdentity } from './identity.js';
import { validatePendingDecisionAction } from './transactionGuard.js';
import { applyDeployInitialUnit, evaluateDeploymentSideStatus, isDeploymentPhase, validateDeployInitialUnitAction } from '../rules/deployment.js';
function logAction(state, action, actionId, battleId, accepted, issues) {
    const entry = {
        index: state.actionLog.length,
        actionId,
        ...(battleId ? { battleId } : {}),
        turn: state.turn,
        phase: state.phase,
        action: structuredClone(action),
        accepted,
        validationCodes: issues.map(x => x.code)
    };
    state.actionLog.push(entry);
}
function rejectedEvent(actionId, battleId, issues) {
    return battleId
        ? { type: 'ActionRejected', actionId, battleId, validationCodes: issues.map((x) => x.code) }
        : { type: 'ActionRejected', actionId, validationCodes: issues.map((x) => x.code) };
}
function activeControllerIds(state) {
    const allied = Object.values(state.controllers).filter((controller) => controller.side === state.activeSide);
    // FA-002 / Task 002D-2: every Soviet controller must participate in the reinforcement/supply
    // barrier even when it currently owns no live units, because it may receive a side-wide reinforcement.
    if (state.phase === 'SOVIET_REINFORCEMENT_SUPPLY' || state.phase === 'SOVIET_DEPLOYMENT' || state.phase === 'GERMAN_DEPLOYMENT')
        return allied.map((controller) => controller.id).sort();
    const withLiveUnits = allied.filter((controller) => Object.values(state.units).some((unit) => unit.alive && unit.controllerId === controller.id));
    // Other phases preserve the existing behavior: live-unit owners participate, with an all-allied
    // fallback only when the side has no live units at all.
    return (withLiveUnits.length > 0 ? withLiveUnits : allied).map((controller) => controller.id).sort();
}
function controllerReadyGuard(state, action) {
    // PendingDecision owns the transaction while present; matching resolution actions must not
    // be blocked merely because a controller had previously marked itself ready.
    if (state.pendingDecision)
        return [];
    if (action.type === 'READY_FOR_PHASE_END' || action.type === 'END_PHASE')
        return [];
    if (state.phaseReadyControllerIds.includes(action.controllerId)) {
        return [{ code: 'CONTROLLER_ALREADY_READY', message: 'Controller has already declared Ready for this phase and may not submit further phase actions.' }];
    }
    return [];
}
export class RulesEngine {
    rules;
    scenario;
    constructor(rules, scenario) {
        this.rules = rules;
        this.scenario = scenario;
    }
    apply(state, inputAction) {
        const next = cloneGameState(state);
        const identity = resolveActionIdentity(next, inputAction);
        const action = identity.action;
        const actionId = identity.actionId;
        const battleId = identity.battleId;
        const events = [];
        let issues = [...identity.issues];
        const duplicateCanonicalActionId = identity.issues.some((issue) => issue.code === 'ACTION_ID_DUPLICATE');
        if (!duplicateCanonicalActionId) {
            // 002E-2: terminal game-over guard runs after deterministic identity resolution so rejected
            // post-game actions still receive/log canonical action ids. Duplicate identity remains the
            // higher-priority Foundation error and is never appended twice.
            if (issues.length === 0 && (next.phase === 'GAME_OVER' || next.victory.winner !== null)) {
                issues.push({
                    code: 'WRONG_PHASE',
                    message: 'The game is already over; no further actions may be accepted.',
                    details: { reason: 'GAME_OVER' }
                });
            }
            if (issues.length === 0)
                issues.push(...validatePendingDecisionAction(next, action));
            if (issues.length === 0)
                issues.push(...controllerReadyGuard(next, action));
            if (issues.length === 0 && isDeploymentPhase(next) && action.type !== 'DEPLOY_INITIAL_UNIT' && action.type !== 'READY_FOR_PHASE_END' && action.type !== 'END_PHASE') {
                issues.push({ code: 'WRONG_PHASE', message: 'Only initial placement and Ready actions are legal during pre-game deployment.', details: { reason: 'INITIAL_DEPLOYMENT' } });
            }
        }
        const reject = (combat) => {
            events.push(rejectedEvent(actionId, battleId, issues));
            // A duplicate canonical action identity is never appended to the authoritative log.
            // Transport/request retries need a future clientRequestId, not a duplicate actionId.
            if (!duplicateCanonicalActionId)
                logAction(next, action, actionId, battleId, false, issues);
            return {
                accepted: false,
                actionId,
                ...(battleId ? { battleId } : {}),
                action,
                issues,
                state: next,
                events,
                ...(combat ? { combat } : {})
            };
        };
        const accept = (combat) => {
            logAction(next, action, actionId, battleId, true, issues);
            return {
                accepted: true,
                actionId,
                ...(battleId ? { battleId } : {}),
                action,
                issues,
                state: next,
                events,
                ...(combat ? { combat } : {})
            };
        };
        if (issues.length > 0)
            return reject();
        switch (action.type) {
            case 'MOVE': {
                const validation = validateMoveAction(next, this.rules, action);
                issues = validation.issues;
                if (issues.length === 0) {
                    const u = next.units[action.unitId];
                    const from = { ...u.hex };
                    // validateMoveAction guarantees a non-empty path before this transition executes.
                    const destination = action.path[action.path.length - 1];
                    u.hex = { ...destination };
                    u.hasMoved = true;
                    u.entrenched = false;
                    if (validation.reconIgnoreConsumed)
                        u.reconZocIgnoreUsed = true;
                    events.push({ type: 'UnitMoved', actionId, unitId: u.id, from, to: { ...destination }, spentMP: validation.spentMP, maxMP: validation.maxMP });
                    if (validation.enteredEnemyZoc && validation.enteredEnemyZocHex) {
                        events.push({ type: 'EnteredEnemyZOC', actionId, unitId: u.id, hex: { ...validation.enteredEnemyZocHex } });
                    }
                    return accept();
                }
                return reject();
            }
            case 'ENTRENCH': {
                issues = validateEntrenchAction(next, this.rules, this.scenario, action);
                if (issues.length === 0) {
                    next.units[action.unitId].entrenched = true;
                    events.push({ type: 'UnitEntrenched', actionId, unitId: action.unitId });
                    return accept();
                }
                return reject();
            }
            case 'READY_FOR_PHASE_END':
            case 'END_PHASE': {
                const controller = next.controllers[action.controllerId];
                if (!controller)
                    issues.push({ code: 'INVALID_CONTROLLER', message: 'Unknown controller.' });
                else if (controller.side !== next.activeSide)
                    issues.push({ code: 'WRONG_SIDE', message: 'Only an active-side controller may declare Ready.' });
                if (next.pendingDecision)
                    issues.push({ code: 'PENDING_DECISION_BLOCKS_PHASE_END', message: 'The phase cannot end while a rules decision is pending.' });
                if (next.phaseReadyControllerIds.includes(action.controllerId))
                    issues.push({ code: 'CONTROLLER_ALREADY_READY', message: 'Controller is already Ready for this phase.' });
                if (issues.length === 0 && isDeploymentPhase(next)) {
                    const status = evaluateDeploymentSideStatus(next, this.rules, this.scenario, next.activeSide);
                    if (!status.complete)
                        issues.push({ code: 'INITIAL_DEPLOYMENT_INCOMPLETE', message: 'All active-side deployment roster units must be legally placed before Ready.', details: { missingUnitIds: status.missingUnitIds, invalidUnitIds: status.invalidUnitIds } });
                }
                if (issues.length === 0 && next.phase === 'SOVIET_REINFORCEMENT_SUPPLY' && hasDeployableSovietReinforcement(next, this.rules, this.scenario)) {
                    issues.push({
                        code: 'INVALID_SUPPORT',
                        message: 'Available Soviet reinforcement still has at least one legal East Exit and must be resolved before Ready.',
                        details: { reason: 'DEPLOYABLE_REINFORCEMENT_REMAINS' }
                    });
                }
                if (issues.length > 0)
                    return reject();
                next.phaseReadyControllerIds.push(action.controllerId);
                next.phaseReadyControllerIds.sort();
                events.push({ type: 'ControllerReadyForPhaseEnd', actionId, controllerId: action.controllerId, phase: next.phase });
                const required = activeControllerIds(next);
                const allReady = required.every((id) => next.phaseReadyControllerIds.includes(id));
                if (allReady) {
                    if (next.phase === 'SOVIET_DEPLOYMENT') {
                        const previousPhase = next.phase;
                        beginPhase(next, 'GERMAN_DEPLOYMENT');
                        events.push({ type: 'PhaseEnded', actionId, previousPhase, nextPhase: 'GERMAN_DEPLOYMENT', turn: next.turn });
                        return accept();
                    }
                    if (next.phase === 'GERMAN_DEPLOYMENT') {
                        const previousPhase = next.phase;
                        beginGameTurn(next, this.rules);
                        beginPlayerTurn(next, this.rules, 'GERMAN');
                        beginPhase(next, 'GERMAN_SUPPLY_RAIL');
                        refreshGermanSupplyState(next, this.rules, this.scenario);
                        refreshSovietSupplyState(next, this.rules, this.scenario);
                        events.push({ type: 'PhaseEnded', actionId, previousPhase, nextPhase: 'GERMAN_SUPPLY_RAIL', turn: next.turn });
                        events.push({ type: 'GameTurnStarted', actionId, turn: next.turn });
                        events.push({ type: 'PlayerTurnStarted', actionId, side: 'GERMAN', turn: next.turn });
                        return accept();
                    }
                    // 002E-2: victory is checked exactly when a Player Turn's final side-wide Ready barrier
                    // completes, while the final phase/turn facts still represent the checkpoint. A winner
                    // short-circuits normal endPhase() so no next Player Turn/Game Turn or supply hook starts.
                    const checkpoint = victoryCheckpointForPhase(next.phase);
                    if (checkpoint) {
                        const victory = evaluateVictoryAtCheckpoint(next, this.rules, this.scenario, checkpoint);
                        if (victory.winner !== null) {
                            const previousPhase = next.phase;
                            const previousSide = next.activeSide;
                            endPlayerTurn(next, previousSide);
                            next.victory = structuredClone(victory);
                            beginPhase(next, 'GAME_OVER');
                            events.push({ type: 'PhaseEnded', actionId, previousPhase, nextPhase: 'GAME_OVER', turn: next.turn });
                            return accept();
                        }
                    }
                    const transition = endPhase(next, this.rules);
                    if (transition.nextPhase === 'GERMAN_SUPPLY_RAIL') {
                        refreshGermanSupplyState(next, this.rules, this.scenario);
                    }
                    if (transition.previousPhase === 'SOVIET_REINFORCEMENT_SUPPLY' && transition.nextPhase === 'SOVIET_MOVEMENT') {
                        refreshSovietSupplyState(next, this.rules, this.scenario);
                    }
                    events.push({ type: 'PhaseEnded', actionId, previousPhase: transition.previousPhase, nextPhase: transition.nextPhase, turn: transition.turn });
                    if (transition.gameTurnStarted)
                        events.push({ type: 'GameTurnStarted', actionId, turn: transition.turn });
                    if (transition.playerTurnStarted)
                        events.push({ type: 'PlayerTurnStarted', actionId, side: transition.nextSide, turn: transition.turn });
                }
                return accept();
            }
            case 'TRANSFER_CONTROL': {
                const { assignment } = action;
                const actor = next.controllers[action.controllerId];
                const target = next.controllers[assignment.toControllerId];
                const unit = next.units[assignment.unitId];
                if (!actor || !target)
                    issues.push({ code: 'INVALID_CONTROLLER', message: 'Source or target controller does not exist.' });
                else if (!unit)
                    issues.push({ code: 'UNIT_NOT_FOUND', message: 'Unit does not exist.', unitId: assignment.unitId });
                else if (unit.controllerId !== action.controllerId)
                    issues.push({ code: 'NOT_UNIT_CONTROLLER', message: 'Only current canonical controller may transfer unit.', unitId: unit.id });
                else if (assignment.fromControllerId !== null && assignment.fromControllerId !== unit.controllerId)
                    issues.push({ code: 'NOT_UNIT_CONTROLLER', message: 'ControlAssignment.fromControllerId does not match canonical unit owner.', unitId: unit.id });
                else if (actor.side !== target.side || unit.side !== target.side)
                    issues.push({ code: 'WRONG_SIDE', message: 'Control can only transfer within the same side.', unitId: unit.id });
                if (issues.length > 0 || !actor || !target || !unit)
                    return reject();
                const fromControllerId = unit.controllerId;
                unit.controllerId = target.id;
                // A transfer invalidates any old commitment made by the former owner for this unit.
                for (const commitment of Object.values(next.unitCommitments)) {
                    if (commitment.unitIds.includes(unit.id))
                        commitment.active = false;
                }
                events.push({ type: 'UnitControlTransferred', actionId, unitId: unit.id, fromControllerId, toControllerId: target.id });
                return accept();
            }
            case 'AUTHORIZE_UNIT_COMMITMENT': {
                issues = validateAuthorizeUnitCommitment(next, action);
                if (issues.length > 0)
                    return reject();
                const commitmentId = `C-${actionId}`;
                next.unitCommitments[commitmentId] = {
                    id: commitmentId,
                    grantActionId: actionId,
                    battleId: action.battleId,
                    grantorControllerId: action.controllerId,
                    authorizedControllerId: action.authorizedControllerId,
                    unitIds: [...action.unitIds],
                    createdTurn: next.turn,
                    createdPhase: next.phase,
                    active: true
                };
                events.push({
                    type: 'UnitCommitmentAuthorized', actionId, commitmentId, battleId: action.battleId,
                    grantorControllerId: action.controllerId, authorizedControllerId: action.authorizedControllerId, unitIds: [...action.unitIds]
                });
                return accept();
            }
            case 'ATTACK': {
                issues = validateAttackAction(next, this.rules, action);
                if (issues.length > 0)
                    return reject();
                const result = declareCombat(next, this.rules, action, actionId, battleId);
                issues = result.issues;
                if (issues.length > 0)
                    return reject();
                events.push(...result.events);
                return accept();
            }
            case 'RAIL_REPAIR': {
                issues = validateRailRepairAction(next, this.rules, this.scenario, action);
                if (issues.length > 0)
                    return reject();
                applyGermanRailRepair(next, action);
                return accept();
            }
            case 'DEPLOY_INITIAL_UNIT': {
                issues = validateDeployInitialUnitAction(next, this.rules, this.scenario, action);
                if (issues.length > 0)
                    return reject();
                const placed = applyDeployInitialUnit(next, this.rules, this.scenario, action);
                events.push({ type: 'InitialUnitPlaced', actionId, unitId: placed.unit.id, controllerId: action.controllerId, hex: { ...placed.unit.hex }, repositioned: placed.repositioned });
                return accept();
            }
            case 'DEPLOY_REINFORCEMENT': {
                issues = validateDeploySovietReinforcementAction(next, this.rules, this.scenario, action);
                if (issues.length > 0)
                    return reject();
                applyDeploySovietReinforcement(next, this.rules, this.scenario, action);
                return accept();
            }
            case 'USE_HQ_COMMAND': {
                issues = validateHQCommand(next, this.rules, action);
                return reject();
            }
            case 'REPAIR_UNIT': {
                issues = validateRecoveryAction(next, this.rules, this.scenario, action);
                if (issues.length > 0)
                    return reject();
                applyRecoveryAction(next, this.rules, action);
                return accept();
            }
            case 'BREAKTHROUGH': {
                const result = applyBreakthrough(next, this.rules, action, actionId);
                issues = result.issues;
                if (issues.length > 0)
                    return reject();
                events.push(...result.events);
                return accept();
            }
            case 'COMBAT_REACTION': {
                const result = applyCombatReaction(next, this.rules, action, actionId);
                issues = result.issues;
                if (issues.length > 0)
                    return reject();
                events.push(...result.events);
                return accept();
            }
            case 'PASS_REACTION': {
                const result = passDefenderReactionAndResolve(next, this.rules, action, actionId);
                issues = result.issues;
                if (issues.length > 0)
                    return reject();
                events.push(...result.events);
                const combat = next.combatTransactions[action.battleId]?.context ?? undefined;
                return accept(combat ?? undefined);
            }
            case 'ALLOCATE_LOSSES': {
                const result = applyLossAllocation(next, this.rules, action, actionId);
                issues = result.issues;
                if (issues.length > 0)
                    return reject();
                events.push(...result.events);
                return accept();
            }
            case 'RETREAT': {
                const result = applyOrderedRetreat(next, this.rules, action, actionId);
                issues = result.issues;
                if (issues.length > 0)
                    return reject();
                events.push(...result.events);
                return accept();
            }
            case 'ADVANCE_AFTER_COMBAT': {
                const result = applyAdvanceAfterCombat(next, this.rules, action, actionId);
                issues = result.issues;
                if (issues.length > 0)
                    return reject();
                events.push(...result.events);
                return accept();
            }
            case 'PASS_ADVANCE': {
                const result = applyPassAdvance(next, this.rules, action, actionId);
                issues = result.issues;
                if (issues.length > 0)
                    return reject();
                events.push(...result.events);
                return accept();
            }
            case 'PASS_BREAKTHROUGH': {
                const result = applyPassBreakthrough(next, this.rules, action, actionId);
                issues = result.issues;
                if (issues.length > 0)
                    return reject();
                events.push(...result.events);
                return accept();
            }
            case 'SCHWERPUNKT_ATTACK': {
                const result = declareSchwerpunktCombat(next, this.rules, action, actionId, battleId);
                issues = result.issues;
                if (issues.length > 0)
                    return reject();
                events.push(...result.events);
                return accept();
            }
            case 'PASS_SCHWERPUNKT': {
                const result = applyPassSchwerpunkt(next, action, actionId);
                issues = result.issues;
                if (issues.length > 0)
                    return reject();
                events.push(...result.events);
                return accept();
            }
            case 'END_TURN': {
                issues = [{ code: 'RULE_NOT_IMPLEMENTED', message: `${action.type} is defined but its transition is deferred beyond Task 002A.` }];
                return reject();
            }
        }
    }
}

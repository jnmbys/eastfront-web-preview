const allowedActionTypesByDecision = {
    DEFENDER_REACTION: ['COMBAT_REACTION', 'PASS_REACTION'],
    LOSS_ALLOCATION: ['ALLOCATE_LOSSES'],
    RETREAT: ['RETREAT'],
    ADVANCE_AFTER_COMBAT: ['ADVANCE_AFTER_COMBAT', 'PASS_ADVANCE'],
    BREAKTHROUGH_OPTION: ['BREAKTHROUGH', 'PASS_BREAKTHROUGH'],
    SCHWERPUNKT_OPTION: ['SCHWERPUNKT_ATTACK', 'PASS_SCHWERPUNKT']
};
function actionBattleId(action) {
    if (action.type === 'SCHWERPUNKT_ATTACK')
        return action.sourceBattleId;
    return 'battleId' in action && typeof action.battleId === 'string' ? action.battleId : null;
}
export function validatePendingDecisionAction(state, action) {
    const pending = state.pendingDecision;
    if (!pending)
        return [];
    const allowed = allowedActionTypesByDecision[pending.kind];
    if (!allowed.includes(action.type))
        return [{ code: 'PENDING_DECISION_BLOCKS_ACTION', message: `Pending ${pending.kind} decision must be resolved before ${action.type}.`, details: { pendingKind: pending.kind, battleId: pending.battleId, allowedActionTypes: [...allowed] } }];
    const controller = state.controllers[action.controllerId];
    if (!controller)
        return [{ code: 'INVALID_CONTROLLER', message: 'Unknown controller for pending decision action.' }];
    if (action.controllerId !== pending.decisionOwnerControllerId)
        return [{ code: 'PENDING_DECISION_CONTROLLER_MISMATCH', message: 'Only the current PendingDecision owner may resolve the decision.', details: { controllerId: action.controllerId, decisionOwnerControllerId: pending.decisionOwnerControllerId, eligibleControllerIds: [...pending.eligibleControllerIds] } }];
    const battleId = actionBattleId(action);
    if (battleId !== pending.battleId)
        return [{ code: 'INVALID_BATTLE_REFERENCE', message: 'Pending decision action must reference the pending battle.', details: { expectedBattleId: pending.battleId, actualBattleId: battleId } }];
    return [];
}

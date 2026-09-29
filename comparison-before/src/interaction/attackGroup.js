import { validateAttackAction } from '../core-adapter/core.js';
/** UI routing gate only. Core remains the authority for each proposed group. */
export function isCombatTargetSelection(session, presentation) {
    return (session.state.phase === 'GERMAN_COMBAT' || session.state.phase === 'SOVIET_COMBAT')
        && presentation.interactionMode === 'ATTACK' && presentation.attackUnitIds.length > 0
        && !session.state.pendingDecision && !presentation.privacyGate
        && session.state.controllers[session.activeViewerControllerId]?.side === session.state.activeSide;
}
export function primaryAttackerId(presentation) {
    return presentation.primaryAttackerId && presentation.attackUnitIds.includes(presentation.primaryAttackerId)
        ? presentation.primaryAttackerId : presentation.attackUnitIds[0] ?? null;
}
export function additionalAttackerIssues(session, presentation, unitId) {
    return validateAttackAction(session.state, session.rules, {
        type: 'ATTACK', controllerId: session.activeViewerControllerId,
        attackerUnitIds: [...new Set([...presentation.attackUnitIds, unitId])].sort(),
        target: { ...presentation.attackTarget },
        ...(presentation.attackerArtilleryUnitId ? { support: { attackerArtilleryUnitId: presentation.attackerArtilleryUnitId } } : {}),
    });
}
export function eligibleAdditionalAttackerIds(session, presentation) {
    if (!isCombatTargetSelection(session, presentation) || !presentation.attackTarget)
        return [];
    return Object.keys(session.state.units).filter(id => !presentation.attackUnitIds.includes(id)
        && additionalAttackerIssues(session, presentation, id).length === 0).sort();
}

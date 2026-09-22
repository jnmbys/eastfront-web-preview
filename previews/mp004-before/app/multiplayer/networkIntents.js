import { coreHexKey } from '../core-adapter/core.js';
import { msg } from '../localization/index.js';
const same = (a, b) => coreHexKey(a) === coreHexKey(b);
const pending = (s) => s.playerView.pendingDecision;
const send = (s, a) => s.submit(a);
export function isCombatTargetSelection(s, p) { return s.canSelect && !pending(s) && s.playerView.phase.endsWith('_COMBAT') && p.attackUnitIds.length > 0; }
export function combatTargetIssues(s, p, h) { return s.model.combat?.attackDraft.targetHexes.some(t => same(t, h)) ? [] : [{ code: 'NO_DEFENDER', message: '' }]; }
export function routeCombatTarget(s, p, h) {
    if (!isCombatTargetSelection(s, p))
        return false;
    if (!combatTargetIssues(s, p, h).length) {
        p.attackTarget = { ...h };
        p.interactionMode = 'ATTACK';
    }
    return true;
}
export function selectCounter(s, p, id) {
    const u = s.playerView.units.find(u => u.id === id);
    if (!u)
        return;
    if (u.side !== s.playerView.viewer && routeCombatTarget(s, p, u.hex))
        return;
    if (u.side === s.playerView.viewer && isCombatTargetSelection(s, p) && p.attackTarget) {
        toggleSupportingAttacker(s, p, id);
        return;
    }
    p.selectedUnitId = id;
    p.pathDraft = [];
    p.message = null;
    if (u.side !== s.playerView.viewer)
        return;
    if (s.playerView.phase.endsWith('_MOVEMENT'))
        p.interactionMode = 'MOVE_PATH';
    if (s.playerView.phase.endsWith('_COMBAT') && !pending(s)) {
        p.interactionMode = 'ATTACK';
        p.attackUnitIds = [id];
        p.primaryAttackerId = id;
        p.attackTarget = null;
        p.attackerArtilleryUnitId = null;
    }
}
export function deploySelectedUnit(s, p, hex) { if (p.selectedDeploymentUnitId)
    send(s, { type: 'DEPLOY_INITIAL_UNIT', deploymentUnitId: p.selectedDeploymentUnitId, hex }); }
export function readyForPhase(s, _p) { send(s, { type: 'READY_FOR_PHASE_END' }); }
export function confirmPrivacyGate(_s, p) { p.privacyGate = null; }
export function switchViewerForDevelopment(_s, _p, _side) { }
export function extendMoveDraft(s, p, h) {
    const unit = s.playerView.units.find(u => u.id === p.selectedUnitId);
    if (!unit)
        return;
    const previous = p.pathDraft.length > 1 ? p.pathDraft.at(-2) : unit.hex;
    if (p.pathDraft.length && same(previous, h)) {
        p.pathDraft.pop();
        return;
    }
    if (s.model.moveOptions.some(o => o.legal && same(o.hex, h))) {
        p.pathDraft.push({ ...h });
        p.interactionMode = 'MOVE_PATH';
    }
}
export function commitMoveDraft(s, p) { if (p.selectedUnitId && p.pathDraft.length)
    send(s, { type: 'MOVE', unitId: p.selectedUnitId, path: structuredClone(p.pathDraft) }); }
export function toggleRailRepairEdge(s, p, key) { if (!s.model.railRepair?.railwayEdgeKeys.includes(key))
    return; p.railRepairEdgeKeys = p.railRepairEdgeKeys.includes(key) ? p.railRepairEdgeKeys.filter(k => k !== key) : [...p.railRepairEdgeKeys, key].sort(); }
export function commitRailRepair(s, p) { send(s, { type: 'RAIL_REPAIR', edgeKeys: [...p.railRepairEdgeKeys], ...(p.selectedEngineerUnitId ? { engineerUnitId: p.selectedEngineerUnitId } : {}) }); }
export function deploySelectedReinforcement(s, p, entryHex) { if (p.selectedReinforcementId)
    send(s, { type: 'DEPLOY_REINFORCEMENT', reinforcementId: p.selectedReinforcementId, entryHex }); }
export function recoverSelectedUnit(s, p) { if (p.selectedUnitId)
    send(s, { type: 'REPAIR_UNIT', unitId: p.selectedUnitId }); }
export function entrenchSelectedUnit(s, p) { if (p.selectedUnitId)
    send(s, { type: 'ENTRENCH', unitId: p.selectedUnitId }); }
export function toggleAttackUnit(s, p, id) {
    if (p.attackTarget) {
        toggleSupportingAttacker(s, p, id);
        return;
    }
    if (!s.playerView.units.some(u => u.id === id && u.side === s.playerView.viewer))
        return;
    p.attackUnitIds = p.attackUnitIds.includes(id) ? p.attackUnitIds.filter(i => i !== id) : [...p.attackUnitIds, id];
    p.primaryAttackerId = p.attackUnitIds[0] ?? null;
    p.interactionMode = 'ATTACK';
}
export function toggleSupportingAttacker(s, p, id) {
    if (id === p.primaryAttackerId)
        return;
    if (p.attackUnitIds.includes(id))
        p.attackUnitIds = p.attackUnitIds.filter(i => i !== id);
    else if (s.model.combat?.attackDraft.eligibleAttackerIds.includes(id))
        p.attackUnitIds.push(id);
}
export function attackAndContinue(s, p) { if (p.attackTarget && p.attackUnitIds.length)
    send(s, { type: 'ATTACK', attackerUnitIds: [...p.attackUnitIds], target: { ...p.attackTarget }, ...(p.attackerArtilleryUnitId ? { support: { attackerArtilleryUnitId: p.attackerArtilleryUnitId } } : {}) }); }
export function passCombatReaction(s, _p) { const d = pending(s); if (d?.kind === 'DEFENDER_REACTION')
    send(s, { type: 'PASS_REACTION', battleId: d.battleId }); }
export function useDefenderArtillery(s, _p, id) { const d = pending(s); if (d?.kind === 'DEFENDER_REACTION')
    send(s, { type: 'COMBAT_REACTION', battleId: d.battleId, reaction: { kind: 'DEFENDER_ARTILLERY', artilleryUnitId: id } }); }
export function chooseLossAndContinue(s, p, id) {
    const d = pending(s);
    if (d?.kind !== 'LOSS_ALLOCATION' || !d.eligibleUnitIds.includes(id))
        return;
    p.lossDraft.push(id);
    if (p.lossDraft.length === d.lossSteps)
        send(s, { type: 'ALLOCATE_LOSSES', battleId: d.battleId, unitIdsByStep: [...p.lossDraft] });
}
export function chooseRetreater(s, p, id) {
    const plan = s.model.combat?.retreat;
    if (!plan || !plan.unitIds.includes(id) || plan.completeUnitIds.includes(id))
        return;
    if (plan.activeUnitId && (p.retreatDrafts[plan.activeUnitId]?.length ?? 0) > 0)
        return;
    p.retreatOrder = [...p.retreatOrder.filter(i => i !== id && (p.retreatDrafts[i]?.length || plan.completeUnitIds.includes(i))), id];
    p.activeRetreaterId = id;
}
export function chooseRetreatDestination(s, p, h) {
    const plan = s.model.combat?.retreat, id = plan?.activeUnitId;
    if (!id || !plan?.options.some(o => same(o, h)))
        return;
    if (!p.retreatOrder.includes(id))
        p.retreatOrder.push(id);
    p.retreatDrafts[id] = [...(p.retreatDrafts[id] ?? []), { ...h }];
    // The following query confirms the completed ordered routes and offers RETREAT.
}
export function chooseAdvancer(s, p, id) { if (s.model.combat?.advance?.unitIds.includes(id))
    p.advanceUnitId = id; }
export function chooseAdvanceDestination(s, p, h) { const c = s.model.combat?.advance, d = pending(s); if (!c || !d || !same(c.target, h))
    return; const id = p.advanceUnitId ?? c.selectedUnitId; if (id)
    send(s, { type: 'ADVANCE_AFTER_COMBAT', battleId: d.battleId, unitId: id }); }
export function routeCombatDecisionCounter(s, p, id) {
    const d = pending(s), u = s.playerView.units.find(u => u.id === id);
    if (!d || !u)
        return false;
    if (d.kind === 'RETREAT') {
        if (s.model.combat?.retreat?.options.some(h => same(h, u.hex)))
            chooseRetreatDestination(s, p, u.hex);
        else
            chooseRetreater(s, p, id);
        return true;
    }
    if (d.kind === 'ADVANCE_AFTER_COMBAT') {
        const c = s.model.combat?.advance;
        if (c && same(c.target, u.hex))
            chooseAdvanceDestination(s, p, u.hex);
        else
            chooseAdvancer(s, p, id);
        return true;
    }
    if (d.kind === 'SCHWERPUNKT_OPTION') {
        if (s.model.combat?.schwerpunkt?.targetOptions.some(h => same(h, u.hex)))
            p.schwerpunktTarget = { ...u.hex };
        return true;
    }
    return false;
}
export function passAdvance(s, _p) { const d = pending(s); if (d?.kind === 'ADVANCE_AFTER_COMBAT')
    send(s, { type: 'PASS_ADVANCE', battleId: d.battleId }); }
export function extendBreakthroughDraft(s, p, h) { const b = s.model.combat?.breakthrough; if (b?.options.some(o => o.legal && same(o.hex, h))) {
    p.breakthroughUnitId ??= b.selectedUnitId;
    p.breakthroughPath.push({ ...h });
} }
export function commitBreakthrough(s, p) { const d = pending(s), id = p.breakthroughUnitId ?? s.model.combat?.breakthrough?.selectedUnitId; if (d?.kind === 'BREAKTHROUGH_OPTION' && id)
    send(s, { type: 'BREAKTHROUGH', battleId: d.battleId, unitId: id, path: structuredClone(p.breakthroughPath) }); }
export function passBreakthrough(s, _p) { const d = pending(s); if (d?.kind === 'BREAKTHROUGH_OPTION')
    send(s, { type: 'PASS_BREAKTHROUGH', battleId: d.battleId }); }
export function commitSchwerpunkt(s, p, unitId) { const d = pending(s); if (d?.kind === 'SCHWERPUNKT_OPTION' && p.schwerpunktTarget)
    send(s, { type: 'SCHWERPUNKT_ATTACK', sourceBattleId: d.battleId, unitId, target: { ...p.schwerpunktTarget } }); }
export function passSchwerpunkt(s, _p) { const d = pending(s); if (d?.kind === 'SCHWERPUNKT_OPTION')
    send(s, { type: 'PASS_SCHWERPUNKT', battleId: d.battleId }); }
export function continueCombatFlow(_s, _p) { }

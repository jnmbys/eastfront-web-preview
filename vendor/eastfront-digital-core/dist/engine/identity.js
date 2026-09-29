function formatId(prefix, value) { return `${prefix}-${String(value).padStart(6, '0')}`; }
function usedActionIds(state) { return new Set(state.actionLog.map(e => e.actionId)); }
const ACTION_ID_RE = /^A-(\d{6})$/;
const BATTLE_ID_RE = /^B-(\d{6})$/;
/**
 * Foundation Amendment FA-001:
 * replayed canonical identities must advance deterministic counters exactly as the
 * original generated identities did. This preserves full authoritative-state equality.
 */
function advanceCounterFromCanonicalId(state, id, kind) {
    const m = (kind === 'ACTION' ? ACTION_ID_RE : BATTLE_ID_RE).exec(id);
    if (!m)
        return;
    const value = Number(m[1]);
    if (!Number.isSafeInteger(value) || value < 1)
        return;
    if (kind === 'ACTION')
        state.idCounters.nextAction = Math.max(state.idCounters.nextAction, value + 1);
    else
        state.idCounters.nextBattle = Math.max(state.idCounters.nextBattle, value + 1);
}
export function getBattleIdLifecycle(state, battleId) {
    const tx = state.combatTransactions[battleId];
    if (tx)
        return tx.stage === 'CLOSED' ? 'CLOSED' : 'ESTABLISHED';
    if (Object.values(state.unitCommitments).some(c => c.battleId === battleId))
        return 'RESERVED';
    if (state.actionLog.some(e => !e.accepted && (e.action.type === 'ATTACK' || e.action.type === 'SCHWERPUNKT_ATTACK') && e.battleId === battleId))
        return 'REJECTED_PROPOSAL';
    return 'UNUSED';
}
function reservedBattleIds(state) { const ids = new Set(Object.keys(state.combatTransactions)); for (const c of Object.values(state.unitCommitments))
    ids.add(c.battleId); if (state.pendingDecision)
    ids.add(state.pendingDecision.battleId); return ids; }
function nextGeneratedActionId(state) { const used = usedActionIds(state); let id; do {
    id = formatId('A', state.idCounters.nextAction++);
} while (used.has(id)); return id; }
function nextGeneratedBattleId(state) { const used = reservedBattleIds(state); let id; do {
    id = formatId('B', state.idCounters.nextBattle++);
} while (used.has(id)); return id; }
export function resolveActionIdentity(state, input) {
    const action = structuredClone(input);
    const issues = [];
    const existing = usedActionIds(state);
    const explicitActionId = action.actionId;
    const actionId = explicitActionId ?? nextGeneratedActionId(state);
    if (existing.has(actionId))
        issues.push({ code: 'ACTION_ID_DUPLICATE', message: `Action id ${actionId} has already been used.`, details: { actionId } });
    else if (explicitActionId)
        advanceCounterFromCanonicalId(state, actionId, 'ACTION');
    action.actionId = actionId;
    // Duplicate canonical requests are not logged and must not mutate other identity counters.
    if (issues.some(x => x.code === 'ACTION_ID_DUPLICATE')) {
        if ('battleId' in action && typeof action.battleId === 'string')
            return { action, actionId, battleId: action.battleId, issues };
        return { action, actionId, issues };
    }
    if (action.type === 'ATTACK' || action.type === 'SCHWERPUNKT_ATTACK') {
        const explicitBattleId = action.battleId;
        const battleId = explicitBattleId ?? nextGeneratedBattleId(state);
        if (explicitBattleId)
            advanceCounterFromCanonicalId(state, battleId, 'BATTLE');
        const lifecycle = getBattleIdLifecycle(state, battleId);
        if (lifecycle === 'ESTABLISHED' || lifecycle === 'CLOSED')
            issues.push({ code: 'BATTLE_ID_DUPLICATE', message: `Battle id ${battleId} is already bound to a combat transaction.`, details: { battleId, lifecycle } });
        action.battleId = battleId;
        return { action, actionId, battleId, issues };
    }
    if ('battleId' in action && typeof action.battleId === 'string') {
        // Canonical battle references supplied explicitly also participate in replay counter recovery.
        advanceCounterFromCanonicalId(state, action.battleId, 'BATTLE');
        return { action, actionId, battleId: action.battleId, issues };
    }
    return { action, actionId, issues };
}

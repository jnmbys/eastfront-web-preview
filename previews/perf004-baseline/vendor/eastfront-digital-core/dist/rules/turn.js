export const PHASE_ORDER = [
    'GERMAN_SUPPLY_RAIL',
    'GERMAN_MOVEMENT',
    'GERMAN_COMBAT',
    'GERMAN_RECOVERY',
    'GERMAN_ENTRENCHMENT',
    'SOVIET_REINFORCEMENT_SUPPLY',
    'SOVIET_MOVEMENT',
    'SOVIET_COMBAT',
    'SOVIET_RECOVERY',
    'SOVIET_ENTRENCHMENT'
];
export function phaseSide(phase) {
    if (phase === 'GAME_OVER')
        return null;
    if (phase === 'SOVIET_DEPLOYMENT')
        return 'SOVIET';
    if (phase === 'GERMAN_DEPLOYMENT')
        return 'GERMAN';
    return phase.startsWith('GERMAN_') ? 'GERMAN' : 'SOVIET';
}
export function nextPhase(current) {
    if (current === 'GAME_OVER')
        return { phase: 'GAME_OVER', turnDelta: 0, activeSide: 'GERMAN' };
    if (current === 'SOVIET_DEPLOYMENT' || current === 'GERMAN_DEPLOYMENT')
        throw new Error('Deployment phases use the FA-003 pre-game lifecycle, not nextPhase/endPhase.');
    const index = PHASE_ORDER.indexOf(current);
    const next = PHASE_ORDER[(index + 1) % PHASE_ORDER.length];
    const turnDelta = current === 'SOVIET_ENTRENCHMENT' ? 1 : 0;
    return { phase: next, turnDelta, activeSide: phaseSide(next) };
}
/**
 * Starts a phase and clears the multiplayer ready barrier.
 * Phase-specific future transient state should be initialized here, not in UI/actions.
 */
export function beginPhase(state, phase) {
    state.phase = phase;
    const side = phaseSide(phase);
    if (side)
        state.activeSide = side;
    state.phaseReadyControllerIds = [];
}
/**
 * Starts one side's player turn. Movement/attack/recon/temp-supply flags reset only for that side.
 * Artillery support is a per-current-Player-Turn window, so its flag resets for both armies.
 * HQ's once-per-full-game-turn rule remains tracked via lastHQCommandTurn and is not reset here.
 */
export function beginPlayerTurn(state, rules, side) {
    // Artillery support is limited once per *current Player Turn*, regardless of which side owns it.
    // Opening either side's Player Turn therefore starts a fresh support window for both armies.
    for (const unit of Object.values(state.units))
        unit.artillerySupportUsed = false;
    for (const unit of Object.values(state.units)) {
        if (unit.side !== side)
            continue;
        unit.hasMoved = false;
        unit.hasAttacked = false;
        unit.reconZocIgnoreUsed = false;
        unit.dedicatedRailRepair = false;
        unit.temporarySupply = false;
        if (unit.supplyState === 'TEMPORARY_SUPPLY')
            unit.supplyState = 'OUT_OF_SUPPLY';
    }
    state.cp[side] = Math.min(rules.cp.maximum, state.cp[side] + rules.cp.gainPerOwnTurn);
}
/** Full game turn hook. Intentionally small now; future global turn counters belong here. */
export function beginGameTurn(_state, _rules) {
    // Reserved for full-game-turn transients. Do not scatter those resets across actions.
}
/**
 * Ends one side's player turn. Commitments are battle-scoped and may not leak into a later own turn.
 */
export function endPlayerTurn(state, side) {
    for (const commitment of Object.values(state.unitCommitments)) {
        const grantor = state.controllers[commitment.grantorControllerId];
        if (grantor?.side === side)
            commitment.active = false;
    }
}
/**
 * Single lifecycle transition used after the side-wide ready barrier is satisfied.
 */
export function endPhase(state, rules) {
    const previousPhase = state.phase;
    const previousSide = state.activeSide;
    const n = nextPhase(previousPhase);
    const playerTurnStarted = n.activeSide !== previousSide;
    const gameTurnStarted = n.turnDelta > 0;
    if (playerTurnStarted)
        endPlayerTurn(state, previousSide);
    if (gameTurnStarted) {
        state.turn += n.turnDelta;
        beginGameTurn(state, rules);
    }
    beginPhase(state, n.phase);
    if (playerTurnStarted)
        beginPlayerTurn(state, rules, n.activeSide);
    return {
        previousPhase,
        nextPhase: n.phase,
        previousSide,
        nextSide: n.activeSide,
        playerTurnStarted,
        gameTurnStarted,
        turn: state.turn
    };
}

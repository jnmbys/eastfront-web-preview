import type { GameRules } from '../core/config.js';
import type { GamePhase, GameState, Side } from '../core/types.js';
export declare const PHASE_ORDER: readonly GamePhase[];
export declare function phaseSide(phase: GamePhase): Side | null;
export declare function nextPhase(current: GamePhase): {
    phase: GamePhase;
    turnDelta: number;
    activeSide: Side;
};
/**
 * Starts a phase and clears the multiplayer ready barrier.
 * Phase-specific future transient state should be initialized here, not in UI/actions.
 */
export declare function beginPhase(state: GameState, phase: GamePhase): void;
/**
 * Starts one side's player turn. Movement/attack/recon/temp-supply flags reset only for that side.
 * Artillery support is a per-current-Player-Turn window, so its flag resets for both armies.
 * HQ's once-per-full-game-turn rule remains tracked via lastHQCommandTurn and is not reset here.
 */
export declare function beginPlayerTurn(state: GameState, rules: GameRules, side: Side): void;
/** Full game turn hook. Intentionally small now; future global turn counters belong here. */
export declare function beginGameTurn(_state: GameState, _rules: GameRules): void;
/**
 * Ends one side's player turn. Commitments are battle-scoped and may not leak into a later own turn.
 */
export declare function endPlayerTurn(state: GameState, side: Side): void;
export interface PhaseAdvanceResult {
    previousPhase: GamePhase;
    nextPhase: GamePhase;
    previousSide: Side;
    nextSide: Side;
    playerTurnStarted: boolean;
    gameTurnStarted: boolean;
    turn: number;
}
/**
 * Single lifecycle transition used after the side-wide ready barrier is satisfied.
 */
export declare function endPhase(state: GameState, rules: GameRules): PhaseAdvanceResult;

import type { GameRules, ScenarioConfig } from '../core/config.js';
import type { Action, ActionResult, GameEvent, GameState, IntegrityIssue } from '../core/types.js';
export interface HeadlessActionContext {
    state: GameState;
    actionIndex: number;
    previousResult: ActionResult | null;
}
export type HeadlessActionProvider = (context: HeadlessActionContext) => Action | null;
export type HeadlessTerminationReason = 'GAME_OVER' | 'NO_ACTION' | 'ACTION_LIMIT' | 'REJECTED_ACTION' | 'INTEGRITY_FAILURE';
export interface HeadlessRunOptions {
    maxActions?: number;
    stopOnRejectedAction?: boolean;
    validateIntegrityAfterEachAction?: boolean;
}
export interface HeadlessRunResult {
    finalState: GameState;
    actionResults: ActionResult[];
    canonicalActions: Action[];
    events: GameEvent[];
    terminationReason: HeadlessTerminationReason;
    actionsProcessed: number;
    acceptedActions: number;
    rejectedActions: number;
    integrityIssues: IntegrityIssue[];
}
export interface HeadlessReplayResult {
    finalState: GameState;
    actionResults: ActionResult[];
    events: GameEvent[];
    integrityIssues: IntegrityIssue[];
}
export interface HeadlessReplayOptions {
    validateIntegrityAfterEachAction?: boolean;
}
/**
 * Deterministic orchestration loop. This layer never advances phases or evaluates rules directly;
 * every state transition is produced by RulesEngine.apply().
 */
export declare function runHeadlessGame(initialState: GameState, rules: GameRules, scenario: ScenarioConfig, provider: HeadlessActionProvider, options?: HeadlessRunOptions): HeadlessRunResult;
/**
 * Exact canonical Action replay. Unlike a live session, GAME_OVER does not truncate the supplied
 * list: post-game canonical actions are resubmitted so RulesEngine can deterministically reject them.
 */
export declare function replayHeadlessActions(initialState: GameState, rules: GameRules, scenario: ScenarioConfig, canonicalActions: readonly Action[], options?: HeadlessReplayOptions): HeadlessReplayResult;

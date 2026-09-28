import type { GameRules, ScenarioConfig } from '../core/config.js';
import type { GamePhase, GameState, VictoryState } from '../core/types.js';
export interface GermanCapitalVictoryCondition {
    satisfied: boolean;
    coreHexKeys: string[];
    allCoresHaveRegularGermanOccupier: boolean;
    noLivingSovietOnAnyCore: boolean;
    atLeastOneLiveSuppliedGermanCapitalUnit: boolean;
    regularGermanUnitIdsByCore: Record<string, string[]>;
    sovietUnitIdsByCore: Record<string, string[]>;
    germanUnitIdsByCore: Record<string, string[]>;
    liveSuppliedGermanCapitalUnitIds: string[];
}
export type VictoryCheckpoint = 'GERMAN_PLAYER_TURN_END' | 'SOVIET_PLAYER_TURN_END';
/** Maps only Player Turn final phases to their pure victory checkpoints. */
export declare function victoryCheckpointForPhase(phase: GamePhase): VictoryCheckpoint | null;
/**
 * Task 002E-1 — pure German capital-condition evaluation.
 *
 * Victory occupancy is derived from configured capital-core hexes and living units only.
 * Final supply confirmation deliberately recomputes live normal German supply rather than
 * consuming the per-player-turn UnitState.supplyState snapshot.
 */
export declare function evaluateGermanCapitalVictoryCondition(state: GameState, rules: GameRules, scenario: ScenarioConfig): GermanCapitalVictoryCondition;
/** Pure checkpoint evaluation. Lifecycle/GAME_OVER integration is intentionally deferred to 002E-2. */
export declare function evaluateVictoryAtCheckpoint(state: GameState, rules: GameRules, scenario: ScenarioConfig, checkpoint: VictoryCheckpoint): VictoryState;

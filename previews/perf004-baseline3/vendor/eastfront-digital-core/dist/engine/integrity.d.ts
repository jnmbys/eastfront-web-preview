import type { GameRules, ScenarioConfig } from '../core/config.js';
import type { GameState, IntegrityIssue } from '../core/types.js';
/** Debug/test invariant audit. It never mutates state. */
export declare function validateGameStateIntegrity(state: GameState, rules: GameRules, scenario?: ScenarioConfig): IntegrityIssue[];

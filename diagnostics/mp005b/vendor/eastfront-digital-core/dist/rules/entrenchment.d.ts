import type { GameRules, ScenarioConfig } from '../core/config.js';
import type { EntrenchAction, GameState, ValidationIssue } from '../core/types.js';
export declare function validateEntrenchAction(state: GameState, rules: GameRules, scenario: ScenarioConfig, action: EntrenchAction): ValidationIssue[];

import type { GameRules, ScenarioConfig } from '../core/config.js';
import type { Action, ActionResult, GameState } from '../core/types.js';
export declare class RulesEngine {
    readonly rules: GameRules;
    readonly scenario: ScenarioConfig;
    constructor(rules: GameRules, scenario: ScenarioConfig);
    apply(state: GameState, inputAction: Action): ActionResult;
}

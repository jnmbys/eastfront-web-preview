import type { GameRules, ScenarioConfig } from '../core/config.js';
import type { GameState, HexEdge, HexState, UnitState } from '../core/types.js';
export interface CreateDeploymentGameStateInput {
    scenario: ScenarioConfig;
    rules: GameRules;
    hexes: HexState[];
    edges: HexEdge[];
    seed?: number;
}
export interface CreateGameStateInput {
    scenario: ScenarioConfig;
    rules: GameRules;
    hexes: HexState[];
    edges: HexEdge[];
    units?: UnitState[];
    seed?: number;
}
export declare function createDeploymentGameState(input: CreateDeploymentGameStateInput): GameState;
export declare function createGameState(input: CreateGameStateInput): GameState;
export declare function cloneGameState(state: GameState): GameState;

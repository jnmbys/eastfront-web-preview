import type { GameRules } from '../core/config.js';
import type { GameState, HexCoord, Side, UnitState, ValidationIssue } from '../core/types.js';
export declare function livingUnitsAt(state: GameState, hex: HexCoord, side?: Side): UnitState[];
export declare function stackingIssueForDestination(state: GameState, rules: GameRules, movingUnit: UnitState, destination: HexCoord): ValidationIssue | null;

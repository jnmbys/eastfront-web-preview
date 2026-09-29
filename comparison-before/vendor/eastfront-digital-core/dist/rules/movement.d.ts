import type { GameRules } from '../core/config.js';
import type { GameState, HexCoord, MoveAction, UnitState, ValidationIssue } from '../core/types.js';
export interface StepMovementCost {
    total: number;
    terrain: number;
    river: number;
    usedRoad: boolean;
    usedBridge: boolean;
}
export interface MoveValidation {
    issues: ValidationIssue[];
    spentMP: number;
    maxMP: number;
    allRoad: boolean;
    zocClean: boolean;
    reconIgnoreConsumed: boolean;
    enteredEnemyZoc: boolean;
    enteredEnemyZocHex: HexCoord | null;
}
export declare function movementStepCost(state: GameState, rules: GameRules, unit: UnitState, from: HexCoord, to: HexCoord): StepMovementCost;
export declare function validateMoveAction(state: GameState, rules: GameRules, action: MoveAction): MoveValidation;

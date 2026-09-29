import type { GameRules } from '../core/config.js';
import type { GameState, HexCoord, UnitState, ValidationIssue } from '../core/types.js';
export interface RetreatStepValidation {
    legal: boolean;
    issues: ValidationIssue[];
}
/**
 * Canonical one-step retreat legality. This helper is intentionally shared by
 * pre-CRT encirclement checks and the future post-CRT retreat transition.
 * Retreat direction preferences belong to AI, not the Rules Engine.
 */
export declare function validateRetreatStep(state: GameState, rules: GameRules, unit: UnitState, from: HexCoord, destination: HexCoord): RetreatStepValidation;
export declare function getLegalRetreatStepOptions(state: GameState, rules: GameRules, unit: UnitState, from?: HexCoord): HexCoord[];
export declare function hasLegalRetreatExit(state: GameState, rules: GameRules, unit: UnitState, from?: HexCoord): boolean;
/** Backward-compatible milestone-1 name; score is deliberately neutral. */
export interface RetreatOption {
    hex: HexCoord;
    score: number;
}
export declare function legalRetreatOptions(state: GameState, rules: GameRules, unit: UnitState): RetreatOption[];
/**
 * Maximum legal retreat distance reachable from the unit's current hex, capped at
 * requiredSteps. The search intentionally delegates every candidate step to the
 * canonical shared retreat legality helper. Current CRT retreat distances are at
 * most two, so exhaustive search is small and deterministic.
 */
export declare function getMaxLegalRetreatDistance(state: GameState, rules: GameRules, unit: UnitState, requiredSteps: number): number;

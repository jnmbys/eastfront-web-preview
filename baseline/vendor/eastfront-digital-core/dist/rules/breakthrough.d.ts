import type { BreakthroughAction, GameState, HexCoord, ValidationIssue } from '../core/types.js';
import type { GameRules } from '../core/config.js';
export interface BreakthroughValidation {
    issues: ValidationIssue[];
    from: HexCoord | null;
    destination: HexCoord | null;
}
export declare function validateBreakthroughAction(state: GameState, rules: GameRules, action: BreakthroughAction): ValidationIssue[];
/**
 * BREAKTHROUGH path contains only the extra hexes after the original battle target.
 * A direct attacker still in its attack hex conceptually transits the target first; that
 * transit costs no breakthrough hex and intentionally ignores target transient stacking.
 */
export declare function analyzeBreakthroughAction(state: GameState, rules: GameRules, action: BreakthroughAction): BreakthroughValidation;

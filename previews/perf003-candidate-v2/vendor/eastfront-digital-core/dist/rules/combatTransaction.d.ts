import type { GameRules } from '../core/config.js';
import type { ActionId, AdvanceAfterCombatAction, AllocateLossesAction, AttackAction, BattleId, BreakthroughAction, CombatReactionAction, CombatTransaction, GameEvent, GameState, PassAdvanceAction, PassBreakthroughAction, PassReactionAction, PassSchwerpunktAction, RetreatAction, SchwerpunktAttackAction, Side, ValidationIssue } from '../core/types.js';
export interface CombatDecisionOwnerResolution {
    ownerControllerId: string | null;
    eligibleControllerIds: string[];
    issues: ValidationIssue[];
}
/**
 * Explicit routing helper for combat decisions. Multi-controller defender delegation remains
 * intentionally unsupported until a dedicated collaboration protocol is approved.
 */
export declare function resolveCombatDecisionOwner(state: GameState, side: Side, unitIds: readonly string[]): CombatDecisionOwnerResolution;
export declare function declareCombat(state: GameState, rules: GameRules, action: AttackAction, actionId: ActionId, battleId: BattleId): {
    issues: ValidationIssue[];
    events: GameEvent[];
};
export declare function declareSchwerpunktCombat(state: GameState, rules: GameRules, action: SchwerpunktAttackAction, actionId: ActionId, battleId: BattleId): {
    issues: ValidationIssue[];
    events: GameEvent[];
};
export declare function applyPassSchwerpunkt(state: GameState, action: PassSchwerpunktAction, actionId: ActionId): {
    issues: ValidationIssue[];
    events: GameEvent[];
};
export declare function applyCombatReaction(state: GameState, rules: GameRules, action: CombatReactionAction, actionId: ActionId): {
    issues: ValidationIssue[];
    events: GameEvent[];
};
/**
 * Resolve all deterministic/unique loss allocations, then stop at the first player choice.
 * Once losses are exhausted, this only prepares RETREAT / ADVANCE for the next milestone.
 */
export declare function continueCombatAfterLosses(state: GameState, rules: GameRules, tx: CombatTransaction, actionId: ActionId, events: GameEvent[]): void;
export declare function applyOrderedRetreat(state: GameState, rules: GameRules, action: RetreatAction, actionId: ActionId): {
    issues: ValidationIssue[];
    events: GameEvent[];
};
export declare function applyAdvanceAfterCombat(state: GameState, rules: GameRules, action: AdvanceAfterCombatAction, actionId: ActionId): {
    issues: ValidationIssue[];
    events: GameEvent[];
};
export declare function applyPassAdvance(state: GameState, rules: GameRules, action: PassAdvanceAction, actionId: ActionId): {
    issues: ValidationIssue[];
    events: GameEvent[];
};
export declare function applyBreakthrough(state: GameState, rules: GameRules, action: BreakthroughAction, actionId: ActionId): {
    issues: ValidationIssue[];
    events: GameEvent[];
};
export declare function applyPassBreakthrough(state: GameState, rules: GameRules, action: PassBreakthroughAction, actionId: ActionId): {
    issues: ValidationIssue[];
    events: GameEvent[];
};
export declare function applyLossAllocation(state: GameState, rules: GameRules, action: AllocateLossesAction, actionId: ActionId): {
    issues: ValidationIssue[];
    events: GameEvent[];
};
export declare function passDefenderReactionAndResolve(state: GameState, rules: GameRules, action: PassReactionAction, actionId: ActionId): {
    issues: ValidationIssue[];
    events: GameEvent[];
};

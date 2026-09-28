import type { GameRules } from '../core/config.js';
import type { ActionId, BattleId, CombatLossRequirement, EntityId, GameEvent, GameState, Side, ValidationIssue } from '../core/types.js';
export interface LossRequirementAnalysis {
    requestedSteps: number;
    effectiveSteps: number;
    totalCapacity: number;
    eligibleUnitIds: EntityId[];
    capacityByUnitId: Record<EntityId, number>;
    unique: boolean;
    uniqueSequence: EntityId[] | null;
}
export interface AppliedLossResult {
    allocations: Record<EntityId, number>;
    events: GameEvent[];
}
export declare function remainingDamageCapacity(state: GameState, rules: GameRules, unitId: EntityId): number;
/**
 * Loss fairness is round based: while enough losses remain for every currently-capable
 * participant, each must take one before any can take another. Choice exists only in the
 * final partial round.
 */
export declare function analyzeLossRequirement(state: GameState, rules: GameRules, requirement: CombatLossRequirement): LossRequirementAnalysis;
export declare function validateLossAllocationSequence(state: GameState, rules: GameRules, requirement: CombatLossRequirement, unitIdsByStep: readonly EntityId[]): ValidationIssue[];
export declare function allocationsFromSequence(sequence: readonly EntityId[]): Record<EntityId, number>;
export declare function applyLossSequence(state: GameState, rules: GameRules, battleId: BattleId, side: Side, sequence: readonly EntityId[], actionId: ActionId, automatic: boolean): AppliedLossResult;

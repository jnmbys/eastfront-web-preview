import type { Action, ActionId, BattleId, GameState, ValidationIssue } from '../core/types.js';
export type BattleIdLifecycle = 'UNUSED' | 'REJECTED_PROPOSAL' | 'RESERVED' | 'ESTABLISHED' | 'CLOSED';
export declare function getBattleIdLifecycle(state: GameState, battleId: BattleId): BattleIdLifecycle;
export interface ResolvedActionIdentity {
    action: Action;
    actionId: ActionId;
    battleId?: BattleId;
    issues: ValidationIssue[];
}
export declare function resolveActionIdentity(state: GameState, input: Action): ResolvedActionIdentity;

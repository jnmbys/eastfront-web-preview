import type { GameRules } from '../core/config.js';
import type { AttackAction, CombatContext, DefenderCombatReactionSelection, GameState, Side, UnitState, ValidationIssue } from '../core/types.js';
export declare function validArtillerySupport(state: GameState, unitId: string | undefined, side: Side, target: {
    q: number;
    r: number;
}, requireUnused?: boolean): UnitState | null;
export declare function isUnitAuthorizedForAttack(state: GameState, action: AttackAction, unitId: string): boolean;
export declare function validateAttackAction(state: GameState, rules: GameRules, action: AttackAction): ValidationIssue[];
export declare function buildCombatContext(state: GameState, rules: GameRules, action: AttackAction, defenderReaction?: DefenderCombatReactionSelection): CombatContext;

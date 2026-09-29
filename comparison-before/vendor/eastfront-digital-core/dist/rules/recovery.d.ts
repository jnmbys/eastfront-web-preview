import type { GameRules, ScenarioConfig } from '../core/config.js';
import type { GameState, RepairUnitAction, Side, UnitState, ValidationIssue } from '../core/types.js';
/**
 * Derived German railheads are terminal nodes (active-edge degree 1) in the current Active
 * German Rail Network, excluding configured German west entries. They are never stored in state.
 */
export declare function computeGermanDerivedRailheadHexKeys(state: GameState, scenario: ScenarioConfig): string[];
/** German Recovery Bases = derived active railheads + cities on the Active German Rail Network. */
export declare function computeGermanRecoveryBaseHexKeys(state: GameState, scenario: ScenarioConfig): string[];
/**
 * Soviet Recovery Bases = active independent Soviet supply sources + cities on the full Soviet
 * supply-rail network. A disconnected ordinary city is not a Recovery Base.
 */
export declare function computeSovietRecoveryBaseHexKeys(state: GameState, scenario: ScenarioConfig): string[];
/** Unified pure Recovery Base query. */
export declare function computeRecoveryBaseHexKeys(state: GameState, side: Side, scenario: ScenarioConfig): string[];
/** Resolve the side-wide number of units that may recover during the current full-game turn. */
export declare function getRecoveryUnitLimit(rules: GameRules, side: Side, turn: number): number;
/** Physical adjacency only; ZOC capability, terrain, and control do not matter. */
export declare function isAdjacentToLivingEnemy(state: GameState, unit: UnitState): boolean;
/** Validate one one-step Recovery action. Recovery consumes the authoritative supply snapshot. */
export declare function validateRecoveryAction(state: GameState, rules: GameRules, scenario: ScenarioConfig, action: RepairUnitAction): ValidationIssue[];
/** Apply one previously validated Recovery action: exactly one damage step and its RP cost. */
export declare function applyRecoveryAction(state: GameState, rules: GameRules, action: RepairUnitAction): void;

import type { GameRules, ScenarioConfig } from '../core/config.js';
import type { DeployReinforcementAction, EntityId, GameState, UnitTemplate, UnitType, ValidationIssue } from '../core/types.js';
/** One canonical Scenario-scheduled Soviet reinforcement slot. Never stored in GameState. */
export interface SovietReinforcementSlot {
    id: EntityId;
    scheduledTurn: number;
    type: UnitType;
}
/** Expand canonical Scenario reinforcement rule data into deterministic permanent slot identities. */
export declare function deriveSovietReinforcementSlots(scenario: ScenarioConfig): SovietReinforcementSlot[];
/** Accepted deployment actions are the only canonical evidence that a Scenario slot was consumed. */
export declare function getDeployedSovietReinforcementIds(state: GameState): string[];
export declare function getAvailableSovietReinforcements(state: GameState, scenario: ScenarioConfig): SovietReinforcementSlot[];
export declare function getDelayedSovietReinforcements(state: GameState, scenario: ScenarioConfig): SovietReinforcementSlot[];
export declare function getCurrentTurnSovietReinforcements(state: GameState, scenario: ScenarioConfig): SovietReinforcementSlot[];
/** Pure board-fact query for Soviet reinforcement entry capacity. Phase legality is Task 002D-2. */
export declare function computeLegalSovietReinforcementEntryHexKeys(state: GameState, rules: GameRules, scenario: ScenarioConfig): string[];
export declare function hasDeployableSovietReinforcement(state: GameState, rules: GameRules, scenario: ScenarioConfig): boolean;
export interface SovietReinforcementTemplateResolution {
    status: 'RESOLVED' | 'UNRESOLVED' | 'AMBIGUOUS';
    template: UnitTemplate | null;
}
/** Resolve a scheduled Soviet UnitType defensively; deployment never guesses among multiple templates. */
export declare function resolveSovietReinforcementTemplate(rules: GameRules, slot: SovietReinforcementSlot): SovietReinforcementTemplateResolution;
/**
 * Task 002D-2 authoritative validation for one Soviet reinforcement deployment.
 * Availability remains schedule + accepted actionLog derived; no reinforcement runtime state exists.
 */
export declare function validateDeploySovietReinforcementAction(state: GameState, rules: GameRules, scenario: ScenarioConfig, action: DeployReinforcementAction): ValidationIssue[];
/** Apply a prevalidated deployment. No supply refresh, CP/RP/RNG spend, or GameEvent occurs here. */
export declare function applyDeploySovietReinforcement(state: GameState, rules: GameRules, scenario: ScenarioConfig, action: DeployReinforcementAction): void;

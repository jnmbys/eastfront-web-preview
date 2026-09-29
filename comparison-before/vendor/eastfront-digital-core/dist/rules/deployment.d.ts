import type { GameRules, ScenarioConfig } from '../core/config.js';
import type { DeployInitialUnitAction, EntityId, GameState, HexEdge, HexState, PlayerController, Side, UnitState, ValidationIssue } from '../core/types.js';
export declare function isDeploymentPhase(state: GameState): boolean;
/** Pure, map-derived deployment zone query. Only real, non-LAKE HexState records are returned. */
export declare function deploymentHexKeysForSide(state: GameState, scenario: ScenarioConfig, side: Side): string[];
export interface DeploymentSideStatus {
    complete: boolean;
    missingUnitIds: string[];
    invalidUnitIds: string[];
}
export declare function evaluateDeploymentSideStatus(state: GameState, rules: GameRules, scenario: ScenarioConfig, side: Side): DeploymentSideStatus;
export declare function validateDeployInitialUnitAction(state: GameState, rules: GameRules, scenario: ScenarioConfig, action: DeployInitialUnitAction): ValidationIssue[];
export declare function applyDeployInitialUnit(state: GameState, rules: GameRules, scenario: ScenarioConfig, action: DeployInitialUnitAction): {
    unit: UnitState;
    repositioned: boolean;
};
export interface DeploymentPlayerView {
    scenarioId: string;
    turn: number;
    phase: GameState['phase'];
    activeSide: Side;
    hexes: Record<string, HexState>;
    edges: Record<string, HexEdge>;
    controllers: Record<EntityId, PlayerController>;
    units: Record<EntityId, UnitState>;
    phaseReadyControllerIds: EntityId[];
    ownUnplacedDeploymentUnitIds: EntityId[];
}
/** Whitelist-only hidden deployment DTO. It intentionally excludes actionLog and other private runtime state. */
export declare function projectDeploymentView(state: GameState, scenario: ScenarioConfig, viewerControllerId: EntityId): DeploymentPlayerView;

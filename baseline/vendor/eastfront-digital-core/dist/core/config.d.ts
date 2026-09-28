import type { HexCoord, HQCommand, EntityId, Side, TerrainType, UnitTemplate, UnitType } from './types.js';
export interface TerrainRule {
    movementCost: number | 'IMPASSABLE';
    attackShift: number;
}
export interface RiverRule {
    movementSurcharge: number;
    attackShift: number;
}
export interface SupplyRules {
    germanRadius: number;
    sovietRadius: number;
    oosAttackMultiplier: number;
    oosMovementPenalty: number;
}
export interface RailRules {
    baseRepairPerTurn: number;
    engineerRepairPerTurn: number;
    /** Deprecated legacy allocation parameter. No Digital Edition rules meaning under DR-002. */
    branchCap?: number;
    /** Deprecated legacy allocation parameter. No Digital Edition rules meaning under DR-002. */
    engineerBranchCap?: number;
}
export interface RecoveryRules {
    initialRP: Record<Side, number>;
    maxUnitsPerTurn: {
        GERMAN: number;
        SOVIET: Array<{
            fromTurn: number;
            maxUnits: number;
        }>;
    };
    maxDistanceFromBase: number;
}
export interface CPRules {
    initial: number;
    gainPerOwnTurn: number;
    maximum: number;
}
export interface HQCommandRule {
    command: HQCommand;
    cost: number;
    range?: number;
    crtShift?: number;
}
export interface GameRules {
    id: string;
    stackingLimit: number;
    terrain: Record<TerrainType, TerrainRule>;
    river: {
        MINOR: RiverRule;
        MAJOR: RiverRule;
    };
    road: {
        movementCost: number;
        wholeMoveBonusEnabled: boolean;
        wholeMoveBonusMP: number;
        bridgeCancelsRiverMovementSurcharge: boolean;
    };
    crt: {
        columns: readonly string[];
        thresholds: readonly number[];
        maxNetShift: number;
        table: Record<number, readonly string[]>;
    };
    unitTemplates: Record<string, UnitTemplate>;
    supply: SupplyRules;
    rail: RailRules;
    recovery: RecoveryRules;
    cp: CPRules;
    hqCommands: Record<HQCommand, HQCommandRule>;
    combat: {
        combinedArmsShift: number;
        unsupportedArmorComplexTerrainShift: number;
        antiTankShift: number;
        artilleryShift: number;
        flankShift: number;
        entrenchmentShift: number;
        schwerpunktSecondAttackShift: number;
        germanCombinedArmsArmorTypes: UnitType[];
        germanCombinedArmsCoordinationTypes: UnitType[];
        complexTerrainForArmor: TerrainType[];
    };
}
export interface ReinforcementGroup {
    turn: number;
    units: UnitType[];
}
export interface ScenarioInitialDeploymentUnit {
    id: EntityId;
    templateId: string;
    side: Side;
}
export type DeploymentZoneRule = {
    kind: 'WESTERNMOST_COLUMNS';
    columnCount: number;
} | {
    kind: 'COMPLEMENT_OF_SIDE_ZONE';
    excludedSide: Side;
} | {
    kind: 'EXPLICIT_HEXES';
    hexes: HexCoord[];
};
export interface ScenarioDeploymentConfig {
    sequence: readonly ['SOVIET', 'GERMAN'];
    hiddenUntilBothComplete: true;
    zones: Record<Side, DeploymentZoneRule>;
    units: ScenarioInitialDeploymentUnit[];
}
export interface ScenarioUnitSetup {
    id: string;
    templateId: string;
    hex: HexCoord;
    controllerId: string;
}
export interface ScenarioControllerSetup {
    id: string;
    side: Side;
    controllerType: 'HUMAN' | 'AI';
    displayName?: string;
}
export interface ScenarioConfig {
    id: string;
    displayName: string;
    rulesId: string;
    board: {
        paperColumns: number;
        paperRows: number;
    };
    turnLimit: number;
    experimental: {
        turnLimitCandidates: number[];
        wholeRoadMoveBonusCandidate: boolean;
    };
    germanWestRailEntries: HexCoord[];
    sovietEastRailExits: HexCoord[];
    /** Explicit Soviet independent normal-supply source hexes. Optional for legacy/custom scenarios. */
    sovietSupplySources?: HexCoord[];
    capitalCoreHexes: HexCoord[];
    capitalOuterHexes: HexCoord[];
    reinforcements: ReinforcementGroup[];
    controllers: ScenarioControllerSetup[];
    initialUnits: ScenarioUnitSetup[];
    /** Optional FA-003 pre-game free-deployment configuration. Legacy/fixed scenarios omit it. */
    deployment?: ScenarioDeploymentConfig;
}

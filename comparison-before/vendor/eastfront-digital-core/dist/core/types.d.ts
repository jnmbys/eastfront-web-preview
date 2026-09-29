/** Core serializable domain types. No UI/framework dependencies. */
export type EntityId = string;
export type ActionId = string;
export type BattleId = string;
export interface HexCoord {
    q: number;
    r: number;
}
export type TerrainType = 'PLAIN' | 'FOREST' | 'HILL' | 'MARSH' | 'ROUGH' | 'CITY' | 'MAIN_CITY' | 'OUTER_CITY' | 'LAKE';
export type EdgeFeature = 'ROAD' | 'RAILWAY' | 'MINOR_RIVER' | 'MAJOR_RIVER' | 'BRIDGE';
export type RiverType = 'MINOR' | 'MAJOR';
export type BridgeKind = 'ROAD' | 'RAILWAY' | 'BOTH';
export interface RailwayState {
    present: boolean;
    repairedBy: Side | null;
    destroyed: boolean;
}
export interface BridgeState {
    kind: BridgeKind;
    destroyed: boolean;
}
export interface HexEdge {
    key: string;
    a: HexCoord;
    b: HexCoord;
    road: boolean;
    railway: RailwayState | null;
    river: RiverType | null;
    bridge: BridgeState | null;
}
export interface HexState {
    coord: HexCoord;
    terrain: TerrainType;
    cityId?: string;
    control: Side | null;
}
export type Side = 'GERMAN' | 'SOVIET';
export type ControllerType = 'HUMAN' | 'AI';
export interface PlayerController {
    id: EntityId;
    side: Side;
    controllerType: ControllerType;
    displayName?: string;
}
export interface ControlAssignment {
    unitId: EntityId;
    fromControllerId: EntityId | null;
    toControllerId: EntityId;
}
export type UnitType = 'INFANTRY' | 'JAGER' | 'PANZER' | 'MOTORIZED' | 'ARTILLERY' | 'ENGINEER' | 'RECON' | 'ELITE_INFANTRY' | 'TANK' | 'HEAVY_TANK' | 'ANTI_TANK' | 'HQ';
export type UnitStep = 0 | 1 | 2;
export type SupplyState = 'SUPPLIED' | 'OUT_OF_SUPPLY' | 'TEMPORARY_SUPPLY';
export interface UnitStats {
    attack: number;
    defense: number;
    movement: number;
}
export interface UnitTemplate {
    id: string;
    side: Side;
    type: UnitType;
    steps: readonly [UnitStats, UnitStats, UnitStats];
    maxDamageSteps: 1 | 3;
    exertsZoc: boolean;
    canEntrench: boolean;
    isArmor: boolean;
    infantryCoordination: boolean;
    isSupport: boolean;
    recoveryCostPerStep: number;
}
export interface UnitState {
    id: EntityId;
    templateId: string;
    side: Side;
    type: UnitType;
    step: UnitStep;
    alive: boolean;
    hex: HexCoord;
    supplyState: SupplyState;
    entrenched: boolean;
    hasMoved: boolean;
    hasAttacked: boolean;
    controllerId: EntityId;
    temporarySupply: boolean;
    dedicatedRailRepair: boolean;
    reconZocIgnoreUsed: boolean;
    artillerySupportUsed: boolean;
    lastHQCommandTurn: number | null;
}
export interface Unit extends UnitState, UnitStats {
}
export type HQCommand = 'FORCE_ATTACK' | 'LAST_STAND' | 'STAFF_OFFICE_PLAN' | 'MAKESHIFT_BRIDGES' | 'EXTRA_SUPPLIES' | 'SIEGE_ARTILLERY';
export type GamePhase = 'SOVIET_DEPLOYMENT' | 'GERMAN_DEPLOYMENT' | 'GERMAN_SUPPLY_RAIL' | 'GERMAN_MOVEMENT' | 'GERMAN_COMBAT' | 'GERMAN_RECOVERY' | 'GERMAN_ENTRENCHMENT' | 'SOVIET_REINFORCEMENT_SUPPLY' | 'SOVIET_MOVEMENT' | 'SOVIET_COMBAT' | 'SOVIET_RECOVERY' | 'SOVIET_ENTRENCHMENT' | 'GAME_OVER';
export interface RandomState {
    seed: number;
    state: number;
    draws: number;
}
export interface VictoryState {
    winner: Side | null;
    reason: string | null;
    turn: number | null;
    checkedAtPhase: GamePhase | null;
}
export interface UnitCommitmentAuthorization {
    id: EntityId;
    grantActionId: ActionId;
    battleId: BattleId;
    grantorControllerId: EntityId;
    authorizedControllerId: EntityId;
    unitIds: EntityId[];
    createdTurn: number;
    createdPhase: GamePhase;
    active: boolean;
}
export type CRTResult = 'A3R' | 'A2' | 'A1' | 'AR' | 'EX' | 'NE' | 'DR' | 'D1R' | 'D2R' | 'D3R';
export type CombatStage = 'DEFENDER_REACTION' | 'LOSS_ALLOCATION' | 'RETREAT' | 'ADVANCE_AFTER_COMBAT' | 'BREAKTHROUGH_OPTION' | 'SCHWERPUNKT_OPTION' | 'CLOSED';
export interface CombatHQEffect {
    hqUnitId: EntityId;
    command: HQCommand;
}
export interface CombatDiceResult {
    die1: number;
    die2: number;
    total: number;
}
export interface CombatResolutionState {
    dice: CombatDiceResult;
    crtResult: CRTResult;
    attackerLossSteps: number;
    defenderLossSteps: number;
    attackerRetreatSteps: number;
    defenderRetreatSteps: number;
    retreatConvertedToLoss: boolean;
}
export interface CombatLossRequirement {
    side: Side;
    steps: number;
    eligibleUnitIds: EntityId[];
    reason: 'CRT' | 'RETREAT_IMPOSSIBLE' | 'RETREAT_CONVERSION';
}
export interface CombatRetreatRequirement {
    side: Side;
    steps: number;
    unitIds: EntityId[];
    resolved: boolean;
    impossible: boolean;
}
export interface CombatAdvanceState {
    eligibleUnitIds: EntityId[];
    advancedUnitIds: EntityId[];
    resolved: boolean;
}
export interface CombatBreakthroughState {
    eligibleUnitIds: EntityId[];
    completedUnitIds: EntityId[];
    maxHexesByUnitId: Record<EntityId, number>;
    resolved: boolean;
}
export interface CombatSchwerpunktState {
    eligibleUnitIds: EntityId[];
    selectedUnitId: EntityId | null;
    childBattleId: BattleId | null;
    resolved: boolean;
}
export interface CombatTransaction {
    battleId: BattleId;
    sourceBattleId: BattleId | null;
    stage: CombatStage;
    declaredByActionId: ActionId;
    declaringControllerId: EntityId;
    attackerSide: Side;
    defenderSide: Side;
    attackerUnitIds: EntityId[];
    defenderUnitIds: EntityId[];
    targetHex: HexCoord;
    commitmentIds: EntityId[];
    attackerArtilleryUnitId: EntityId | null;
    defenderArtilleryUnitId: EntityId | null;
    attackerHQEffect: CombatHQEffect | null;
    defenderHQEffect: CombatHQEffect | null;
    defenderReactionPassed: boolean;
    context: CombatContext | null;
    resolution: CombatResolutionState | null;
    unresolvedLosses: CombatLossRequirement[];
    lossesApplied: Record<Side, Record<EntityId, number>>;
    retreat: CombatRetreatRequirement | null;
    retreatImpossibleExtraLossApplied: boolean;
    advance: CombatAdvanceState | null;
    breakthrough: CombatBreakthroughState | null;
    schwerpunkt: CombatSchwerpunktState | null;
    isSchwerpunktSecondAttack: boolean;
    completedByActionId: ActionId | null;
}
export interface PendingDecisionBase {
    battleId: BattleId;
    side: Side;
    decisionOwnerControllerId: EntityId;
    eligibleControllerIds: EntityId[];
}
export type PendingDecision = (PendingDecisionBase & {
    kind: 'DEFENDER_REACTION';
    eligibleHQUnitIds: EntityId[];
    eligibleArtilleryUnitIds: EntityId[];
}) | (PendingDecisionBase & {
    kind: 'LOSS_ALLOCATION';
    lossSteps: number;
    eligibleUnitIds: EntityId[];
}) | (PendingDecisionBase & {
    kind: 'RETREAT';
    retreatSteps: number;
    unitIds: EntityId[];
}) | (PendingDecisionBase & {
    kind: 'ADVANCE_AFTER_COMBAT';
    eligibleUnitIds: EntityId[];
}) | (PendingDecisionBase & {
    kind: 'BREAKTHROUGH_OPTION';
    eligibleUnitIds: EntityId[];
}) | (PendingDecisionBase & {
    kind: 'SCHWERPUNKT_OPTION';
    eligibleUnitIds: EntityId[];
});
export interface DeterministicIdCounters {
    nextAction: number;
    nextBattle: number;
}
export interface GameState {
    scenarioId: string;
    rulesVersion: string;
    turn: number;
    phase: GamePhase;
    activeSide: Side;
    hexes: Record<string, HexState>;
    edges: Record<string, HexEdge>;
    units: Record<EntityId, UnitState>;
    controllers: Record<EntityId, PlayerController>;
    rp: Record<Side, number>;
    cp: Record<Side, number>;
    random: RandomState;
    victory: VictoryState;
    pendingDecision: PendingDecision | null;
    phaseReadyControllerIds: EntityId[];
    unitCommitments: Record<EntityId, UnitCommitmentAuthorization>;
    combatTransactions: Record<BattleId, CombatTransaction>;
    schwerpunktUsedOnTurn: number | null;
    idCounters: DeterministicIdCounters;
    actionLog: LoggedAction[];
}
export interface ActionIdentity {
    actionId?: ActionId;
}
export interface MoveAction extends ActionIdentity {
    type: 'MOVE';
    controllerId: EntityId;
    unitId: EntityId;
    path: HexCoord[];
}
export interface AttackSupportSelection {
    attackerArtilleryUnitId?: EntityId;
    attackerHQUnitId?: EntityId;
    attackerHQCommand?: HQCommand;
    secondSchwerpunktAttack?: boolean;
}
export interface AttackAction extends ActionIdentity {
    type: 'ATTACK';
    controllerId: EntityId;
    battleId?: BattleId;
    attackerUnitIds: EntityId[];
    target: HexCoord;
    commitmentIds?: EntityId[];
    support?: AttackSupportSelection;
}
export interface ReadyForPhaseEndAction extends ActionIdentity {
    type: 'READY_FOR_PHASE_END';
    controllerId: EntityId;
}
export interface EndPhaseAction extends ActionIdentity {
    type: 'END_PHASE';
    controllerId: EntityId;
}
export interface EndTurnAction extends ActionIdentity {
    type: 'END_TURN';
    controllerId: EntityId;
}
export interface UseHQCommandAction extends ActionIdentity {
    type: 'USE_HQ_COMMAND';
    controllerId: EntityId;
    hqUnitId: EntityId;
    command: HQCommand;
    target?: HexCoord;
    unitIds?: EntityId[];
    battleId?: BattleId;
}
export interface EntrenchAction extends ActionIdentity {
    type: 'ENTRENCH';
    controllerId: EntityId;
    unitId: EntityId;
}
export interface RepairUnitAction extends ActionIdentity {
    type: 'REPAIR_UNIT';
    controllerId: EntityId;
    unitId: EntityId;
}
export interface RailRepairAction extends ActionIdentity {
    type: 'RAIL_REPAIR';
    controllerId: EntityId;
    edgeKeys: string[];
    engineerUnitId?: EntityId;
}
export interface DeployReinforcementAction extends ActionIdentity {
    type: 'DEPLOY_REINFORCEMENT';
    controllerId: EntityId;
    reinforcementId: EntityId;
    entryHex: HexCoord;
}
export interface DeployInitialUnitAction extends ActionIdentity {
    type: 'DEPLOY_INITIAL_UNIT';
    controllerId: EntityId;
    deploymentUnitId: EntityId;
    hex: HexCoord;
}
export interface BreakthroughAction extends ActionIdentity {
    type: 'BREAKTHROUGH';
    controllerId: EntityId;
    battleId: BattleId;
    unitId: EntityId;
    path: HexCoord[];
}
export interface PassBreakthroughAction extends ActionIdentity {
    type: 'PASS_BREAKTHROUGH';
    controllerId: EntityId;
    battleId: BattleId;
}
export interface TransferControlAction extends ActionIdentity {
    type: 'TRANSFER_CONTROL';
    controllerId: EntityId;
    assignment: ControlAssignment;
}
export interface AuthorizeUnitCommitmentAction extends ActionIdentity {
    type: 'AUTHORIZE_UNIT_COMMITMENT';
    controllerId: EntityId;
    battleId: BattleId;
    authorizedControllerId: EntityId;
    unitIds: EntityId[];
}
export interface AllocateLossesAction extends ActionIdentity {
    type: 'ALLOCATE_LOSSES';
    controllerId: EntityId;
    battleId: BattleId;
    unitIdsByStep: EntityId[];
}
export interface OrderedRetreat {
    unitId: EntityId;
    path: HexCoord[];
}
export interface RetreatAction extends ActionIdentity {
    type: 'RETREAT';
    controllerId: EntityId;
    battleId: BattleId;
    retreats: OrderedRetreat[];
}
export interface CombatReactionAction extends ActionIdentity {
    type: 'COMBAT_REACTION';
    controllerId: EntityId;
    battleId: BattleId;
    reaction: {
        kind: 'DEFENDER_ARTILLERY';
        artilleryUnitId: EntityId;
    } | {
        kind: 'DEFENDER_HQ_COMMAND';
        hqUnitId: EntityId;
        command: 'LAST_STAND';
    };
}
export interface PassReactionAction extends ActionIdentity {
    type: 'PASS_REACTION';
    controllerId: EntityId;
    battleId: BattleId;
}
export interface AdvanceAfterCombatAction extends ActionIdentity {
    type: 'ADVANCE_AFTER_COMBAT';
    controllerId: EntityId;
    battleId: BattleId;
    unitId: EntityId;
}
export interface PassAdvanceAction extends ActionIdentity {
    type: 'PASS_ADVANCE';
    controllerId: EntityId;
    battleId: BattleId;
}
export interface SchwerpunktAttackAction extends ActionIdentity {
    type: 'SCHWERPUNKT_ATTACK';
    controllerId: EntityId;
    sourceBattleId: BattleId;
    battleId?: BattleId;
    unitId: EntityId;
    target: HexCoord;
    support?: {
        attackerArtilleryUnitId?: EntityId;
    };
}
export interface PassSchwerpunktAction extends ActionIdentity {
    type: 'PASS_SCHWERPUNKT';
    controllerId: EntityId;
    battleId: BattleId;
}
export type Action = MoveAction | AttackAction | ReadyForPhaseEndAction | EndPhaseAction | EndTurnAction | UseHQCommandAction | EntrenchAction | RepairUnitAction | RailRepairAction | DeployReinforcementAction | DeployInitialUnitAction | BreakthroughAction | PassBreakthroughAction | TransferControlAction | AuthorizeUnitCommitmentAction | AllocateLossesAction | RetreatAction | CombatReactionAction | PassReactionAction | AdvanceAfterCombatAction | PassAdvanceAction | SchwerpunktAttackAction | PassSchwerpunktAction;
export type ValidationCode = 'OK' | 'INVALID_CONTROLLER' | 'WRONG_SIDE' | 'WRONG_PHASE' | 'UNIT_NOT_FOUND' | 'UNIT_DESTROYED' | 'NOT_UNIT_CONTROLLER' | 'UNAUTHORIZED_UNIT_COMMITMENT' | 'COMMITMENT_NOT_FOUND' | 'DUPLICATE_ID' | 'EMPTY_MOVE_PATH' | 'NON_ADJACENT_HEX' | 'HEX_OUT_OF_BOUNDS' | 'IMPASSABLE_TERRAIN' | 'ENEMY_OCCUPIED_HEX' | 'STACKING_LIMIT' | 'INSUFFICIENT_MP' | 'ENEMY_ZOC_STOP' | 'ENEMY_ZOC_TO_ZOC' | 'UNIT_ALREADY_MOVED' | 'UNIT_ALREADY_ATTACKED' | 'NOT_ADJACENT_TO_TARGET' | 'NO_DEFENDER' | 'INVALID_SUPPORT' | 'ARTILLERY_ALREADY_USED' | 'INSUFFICIENT_CP' | 'HQ_ALREADY_USED' | 'HQ_OUT_OF_RANGE' | 'INVALID_REACTION' | 'CANNOT_ENTRENCH' | 'MOVED_THIS_TURN' | 'CORE_CANNOT_ENTRENCH' | 'CONTROLLER_ALREADY_READY' | 'PENDING_DECISION_BLOCKS_PHASE_END' | 'PENDING_DECISION_BLOCKS_ACTION' | 'PENDING_DECISION_CONTROLLER_MISMATCH' | 'ACTION_ID_DUPLICATE' | 'BATTLE_ID_DUPLICATE' | 'INVALID_BATTLE_REFERENCE' | 'COMBAT_TRANSACTION_NOT_FOUND' | 'COMBAT_STAGE_MISMATCH' | 'INVALID_LOSS_ALLOCATION' | 'INVALID_RETREAT' | 'INVALID_ADVANCE' | 'INVALID_BREAKTHROUGH' | 'SCHWERPUNKT_UNAVAILABLE' | 'INITIAL_DEPLOYMENT_INCOMPLETE' | 'INVALID_DEPLOYMENT_HEX' | 'DEPLOYMENT_UNIT_UNAVAILABLE' | 'RULE_NOT_IMPLEMENTED';
export interface ValidationIssue {
    code: ValidationCode;
    message: string;
    unitId?: EntityId;
    hex?: HexCoord;
    details?: Record<string, unknown>;
}
export interface DefenderCombatReactionSelection {
    defenderArtilleryUnitId?: EntityId;
    defenderHQCommand?: 'LAST_STAND';
}
export interface ActionResult {
    accepted: boolean;
    actionId: ActionId;
    battleId?: BattleId;
    action: Action;
    issues: ValidationIssue[];
    state: GameState;
    events: GameEvent[];
    combat?: CombatContext;
}
export type GameEvent = {
    type: 'UnitMoved';
    actionId: ActionId;
    unitId: EntityId;
    from: HexCoord;
    to: HexCoord;
    spentMP: number;
    maxMP: number;
} | {
    type: 'EnteredEnemyZOC';
    actionId: ActionId;
    unitId: EntityId;
    hex: HexCoord;
} | {
    type: 'UnitEntrenched';
    actionId: ActionId;
    unitId: EntityId;
} | {
    type: 'InitialUnitPlaced';
    actionId: ActionId;
    unitId: EntityId;
    controllerId: EntityId;
    hex: HexCoord;
    repositioned: boolean;
} | {
    type: 'UnitControlTransferred';
    actionId: ActionId;
    unitId: EntityId;
    fromControllerId: EntityId;
    toControllerId: EntityId;
} | {
    type: 'UnitCommitmentAuthorized';
    actionId: ActionId;
    commitmentId: EntityId;
    battleId: BattleId;
    grantorControllerId: EntityId;
    authorizedControllerId: EntityId;
    unitIds: EntityId[];
} | {
    type: 'ControllerReadyForPhaseEnd';
    actionId: ActionId;
    controllerId: EntityId;
    phase: GamePhase;
} | {
    type: 'PhaseEnded';
    actionId: ActionId;
    previousPhase: GamePhase;
    nextPhase: GamePhase;
    turn: number;
} | {
    type: 'PlayerTurnStarted';
    actionId: ActionId;
    side: Side;
    turn: number;
} | {
    type: 'GameTurnStarted';
    actionId: ActionId;
    turn: number;
} | {
    type: 'ActionRejected';
    actionId: ActionId;
    battleId?: BattleId;
    validationCodes: ValidationCode[];
} | {
    type: 'CombatDeclared';
    actionId: ActionId;
    battleId: BattleId;
    attackerUnitIds: EntityId[];
    defenderUnitIds: EntityId[];
    target: HexCoord;
    sourceBattleId: BattleId | null;
} | {
    type: 'CombatReactionUsed';
    actionId: ActionId;
    battleId: BattleId;
    controllerId: EntityId;
    reaction: 'DEFENDER_ARTILLERY' | 'LAST_STAND';
    unitId: EntityId;
} | {
    type: 'CombatReactionPassed';
    actionId: ActionId;
    battleId: BattleId;
    controllerId: EntityId;
} | {
    type: 'DiceRolled';
    actionId: ActionId;
    battleId: BattleId;
    die1: number;
    die2: number;
    total: number;
} | {
    type: 'CRTResolved';
    actionId: ActionId;
    battleId: BattleId;
    result: CRTResult;
    finalCRTColumn: number;
    finalCRTColumnLabel: string;
} | {
    type: 'UnitStepLost';
    actionId: ActionId;
    battleId: BattleId;
    unitId: EntityId;
    fromStep: UnitStep;
    toStep: UnitStep | null;
} | {
    type: 'UnitDestroyed';
    actionId: ActionId;
    battleId: BattleId;
    unitId: EntityId;
} | {
    type: 'LossesAllocated';
    actionId: ActionId;
    battleId: BattleId;
    side: Side;
    allocations: Record<EntityId, number>;
    automatic: boolean;
} | {
    type: 'UnitRetreated';
    actionId: ActionId;
    battleId: BattleId;
    unitId: EntityId;
    from: HexCoord;
    to: HexCoord;
    path: HexCoord[];
    requiredSteps: number;
    completedSteps: number;
} | {
    type: 'RetreatImpossible';
    actionId: ActionId;
    battleId: BattleId;
    side: Side;
    extraLossSteps: number;
} | {
    type: 'AdvanceAvailable';
    actionId: ActionId;
    battleId: BattleId;
    eligibleUnitIds: EntityId[];
} | {
    type: 'UnitAdvanced';
    actionId: ActionId;
    battleId: BattleId;
    unitId: EntityId;
    from: HexCoord;
    to: HexCoord;
} | {
    type: 'BreakthroughAvailable';
    actionId: ActionId;
    battleId: BattleId;
    eligibleUnitIds: EntityId[];
    maxHexesByUnitId: Record<EntityId, number>;
} | {
    type: 'UnitBrokeThrough';
    actionId: ActionId;
    battleId: BattleId;
    unitId: EntityId;
    from: HexCoord;
    to: HexCoord;
    path: HexCoord[];
} | {
    type: 'SchwerpunktAvailable';
    actionId: ActionId;
    battleId: BattleId;
    eligibleUnitIds: EntityId[];
} | {
    type: 'SchwerpunktDeclared';
    actionId: ActionId;
    sourceBattleId: BattleId;
    battleId: BattleId;
    unitId: EntityId;
} | {
    type: 'SchwerpunktPassed';
    actionId: ActionId;
    sourceBattleId: BattleId;
    controllerId: EntityId;
} | {
    type: 'CombatCompleted';
    actionId: ActionId;
    battleId: BattleId;
};
export interface CombatModifierBreakdown {
    terrainShift: number;
    riverShift: number;
    engineerShift: number;
    combinedArmsShift: number;
    unsupportedArmorShift: number;
    antiTankShift: number;
    attackerArtilleryShift: number;
    defenderArtilleryShift: number;
    flankShift: number;
    entrenchmentShift: number;
    hqShift: number;
    secondAttackShift: number;
    rawShift: number;
    cappedShift: number;
}
export interface CombatContext {
    battleId?: BattleId;
    attackerSide: Side;
    target: HexCoord;
    attackerUnitIds: EntityId[];
    defenderUnitIds: EntityId[];
    attackStrength: number;
    rawDefenseStrength: number;
    finalDefenseStrength: number;
    defenseStrength: number;
    oosSurroundedDefenseHalved: boolean;
    baseOdds: string;
    baseCRTColumn: number;
    modifiers: CombatModifierBreakdown;
    finalShift: number;
    finalCRTColumn: number;
    finalCRTColumnLabel: string;
    attackerArtilleryUnitId: EntityId | null;
    defenderArtilleryUnitId: EntityId | null;
}
export interface LoggedAction {
    index: number;
    actionId: ActionId;
    battleId?: BattleId;
    turn: number;
    phase: GamePhase;
    action: Action;
    accepted: boolean;
    validationCodes: ValidationCode[];
}
export interface IntegrityIssue {
    code: string;
    message: string;
    details?: Record<string, unknown>;
}

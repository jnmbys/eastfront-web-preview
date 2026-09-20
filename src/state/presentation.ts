import type { Message } from '../localization/index.js';
import type { BattleId, EntityId, HexCoord } from '../core-adapter/core.js';
import type { RendererMode, TerrainAssetSet } from '../render/terrainAssets.js';

export type PrivacyGate = 'PASS_TO_GERMAN' | 'REVEAL_BOTH' | 'PASS_TURN_TO_GERMAN' | 'PASS_TURN_TO_SOVIET' | 'COMBAT_DECISION' | null;
export type InteractionMode = 'SELECT' | 'MOVE_PATH' | 'RAIL_REPAIR' | 'REINFORCEMENT' | 'RECOVERY' | 'ENTRENCH' | 'ATTACK' | 'LOSS_ALLOCATION' | 'RETREAT' | 'BREAKTHROUGH' | 'SCHWERPUNKT';

export interface PresentationState {
  selectedUnitId: EntityId | null;
  selectedDeploymentUnitId: EntityId | null;
  hoveredHex: HexCoord | null;
  debug: boolean;
  panelCollapsed: boolean;
  privacyGate: PrivacyGate;
  message: Message | null;
  interactionMode: InteractionMode;
  pathDraft: HexCoord[];
  railRepairEdgeKeys: string[];
  selectedEngineerUnitId: EntityId | null;
  selectedReinforcementId: EntityId | null;
  attackUnitIds: EntityId[];
  attackTarget: HexCoord | null;
  attackerArtilleryUnitId: EntityId | null;
  selectedBattleId: BattleId | null;
  lossDraft: EntityId[];
  retreatOrder: EntityId[];
  retreatDrafts: Record<EntityId, HexCoord[]>;
  activeRetreaterId: EntityId | null;
  breakthroughUnitId: EntityId | null;
  breakthroughPath: HexCoord[];
  schwerpunktTarget: HexCoord | null;
  rendererMode: RendererMode;
  productionAssetSet: TerrainAssetSet;
}

export function createPresentationState(debug = false, panelCollapsed = false): PresentationState {
  return {
    selectedUnitId:null, selectedDeploymentUnitId:null, hoveredHex:null, debug, panelCollapsed,
    privacyGate:null, message:null, interactionMode:'SELECT', pathDraft:[], railRepairEdgeKeys:[],
    selectedEngineerUnitId:null, selectedReinforcementId:null, attackUnitIds:[], attackTarget:null,
    attackerArtilleryUnitId:null, selectedBattleId:null, lossDraft:[], retreatOrder:[], retreatDrafts:{},
    activeRetreaterId:null, breakthroughUnitId:null, breakthroughPath:[], schwerpunktTarget:null, rendererMode:'production', productionAssetSet:'p5',
  };
}

export function clearCombatDrafts(presentation:PresentationState):void {
  presentation.attackUnitIds=[];presentation.attackTarget=null;presentation.attackerArtilleryUnitId=null;
  presentation.lossDraft=[];presentation.retreatOrder=[];presentation.retreatDrafts={};presentation.activeRetreaterId=null;
  presentation.breakthroughUnitId=null;presentation.breakthroughPath=[];presentation.schwerpunktTarget=null;
}

export function clearActionDrafts(presentation:PresentationState):void {
  presentation.pathDraft=[];presentation.railRepairEdgeKeys=[];presentation.selectedEngineerUnitId=null;
  presentation.selectedReinforcementId=null;clearCombatDrafts(presentation);presentation.interactionMode='SELECT';
}

export function createPresentationState(debug = false, panelCollapsed = false) {
    return {
        selectedUnitId: null, selectedDeploymentUnitId: null, hoveredHex: null, debug, panelCollapsed,
        privacyGate: null, message: null, interactionMode: 'SELECT', pathDraft: [], railRepairEdgeKeys: [],
        selectedEngineerUnitId: null, selectedReinforcementId: null, attackUnitIds: [], attackTarget: null,
        attackerArtilleryUnitId: null, selectedBattleId: null, lossDraft: [], retreatOrder: [], retreatDrafts: {},
        activeRetreaterId: null, breakthroughUnitId: null, breakthroughPath: [], schwerpunktTarget: null, rendererMode: 'production', productionAssetSet: 'p5',
    };
}
export function clearCombatDrafts(presentation) {
    presentation.attackUnitIds = [];
    presentation.attackTarget = null;
    presentation.attackerArtilleryUnitId = null;
    presentation.lossDraft = [];
    presentation.retreatOrder = [];
    presentation.retreatDrafts = {};
    presentation.activeRetreaterId = null;
    presentation.breakthroughUnitId = null;
    presentation.breakthroughPath = [];
    presentation.schwerpunktTarget = null;
}
export function clearActionDrafts(presentation) {
    presentation.pathDraft = [];
    presentation.railRepairEdgeKeys = [];
    presentation.selectedEngineerUnitId = null;
    presentation.selectedReinforcementId = null;
    clearCombatDrafts(presentation);
    presentation.interactionMode = 'SELECT';
}

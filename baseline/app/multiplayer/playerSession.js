import * as local from '../interaction/intents.js';
import * as flow from '../interaction/combatFlow.js';
import * as remote from './networkIntents.js';
import { NetworkPlayerSession } from './networkSession.js';
import { sessionPlayerView as localView, dispatchGameAction as localDispatch } from '../core-adapter/session.js';
import { deriveBrowserRenderModel as localModel } from '../core-adapter/browserProjection.js';
import { isNetworkAction } from './gameplayProtocol.js';
export * from '../interaction/intents.js';
export { undoRetreatDestination } from '../interaction/combatFlow.js';
export const isNetwork = (s) => s instanceof NetworkPlayerSession;
export const sessionPlayerView = (s) => isNetwork(s) ? s.playerView : localView(s);
export const deriveBrowserRenderModel = (s, p) => isNetwork(s) ? s.renderModel() : localModel(s, p);
export const isSessionDeployment = (s) => sessionPlayerView(s).phase.endsWith('_DEPLOYMENT');
export function dispatchGameAction(s, action) {
    if (!isNetwork(s)) {
        localDispatch(s, action);
        return;
    }
    const { controllerId: _, actionId: __, ...dto } = action;
    if (isNetworkAction(dto))
        s.submit(dto);
}
export function selectCounter(s, ...args) { return isNetwork(s) ? remote.selectCounter(s, ...args) : local.selectCounter(s, ...args); }
export function deploySelectedUnit(s, ...args) { return isNetwork(s) ? remote.deploySelectedUnit(s, ...args) : local.deploySelectedUnit(s, ...args); }
export function readyForPhase(s, ...args) { return isNetwork(s) ? remote.readyForPhase(s, ...args) : local.readyForPhase(s, ...args); }
export function confirmPrivacyGate(s, ...args) { return isNetwork(s) ? remote.confirmPrivacyGate(s, ...args) : local.confirmPrivacyGate(s, ...args); }
export function switchViewerForDevelopment(s, ...args) { return isNetwork(s) ? remote.switchViewerForDevelopment(s, ...args) : local.switchViewerForDevelopment(s, ...args); }
export function extendMoveDraft(s, ...args) { return isNetwork(s) ? remote.extendMoveDraft(s, ...args) : local.extendMoveDraft(s, ...args); }
export function commitMoveDraft(s, ...args) { return isNetwork(s) ? remote.commitMoveDraft(s, ...args) : local.commitMoveDraft(s, ...args); }
export function toggleRailRepairEdge(s, ...args) { return isNetwork(s) ? remote.toggleRailRepairEdge(s, ...args) : local.toggleRailRepairEdge(s, ...args); }
export function commitRailRepair(s, ...args) { return isNetwork(s) ? remote.commitRailRepair(s, ...args) : local.commitRailRepair(s, ...args); }
export function deploySelectedReinforcement(s, ...args) { return isNetwork(s) ? remote.deploySelectedReinforcement(s, ...args) : local.deploySelectedReinforcement(s, ...args); }
export function recoverSelectedUnit(s, ...args) { return isNetwork(s) ? remote.recoverSelectedUnit(s, ...args) : local.recoverSelectedUnit(s, ...args); }
export function entrenchSelectedUnit(s, ...args) { return isNetwork(s) ? remote.entrenchSelectedUnit(s, ...args) : local.entrenchSelectedUnit(s, ...args); }
export function toggleAttackUnit(s, ...args) { return isNetwork(s) ? remote.toggleAttackUnit(s, ...args) : local.toggleAttackUnit(s, ...args); }
export function toggleSupportingAttacker(s, ...args) { return isNetwork(s) ? remote.toggleSupportingAttacker(s, ...args) : local.toggleSupportingAttacker(s, ...args); }
export function combatTargetIssues(s, ...args) { return isNetwork(s) ? remote.combatTargetIssues(s, ...args) : local.combatTargetIssues(s, ...args); }
export function routeCombatTarget(s, ...args) { return isNetwork(s) ? remote.routeCombatTarget(s, ...args) : local.routeCombatTarget(s, ...args); }
export function attackAndContinue(s, ...args) { return isNetwork(s) ? remote.attackAndContinue(s, ...args) : local.attackAndContinue(s, ...args); }
export function passCombatReaction(s, ...args) { return isNetwork(s) ? remote.passCombatReaction(s, ...args) : local.passCombatReaction(s, ...args); }
export function useDefenderArtillery(s, ...args) { return isNetwork(s) ? remote.useDefenderArtillery(s, ...args) : local.useDefenderArtillery(s, ...args); }
export function chooseLossAndContinue(s, ...args) { return isNetwork(s) ? remote.chooseLossAndContinue(s, ...args) : local.chooseLossAndContinue(s, ...args); }
export function passAdvance(s, ...args) { return isNetwork(s) ? remote.passAdvance(s, ...args) : local.passAdvance(s, ...args); }
export function extendBreakthroughDraft(s, ...args) { return isNetwork(s) ? remote.extendBreakthroughDraft(s, ...args) : local.extendBreakthroughDraft(s, ...args); }
export function commitBreakthrough(s, ...args) { return isNetwork(s) ? remote.commitBreakthrough(s, ...args) : local.commitBreakthrough(s, ...args); }
export function passBreakthrough(s, ...args) { return isNetwork(s) ? remote.passBreakthrough(s, ...args) : local.passBreakthrough(s, ...args); }
export function commitSchwerpunkt(s, ...args) { return isNetwork(s) ? remote.commitSchwerpunkt(s, ...args) : local.commitSchwerpunkt(s, ...args); }
export function passSchwerpunkt(s, ...args) { return isNetwork(s) ? remote.passSchwerpunkt(s, ...args) : local.passSchwerpunkt(s, ...args); }
export function chooseRetreater(s, ...args) { return isNetwork(s) ? remote.chooseRetreater(s, ...args) : flow.chooseRetreater(s, ...args); }
export function chooseRetreatDestination(s, ...args) { return isNetwork(s) ? remote.chooseRetreatDestination(s, ...args) : flow.chooseRetreatDestination(s, ...args); }
export function chooseAdvancer(s, ...args) { return isNetwork(s) ? remote.chooseAdvancer(s, ...args) : flow.chooseAdvancer(s, ...args); }
export function routeCombatDecisionCounter(s, ...args) { return isNetwork(s) ? remote.routeCombatDecisionCounter(s, ...args) : flow.routeCombatDecisionCounter(s, ...args); }
export function chooseAdvanceDestination(s, ...args) { return isNetwork(s) ? remote.chooseAdvanceDestination(s, ...args) : flow.chooseAdvanceDestination(s, ...args); }
export function continueCombatFlow(s, ...args) { return isNetwork(s) ? remote.continueCombatFlow(s, ...args) : flow.continueCombatFlow(s, ...args); }
export function isCombatTargetSelection(s, p) { return isNetwork(s) ? remote.isCombatTargetSelection(s, p) : local.isCombatTargetSelection(s, p); }

import * as local from '../interaction/intents.js';
import * as flow from '../interaction/combatFlow.js';
import * as remote from './networkIntents.js';
import {NetworkPlayerSession} from './networkSession.js';
import {sessionPlayerView as localView,dispatchGameAction as localDispatch,type LocalGameSession} from '../core-adapter/session.js';
import {deriveBrowserRenderModel as localModel} from '../core-adapter/browserProjection.js';
import type {PresentationState} from '../state/presentation.js';
import type {Action} from '../core-adapter/core.js';
import {isNetworkAction} from './gameplayProtocol.js';
export * from '../interaction/intents.js';
export {undoRetreatDestination} from '../interaction/combatFlow.js';
export type PlayerSession=LocalGameSession|NetworkPlayerSession;
export const isNetwork=(s:PlayerSession|null):s is NetworkPlayerSession=>s instanceof NetworkPlayerSession;
export const sessionPlayerView=(s:PlayerSession)=>isNetwork(s)?s.playerView:localView(s);
export const deriveBrowserRenderModel=(s:PlayerSession,p:PresentationState)=>isNetwork(s)?s.renderModel():localModel(s,p);
export const isSessionDeployment=(s:PlayerSession)=>sessionPlayerView(s).phase.endsWith('_DEPLOYMENT');
type Tail<T extends unknown[]>=T extends [unknown,...infer R]?R:never;
export function dispatchGameAction(s:PlayerSession,action:Action):void {
 if(!isNetwork(s)){localDispatch(s,action);return;}
 const {controllerId:_,actionId:__,...dto}=action;if(isNetworkAction(dto))s.submit(dto);
}
export function selectCounter(s:PlayerSession,...args:Tail<Parameters<typeof local.selectCounter>>):ReturnType<typeof local.selectCounter> {return isNetwork(s)?remote.selectCounter(s,...args):local.selectCounter(s,...args);}
export function deploySelectedUnit(s:PlayerSession,...args:Tail<Parameters<typeof local.deploySelectedUnit>>):ReturnType<typeof local.deploySelectedUnit> {return isNetwork(s)?remote.deploySelectedUnit(s,...args):local.deploySelectedUnit(s,...args);}
export function readyForPhase(s:PlayerSession,...args:Tail<Parameters<typeof local.readyForPhase>>):ReturnType<typeof local.readyForPhase> {return isNetwork(s)?remote.readyForPhase(s,...args):local.readyForPhase(s,...args);}
export function confirmPrivacyGate(s:PlayerSession,...args:Tail<Parameters<typeof local.confirmPrivacyGate>>):ReturnType<typeof local.confirmPrivacyGate> {return isNetwork(s)?remote.confirmPrivacyGate(s,...args):local.confirmPrivacyGate(s,...args);}
export function switchViewerForDevelopment(s:PlayerSession,...args:Tail<Parameters<typeof local.switchViewerForDevelopment>>):ReturnType<typeof local.switchViewerForDevelopment> {return isNetwork(s)?remote.switchViewerForDevelopment(s,...args):local.switchViewerForDevelopment(s,...args);}
export function extendMoveDraft(s:PlayerSession,...args:Tail<Parameters<typeof local.extendMoveDraft>>):ReturnType<typeof local.extendMoveDraft> {return isNetwork(s)?remote.extendMoveDraft(s,...args):local.extendMoveDraft(s,...args);}
export function commitMoveDraft(s:PlayerSession,...args:Tail<Parameters<typeof local.commitMoveDraft>>):ReturnType<typeof local.commitMoveDraft> {return isNetwork(s)?remote.commitMoveDraft(s,...args):local.commitMoveDraft(s,...args);}
export function toggleRailRepairEdge(s:PlayerSession,...args:Tail<Parameters<typeof local.toggleRailRepairEdge>>):ReturnType<typeof local.toggleRailRepairEdge> {return isNetwork(s)?remote.toggleRailRepairEdge(s,...args):local.toggleRailRepairEdge(s,...args);}
export function commitRailRepair(s:PlayerSession,...args:Tail<Parameters<typeof local.commitRailRepair>>):ReturnType<typeof local.commitRailRepair> {return isNetwork(s)?remote.commitRailRepair(s,...args):local.commitRailRepair(s,...args);}
export function deploySelectedReinforcement(s:PlayerSession,...args:Tail<Parameters<typeof local.deploySelectedReinforcement>>):ReturnType<typeof local.deploySelectedReinforcement> {return isNetwork(s)?remote.deploySelectedReinforcement(s,...args):local.deploySelectedReinforcement(s,...args);}
export function recoverSelectedUnit(s:PlayerSession,...args:Tail<Parameters<typeof local.recoverSelectedUnit>>):ReturnType<typeof local.recoverSelectedUnit> {return isNetwork(s)?remote.recoverSelectedUnit(s,...args):local.recoverSelectedUnit(s,...args);}
export function entrenchSelectedUnit(s:PlayerSession,...args:Tail<Parameters<typeof local.entrenchSelectedUnit>>):ReturnType<typeof local.entrenchSelectedUnit> {return isNetwork(s)?remote.entrenchSelectedUnit(s,...args):local.entrenchSelectedUnit(s,...args);}
export function toggleAttackUnit(s:PlayerSession,...args:Tail<Parameters<typeof local.toggleAttackUnit>>):ReturnType<typeof local.toggleAttackUnit> {return isNetwork(s)?remote.toggleAttackUnit(s,...args):local.toggleAttackUnit(s,...args);}
export function toggleSupportingAttacker(s:PlayerSession,...args:Tail<Parameters<typeof local.toggleSupportingAttacker>>):ReturnType<typeof local.toggleSupportingAttacker> {return isNetwork(s)?remote.toggleSupportingAttacker(s,...args):local.toggleSupportingAttacker(s,...args);}
export function combatTargetIssues(s:PlayerSession,...args:Tail<Parameters<typeof local.combatTargetIssues>>):ReturnType<typeof local.combatTargetIssues> {return isNetwork(s)?remote.combatTargetIssues(s,...args):local.combatTargetIssues(s,...args);}
export function routeCombatTarget(s:PlayerSession,...args:Tail<Parameters<typeof local.routeCombatTarget>>):ReturnType<typeof local.routeCombatTarget> {return isNetwork(s)?remote.routeCombatTarget(s,...args):local.routeCombatTarget(s,...args);}
export function attackAndContinue(s:PlayerSession,...args:Tail<Parameters<typeof local.attackAndContinue>>):ReturnType<typeof local.attackAndContinue> {return isNetwork(s)?remote.attackAndContinue(s,...args):local.attackAndContinue(s,...args);}
export function passCombatReaction(s:PlayerSession,...args:Tail<Parameters<typeof local.passCombatReaction>>):ReturnType<typeof local.passCombatReaction> {return isNetwork(s)?remote.passCombatReaction(s,...args):local.passCombatReaction(s,...args);}
export function useDefenderArtillery(s:PlayerSession,...args:Tail<Parameters<typeof local.useDefenderArtillery>>):ReturnType<typeof local.useDefenderArtillery> {return isNetwork(s)?remote.useDefenderArtillery(s,...args):local.useDefenderArtillery(s,...args);}
export function chooseLossAndContinue(s:PlayerSession,...args:Tail<Parameters<typeof local.chooseLossAndContinue>>):ReturnType<typeof local.chooseLossAndContinue> {return isNetwork(s)?remote.chooseLossAndContinue(s,...args):local.chooseLossAndContinue(s,...args);}
export function passAdvance(s:PlayerSession,...args:Tail<Parameters<typeof local.passAdvance>>):ReturnType<typeof local.passAdvance> {return isNetwork(s)?remote.passAdvance(s,...args):local.passAdvance(s,...args);}
export function extendBreakthroughDraft(s:PlayerSession,...args:Tail<Parameters<typeof local.extendBreakthroughDraft>>):ReturnType<typeof local.extendBreakthroughDraft> {return isNetwork(s)?remote.extendBreakthroughDraft(s,...args):local.extendBreakthroughDraft(s,...args);}
export function commitBreakthrough(s:PlayerSession,...args:Tail<Parameters<typeof local.commitBreakthrough>>):ReturnType<typeof local.commitBreakthrough> {return isNetwork(s)?remote.commitBreakthrough(s,...args):local.commitBreakthrough(s,...args);}
export function passBreakthrough(s:PlayerSession,...args:Tail<Parameters<typeof local.passBreakthrough>>):ReturnType<typeof local.passBreakthrough> {return isNetwork(s)?remote.passBreakthrough(s,...args):local.passBreakthrough(s,...args);}
export function commitSchwerpunkt(s:PlayerSession,...args:Tail<Parameters<typeof local.commitSchwerpunkt>>):ReturnType<typeof local.commitSchwerpunkt> {return isNetwork(s)?remote.commitSchwerpunkt(s,...args):local.commitSchwerpunkt(s,...args);}
export function passSchwerpunkt(s:PlayerSession,...args:Tail<Parameters<typeof local.passSchwerpunkt>>):ReturnType<typeof local.passSchwerpunkt> {return isNetwork(s)?remote.passSchwerpunkt(s,...args):local.passSchwerpunkt(s,...args);}
export function chooseRetreater(s:PlayerSession,...args:Tail<Parameters<typeof flow.chooseRetreater>>):ReturnType<typeof flow.chooseRetreater> {return isNetwork(s)?remote.chooseRetreater(s,...args):flow.chooseRetreater(s,...args);}
export function chooseRetreatDestination(s:PlayerSession,...args:Tail<Parameters<typeof flow.chooseRetreatDestination>>):ReturnType<typeof flow.chooseRetreatDestination> {return isNetwork(s)?remote.chooseRetreatDestination(s,...args):flow.chooseRetreatDestination(s,...args);}
export function chooseAdvancer(s:PlayerSession,...args:Tail<Parameters<typeof flow.chooseAdvancer>>):ReturnType<typeof flow.chooseAdvancer> {return isNetwork(s)?remote.chooseAdvancer(s,...args):flow.chooseAdvancer(s,...args);}
export function routeCombatDecisionCounter(s:PlayerSession,...args:Tail<Parameters<typeof flow.routeCombatDecisionCounter>>):ReturnType<typeof flow.routeCombatDecisionCounter> {return isNetwork(s)?remote.routeCombatDecisionCounter(s,...args):flow.routeCombatDecisionCounter(s,...args);}
export function chooseAdvanceDestination(s:PlayerSession,...args:Tail<Parameters<typeof flow.chooseAdvanceDestination>>):ReturnType<typeof flow.chooseAdvanceDestination> {return isNetwork(s)?remote.chooseAdvanceDestination(s,...args):flow.chooseAdvanceDestination(s,...args);}
export function continueCombatFlow(s:PlayerSession,...args:Tail<Parameters<typeof flow.continueCombatFlow>>):ReturnType<typeof flow.continueCombatFlow> {return isNetwork(s)?remote.continueCombatFlow(s,...args):flow.continueCombatFlow(s,...args);}
export function isCombatTargetSelection(s:PlayerSession,p:PresentationState):boolean {return isNetwork(s)?remote.isCombatTargetSelection(s,p):local.isCombatTargetSelection(s,p);}

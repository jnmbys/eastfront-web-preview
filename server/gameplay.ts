import {deriveBrowserRenderModel,type BrowserRenderModel} from '../src/core-adapter/browserProjection.js';
import {dispatchGameAction} from '../src/core-adapter/session.js';
import {derivePresentationEvents,type PresentationEvent} from '../src/presentation/events.js';
import {filterPresentationEvents} from '../src/player-view/presentationVisibility.js';
import {createPresentationState} from '../src/state/presentation.js';
import {advanceChoices,reactionChoices,retreatPlan,schwerpunktChoices} from '../src/interaction/combatFlow.js';
import {getNeighbors,type Action} from '../src/core-adapter/core.js';
import {toCoreAction,type NetworkAction,type QueryDraft,type ActionError} from '../src/multiplayer/gameplayProtocol.js';
import {playerSnapshot,type MatchSession} from './match.js';

export function actionOwner(match:MatchSession):string {
  const s=match.authoritative.state;
  return s.pendingDecision?.decisionOwnerControllerId??Object.values(s.controllers).find(c=>c.side===s.activeSide)!.id;
}
function viewerSession(match:MatchSession,controllerId:string){
  const a=match.controllerAssignments.find(a=>a.controllerId===controllerId);if(!a)throw new Error('No assignment');
  return {...match.authoritative,activeViewerControllerId:a.coreControllerId,viewOverride:a.viewer};
}
/** Query input is presentation only; never accepted as knowledge or canonical state. */
export function queryModel(match:MatchSession,controllerId:string,draft?:QueryDraft):BrowserRenderModel {
  const session=viewerSession(match,controllerId),view=playerSnapshot(match,controllerId),visible=new Set(view.units.map(u=>u.id));
  const own=new Set(view.units.filter(u=>u.side===view.viewer).map(u=>u.id));
  const p=Object.assign(createPresentationState(),draft??{}),memory=match.disclosedBattles[controllerId]!;
  p.selectedUnitId=p.selectedUnitId&&visible.has(p.selectedUnitId)?p.selectedUnitId:null;
  for(const k of ['primaryAttackerId','attackerArtilleryUnitId','activeRetreaterId','advanceUnitId','breakthroughUnitId','selectedEngineerUnitId'] as const)if(p[k]&&!own.has(p[k]!))p[k]=null;
  for(const k of ['attackUnitIds','lossDraft','retreatOrder'] as const)p[k]=p[k].filter(id=>own.has(id));
  p.retreatDrafts=Object.fromEntries(Object.entries(p.retreatDrafts).filter(([id])=>own.has(id)));
  if(p.selectedBattleId&&!memory.has(p.selectedBattleId))p.selectedBattleId=null;
  if(!p.selectedBattleId)p.selectedBattleId=[...memory].at(-1)??null;
  if(view.pendingDecision)p.selectedBattleId=view.pendingDecision.battleId;
  const model=deriveBrowserRenderModel(session,p);
  model.playerView=view;model.hexes=view.hexes;model.edges=view.edges;
  model.readOnly=match.status!=='ACTIVE'||actionOwner(match)!==session.activeViewerControllerId;
  if(model.readOnly){model.movement=null;model.moveOptions=[];model.railRepair=null;model.reinforcement=null;model.recovery=null;model.entrench=null;model.combat=null;}
  if(model.combat){
    model.combat.history=model.combat.history.filter(b=>memory.has(b.battleId));
    for(const row of model.combat.history)if(row.sourceBattleId&&!memory.has(row.sourceBattleId))row.sourceBattleId=null;
    if(model.combat.battle&&!memory.has(model.combat.battle.battleId))model.combat.battle=null;
    const contexts=[model.combat.attackDraft.preview,model.combat.battle?.context];
    for(const context of contexts)if(context){
      context.attackerUnitIds=context.attackerUnitIds.filter(id=>visible.has(id));context.defenderUnitIds=context.defenderUnitIds.filter(id=>visible.has(id));
    }
    // Second-attack target queries cannot be used to locate unobserved opponents.
    if(model.combat.schwerpunkt){const c=model.combat.schwerpunkt;
      c.choices=c.choices.filter(c=>view.units.some(u=>u.side!==view.viewer&&u.hex.q===c.target.q&&u.hex.r===c.target.r));
      c.targetOptions=c.targetOptions.filter(h=>c.choices.some(c=>c.target.q===h.q&&c.target.r===h.r));
      c.eligibleUnitIds=[...new Set(c.choices.map(c=>c.unitId))];
    }
  }
  // Validation diagnostics are not a data channel. Keep localizable codes only.
  const scrub=(value:unknown):void=>{if(!value||typeof value!=='object')return;
    if('code' in value&&'message' in value){for(const key of Object.keys(value))if(key!=='code')delete (value as Record<string,unknown>)[key];(value as {message:string}).message='';return;}
    for(const child of Object.values(value))scrub(child);
  };
  for(const field of ['movement','moveOptions','railRepair','recovery','entrench','combat'] as const)scrub(model[field]);
  return model;
}
/** Equivalent to UX2 forced transitions, offered only to the currently authorized client.
 * Queries never dispatch; the client must submit this ordinary validated Core Action. */
export function forcedAction(match:MatchSession,controllerId:string,draft?:QueryDraft):NetworkAction|null {
  const s=viewerSession(match,controllerId),p=s.state.pendingDecision;
  if(match.status!=='ACTIVE'||!p||p.decisionOwnerControllerId!==s.activeViewerControllerId)return null;
  const base={battleId:p.battleId};
  if(p.kind==='DEFENDER_REACTION'){const c=reactionChoices(s);if(!c.artillery.length&&!c.hq.length)return {...base,type:'PASS_REACTION'};}
  if(p.kind==='ADVANCE_AFTER_COMBAT'&&!advanceChoices(s).length)return {...base,type:'PASS_ADVANCE'};
  if(p.kind==='RETREAT'){
    const plan=retreatPlan(s,Object.assign(createPresentationState(),draft??{}));
    if(plan.action){const {controllerId:_,...action}=plan.action;return action;}
  }
  if(p.kind==='BREAKTHROUGH_OPTION'){
    const tx=s.state.combatTransactions[p.battleId]!;
    const any=p.eligibleUnitIds.some(unitId=>getNeighbors(tx.targetHex).some(hex=>s.engine.apply(structuredClone(s.state),{...base,type:'BREAKTHROUGH',controllerId:s.activeViewerControllerId,unitId,path:[hex]}).accepted));
    if(!any)return {...base,type:'PASS_BREAKTHROUGH'};
  }
  if(p.kind==='SCHWERPUNKT_OPTION'&&!schwerpunktChoices(s).length)return {...base,type:'PASS_SCHWERPUNKT'};
  return null;
}
export function validateIntent(match:MatchSession,controllerId:string,action:NetworkAction):ActionError|null {
  const assignment=match.controllerAssignments.find(a=>a.controllerId===controllerId);if(!assignment||actionOwner(match)!==assignment.coreControllerId)return 'NOT_ACTION_OWNER';
  const s=match.authoritative.state,own=(id:string)=>s.units[id]?.controllerId===assignment.coreControllerId;
  if(action.type==='DEPLOY_INITIAL_UNIT'&&!match.authoritative.scenario.deployment?.units.some(u=>u.id===action.deploymentUnitId&&u.side===assignment.viewer))return 'NOT_ACTION_OWNER';
  if('unitId' in action&&!own(action.unitId))return 'NOT_ACTION_OWNER';
  for(const key of ['attackerUnitIds','unitIdsByStep','unitIds'] as const)if(key in action&&!(action as unknown as Record<string,string[]>)[key]!.every(own))return 'NOT_ACTION_OWNER';
  if(action.type==='RETREAT'&&!action.retreats.every(r=>own(r.unitId)))return 'NOT_ACTION_OWNER';
  for(const key of ['engineerUnitId','hqUnitId'] as const)if(key in action&&!own((action as unknown as Record<string,string>)[key]!))return 'NOT_ACTION_OWNER';
  if('support' in action&&action.support)for(const [key,id]of Object.entries(action.support))if(key.endsWith('UnitId')&&!own(String(id)))return 'NOT_ACTION_OWNER';
  if(action.type==='COMBAT_REACTION'&&!own(action.reaction.kind==='DEFENDER_ARTILLERY'?action.reaction.artilleryUnitId:action.reaction.hqUnitId))return 'NOT_ACTION_OWNER';
  if('battleId' in action&&action.battleId!==s.pendingDecision?.battleId)return 'INVALID_ACTION';
  if(action.type==='SCHWERPUNKT_ATTACK'&&action.sourceBattleId!==s.pendingDecision?.battleId)return 'INVALID_ACTION';
  if(action.type==='ATTACK'||action.type==='SCHWERPUNKT_ATTACK'){
    const v=playerSnapshot(match,controllerId);if(!v.units.some(u=>u.side!==assignment.viewer&&u.hex.q===action.target.q&&u.hex.r===action.target.r))return 'INVALID_ACTION';
  }
  return null;
}
export function applyIntent(match:MatchSession,controllerId:string,action:NetworkAction):Map<string,readonly PresentationEvent[]>|null {
  const assignment=match.controllerAssignments.find(a=>a.controllerId===controllerId)!;
  const before=match.authoritative.state,views=new Map(match.controllerAssignments.map(a=>[a.controllerId,playerSnapshot(match,a.controllerId)]));
  const result=dispatchGameAction(match.authoritative,toCoreAction(action,assignment.coreControllerId)).result;
  if(!result.accepted)return null;
  match.matchRevision++;match.actionSequence++;
  if(result.state.phase==='GAME_OVER'||result.state.victory.winner)match.status='FINISHED';
  const events=derivePresentationEvents(before,result),out=new Map<string,readonly PresentationEvent[]>();
  for(const a of match.controllerAssignments){
    const after=playerSnapshot(match,a.controllerId),filtered=filterPresentationEvents(events,views.get(a.controllerId)!,after);
    // Event IDs use opaque presentation ordering, not a raw action/type/result.
    const safe=filtered.map((e,i)=>({...e,id:`p:${match.matchRevision}:${i}`,actionId:`p:${match.matchRevision}`}));
    for(const e of safe)if('battleId' in e)match.disclosedBattles[a.controllerId]!.add(e.battleId);
    if(after.pendingDecision)match.disclosedBattles[a.controllerId]!.add(after.pendingDecision.battleId);
    out.set(a.controllerId,safe);
  }
  return out;
}

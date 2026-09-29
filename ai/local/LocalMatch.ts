import {perf006} from '../../src/local-ai/performance.js';
/** Trusted Worker authority. Never loaded by the UI or handed to the policy. */
import {FairHost} from '../authority/FairHost.js';
import {minimalAgent} from '../fair/minimalAgent.js';
import type {FairAgent} from '../fair/types.js';
import {actionOwner,queryModel,forcedAction,validateIntent,recordAcceptedIntent} from '../../server/gameplay.js';
import {playerSnapshot} from '../../server/playerSnapshot.js';
import {battleSummaries,recordBattleSummaries} from '../../server/battleSummary.js';
import type {MatchSession} from '../../server/match.js';
import type {LocalGameSession} from '../../src/core-adapter/session.js';
import {isNetworkAction,isQueryDraft,type MatchSnapshot,type QueryDraft,type NetworkAction} from '../../src/multiplayer/gameplayProtocol.js';
import {serverMessage,type ServerMessage} from '../../src/multiplayer/protocol.js';
import type {Side} from '../../src/core-adapter/core.js';
import type {PresentationEvent} from '../../src/presentation/events.js';
import type {LocalMeta} from '../../src/local-ai/types.js';
export class LocalMatch {
 private host:FairHost;private match:MatchSession;private humanSide:Side;
 private paused=false;private manual=false;private reason:string|null=null;private accepted=0;private rejected=0;
 private seen=new Set<string>();
 constructor(session:LocalGameSession,side:Side,private policy:FairAgent=minimalAgent){
  this.humanSide=side;const matchId=crypto.randomUUID();const assignments=(['GERMAN','SOVIET'] as const).map(viewer=>{const id=Object.values(session.state.controllers).find(c=>c.side===viewer)!.id;return {controllerId:id,coreControllerId:id,viewer,seat:viewer==='GERMAN'?'GERMANY' as const:'SOVIET' as const};});
  this.host=new FairHost({matchId,initialState:session.state,rules:session.rules,scenario:session.scenario,agentSeeds:{GERMAN:101,SOVIET:202}});
  this.match={matchId,scenarioId:session.scenario.id,createdAt:0,authoritative:session,matchRevision:0,actionSequence:0,status:session.state.victory.winner?'FINISHED':'ACTIVE',controllerAssignments:assignments,viewerAssignments:Object.fromEntries(assignments.map(a=>[a.controllerId,a.viewer])),serverSequences:{},receipts:{},disclosedBattles:Object.fromEntries(assignments.map(a=>[a.controllerId,new Set<string>()])),battleSummaries:Object.fromEntries(assignments.map(a=>[a.controllerId,{entries:new Map(),olderOmitted:false}]))};
  const failure=this.host.auditTransition().terminal;if(failure){this.paused=true;this.reason=failure.status;}
  if(session.lastResult?.accepted){for(const a of assignments){const p=session.state.pendingDecision;if(p)this.match.disclosedBattles[a.controllerId]!.add(p.battleId);}recordBattleSummaries(this.match,session.lastResult);}
 }
 private get recipient(){return this.match.controllerAssignments.find(a=>a.viewer===this.humanSide)!.controllerId;}
 get meta():LocalMeta {return {humanSide:this.humanSide,ownerSide:this.match.authoritative.state.controllers[actionOwner(this.match)]!.side,paused:this.paused,manual:this.manual,reason:this.reason,accepted:this.accepted,rejected:this.rejected};}
 pause(reason:string){this.paused=true;this.reason=reason;}
 get shouldThink(){return !this.paused&&!this.manual&&this.match.status==='ACTIVE'&&this.meta.ownerSide!==this.humanSide;}
 private order(){return {matchId:this.match.matchId,matchRevision:this.match.matchRevision,serverSequence:(this.match.serverSequences[this.recipient]=(this.match.serverSequences[this.recipient]??0)+1)};}
 private model(draft?:QueryDraft){const m=queryModel(this.match,this.recipient,draft);m.battleSummaries=battleSummaries(this.match,this.recipient);if(this.paused)m.readOnly=true;return m;}
 snapshot(resync=false,events:readonly PresentationEvent[]=[]):ServerMessage {
  return perf006.measure('snapshotMs',()=>this.snapshotNow(resync,events));
 }
 private snapshotNow(resync:boolean,events:readonly PresentationEvent[]):ServerMessage {
  const model=this.model();const canAct=!this.paused&&this.meta.ownerSide===this.humanSide&&this.match.status==='ACTIVE';
  const payload:MatchSnapshot={...this.order(),revision:this.match.matchRevision,format:'snapshot-v1',resync,status:this.match.status,canAct,view:playerSnapshot(this.match,this.recipient),model,forcedAction:canAct?forcedAction(this.match,this.recipient):null,events};
  return serverMessage('PLAYER_VIEW_SNAPSHOT',payload);
 }
 private accept(before:LocalGameSession['state'],views:Map<string,ReturnType<typeof playerSnapshot>>):readonly PresentationEvent[]{
  const audit=this.host.auditTransition(),result=audit.result;if(!result?.accepted)return [];
  this.match.authoritative.state=this.host.auditOmniscient();this.match.authoritative.knowledge=audit.knowledge;this.match.authoritative.stateRevision=(this.match.authoritative.stateRevision??0)+1;
  this.accepted++;
  const events=recordAcceptedIntent(this.match,before,result,views).get(this.recipient)??[];
  if(audit.terminal?.status==='INTEGRITY_FAILURE'){this.paused=true;this.reason='INTEGRITY_FAILURE';}
  return events;
 }
 private views(){return new Map(this.match.controllerAssignments.map(a=>[a.controllerId,playerSnapshot(this.match,a.controllerId)]));}
 think():ServerMessage|null {
  if(!this.shouldThink)return null;
  const before=this.match.authoritative.state,views=this.views(),step=this.host.step({GERMAN:this.policy,SOVIET:this.policy});
  const events=this.accept(before,views);
  if(step.status==='REJECTED'||step.status==='REJECTION_LIMIT')this.rejected++;
  if(!['ACCEPTED','REJECTED','GAME_OVER'].includes(step.status)){this.paused=true;this.reason=step.status+(step.reason?':'+step.reason:'');}
  return this.snapshot(false,events);
 }
 request(type:string,payload:unknown,requestId:string):ServerMessage[]{
  if(this.seen.has(requestId))return [];this.seen.add(requestId);if(this.seen.size>512)this.seen.delete(this.seen.values().next().value!);
  const p=payload as {matchId?:string;expectedRevision?:number;action?:NetworkAction;draft?:QueryDraft};
  const reply=(code:'STALE_REVISION'|'NOT_ACTION_OWNER'|'INVALID_ACTION')=>serverMessage('ACTION_REJECTED',{...this.order(),acceptedRevision:null,actionSequence:this.match.actionSequence,code},requestId);
  if(!p||p.matchId!==this.match.matchId)return [reply('INVALID_ACTION')];
  if(type==='RESYNC_MATCH')return [this.snapshot(true)];
  if(p.expectedRevision!==this.match.matchRevision)return [reply('STALE_REVISION')];
  if(type==='QUERY_MATCH'&&isQueryDraft(p.draft))return [serverMessage('MATCH_QUERY',{...this.order(),model:this.model(p.draft),forcedAction:!this.paused?forcedAction(this.match,this.recipient,p.draft):null},requestId)];
  if(type!=='SUBMIT_ACTION'||!isNetworkAction(p.action))return [reply('INVALID_ACTION')];
  if(this.paused||this.meta.ownerSide!==this.humanSide||validateIntent(this.match,this.recipient,p.action))return [reply('NOT_ACTION_OWNER')];
  const before=this.match.authoritative.state,views=this.views();
  if(!this.host.submitHuman(this.recipient,p.action)){this.rejected++;return [reply('INVALID_ACTION')];}
  const events=this.accept(before,views);
  return [serverMessage('ACTION_ACCEPTED',{...this.order(),acceptedRevision:this.match.matchRevision,actionSequence:this.match.actionSequence},requestId),this.snapshot(false,events)];
 }
 takeOver():ServerMessage|null {
  if((!this.paused&&!this.manual)||!this.host.takeOver()||this.reason==='INTEGRITY_FAILURE')return null;
  this.humanSide=this.meta.ownerSide;this.manual=true;this.paused=false;this.reason=null;
  return this.snapshot(true);
 }
 /** Test-only trusted diagnostics, never part of Worker response. */
 audit(){return this.host.auditOmniscient();}
}

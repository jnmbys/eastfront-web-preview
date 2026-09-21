import type {Action,HexCoord} from '../core-adapter/core.js';
import type {BrowserRenderModel} from '../core-adapter/browserProjection.js';
import type {PresentationEvent} from '../presentation/events.js';
import type {PresentationState} from '../state/presentation.js';
import type {AuthorizedPlayerView} from './protocol.js';
/** Controller/action IDs and newly allocated battle IDs are always supplied by the host.
 * Cross-controller transfers/commitments are not capabilities of two-seat Scenario rooms. */
type RemoteAction = Exclude<Action,{type:'TRANSFER_CONTROL'|'AUTHORIZE_UNIT_COMMITMENT'}>;
type DTO<A> = A extends Action ? Omit<A,'controllerId'|'actionId'|'battleId'> &
  (A extends {battleId:string}?{battleId:string}:Record<never,never>) : never;
export type NetworkAction = DTO<RemoteAction>;
export type MatchStatus='ACTIVE'|'WAITING_FOR_RECONNECT'|'FINISHED'|'ABORTED';
export interface MatchOrder {matchId:string;matchRevision:number;serverSequence:number;}
export interface MatchSnapshot extends MatchOrder {
  revision:number;format:'snapshot-v1';resync:boolean;status:MatchStatus;canAct:boolean;
  view:AuthorizedPlayerView;model:BrowserRenderModel;forcedAction:NetworkAction|null;events:readonly PresentationEvent[];
}
export type ActionError='STALE_REVISION'|'NOT_ACTION_OWNER'|'INVALID_ACTION'|'MATCH_UNAVAILABLE'|'REQUEST_REUSED'|'REQUEST_LIMIT';
export interface ActionReply extends MatchOrder {acceptedRevision:number|null;actionSequence:number;code?:ActionError;}
export const DRAFT_KEYS=[
  'selectedUnitId','selectedDeploymentUnitId','interactionMode','pathDraft','railRepairEdgeKeys','selectedEngineerUnitId',
  'selectedReinforcementId','attackUnitIds','primaryAttackerId','attackTarget','attackerArtilleryUnitId','selectedBattleId',
  'lossDraft','retreatOrder','retreatDrafts','activeRetreaterId','advanceUnitId','breakthroughUnitId','breakthroughPath','schwerpunktTarget',
] as const;
export type QueryDraft=Pick<PresentationState,typeof DRAFT_KEYS[number]>;
export function queryDraft(p:PresentationState):QueryDraft {return Object.fromEntries(DRAFT_KEYS.map(k=>[k,structuredClone(p[k])])) as unknown as QueryDraft;}
export const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
type Check=(v:unknown)=>boolean;
export const id:Check=v=>typeof v==='string'&&/^[A-Za-z0-9_:.,-]{1,96}$/.test(v);
export const revision:Check=v=>Number.isSafeInteger(v)&&Number(v)>=0;
export const hex:Check=v=>record(v)&&Object.keys(v).length===2&&['q','r'].every(k=>Number.isSafeInteger(v[k])&&Math.abs(Number(v[k]))<=10000);
const list=(check:Check,max=128):Check=>v=>Array.isArray(v)&&v.length<=max&&v.every(check);
const ids=list(id),path=list(hex,64),nullable=(check:Check):Check=>v=>v===null||check(v);
const oneOf=(...values:string[]):Check=>v=>values.includes(v as string);
export function shape(v:unknown,required:Record<string,Check>,optional:Record<string,Check>={}):boolean {
  return record(v)&&Object.keys(v).every(k=>Object.hasOwn(required,k)||Object.hasOwn(optional,k))&&Object.entries(required).every(([k,c])=>Object.hasOwn(v,k)&&c(v[k]))&&Object.entries(optional).every(([k,c])=>!Object.hasOwn(v,k)||c(v[k]));
}
const hq=oneOf('FORCE_ATTACK','LAST_STAND','STAFF_OFFICE_PLAN','MAKESHIFT_BRIDGES','EXTRA_SUPPLIES','SIEGE_ARTILLERY');
const support:Check=v=>shape(v,{}, {attackerArtilleryUnitId:id,attackerHQUnitId:id,attackerHQCommand:hq});
const schema:Record<RemoteAction['type'],{required:Record<string,Check>;optional?:Record<string,Check>}>= {
  MOVE:{required:{unitId:id,path}},ATTACK:{required:{attackerUnitIds:ids,target:hex},optional:{support}},
  READY_FOR_PHASE_END:{required:{}},END_PHASE:{required:{}},END_TURN:{required:{}},
  USE_HQ_COMMAND:{required:{hqUnitId:id,command:hq},optional:{target:hex,unitIds:ids,battleId:id}},
  ENTRENCH:{required:{unitId:id}},REPAIR_UNIT:{required:{unitId:id}},RAIL_REPAIR:{required:{edgeKeys:ids},optional:{engineerUnitId:id}},
  DEPLOY_REINFORCEMENT:{required:{reinforcementId:id,entryHex:hex}},DEPLOY_INITIAL_UNIT:{required:{deploymentUnitId:id,hex}},
  BREAKTHROUGH:{required:{battleId:id,unitId:id,path}},PASS_BREAKTHROUGH:{required:{battleId:id}},
  ALLOCATE_LOSSES:{required:{battleId:id,unitIdsByStep:ids}},
  RETREAT:{required:{battleId:id,retreats:list(v=>shape(v,{unitId:id,path}),64)}},
  COMBAT_REACTION:{required:{battleId:id,reaction:v=>shape(v,{kind:oneOf('DEFENDER_ARTILLERY'),artilleryUnitId:id})||shape(v,{kind:oneOf('DEFENDER_HQ_COMMAND'),hqUnitId:id,command:oneOf('LAST_STAND')})}},
  PASS_REACTION:{required:{battleId:id}},ADVANCE_AFTER_COMBAT:{required:{battleId:id,unitId:id}},PASS_ADVANCE:{required:{battleId:id}},
  SCHWERPUNKT_ATTACK:{required:{sourceBattleId:id,unitId:id,target:hex},optional:{support:v=>shape(v,{}, {attackerArtilleryUnitId:id})}},
  PASS_SCHWERPUNKT:{required:{battleId:id}},
};
export function isNetworkAction(v:unknown):v is NetworkAction {
  if(!record(v)||typeof v.type!=='string'||!Object.hasOwn(schema,v.type))return false;
  const s=schema[v.type as keyof typeof schema];return shape(v,{type:oneOf(v.type),...s.required},s.optional);
}
export function isQueryDraft(v:unknown):v is QueryDraft {
  const checks:Record<typeof DRAFT_KEYS[number],Check>={
    selectedUnitId:nullable(id),selectedDeploymentUnitId:nullable(id),interactionMode:oneOf('SELECT','MOVE_PATH','RAIL_REPAIR','REINFORCEMENT','RECOVERY','ENTRENCH','ATTACK','LOSS_ALLOCATION','RETREAT','BREAKTHROUGH','SCHWERPUNKT'),
    pathDraft:path,railRepairEdgeKeys:ids,selectedEngineerUnitId:nullable(id),selectedReinforcementId:nullable(id),attackUnitIds:ids,primaryAttackerId:nullable(id),attackTarget:nullable(hex),attackerArtilleryUnitId:nullable(id),selectedBattleId:nullable(id),lossDraft:ids,retreatOrder:ids,
    retreatDrafts:x=>record(x)&&Object.keys(x).length<=64&&Object.entries(x).every(([k,p])=>id(k)&&k!=='__proto__'&&path(p)),
    activeRetreaterId:nullable(id),advanceUnitId:nullable(id),breakthroughUnitId:nullable(id),breakthroughPath:path,schwerpunktTarget:nullable(hex),
  };return shape(v,checks);
}
/** Called only after exact schema validation and server ownership checks. */
export function toCoreAction(action:NetworkAction,controllerId:string):Action {return {...structuredClone(action),controllerId} as Action;}

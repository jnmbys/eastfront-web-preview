import type {PlayerViewState} from '../../src/player-view/playerView.js';
import type {Side,HexCoord,UnitTemplate} from '../../src/core-adapter/core.js';
import type {NetworkAction} from '../../src/multiplayer/gameplayProtocol.js';
export type DeepReadonly<T> = T extends object ? {readonly [K in keyof T]:DeepReadonly<T[K]>}:T;
/** Player DTO only; OBSERVER and its authoritativeState are not part of the contract. */
export type FairView=Omit<PlayerViewState,'viewer'|'authoritativeState'> & {viewer:Side};
/** Small explicit public rule subset. No scenario initialUnits, controllers or RNG. */
export interface PublicRules {
  /** Public maintenance constants only; no computed legal targets or active bases. */
  refit?:{maxDistance:number;limits:{GERMAN:number;SOVIET:{fromTurn:number;maxUnits:number}[]};
    germanWestEntries:HexCoord[];sovietEastExits:HexCoord[];sovietSources:HexCoord[];
    templates:Record<string,{cost:number;canEntrench:boolean}>};
  rulesId:string;scenarioId:string;turnLimit:number;stackingLimit:number;
  /** Public scenario goals and risk factors only; no deployment or runtime state. */
  objectives:HexCoord[];
  terrainAttackShift:Record<string,number>;
  terrainMovementCost:Record<string,number|'IMPASSABLE'>;
  riverMovementSurcharge:Record<string,number>;
  oosMovementPenalty:number;
  road:{movementCost:number;wholeMoveBonusEnabled:boolean;wholeMoveBonusMP:number;bridgeCancelsRiverMovementSurcharge:boolean};
  oosAttackMultiplier:number;
  riverAttackShift:Record<string,number>;
  entrenchmentShift:number;
  templates:Record<string,Pick<UnitTemplate,'id'|'side'|'maxDamageSteps'|'type'|'exertsZoc'>>;
}
export type FairIntent=Extract<NetworkAction,{type:'REPAIR_UNIT'|'ENTRENCH'|'DEPLOY_REINFORCEMENT'|'RETREAT'|'ADVANCE_AFTER_COMBAT'|'BREAKTHROUGH'|'SCHWERPUNKT_ATTACK'|'DEPLOY_INITIAL_UNIT'|'READY_FOR_PHASE_END'|'MOVE'|'ATTACK'|'PASS_REACTION'|'ALLOCATE_LOSSES'|'PASS_ADVANCE'|'PASS_BREAKTHROUGH'|'PASS_SCHWERPUNKT'}>;
export interface OwnAttempt {observationKey:string;intent:FairIntent|null;outcome:'ACCEPTED'|'REJECTED';}
export interface FairInput {
  /** Own accepted recovery receipts and own generic rejection, current phase only. */
  refit?:{recoveredUnitIds:string[];rejected:boolean};
  /** Optional headless-only shared plan; absent by default, preserving v1 observations. */
  plan?:import('./plan.js').FairPlanSnapshot;
  schema:'fair-player-view-v1';observationKey:string;scope:{matchId:string;controllerId:string;side:Side};
  view:FairView;rules:PublicRules;
  deployment:{roster:{id:string;templateId:string}[];zone:HexCoord[]}|null;
  reinforcements:{availableIds:string[];entries:HexCoord[]}|null;
  /** Own bounded feedback only. Enemy observation memory is solely view.lastKnown. */
  history:OwnAttempt[];
  agentRandom:{seed:number;decisionIndex:number};
}
export type FairDecision={kind:'INTENT';intent:FairIntent}|{kind:'STOP';reason:'UNSUPPORTED_RETREAT'|'NO_CANDIDATE'};
export type FairAgent=(input:DeepReadonly<FairInput>)=>FairDecision;

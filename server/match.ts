import type {MatchStatus,ActionError} from '../src/multiplayer/gameplayProtocol.js';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createFreshProductionSession } from '../src/web/preview.js';
import { controllerIdForSide, type LocalGameSession } from '../src/core-adapter/session.js';
import { SEATS,sideForSeat,type SeatId,type RoomState,type AuthorizedPlayerView,type PlayerSide } from '../src/multiplayer/protocol.js';
import type { LegacyMapData } from '../src/core-adapter/core.js';
const rawMap=JSON.parse(readFileSync(new URL('../vendor/eastfront-digital-core/reference/strategic-reset-f-map.json',import.meta.url),'utf8')) as LegacyMapData;
export interface ControllerAssignment {controllerId:string;coreControllerId:string;seat:SeatId;viewer:PlayerSide;}
/** Server private. Never serialize this object. Core controller IDs remain canonical. */
export interface MatchSession {
  matchId:string;scenarioId:string;createdAt:number;authoritative:LocalGameSession;
  matchRevision:number;actionSequence:number;status:MatchStatus;
  battleSummaries:Record<string,{entries:Map<string,import('../src/multiplayer/battleSummary.js').BattleSummary>;olderOmitted:boolean}>;
  serverSequences:Record<string,number>;disclosedBattles:Record<string,Set<string>>;
  receipts:Record<string,Map<string,{fingerprint:string;acceptedRevision:number|null;actionSequence:number;code?:ActionError}>>;
  controllerAssignments:ControllerAssignment[];viewerAssignments:Record<string,PlayerSide>;
}
export function createMatchSession(room:RoomState,now:number):MatchSession {
  const authoritative=createFreshProductionSession(rawMap);
  if(authoritative.integrityIssues.length)throw new Error('Scenario integrity failed');
  const controllerAssignments=SEATS.map(seat=>{
    const owner=room.seats[seat];if(owner.controllerType!=='HUMAN_REMOTE'||!owner.ready)throw new Error('Seats not ready');
    const viewer=sideForSeat(seat);
    return {seat,controllerId:owner.controllerId,coreControllerId:controllerIdForSide(authoritative,viewer),viewer};
  });
  return {matchRevision:0,actionSequence:0,status:'ACTIVE',serverSequences:Object.fromEntries(controllerAssignments.map(a=>[a.controllerId,0])),
    battleSummaries:Object.fromEntries(controllerAssignments.map(a=>[a.controllerId,{entries:new Map(),olderOmitted:false}])),
    disclosedBattles:Object.fromEntries(controllerAssignments.map(a=>[a.controllerId,new Set<string>()])),
    receipts:Object.fromEntries(controllerAssignments.map(a=>[a.controllerId,new Map()])),matchId:randomUUID(),scenarioId:authoritative.scenario.id,createdAt:now,authoritative,controllerAssignments,
    viewerAssignments:Object.fromEntries(controllerAssignments.map(a=>[a.controllerId,a.viewer]))};
}
export {playerSnapshot} from './playerSnapshot.js';

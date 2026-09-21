import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createFreshProductionSession } from '../src/web/preview.js';
import { controllerIdForSide, type LocalGameSession } from '../src/core-adapter/session.js';
import { derivePlayerView } from '../src/player-view/playerView.js';
import { SEATS,sideForSeat,type SeatId,type RoomState,type AuthorizedPlayerView,type PlayerSide } from '../src/multiplayer/protocol.js';
import type { LegacyMapData } from '../src/core-adapter/core.js';
const rawMap=JSON.parse(readFileSync(new URL('../vendor/eastfront-digital-core/reference/strategic-reset-f-map.json',import.meta.url),'utf8')) as LegacyMapData;
export interface ControllerAssignment {controllerId:string;coreControllerId:string;seat:SeatId;viewer:PlayerSide;}
/** Server private. Never serialize this object. Core controller IDs remain canonical. */
export interface MatchSession {
  matchId:string;scenarioId:string;createdAt:number;authoritative:LocalGameSession;
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
  return {matchId:randomUUID(),scenarioId:authoritative.scenario.id,createdAt:now,authoritative,controllerAssignments,
    viewerAssignments:Object.fromEntries(controllerAssignments.map(a=>[a.controllerId,a.viewer]))};
}
export function playerSnapshot(match:MatchSession,controllerId:string):AuthorizedPlayerView {
  const assignment=match.controllerAssignments.find(a=>a.controllerId===controllerId);
  if(!assignment)throw new Error('Controller has no viewer assignment');
  const derived=derivePlayerView(match.authoritative.state,assignment.viewer,match.authoritative.rules,match.authoritative.knowledge?.[assignment.viewer]);
  // Explicit allowlist, even if the local projection later grows host/debug fields.
  return {viewer:assignment.viewer,turn:derived.turn,phase:derived.phase,activeSide:derived.activeSide,
    hexes:derived.hexes,edges:derived.edges,units:derived.units,contacts:derived.contacts,lastKnown:derived.lastKnown,
    identifiedHexKeys:derived.identifiedHexKeys,contactHexKeys:derived.contactHexKeys,resources:derived.resources,
    pendingDecision:derived.pendingDecision,victory:derived.victory};
}

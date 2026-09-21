import type { ActionResult, GameState, HexCoord } from '../core-adapter/core.js';
import { hexEqual, hexToPixel, type Point } from '../geometry/hex.js';
import { deriveCounterPlacement } from '../render/derive.js';

type Identity = Readonly<{ id:string; actionId:string }>;
export type TravelKind = 'move' | 'retreat' | 'advance' | 'breakthrough';
export type UnitTravelEvent = Identity & Readonly<{
  kind:TravelKind; unitId:string; path:readonly Readonly<HexCoord>[];
  sourceOffset:Point; destinationOffset:Point;
}>;
export type UnitCueEvent = Identity & Readonly<{
  kind:'hit'|'destroyed'; unitId:string; position:Point;
}>;
export type CombatPresentationEvent = Identity & Readonly<{
  kind:'combat-started'|'combat-fire'|'combat-result'|'combat-completed';
  battleId:string; unitIds:readonly string[];
}>;
export type PresentationEvent = UnitTravelEvent | UnitCueEvent | CombatPresentationEvent;

export function isTravelEvent(event:PresentationEvent):event is UnitTravelEvent { return 'path' in event; }

/** Existing Counter V2 placement is the only authority for local stack offsets. */
function stackOffset(state:Readonly<GameState>,id:string):Point {
  const unit=state.units[id];
  if(!unit)return {x:0,y:0};
  const group=Object.values(state.units).filter(u=>u.alive&&hexEqual(u.hex,unit.hex)).sort((a,b)=>a.id.localeCompare(b.id));
  const placement=deriveCounterPlacement(unit,Math.max(0,group.findIndex(u=>u.id===id)),group.length);
  return {x:placement.visualCenter.x-placement.authoritativeAnchor.x,y:placement.visualCenter.y-placement.authoritativeAnchor.y};
}

/** Read-only projection of accepted facts. No engine calls, legality checks or random draws. */
export function derivePresentationEvents(before:Readonly<GameState>,result:Readonly<ActionResult>):readonly PresentationEvent[] {
  if(!result.accepted)return Object.freeze([]);
  const after=result.state,events:PresentationEvent[]=[];
  const identity=()=>({id:`${result.actionId}:presentation:${events.length}`,actionId:result.actionId});
  const combat=(kind:CombatPresentationEvent['kind'],battleId:string)=>{
    const tx=after.combatTransactions[battleId];
    events.push({...identity(),kind,battleId,unitIds:[...(tx?.attackerUnitIds??[]),...(tx?.defenderUnitIds??[])]});
  };
  const travel=(kind:TravelKind,unitId:string,acceptedPath:readonly HexCoord[])=>{
    const source=before.units[unitId],destination=after.units[unitId];
    if(!source||!destination||!destination.alive||hexEqual(source.hex,destination.hex))return;
    const path:HexCoord[]=[{...source.hex}];
    for(const hex of acceptedPath)if(!hexEqual(path.at(-1)!,hex))path.push({...hex});
    // State is authoritative even if a future Core event omits its final path node.
    if(!hexEqual(path.at(-1)!,destination.hex))path.push({...destination.hex});
    events.push({...identity(),kind,unitId,path,sourceOffset:stackOffset(before,unitId),destinationOffset:stackOffset(after,unitId)});
  };
  for(const event of result.events){
    switch(event.type){
      case 'UnitMoved':travel('move',event.unitId,result.action.type==='MOVE'?result.action.path:[event.to]);break;
      case 'UnitRetreated':travel('retreat',event.unitId,event.path);break;
      case 'UnitAdvanced':travel('advance',event.unitId,[event.to]);break;
      case 'UnitBrokeThrough':travel('breakthrough',event.unitId,event.path);break;
      case 'CombatDeclared':combat('combat-started',event.battleId);break;
      // Fire is queued only AFTER Core has resolved the roll and CRT.
      case 'CRTResolved':combat('combat-fire',event.battleId);combat('combat-result',event.battleId);break;
      case 'CombatCompleted':combat('combat-completed',event.battleId);break;
      case 'UnitStepLost':case 'UnitDestroyed':{
        const unit=before.units[event.unitId]??after.units[event.unitId];
        if(unit)events.push({...identity(),kind:event.type==='UnitStepLost'?'hit':'destroyed',unitId:event.unitId,position:hexToPixel(unit.hex)});
        break;
      }
    }
  }
  // All payloads are detached, recursively frozen values. Observers never receive GameState.
  return freeze(events);
}

function freeze<T>(value:T):T {
  if(value&&typeof value==='object'){for(const item of Object.values(value))freeze(item);Object.freeze(value);}
  return value;
}

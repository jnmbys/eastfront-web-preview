import type {MatchSnapshot} from './gameplayProtocol.js';
import {record,shape,id,revision,hex,isNetworkAction} from './gameplayProtocol.js';
export const FULL_SNAPSHOT='snapshot-v1' as const;
export const COMPACT_SNAPSHOT='snapshot-v2-inline-view' as const;
export type SnapshotFormat=typeof FULL_SNAPSHOT|typeof COMPACT_SNAPSHOT;
export type CompactSnapshot=Omit<MatchSnapshot,'format'|'model'> & {format:typeof COMPACT_SNAPSHOT;model:Omit<MatchSnapshot['model'],'playerView'|'hexes'|'edges'>};
export type WireSnapshot=MatchSnapshot|CompactSnapshot;
export const MAX_SERVER_MESSAGE_BYTES=2*1024*1024;
export const isSnapshotFormat=(v:unknown):v is SnapshotFormat=>v===FULL_SNAPSHOT||v===COMPACT_SNAPSHOT;
/** Three aliases only. Fallback rather than discard a divergent future model. */
export function encodeSnapshot(snapshot:MatchSnapshot,format:SnapshotFormat):WireSnapshot {
  const {view,model}=snapshot;
  if(format!==COMPACT_SNAPSHOT||snapshot.resync||model.playerView!==view||model.hexes!==view.hexes||model.edges!==view.edges)return snapshot;
  const {playerView,hexes,edges,...rest}=model;
  return {...snapshot,format:COMPACT_SNAPSHOT,model:rest};
}
type Check=(v:unknown)=>boolean;
const bool:Check=v=>typeof v==='boolean',num:Check=v=>typeof v==='number'&&Number.isFinite(v);
const str:Check=v=>typeof v==='string'&&v.length<=4096;
const one=(...xs:unknown[]):Check=>v=>xs.includes(v);
const side=one('GERMAN','SOVIET'),nullable=(c:Check):Check=>v=>v===null||c(v);
const list=(c:Check,max=4096):Check=>v=>Array.isArray(v)&&v.length<=max&&v.every(c);
const ids=list(id),coords=list(hex),strings=list(str),obj=record;
const required=(v:unknown,checks:Record<string,Check>):boolean=>record(v)&&Object.entries(checks).every(([k,c])=>Object.hasOwn(v,k)&&c(v[k]));
const stats:Check=v=>shape(v,{attack:num,defense:num,movement:num});
const unitType=one('INFANTRY','JAGER','PANZER','MOTORIZED','ARTILLERY','ENGINEER','RECON','ELITE_INFANTRY','TANK','HEAVY_TANK','ANTI_TANK','HQ');
const supply=one('SUPPLIED','OUT_OF_SUPPLY','TEMPORARY_SUPPLY');
const unitBase={id,side,type:unitType,step:one(0,1,2),hex,stats,supplyState:supply,entrenched:bool};
const pending:Check=v=>{
  if(v===null)return true;
  if(!required(v,{battleId:id,side,decisionOwnerControllerId:id,eligibleControllerIds:ids})||!record(v))return false;
  switch(v.kind){
    case 'DEFENDER_REACTION':return required(v,{eligibleHQUnitIds:ids,eligibleArtilleryUnitIds:ids});
    case 'LOSS_ALLOCATION':return required(v,{lossSteps:num,eligibleUnitIds:ids});
    case 'RETREAT':return required(v,{retreatSteps:num,unitIds:ids});
    case 'ADVANCE_AFTER_COMBAT':case 'BREAKTHROUGH_OPTION':case 'SCHWERPUNKT_OPTION':return ids(v.eligibleUnitIds);
    default:return false;
  }
};
const victory:Check=v=>required(v,{winner:nullable(side),reason:nullable(str)});
const mapHex:Check=v=>shape(v,{coord:hex,terrain:one('PLAIN','FOREST','HILL','MARSH','ROUGH','CITY','MAIN_CITY','OUTER_CITY','LAKE'),control:nullable(side)},{cityId:str});
const edge:Check=v=>shape(v,{key:str,a:hex,b:hex,road:bool,railway:nullable(v=>shape(v,{present:bool,repairedBy:nullable(side),destroyed:bool})),river:nullable(one('MINOR','MAJOR')),bridge:nullable(v=>shape(v,{kind:one('ROAD','RAILWAY','BOTH'),destroyed:bool}))});
function playerView(v:unknown):boolean {
  if(!record(v)||!shape(v,{viewer:side,turn:revision,phase:str,activeSide:side,hexes:list(mapHex),edges:list(edge,16384),
    units:list(u=>shape(u,{...unitBase,visibility:one('IDENTIFIED')},{friendly:f=>required(f,{id,templateId:id,side,type:unitType,step:one(0,1,2),alive:bool,hex,supplyState:supply,entrenched:bool,controllerId:id,hasMoved:bool,hasAttacked:bool,temporarySupply:bool,dedicatedRailRepair:bool,reconZocIgnoreUsed:bool,artillerySupportUsed:bool,lastHQCommandTurn:nullable(revision)})})),
    contacts:list(c=>shape(c,{visibility:one('CONTACT'),contactId:str,side,hex,status:one('CURRENT')})),
    lastKnown:list(c=>shape(c,{contactId:str,side,hex,lastSeenTurn:revision,status:one('LAST_KNOWN'),confidence:one('UNCONFIRMED')})),
    identifiedHexKeys:strings,contactHexKeys:strings,resources:r=>record(r)&&Object.keys(r).every(k=>k===v.viewer)&&Object.values(r).every(x=>shape(x,{rp:num,cp:num})),pendingDecision:pending,victory}))return false;
  return (v.pendingDecision===null||(v.pendingDecision as {side:unknown}).side===v.viewer)&&
    (v.units as Record<string,unknown>[]).every(u=>!('friendly' in u)||(u.side===v.viewer&&record(u.friendly)&&u.friendly.side===v.viewer&&u.friendly.id===u.id));
}
const counter:Check=v=>shape(v,{...unitBase,controllerId:str,selected:bool},{combatRole:one('primary','selected','eligible')});
const option:Check=v=>required(v,{hex,legal:bool,issues:list(obj),spentMP:num,maxMP:num});
const modelFields:Record<string,Check>={readOnly:bool,phase:str,turn:revision,activeSide:side,rp:obj,cp:obj,viewerControllerId:id,viewerSide:side,counters:list(counter),selectedCounter:nullable(counter),
  deployment:nullable(v=>shape(v,{side,zoneKeys:strings,roster:list(r=>required(r,{id,templateId:id,side,placed:bool,stats,type:unitType})),deployed:revision,total:revision,complete:bool,invalidUnitIds:ids})),
  movement:nullable(v=>shape(v,{path:coords,options:list(option),issues:list(obj),spentMP:num,maxMP:num})),moveOptions:list(option),
  railRepair:nullable(v=>required(v,{selectedEdgeKeys:strings,activeEdgeKeys:strings,railwayEdgeKeys:strings,engineers:list(x=>shape(x,{id,selected:bool})),selectedEngineerUnitId:nullable(id),issues:list(obj),alreadyUsed:bool})),
  reinforcement:nullable(v=>required(v,{available:list(obj),delayed:list(obj),current:list(obj),legalEntryKeys:strings,selectedId:nullable(id),deployable:bool})),
  recovery:nullable(v=>required(v,{baseKeys:strings,limit:num,recoveredCount:num,selectedCost:nullable(num),selectedIssues:list(obj)})),
  entrench:nullable(v=>shape(v,{selectedIssues:list(obj)})),victory,
  combat:nullable(v=>required(v,{attackDraft:d=>required(d,{attackerUnitIds:ids,primaryAttackerId:nullable(id),eligibleAttackerIds:ids,target:nullable(hex),targetHexes:coords,artilleryUnitIds:ids,selectedArtilleryId:nullable(id),issues:list(obj),preview:nullable(obj)}),
    battle:nullable(b=>required(b,{battleId:id,stage:str,targetHex:hex,resolution:nullable(obj),context:nullable(obj)})),pending,
    reaction:r=>shape(r,{artillery:ids,hq:ids}),crt:c=>required(c,{columns:strings,table:obj}),history:list(h=>required(h,{battleId:id,sourceBattleId:nullable(id),attackerSide:side,defenderSide:side,target:hex,stage:str,crtResult:nullable(str)})),
    advance:nullable(x=>shape(x,{unitIds:ids,selectedUnitId:nullable(id),target:hex})),
    loss:nullable(x=>required(x,{steps:num,eligibleUnitIds:ids,draft:ids,issues:list(obj),capacityByUnitId:obj})),
    retreat:nullable(x=>required(x,{steps:num,unitIds:ids,activeUnitId:nullable(id),drafts:d=>record(d)&&Object.values(d).every(coords),options:coords,completeUnitIds:ids})),
    breakthrough:nullable(x=>required(x,{eligibleUnitIds:ids,selectedUnitId:nullable(id),maxHexes:num,path:coords,options:list(o=>required(o,{hex,legal:bool,issues:list(obj)}))})),
    schwerpunkt:nullable(x=>required(x,{eligibleUnitIds:ids,target:nullable(hex),targetOptions:coords,choices:list(c=>shape(c,{unitId:id,target:hex}))}))})),
};
const point:Check=v=>shape(v,{x:num,y:num});
const participant:Check=v=>shape(v,{unitId:id,position:point,offset:point,direction:point,character:one('generic','infantry','armor','artillery')});
const event:Check=v=>{
  if(!required(v,{id:str,actionId:str})||!record(v))return false;
  if(['move','retreat','advance','breakthrough'].includes(String(v.kind)))return required(v,{unitId:id,path:coords,sourceOffset:point,destinationOffset:point});
  if(['hit','destroyed'].includes(String(v.kind)))return required(v,{unitId:id,position:point,participant});
  return ['combat-started','combat-fire','combat-result','combat-completed'].includes(String(v.kind))&&required(v,{battleId:id,unitIds:ids,attackers:list(participant)})&&(!Object.hasOwn(v,'supporters')||list(participant)(v.supporters));
};
/** Bounded JSON tree: reject prototype keys, privileged fields and pathological nesting before any application. */
function safeTree(v:unknown,depth=0,budget={remaining:160000}):boolean {
  if(--budget.remaining<0||depth>32)return false;
  if(v===null||typeof v==='boolean')return true;
  if(typeof v==='number')return Number.isFinite(v);
  if(typeof v==='string')return v.length<=4096;
  if(Array.isArray(v))return v.length<=16384&&v.every(x=>safeTree(x,depth+1,budget));
  return record(v)&&Object.entries(v).every(([k,x])=>!['__proto__','constructor','prototype','authoritativeState','combatTransactions','actionLog','reconnectToken'].includes(k)&&safeTree(x,depth+1,budget));
}
/** Validates either full representation atomically, then restores independent copies. No previous state is accepted. */
export function decodeSnapshot(value:unknown,compactAllowed:boolean):MatchSnapshot {
  const fail=():never=>{throw new Error('Invalid authorized snapshot');};
  if(!safeTree(value)||!record(value)||!isSnapshotFormat(value.format)||(!compactAllowed&&value.format===COMPACT_SNAPSHOT))return fail();
  const compact=value.format===COMPACT_SNAPSHOT;
  if(compact&&value.resync)return fail();
  if(!shape(value,{matchId:id,matchRevision:revision,serverSequence:revision,revision,format:isSnapshotFormat,resync:bool,status:one('ACTIVE','WAITING_FOR_RECONNECT','FINISHED','ABORTED'),canAct:bool,view:playerView,
    model:m=>shape(m,compact?modelFields:{...modelFields,playerView,hexes:list(mapHex),edges:list(edge,16384)}),forcedAction:nullable(isNetworkAction),events:list(event,2048)}))return fail();
  const snapshot=value as unknown as WireSnapshot;
  if(snapshot.revision!==snapshot.matchRevision||snapshot.model.viewerSide!==snapshot.view.viewer||snapshot.model.phase!==snapshot.view.phase||snapshot.model.turn!==snapshot.view.turn)return fail();
  if(!compact)return snapshot as MatchSnapshot;
  const {view,model}=snapshot;
  return {...snapshot,format:FULL_SNAPSHOT,model:{...model,playerView:structuredClone(view),hexes:structuredClone(view.hexes),edges:structuredClone(view.edges)}};
}

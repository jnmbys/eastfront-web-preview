import type {PlayerViewState} from '../../src/player-view/playerView.js';
import type {Side,PendingDecision} from '../../src/core-adapter/core.js';
import type {FairView,PublicRules} from '../fair/types.js';
import type {GameRules,ScenarioConfig} from '../../vendor/eastfront-digital-core/dist/core/config.js';
const hex=(h:{q:number;r:number})=>({q:h.q,r:h.r});
const stats=(s:{attack:number;defense:number;movement:number})=>({attack:s.attack,defense:s.defense,movement:s.movement});
function pending(p:PendingDecision|null):PendingDecision|null {
  if(!p)return null;
  const base={battleId:p.battleId,side:p.side,decisionOwnerControllerId:p.decisionOwnerControllerId,eligibleControllerIds:[...p.eligibleControllerIds]};
  switch(p.kind){
    case 'DEFENDER_REACTION':return {...base,kind:p.kind,eligibleHQUnitIds:[...p.eligibleHQUnitIds],eligibleArtilleryUnitIds:[...p.eligibleArtilleryUnitIds]};
    case 'LOSS_ALLOCATION':return {...base,kind:p.kind,lossSteps:p.lossSteps,eligibleUnitIds:[...p.eligibleUnitIds]};
    case 'RETREAT':return {...base,kind:p.kind,retreatSteps:p.retreatSteps,unitIds:[...p.unitIds]};
    default:return {...base,kind:p.kind,eligibleUnitIds:[...p.eligibleUnitIds]};
  }
}
/** Second explicit allowlist; accidental future fields on PlayerView cannot cross this boundary. */
export function fairView(view:PlayerViewState,side:Side):FairView {
  if(view.viewer!==side)throw new Error('Fair view requires its assigned player side.');
  return {
    viewer:side,turn:view.turn,phase:view.phase,activeSide:view.activeSide,
    hexes:view.hexes.map(h=>({coord:hex(h.coord),terrain:h.terrain,control:h.control,...(h.cityId!==undefined?{cityId:h.cityId}:{})})),
    edges:view.edges.map(e=>({key:e.key,a:hex(e.a),b:hex(e.b),road:e.road,river:e.river,
      railway:e.railway?{present:e.railway.present,repairedBy:e.railway.repairedBy,destroyed:e.railway.destroyed}:null,
      bridge:e.bridge?{kind:e.bridge.kind,destroyed:e.bridge.destroyed}:null})),
    units:view.units.map(u=>{
      const base={visibility:'IDENTIFIED' as const,id:u.id,side:u.side,type:u.type,step:u.step,hex:hex(u.hex),stats:stats(u.stats),supplyState:u.supplyState,entrenched:u.entrenched};
      if(!('friendly' in u)||u.side!==side)return base;
      const f=u.friendly;
      return {...base,friendly:{id:f.id,templateId:f.templateId,side:f.side,type:f.type,step:f.step,alive:f.alive,hex:hex(f.hex),supplyState:f.supplyState,entrenched:f.entrenched,hasMoved:f.hasMoved,hasAttacked:f.hasAttacked,controllerId:f.controllerId,temporarySupply:f.temporarySupply,dedicatedRailRepair:f.dedicatedRailRepair,reconZocIgnoreUsed:f.reconZocIgnoreUsed,artillerySupportUsed:f.artillerySupportUsed,lastHQCommandTurn:f.lastHQCommandTurn}};
    }),
    contacts:view.contacts.map(c=>({visibility:'CONTACT',contactId:c.contactId,side:c.side,hex:hex(c.hex),status:'CURRENT'})),
    lastKnown:view.lastKnown.map(k=>({contactId:k.contactId,side:k.side,hex:hex(k.hex),lastSeenTurn:k.lastSeenTurn,status:'LAST_KNOWN',confidence:'UNCONFIRMED'})),
    identifiedHexKeys:[...view.identifiedHexKeys],contactHexKeys:[...view.contactHexKeys],
    resources:view.resources[side]?{[side]:{rp:view.resources[side]!.rp,cp:view.resources[side]!.cp}}:{},
    pendingDecision:pending(view.pendingDecision),
    victory:{winner:view.victory.winner,reason:view.victory.reason,turn:view.victory.turn,checkedAtPhase:view.victory.checkedAtPhase},
  };
}
export function publicRules(rules:GameRules,scenario:ScenarioConfig):PublicRules {
  return {rulesId:rules.id,scenarioId:scenario.id,turnLimit:scenario.turnLimit,stackingLimit:rules.stackingLimit,
    refit:{maxDistance:rules.recovery.maxDistanceFromBase,
      limits:{GERMAN:rules.recovery.maxUnitsPerTurn.GERMAN,SOVIET:rules.recovery.maxUnitsPerTurn.SOVIET.map(b=>({fromTurn:b.fromTurn,maxUnits:b.maxUnits}))},
      germanWestEntries:scenario.germanWestRailEntries.map(hex),sovietEastExits:scenario.sovietEastRailExits.map(hex),sovietSources:(scenario.sovietSupplySources??[]).map(hex),
      templates:Object.fromEntries(Object.entries(rules.unitTemplates).map(([id,t])=>[id,{cost:t.recoveryCostPerStep,canEntrench:t.canEntrench}]))},
    objectives:scenario.capitalCoreHexes.map(hex),
    terrainAttackShift:Object.fromEntries(Object.entries(rules.terrain).map(([k,v])=>[k,v.attackShift])),
    terrainMovementCost:Object.fromEntries(Object.entries(rules.terrain).map(([k,v])=>[k,v.movementCost])),
    riverMovementSurcharge:{MINOR:rules.river.MINOR.movementSurcharge,MAJOR:rules.river.MAJOR.movementSurcharge},
    oosMovementPenalty:rules.supply.oosMovementPenalty,
    road:{movementCost:rules.road.movementCost,wholeMoveBonusEnabled:rules.road.wholeMoveBonusEnabled,
      wholeMoveBonusMP:rules.road.wholeMoveBonusMP,bridgeCancelsRiverMovementSurcharge:rules.road.bridgeCancelsRiverMovementSurcharge},
    oosAttackMultiplier:rules.supply.oosAttackMultiplier,
    riverAttackShift:{MINOR:rules.river.MINOR.attackShift,MAJOR:rules.river.MAJOR.attackShift},
    entrenchmentShift:rules.combat.entrenchmentShift,
    templates:Object.fromEntries(Object.entries(rules.unitTemplates).sort(([a],[b])=>a.localeCompare(b)).map(([key,t])=>[key,{id:t.id,side:t.side,maxDamageSteps:t.maxDamageSteps,type:t.type,exertsZoc:t.exertsZoc}]))};
}

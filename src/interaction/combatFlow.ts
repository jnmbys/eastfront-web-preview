import {
  coreHexKey, getLegalRetreatStepOptions, getMaxLegalRetreatDistance, getNeighbors,
  type Action, type EntityId, type HexCoord, type RetreatAction,
} from '../core-adapter/core.js';
import { controllerIdForSide, dispatchGameAction, setActiveViewer, type LocalGameSession } from '../core-adapter/session.js';
import { clearCombatDrafts, type PresentationState } from '../state/presentation.js';
import { msg } from '../localization/index.js';
import { joinIssues } from '../localization/issues.js';

/** Read-only Core oracle for options without a separate public validator.
 * No probe is dispatched or adopted; the authoritative state and RNG never change. */
function accepts(session:LocalGameSession,action:Action):boolean {
  return session.engine.apply(structuredClone(session.state),action).accepted;
}

export function reactionChoices(session:LocalGameSession):{artillery:string[];hq:string[]} {
  const p=session.state.pendingDecision;
  if(p?.kind!=='DEFENDER_REACTION')return {artillery:[],hq:[]};
  const base={type:'COMBAT_REACTION' as const,controllerId:p.decisionOwnerControllerId,battleId:p.battleId};
  return {
    artillery:p.eligibleArtilleryUnitIds.filter(artilleryUnitId=>accepts(session,{...base,reaction:{kind:'DEFENDER_ARTILLERY',artilleryUnitId}})),
    hq:p.eligibleHQUnitIds.filter(hqUnitId=>accepts(session,{...base,reaction:{kind:'DEFENDER_HQ_COMMAND',hqUnitId,command:'LAST_STAND'}})),
  };
}

export function advanceChoices(session:LocalGameSession):string[] {
  const p=session.state.pendingDecision;if(p?.kind!=='ADVANCE_AFTER_COMBAT')return [];
  return p.eligibleUnitIds.filter(unitId=>accepts(session,{type:'ADVANCE_AFTER_COMBAT',controllerId:p.decisionOwnerControllerId,battleId:p.battleId,unitId}));
}

export function schwerpunktChoices(session:LocalGameSession):{unitId:string;target:HexCoord}[] {
  const p=session.state.pendingDecision;if(p?.kind!=='SCHWERPUNKT_OPTION')return [];
  return p.eligibleUnitIds.flatMap(unitId=>{
    const unit=session.state.units[unitId];if(!unit)return [];
    return getNeighbors(unit.hex).filter(target=>accepts(session,{type:'SCHWERPUNKT_ATTACK',controllerId:p.decisionOwnerControllerId,sourceBattleId:p.battleId,unitId,target})).map(target=>({unitId,target}));
  });
}

export interface RetreatPlan {
  order:string[]; completeUnitIds:string[]; activeUnitId:string|null; options:HexCoord[];
  action:RetreatAction|null;
}

/** Project only drafted positions, asking Core about every step and required distance.
 * Later units see earlier drafted positions, matching Core's ordered retreat contract. */
export function retreatPlan(session:LocalGameSession,presentation:PresentationState):RetreatPlan {
  const p=session.state.pendingDecision;
  const empty={order:[],completeUnitIds:[],activeUnitId:null,options:[],action:null};
  if(p?.kind!=='RETREAT')return empty;
  const order=[...presentation.retreatOrder.filter(id=>p.unitIds.includes(id)),...p.unitIds.filter(id=>!presentation.retreatOrder.includes(id))];
  const sim=structuredClone(session.state),completeUnitIds:string[]=[],completeRoutes:string[]=[];
  let activeUnitId:string|null=null,options:HexCoord[]=[];
  for(const id of order){
    const unit=sim.units[id];if(!unit)continue;
    const maximum=getMaxLegalRetreatDistance(sim,session.rules,unit,p.retreatSteps);
    const path=presentation.retreatDrafts[id]??[];
    let valid=true;
    for(const hex of path){
      if(!getLegalRetreatStepOptions(sim,session.rules,unit).some(h=>coreHexKey(h)===coreHexKey(hex))){valid=false;break;}
      unit.hex={...hex};
    }
    if(valid&&path.length===maximum){
      completeRoutes.push(id);
      // An implicitly blocked unit must not lock the ordering: another unit may
      // move first and free its route. Explicitly selected order remains binding.
      if(path.length>0||presentation.retreatOrder.includes(id))completeUnitIds.push(id);
      continue;
    }
    activeUnitId=id;
    if(valid&&path.length<maximum){
      // Exclude a first step that cannot complete Core's required maximum distance.
      options=getLegalRetreatStepOptions(sim,session.rules,unit).filter(hex=>{
        const candidate=structuredClone(sim),mover=candidate.units[id]!;mover.hex={...hex};
        return getMaxLegalRetreatDistance(candidate,session.rules,mover,maximum-path.length-1)===maximum-path.length-1;
      });
    }
    break;
  }
  const action:RetreatAction={type:'RETREAT',controllerId:p.decisionOwnerControllerId,battleId:p.battleId,retreats:order.map(unitId=>({unitId,path:(presentation.retreatDrafts[unitId]??[]).map(h=>({...h}))}))};
  return {order,completeUnitIds,activeUnitId,options,action:completeRoutes.length===order.length?action:null};
}

/** Ordering can affect stacking, so the player may choose the next unplanned unit. */
export function chooseRetreater(session:LocalGameSession,presentation:PresentationState,id:EntityId):void {
  const p=session.state.pendingDecision;
  if(p?.kind!=='RETREAT'||presentation.privacyGate||p.decisionOwnerControllerId!==session.activeViewerControllerId||!p.unitIds.includes(id))return;
  const plan=retreatPlan(session,presentation);
  if(plan.completeUnitIds.includes(id))return;
  const planned=plan.order.filter(candidate=>(presentation.retreatDrafts[candidate]?.length??0)>0||plan.completeUnitIds.includes(candidate));
  // Finish a partially drafted route before choosing the following unit.
  if(plan.activeUnitId&&(presentation.retreatDrafts[plan.activeUnitId]?.length??0)>0)return;
  presentation.retreatOrder=[...planned.filter(candidate=>candidate!==id),id];
  presentation.activeRetreaterId=id;
}

export function chooseRetreatDestination(session:LocalGameSession,presentation:PresentationState,destination:HexCoord):void {
  const p=session.state.pendingDecision;
  if(p?.kind!=='RETREAT'||presentation.privacyGate||p.decisionOwnerControllerId!==session.activeViewerControllerId)return;
  const plan=retreatPlan(session,presentation),id=plan.activeUnitId;
  if(!id||!plan.options.some(h=>coreHexKey(h)===coreHexKey(destination))){presentation.message=msg('feedback.illegalRetreat');return;}
  if(!presentation.retreatOrder.includes(id))presentation.retreatOrder.push(id);
  presentation.retreatDrafts[id]=[...(presentation.retreatDrafts[id]??[]),{...destination}];
  continueCombatFlow(session,presentation);
}

export function chooseAdvancer(session:LocalGameSession,presentation:PresentationState,unitId:EntityId):void {
  if(!presentation.privacyGate&&session.state.pendingDecision?.decisionOwnerControllerId===session.activeViewerControllerId&&advanceChoices(session).includes(unitId))presentation.advanceUnitId=unitId;
}
/** Counters can sit above decision polygons; route their taps to the same map action. */
export function routeCombatDecisionCounter(session:LocalGameSession,presentation:PresentationState,unitId:EntityId):boolean {
  const p=session.state.pendingDecision,unit=session.state.units[unitId];
  if(!p||!unit||presentation.privacyGate)return false;
  if(p.kind==='RETREAT'){
    const plan=retreatPlan(session,presentation);
    if(plan.options.some(h=>coreHexKey(h)===coreHexKey(unit.hex)))chooseRetreatDestination(session,presentation,unit.hex);
    else chooseRetreater(session,presentation,unitId);
    return true;
  }
  if(p.kind==='ADVANCE_AFTER_COMBAT'){
    const target=session.state.combatTransactions[p.battleId]?.targetHex;
    if(target&&coreHexKey(target)===coreHexKey(unit.hex))chooseAdvanceDestination(session,presentation,unit.hex);
    else chooseAdvancer(session,presentation,unitId);
    return true;
  }
  if(p.kind==='SCHWERPUNKT_OPTION'){
    if(p.decisionOwnerControllerId===session.activeViewerControllerId&&schwerpunktChoices(session).some(choice=>coreHexKey(choice.target)===coreHexKey(unit.hex))){
      presentation.schwerpunktTarget={...unit.hex};presentation.interactionMode='SCHWERPUNKT';
    }
    return true;
  }
  return false;
}

export function undoRetreatDestination(presentation:PresentationState):void {
  const id=[...presentation.retreatOrder].reverse().find(id=>presentation.retreatDrafts[id]?.length);
  if(!id)return;
  presentation.retreatDrafts[id]!.pop();presentation.activeRetreaterId=id;
  presentation.retreatOrder=presentation.retreatOrder.slice(0,presentation.retreatOrder.indexOf(id)+1);
}
export function chooseAdvanceDestination(session:LocalGameSession,presentation:PresentationState,destination:HexCoord):void {
  const p=session.state.pendingDecision;if(p?.kind!=='ADVANCE_AFTER_COMBAT'||presentation.privacyGate||p.decisionOwnerControllerId!==session.activeViewerControllerId)return;
  const tx=session.state.combatTransactions[p.battleId],ids=advanceChoices(session);
  const unitId=ids.includes(presentation.advanceUnitId??'')?presentation.advanceUnitId:ids.length===1?ids[0]:null;
  if(!tx||!unitId||coreHexKey(destination)!==coreHexKey(tx.targetHex))return;
  const out=dispatchGameAction(session,{type:'ADVANCE_AFTER_COMBAT',controllerId:session.activeViewerControllerId,battleId:p.battleId,unitId});
  if(!out.result.accepted){presentation.message=joinIssues(out.result.issues);return;}
  continueCombatFlow(session,presentation);
}

/** Only forced transitions are automated. Optional resources, loss choices, movement,
 * unit ordering, breakthrough and second attacks remain explicit player decisions. */
export function continueCombatFlow(session:LocalGameSession,presentation:PresentationState):void {
  for(let transitions=0;transitions<16;transitions++){
    const p=session.state.pendingDecision;
    if(!p){
      const tx=presentation.selectedBattleId?session.state.combatTransactions[presentation.selectedBattleId]:null;
      if(tx?.stage==='CLOSED'){
        clearCombatDrafts(presentation);presentation.interactionMode='SELECT';presentation.privacyGate=null;
        setActiveViewer(session,controllerIdForSide(session,session.state.activeSide));
        presentation.message=msg('combat.flow.completed',{result:tx.resolution?.crtResult??'—'});
      }
      return;
    }
    presentation.selectedBattleId=p.battleId;
    const base={controllerId:p.decisionOwnerControllerId,battleId:p.battleId};
    let forced:Action|null=null;
    if(p.kind==='DEFENDER_REACTION'){
      const choices=reactionChoices(session);
      if(!choices.artillery.length&&!choices.hq.length)forced={...base,type:'PASS_REACTION'};
    }else if(p.kind==='ADVANCE_AFTER_COMBAT'){
      const ids=advanceChoices(session);
      if(!ids.length)forced={...base,type:'PASS_ADVANCE'};
      else if(ids.length===1)presentation.advanceUnitId=ids[0]!;
    }else if(p.kind==='RETREAT'){
      const plan=retreatPlan(session,presentation);forced=plan.action;
      presentation.activeRetreaterId=plan.activeUnitId;presentation.interactionMode='RETREAT';
    }else if(p.kind==='BREAKTHROUGH_OPTION'){
      const tx=session.state.combatTransactions[p.battleId]!;
      const any=p.eligibleUnitIds.some(unitId=>getNeighbors(tx.targetHex).some(hex=>accepts(session,{...base,type:'BREAKTHROUGH',unitId,path:[hex]})));
      if(!any)forced={...base,type:'PASS_BREAKTHROUGH'};
      else if(!presentation.breakthroughUnitId)presentation.breakthroughUnitId=p.eligibleUnitIds[0]??null;
    }else if(p.kind==='SCHWERPUNKT_OPTION'&&!schwerpunktChoices(session).length)forced={...base,type:'PASS_SCHWERPUNKT'};
    if(!forced){
      // Combat is public after deployment. Present the actual decision directly,
      // with its owner in the panel, instead of a separate handoff confirmation.
      // Viewer changes are presentation-only; Core still checks the action owner.
      setActiveViewer(session,p.decisionOwnerControllerId);presentation.privacyGate=null;
      return;
    }
    const out=dispatchGameAction(session,forced);
    if(!out.result.accepted){presentation.message=joinIssues(out.result.issues);return;}
    if(forced.type==='RETREAT'){presentation.retreatDrafts={};presentation.retreatOrder=[];presentation.activeRetreaterId=null;}
  }
}

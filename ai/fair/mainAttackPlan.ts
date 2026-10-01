import {getNeighbors,hexDistance,hexKey} from '../../vendor/eastfront-digital-core/dist/core/hex.js';
import {createMoveScorer} from './routing.js';
import type {FairPlanProvider} from './plan.js';

/** AI-PLAN-023: experimental, German-only, one local cohort per movement phase.
 * No retained state, RNG, authority access or additional route searches. */
export const MAIN_ATTACK_LIMITS=Object.freeze({members:4,clusterRadius:2,targetRadius:3,cells:37,minimumMP:3});
export const mainAttackPlan:FairPlanProvider=(input,previous)=>{
 const {view,rules}=input;
 if(input.scope.side!=='GERMAN'||view.viewer!=='GERMAN'||view.activeSide!=='GERMAN'||view.phase!=='GERMAN_MOVEMENT'||view.pendingDecision||input.deployment||!rules.objectives.length)return null;
 const enemies=view.units.filter(u=>u.side!==view.viewer);
 let boundary=-1;for(let i=0;i<input.history.length;i++)if(input.history[i]!.outcome==='ACCEPTED'&&input.history[i]!.intent?.type==='READY_FOR_PHASE_END')boundary=i;
 const recent=input.history.slice(boundary+1),attempts=recent.filter(h=>h.intent?.type==='MOVE');
 const failed=new Set(attempts.filter(h=>h.outcome==='REJECTED').map(h=>h.intent?.type==='MOVE'?h.intent.unitId:''));
 const eligible=view.units.filter(u=>'friendly' in u&&u.friendly.controllerId===input.scope.controllerId&&u.friendly.alive&&!u.friendly.hasMoved&&!u.friendly.dedicatedRailRepair&&u.type!=='ARTILLERY'
  &&u.stats.movement-(u.supplyState==='OUT_OF_SUPPLY'?rules.oosMovementPenalty:0)>=MAIN_ATTACK_LIMITS.minimumMP&&!failed.has(u.id)&&!enemies.some(e=>hexDistance(u.hex,e.hex)<=1));
 const distance=(h:{readonly q:number;readonly r:number})=>Math.min(...rules.objectives.map(g=>hexDistance(h,g)));
 const risk=createMoveScorer(input); // safeDestination only: never invoke score/prefix/search.
 if(previous){
  if(previous.scope.matchId!==input.scope.matchId||previous.scope.controllerId!==input.scope.controllerId||previous.scope.side!==input.scope.side)return null;
  const goalKeys=new Set(previous.goals.map(hexKey));
  const members=eligible.filter(u=>previous.unitIds.includes(u.id)&&!goalKeys.has(hexKey(u.hex)));
  // Release a finished, moved, rejected, engaged or newly unsafe member independently;
  // there is no requirement to wait for the cohort to assemble or finish together.
  const unitIds=members.filter(u=>previous.goals.some(g=>risk.safeDestination(u.id,g)&&distance(g)<distance(u.hex))).map(u=>u.id).sort();
  const goals=previous.goals.filter(g=>unitIds.every(id=>risk.safeDestination(id,g)));
  return unitIds.length&&goals.length?{unitIds,goals:goals.map(g=>({...g}))}:null;
 }
 // After any movement attempt, never recruit replacements in this phase. A phase's
 // eligible observation creates a cohort or leaves the original policy.
 // Friendly hasMoved also covers accepted moves evicted from the 16-receipt window.
 if(attempts.length||view.units.some(u=>'friendly' in u&&u.friendly.controllerId===input.scope.controllerId&&u.friendly.hasMoved)||eligible.length<2)return null;
 eligible.sort((a,b)=>distance(a.hex)-distance(b.hex)||b.stats.movement-a.stats.movement||a.id.localeCompare(b.id));
 const anchor=eligible[0]!;
 const members=eligible.filter(u=>hexDistance(u.hex,anchor.hex)<=MAIN_ATTACK_LIMITS.clusterRadius)
  .sort((a,b)=>hexDistance(a.hex,anchor.hex)-hexDistance(b.hex,anchor.hex)||b.stats.movement-a.stats.movement||a.id.localeCompare(b.id)).slice(0,MAIN_ATTACK_LIMITS.members);
 if(members.length<2)return null;
 const board=new Set(view.hexes.map(h=>hexKey(h.coord))),cells=new Map([[hexKey(anchor.hex),anchor.hex]]);
 let frontier=[anchor.hex];for(let i=0;i<MAIN_ATTACK_LIMITS.targetRadius;i++){
  const next:typeof frontier=[];for(const h of frontier)for(const g of getNeighbors(h)){const k=hexKey(g);if(!cells.has(k)){cells.set(k,g);next.push(g);}}frontier=next;
 }
 const centers=[...cells.values()].filter(g=>hexDistance(anchor.hex,g)>=2&&board.has(hexKey(g))&&members.every(u=>distance(g)<distance(u.hex)&&risk.safeDestination(u.id,g)))
  .sort((a,b)=>distance(a)-distance(b)||members.reduce((n,u)=>n+hexDistance(u.hex,a)-hexDistance(u.hex,b),0)||hexKey(a).localeCompare(hexKey(b)));
 const center=centers[0];if(!center)return null;
 const goals=[center,...getNeighbors(center)].filter(g=>board.has(hexKey(g))&&members.every(u=>distance(g)<distance(u.hex)&&risk.safeDestination(u.id,g)));
 return {unitIds:members.map(u=>u.id).sort(),goals:goals.map(g=>({...g}))};
};

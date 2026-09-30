import {hexDistance,hexKey} from '../../vendor/eastfront-digital-core/dist/core/hex.js';
import {observationCandidates} from './candidates.js';
import {createMoveScorer} from './routing.js';
import type {DeepReadonly,FairInput,FairIntent} from './types.js';
/** Narrow German exploitation of an already offered advance. No Core, battle state,
 * hidden positions, hypothetical combat results, or extra movement allowance. */
export function chooseCombatAdvance(input:DeepReadonly<FairInput>):FairIntent|null {
  const {view}=input,p=view.pendingDecision;
  if(view.viewer!=='GERMAN'||p?.kind!=='ADVANCE_AFTER_COMBAT'||p.decisionOwnerControllerId!==input.scope.controllerId||!input.rules.objectives.length)return null;
  // One rejected advance ends this optional attempt; never probe another unit's
  // version of the same destination after generic, non-explanatory rejection.
  if(input.history.some(h=>h.outcome==='REJECTED'&&h.intent?.type==='ADVANCE_AFTER_COMBAT'&&h.intent.battleId===p.battleId))return null;
  // Pending DTO omits the destination. Recover only our own latest accepted attack
  // receipt in this phase; if absent/ambiguous, preserve the existing pass fallback.
  let attack:DeepReadonly<Extract<FairIntent,{type:'ATTACK'}>>|null=null;
  for(let i=input.history.length-1;i>=0;i--){
    const h=input.history[i]!;if(h.outcome!=='ACCEPTED')continue;
    const a=h.intent;if(a?.type==='READY_FOR_PHASE_END'||a?.type==='SCHWERPUNKT_ATTACK')break;
    if(a?.type==='ATTACK'){attack=a;break;}
  }
  if(!attack||!p.eligibleUnitIds.every(id=>attack!.attackerUnitIds.includes(id)))return null;
  const target=attack.target,k=hexKey(target);
  if(!view.identifiedHexKeys.includes(k)||view.units.some(u=>u.side!==view.viewer&&hexKey(u.hex)===k))return null;
  const distance=(h:{q:number;r:number})=>Math.min(...input.rules.objectives.map(g=>hexDistance(h,g)));
  const risk=createMoveScorer(input),options=observationCandidates(input).filter(a=>a.type==='ADVANCE_AFTER_COMBAT');
  const eligible=options.flatMap(intent=>{
    const u=view.units.find(u=>u.id===intent.unitId&&'friendly' in u&&u.friendly.controllerId===input.scope.controllerId);
    if(!u||!('friendly' in u)||!u.friendly.alive||u.type==='ARTILLERY'||u.friendly.dedicatedRailRepair||hexDistance(u.hex,target)!==1||!risk.safeDestination(u.id,target))return [];
    const progress=distance(u.hex)-distance(target);return progress>0?[{intent,progress}]:[];
  }).sort((a,b)=>b.progress-a.progress||a.intent.unitId.localeCompare(b.intent.unitId));
  return eligible[0]?.intent??null;
}

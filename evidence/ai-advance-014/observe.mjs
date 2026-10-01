// Passive diagnostics from the same authorized DTO; never used to choose actions.
import {chooseCombatAdvance as original} from '../../.evaluation/original/.ai-dist/ai/fair/advance.js';
import {hexDistance} from '../../.ai-dist/vendor/eastfront-digital-core/dist/core/hex.js';
import {hash} from '../../ai/lab/common.mjs';
export function advanceOffer(input){
 const p=input.view.pendingDecision;if(input.view.viewer!=='GERMAN'||p?.kind!=='ADVANCE_AFTER_COMBAT')return null;
 const target=input.history.findLast(h=>h.outcome==='ACCEPTED'&&h.intent?.type==='ATTACK')?.intent.target;
 const enemies=input.view.units.filter(u=>u.side!=='GERMAN');
 const options=p.eligibleUnitIds.map(id=>{
  const u=input.view.units.find(u=>u.id===id),one=structuredClone(input);one.view.pendingDecision.eligibleUnitIds=[id];
  const oldEligible=!!original(one),start=enemies.filter(e=>u&&hexDistance(u.hex,e.hex)===1).map(e=>e.id).sort(),dest=enemies.filter(e=>target&&hexDistance(target,e.hex)===1).map(e=>e.id).sort(),added=dest.filter(id=>!start.includes(id));
  return {unitId:id,from:u?.hex,to:target,adjacentBefore:start,adjacentAfter:dest,added,oldEligible,guardExcluded:oldEligible&&added.length>0,retained:oldEligible&&!added.length};
 });
 return {battleId:p.battleId,inputHash:hash(input),originalChoice:original(input),visibleEnemies:enemies.map(e=>({id:e.id,hex:e.hex,type:e.type,stats:e.stats})),options};
}

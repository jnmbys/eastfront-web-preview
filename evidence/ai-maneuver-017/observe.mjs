// Passive, authorized-DTO-only diagnostics. Never participates in the chosen action.
import {createMoveScorer} from '../../.ai-dist/ai/fair/routing.js';
import {createMoveScorer as oldScorer} from '../../.evaluation/baseline014/.ai-dist/ai/fair/routing.js';
import {basicAgent as oldAgent} from '../../.evaluation/baseline014/.ai-dist/ai/fair/basicAgent.js';
import {observationCandidates} from '../../.ai-dist/ai/fair/candidates.js';
import {hexDistance} from '../../.ai-dist/vendor/eastfront-digital-core/dist/core/hex.js';
export function movementProbe(input){
 if(input.view.viewer!=='GERMAN'||input.view.phase!=='GERMAN_MOVEMENT'||input.view.pendingDecision)return null;
 const started=performance.now(),newer=createMoveScorer(input),old=oldScorer(input),enemies=input.view.units.filter(e=>e.side!=='GERMAN'),adjacent=new Map(input.view.units.filter(u=>u.friendly&&!u.friendly.hasMoved).map(u=>[u.id,enemies.filter(e=>hexDistance(e.hex,u.hex)===1).map(e=>e.id)]));
 const candidates=observationCandidates(input,false),newAdjacent=[],oldAdjacent=[];
 for(const a of candidates)if(a.type==='MOVE'){
  const score=newer.score(a),prior=old.score(a);if(Number.isFinite(score)&&adjacent.get(a.unitId)?.length)newAdjacent.push({first:a,score,prefix:newer.prefix(a),origin:input.view.units.find(u=>u.id===a.unitId).hex,adjacent:adjacent.get(a.unitId)});
  if(Number.isFinite(prior)&&adjacent.get(a.unitId)?.length)oldAdjacent.push(a);
 }
 return {newAdjacent,oldAdjacent,newMetrics:newer.metrics,oldMetrics:old.metrics,oldChoice:oldAgent(input),diagnosticMs:performance.now()-started};
}

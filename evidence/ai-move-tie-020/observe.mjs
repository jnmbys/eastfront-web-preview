import assert from 'node:assert/strict';
import {basicAgent as oldAgent} from '../../.evaluation/baseline014/.ai-dist/ai/fair/basicAgent.js';
import {createMoveScorer} from '../../.ai-dist/ai/fair/routing.js';
import {observationCandidates} from '../../.ai-dist/ai/fair/candidates.js';
import {scoreIntent} from '../../.ai-dist/ai/fair/basicAgent.js';
import {agentOrder} from '../../.ai-dist/ai/fair/minimalAgent.js';
import {prioritizeMoveTies} from '../../.ai-dist/ai/fair/moveTie.js';
import {hexDistance} from '../../.ai-dist/vendor/eastfront-digital-core/dist/core/hex.js';
export function movementProbe(input,choice){
 if(input.view.viewer!=='GERMAN'||input.view.phase!=='GERMAN_MOVEMENT'||input.view.pendingDecision)return null;
 const moves=createMoveScorer(input),rejected=new Set(input.history.filter(h=>h.outcome==='REJECTED'&&h.observationKey===input.observationKey).map(h=>JSON.stringify(h.intent))),failures=input.history.filter(h=>h.outcome==='REJECTED'&&h.observationKey===input.observationKey).length;
 const ranked=observationCandidates(input,false).filter(a=>!rejected.has(JSON.stringify(a))&&(failures<3||a.type==='READY_FOR_PHASE_END')).map((a,i)=>({a,score:a.type==='MOVE'?moves.score(a):scoreIntent(input,a),tie:agentOrder(input.agentRandom.seed,i)})).filter(x=>Number.isFinite(x.score)).sort((a,b)=>b.score-a.score||a.tie-b.tie);
 const distance=h=>Math.min(...input.rules.objectives.map(g=>hexDistance(h,g))),end=a=>{const p=moves.prefix(a);return p.type==='MOVE'?distance(p.path.at(-1)):null;};
 const expandedBefore=moves.metrics.expanded,started=performance.now(),ordered=prioritizeMoveTies(ranked,end),tieMs=performance.now()-started;assert.equal(moves.metrics.expanded,expandedBefore);
 const selected=ordered.length?{kind:'INTENT',intent:moves.prefix(ordered[0].a)}:{kind:'STOP',reason:'NO_CANDIDATE'};assert.deepEqual(selected,choice);
 const before=performance.now(),original=oldAgent(input),oldPolicyMs=performance.now()-before,changed=JSON.stringify(original)!==JSON.stringify(choice);
 if(changed){assert.equal(original.intent.type,'MOVE');assert.equal(choice.intent.type,'MOVE');assert.equal(ordered[0].score,ranked[0].score);assert(end(ordered[0].a)<end(ranked[0].a));}
 return {changed,original,primaryScore:ranked[0]?.score??null,oldEndpointDistance:original.intent?.type==='MOVE'?distance(original.intent.path.at(-1)):null,newEndpointDistance:choice.intent?.type==='MOVE'?distance(choice.intent.path.at(-1)):null,unitOriginDistance:choice.intent?.type==='MOVE'?distance(input.view.units.find(u=>u.id===choice.intent.unitId).hex):null,topTied:ranked.filter(r=>r.score===ranked[0]?.score).map(r=>({intent:moves.prefix(r.a),score:r.score,tie:r.tie,distance:end(r.a)})),metrics:moves.metrics,tieMs,oldPolicyMs};
}

import assert from 'node:assert/strict';
import {movementProbe as priorProbe} from '../ai-maneuver-017/observe.mjs';
import {basicAgent as priorAgent} from '../../.evaluation/experiment017/.ai-dist/ai/fair/basicAgent.js';
import {createMoveScorer} from '../../.ai-dist/ai/fair/routing.js';
import {observationCandidates} from '../../.ai-dist/ai/fair/candidates.js';
import {scoreIntent} from '../../.ai-dist/ai/fair/basicAgent.js';
import {agentOrder} from '../../.ai-dist/ai/fair/minimalAgent.js';
import {createAttackReserve} from '../../.ai-dist/ai/fair/attackReserve.js';
export function movementProbe(input,choice){
 const base=priorProbe(input);if(!base)return null;
 const t=performance.now(),original017=priorAgent(input),original017Ms=performance.now()-t;
 const moves=createMoveScorer(input),reserve=createAttackReserve(input,scoreIntent),rejected=new Set(input.history.filter(h=>h.outcome==='REJECTED'&&h.observationKey===input.observationKey).map(h=>JSON.stringify(h.intent))),failures=input.history.filter(h=>h.outcome==='REJECTED'&&h.observationKey===input.observationKey).length;
 const ranked=observationCandidates(input,false).filter(a=>!rejected.has(JSON.stringify(a))&&(failures<3||a.type==='READY_FOR_PHASE_END')).map((a,i)=>({a,score:a.type==='MOVE'?moves.score(a):scoreIntent(input,a),tie:agentOrder(input.agentRandom.seed,i)})).filter(x=>Number.isFinite(x.score)).sort((a,b)=>b.score-a.score||a.tie-b.tie);
 let selected=null,guardMs=0;const checks=[];
 for(const x of ranked){const intent=moves.prefix(x.a),start=performance.now(),result=reserve.check(intent);guardMs+=performance.now()-start;checks.push({intent,...result});if(!result.blocked){selected={kind:'INTENT',intent};break;}}
 assert.deepEqual(selected??{kind:'STOP',reason:'NO_CANDIDATE'},choice);
 return {...base,reserve:{checks,metrics:reserve.metrics,guardMs,original017,original017Ms,changed:JSON.stringify(original017)!==JSON.stringify(choice)}};
}

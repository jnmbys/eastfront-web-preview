import {observationCandidates} from './candidates.js';
import type {FairAgent,FairIntent,DeepReadonly} from './types.js';
/** Local tie breaker only; never imports or invokes the combat RNG. */
export function agentOrder(seed:number,index:number):number {
  let x=((seed>>>0)^Math.imul(index+1,0x9e3779b9))>>>0;
  x^=x>>>16;x=Math.imul(x,0x7feb352d);x^=x>>>15;x=Math.imul(x,0x846ca68b);return (x^(x>>>16))>>>0;
}
const key=(intent:DeepReadonly<FairIntent>|null)=>JSON.stringify(intent);
/** Deliberately passive verification policy. Deploy, pass phases/reactions/options, allocate own loss.
 * Handles reinforcement and retreat proposals; no strategic movement or attack planning. */
export const minimalAgent:FairAgent=input=>{
  let candidates=observationCandidates(input);
  if(!input.deployment&&!input.view.pendingDecision&&input.view.phase!=='SOVIET_REINFORCEMENT_SUPPLY')candidates=candidates.filter(a=>a.type==='READY_FOR_PHASE_END');
  const rejected=new Set(input.history.filter(a=>a.outcome==='REJECTED'&&a.observationKey===input.observationKey).map(a=>key(a.intent)));
  const remaining=candidates.filter(a=>!rejected.has(key(a)));
  if(!remaining.length)return {kind:'STOP',reason:'NO_CANDIDATE'};
  const i=input.deployment?agentOrder(input.agentRandom.seed,input.agentRandom.decisionIndex)%remaining.length:0;
  return {kind:'INTENT',intent:remaining[i]!};
};

import {hexKey} from '../../vendor/eastfront-digital-core/dist/core/hex.js';
import {createMoveScorer} from './routing.js';
import {observationCandidates} from './candidates.js';
import {minimalAgent,agentOrder} from './minimalAgent.js';
import type {FairAgent,FairInput,FairIntent,DeepReadonly} from './types.js';
import {parseParameters,type Parameters} from './parameters.js';
const defaults=parseParameters();
type Input=DeepReadonly<FairInput>;
const key=(a:unknown)=>JSON.stringify(a);
/** Heuristic only, never CRT prediction or an authoritative legality query.
 * No unseen support, surrounded bonus, future dice or inferred CONTACT strength. */
export function scoreIntent(input:Input,a:FairIntent,params:Readonly<Parameters>=defaults):number {
  const {view,rules}=input;
  const own=view.units.filter(u=>'friendly' in u&&u.friendly.controllerId===input.scope.controllerId);
  const enemies=view.units.filter(u=>u.side!==view.viewer);
  if(a.type==='READY_FOR_PHASE_END')return 0;
  if(a.type==='ATTACK'){
    const attackers=own.filter(u=>a.attackerUnitIds.includes(u.id));
    const defenders=enemies.filter(u=>hexKey(u.hex)===hexKey(a.target));
    if(!defenders.length||attackers.length!==a.attackerUnitIds.length)return -Infinity;
    const attack=attackers.reduce((n,u)=>n+(u.supplyState==='OUT_OF_SUPPLY'?Math.ceil(u.stats.attack*rules.oosAttackMultiplier):u.stats.attack),0);
    const defense=defenders.reduce((n,u)=>n+u.stats.defense,0);
    const terrain=view.hexes.find(h=>hexKey(h.coord)===hexKey(a.target));
    let penalty=Math.max(0,-(rules.terrainAttackShift[terrain?.terrain??'']??0));
    if(defenders.some(u=>u.entrenched))penalty+=Math.max(0,-rules.entrenchmentShift);
    // Conservative: charge the worst crossing and ignore favorable combined-arms/flank bonuses.
    penalty+=Math.max(0,...attackers.map(u=>{
      const e=view.edges.find(e=>(hexKey(e.a)===hexKey(u.hex)&&hexKey(e.b)===hexKey(a.target))||(hexKey(e.b)===hexKey(u.hex)&&hexKey(e.a)===hexKey(a.target)));
      return e?.river?-(rules.riverAttackShift[e.river]??0):0;
    }));
    const ratio=attack/Math.max(1,defense);
    const required=params.attackRatio+penalty*params.penaltyWeight;
    return ratio>=required?10+Math.min(10,ratio-required):-Infinity;
  }
  if(a.type==='MOVE')return createMoveScorer(input).score(a);
  return -Infinity;
}
/** Stateless, deterministic basic policy. Original minimal policy remains the forced-flow owner. */
export function createBasicAgent(options:unknown={}):FairAgent {
 const params=parseParameters(options);
 return input=>{
  if(input.deployment||input.view.pendingDecision||!input.view.phase.endsWith('_MOVEMENT')&&!input.view.phase.endsWith('_COMBAT'))return minimalAgent(input);
  const rejected=new Set(input.history.filter(h=>h.outcome==='REJECTED'&&h.observationKey===input.observationKey).map(h=>key(h.intent)));
  // Avoid probing alternative tactical intents after repeated rejection. Never inspect error codes.
  const failures=input.history.filter(h=>h.outcome==='REJECTED'&&h.observationKey===input.observationKey).length;
  const moves=createMoveScorer(input);
  const ranked=observationCandidates(input,false).filter(a=>!rejected.has(key(a))&&(failures<3||a.type==='READY_FOR_PHASE_END'))
    .map((a,i)=>({a,score:a.type==='MOVE'?moves.score(a):scoreIntent(input,a,params),tie:agentOrder(input.agentRandom.seed,i)}))
    .filter(x=>Number.isFinite(x.score)).sort((a,b)=>b.score-a.score||a.tie-b.tie);
  return ranked.length?{kind:'INTENT',intent:moves.prefix(ranked[0]!.a)}:{kind:'STOP',reason:'NO_CANDIDATE'};
};

}
export const basicAgent:FairAgent=createBasicAgent();

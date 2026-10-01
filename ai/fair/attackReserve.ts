import {hexDistance,hexKey} from '../../vendor/eastfront-digital-core/dist/core/hex.js';
import {attackCandidatePool} from './candidates.js';
import type {DeepReadonly,FairInput,FairIntent} from './types.js';
type Input=DeepReadonly<FairInput>;
type Result={blocked:boolean;protectedTargets:string[];unknownTargets:string[]};
/** Decision-local, observation-only guard for017's newly movable German units.
 * Absence is conclusive only for a complete bounded candidate family with known
 * own eligibility. No authority, hidden occupancy, visibility prediction or dice. */
export function createAttackReserve(input:Input,score:(input:Input,a:FairIntent)=>number){
  const metrics={checks:0,pools:0,scored:0,blocked:0,unknown:0};
  const cache=new Map<string,Result>();
  let before:ReturnType<typeof evaluate>|undefined;
  const known=input.view.units.filter(u=>u.side===input.view.viewer).every(u=>
    'friendly' in u&&typeof u.friendly.controllerId==='string'&&
    typeof u.friendly.alive==='boolean'&&typeof u.friendly.hasAttacked==='boolean'&&
    typeof u.friendly.dedicatedRailRepair==='boolean'&&Number.isFinite(u.stats.attack)&&
    ['SUPPLIED','OUT_OF_SUPPLY'].includes(u.supplyState));
  function evaluate(i:Input){
    const pool=attackCandidatePool(i),positive=new Set<string>();metrics.pools++;
    for(const a of pool.intents)if(a.type==='ATTACK'){metrics.scored++;if(Number.isFinite(score(i,a)))positive.add(hexKey(a.target));}
    return {positive,complete:pool.completeTargets};
  }
  const combat=(i:Input):Input=>({...i,view:{...i.view,phase:'GERMAN_COMBAT',pendingDecision:null}});
  function check(a:FairIntent):Result{
    const clear={blocked:false,protectedTargets:[],unknownTargets:[]};
    if(input.view.viewer!=='GERMAN'||input.view.phase!=='GERMAN_MOVEMENT'||input.view.pendingDecision||a.type!=='MOVE'||!a.path.length)return clear;
    const u=input.view.units.find(u=>u.id===a.unitId);
    if(!u||!('friendly' in u)||u.friendly.controllerId!==input.scope.controllerId||u.friendly.hasMoved||
      !input.view.units.some(e=>e.side!==input.view.viewer&&hexDistance(e.hex,u.hex)===1))return clear;
    const end=a.path.at(-1)!,key=u.id+':'+hexKey(end),cached=cache.get(key);if(cached)return cached;
    metrics.checks++;
    if(!known){metrics.unknown++;const r={...clear,unknownTargets:['OWN_ELIGIBILITY_UNKNOWN']};cache.set(key,r);return r;}
    before??=evaluate(combat(input));
    if(!before.positive.size){cache.set(key,clear);return clear;}
    // Only this own position changes; public enemy observations remain frozen.
    const after=evaluate(combat({...input,view:{...input.view,units:input.view.units.map(v=>v.id===u.id&&'friendly' in v?{...v,hex:end,friendly:{...v.friendly,hex:end,hasMoved:true}}:v)}}));
    const lost=[...before.positive].filter(k=>!after.positive.has(k));
    const protectedTargets=lost.filter(k=>after.complete.has(k)),unknownTargets=lost.filter(k=>!after.complete.has(k));
    const r={blocked:protectedTargets.length>0,protectedTargets,unknownTargets};
    if(r.blocked)metrics.blocked++;if(unknownTargets.length)metrics.unknown++;
    cache.set(key,r);return r;
  }
  return {check,metrics};
}

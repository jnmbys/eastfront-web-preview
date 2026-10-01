import {hexKey} from '../../vendor/eastfront-digital-core/dist/core/hex.js';
import type {DeepReadonly,FairInput} from './types.js';

/** One bounded shared region; this is a transport contract, not a main-attack policy. */
export const PLAN_UNIT_LIMIT=8,PLAN_REGION_LIMIT=7;
export interface FairPlanSpec {unitIds:string[];goals:{q:number;r:number}[];}
export interface FairPlanSnapshot extends FairPlanSpec {
  schema:'fair-plan-v1';scope:FairInput['scope'];observationKey:string;decisionIndex:number;revision:number;
}
/** Trusted, audited code only. Receives no authority object, state, validator or callback. */
export type FairPlanProvider=(input:DeepReadonly<FairInput>,previous:DeepReadonly<FairPlanSnapshot>|null)=>FairPlanSpec|null;

/** Validate and copy only the narrow payload; never accept supplied paths or hidden IDs. */
export function validatePlanSpec(input:DeepReadonly<FairInput>,value:unknown):FairPlanSpec|null {
  if(value===null)return null;
  if(!value||typeof value!=='object'||Object.keys(value).sort().join(',')!=='goals,unitIds')throw new Error('Invalid fair plan payload.');
  const {unitIds,goals}=value as FairPlanSpec;
  if(!Array.isArray(unitIds)||!unitIds.length||unitIds.length>PLAN_UNIT_LIMIT||!Array.isArray(goals)||!goals.length||goals.length>PLAN_REGION_LIMIT)throw new Error('Fair plan exceeds fixed bounds.');
  const own=new Set(input.view.units.filter(u=>'friendly' in u&&u.friendly.controllerId===input.scope.controllerId&&u.friendly.alive).map(u=>u.id));
  const board=new Set(input.view.hexes.map(h=>hexKey(h.coord)));
  if(unitIds.some(id=>typeof id!=='string'||!own.has(id))||new Set(unitIds).size!==unitIds.length)throw new Error('Invalid fair plan membership.');
  if(goals.some(h=>!h||typeof h!=='object'||Object.keys(h).sort().join(',')!=='q,r'||!Number.isSafeInteger(h.q)||!Number.isSafeInteger(h.r)||!board.has(hexKey(h)))||new Set(goals.map(hexKey)).size!==goals.length)throw new Error('Invalid fair plan region.');
  return {unitIds:[...unitIds].sort(),goals:goals.map(h=>({q:h.q,r:h.r})).sort((a,b)=>hexKey(a).localeCompare(hexKey(b)))};
}

/** Stale/cross-seat snapshots cannot affect candidate generation, even in offline callers. */
export function planGoals(input:DeepReadonly<FairInput>,unitId:string):readonly {readonly q:number;readonly r:number}[]|null {
  const p=input.plan;
  if(!p||p.schema!=='fair-plan-v1'||p.observationKey!==input.observationKey||p.decisionIndex!==input.agentRandom.decisionIndex||p.scope.matchId!==input.scope.matchId||p.scope.controllerId!==input.scope.controllerId||p.scope.side!==input.scope.side||!Number.isSafeInteger(p.revision)||p.revision<1)return null;
  try{
    const spec=validatePlanSpec(input,{unitIds:p.unitIds,goals:p.goals});
    return spec?.unitIds.includes(unitId)?spec.goals:null;
  }catch{return null;}
}

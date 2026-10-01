import {deriveSovietReinforcementSlots} from '../../vendor/eastfront-digital-core/dist/rules/reinforcement.js';
import {sha256} from './sha256.js';
import {RulesEngine,deploymentHexKeysForSide,isDeploymentPhase,validateGameStateIntegrity,type GameState,type Side} from '../../src/core-adapter/core.js';
import type {GameRules,ScenarioConfig} from '../../vendor/eastfront-digital-core/dist/core/config.js';
import {derivePlayerView,rememberPlayerView,type Knowledge} from '../../src/player-view/playerView.js';
import {isNetworkAction,toCoreAction,type NetworkAction} from '../../src/multiplayer/gameplayProtocol.js';
import {observationCandidates} from '../fair/candidates.js';
import type {FairInput,FairAgent,FairIntent,OwnAttempt,DeepReadonly} from '../fair/types.js';
import {validatePlanSpec,type FairPlanSnapshot,type FairPlanProvider} from '../fair/plan.js';
import {fairView,publicRules} from './projection.js';
export const HISTORY_LIMIT=16,REJECTION_LIMIT=8;
export type StepStatus='ACCEPTED'|'REJECTED'|'GAME_OVER'|'AGENT_STOP'|'AGENT_ERROR'|'REJECTION_LIMIT'|'INTEGRITY_FAILURE';
export interface HostStep {status:StepStatus;side:Side|null;reason?:string;}
interface SeatMemory {seed:number;decisions:number;history:OwnAttempt[];rejections:number;
  plan:FairPlanSnapshot|null;planRevision:number;prepared?:{decisionIndex:number;observationKey:string;input:DeepReadonly<FairInput>};}
function freeze<T>(value:T):DeepReadonly<T>{
  if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value as DeepReadonly<T>;
}
function stable(value:unknown):string {
  if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+stable(v)).join(',')+'}';
  return JSON.stringify(value);
}
/** TRUSTED AUTHORITY ONLY. Never hand this object, its methods, state or audit to a policy.
 * One instance per match; one private memory partition per assigned controller. */
export class FairHost {
  #lastResult:import('../../src/core-adapter/core.js').ActionResult|null=null;
  #state:GameState;#rules:GameRules;#scenario:ScenarioConfig;#engine:RulesEngine;#matchId:string;
  #planProviders:Partial<Record<Side,FairPlanProvider>>;
  #knowledge:Partial<Record<Side,Knowledge>>={};#memory=new Map<string,SeatMemory>();#terminal:HostStep|null=null;
  constructor(options:{matchId:string;initialState:GameState;rules:GameRules;scenario:ScenarioConfig;agentSeeds:Record<Side,number>;planProviders?:Partial<Record<Side,FairPlanProvider>>}){
    if(!options.matchId)throw new Error('A fresh match scope is required.');
    this.#state=structuredClone(options.initialState);this.#rules=structuredClone(options.rules);this.#scenario=structuredClone(options.scenario);this.#matchId=options.matchId;
    this.#planProviders={...options.planProviders};
    this.#engine=new RulesEngine(this.#rules,this.#scenario);
    for(const side of ['GERMAN','SOVIET'] as const){
      const seats=Object.values(this.#state.controllers).filter(c=>c.side===side);
      if(seats.length!==1)throw new Error('AI-001 supports exactly one controller per side.');
      const seed=options.agentSeeds[side];if(!Number.isSafeInteger(seed))throw new Error('Agent seeds must be explicit integers independent of combat RNG.');
      this.#memory.set(seats[0]!.id,{seed,decisions:0,history:[],rejections:0,plan:null,planRevision:0});
      this.#knowledge[side]=rememberPlayerView(derivePlayerView(this.#state,side,this.#rules))!;
    }
    if(validateGameStateIntegrity(this.#state,this.#rules,this.#scenario).length)this.#terminal={status:'INTEGRITY_FAILURE',side:null};
  }
  /** Host-owned observation transport. It is NOT passed as a callable policy capability. */
  observe(controllerId:string):DeepReadonly<FairInput>{
    const seat=this.#state.controllers[controllerId],memory=this.#memory.get(controllerId);
    if(!seat||!memory)throw new Error('Unassigned fair-agent seat.');
    const view=fairView(derivePlayerView(this.#state,seat.side,this.#rules,this.#knowledge[seat.side]),seat.side);
    const rules=publicRules(this.#rules,this.#scenario);
    const deployment=isDeploymentPhase(this.#state)?{
      roster:(this.#scenario.deployment?.units??[]).filter(u=>u.side===seat.side).map(u=>({id:u.id,templateId:u.templateId})).sort((a,b)=>a.id.localeCompare(b.id)),
      // Core helper audited: reads only public map geometry/terrain and zone configuration.
      zone:deploymentHexKeysForSide(this.#state,this.#scenario,seat.side).filter(k=>!!this.#state.hexes[k]).map(k=>({q:this.#state.hexes[k]!.coord.q,r:this.#state.hexes[k]!.coord.r})),
    }:null;
    // Public schedule plus this seat's accepted deployment receipts only. Never query entry legality.
    // Persistent own receipts survive bounded feedback eviction and unit destruction.
    const consumed=new Set(this.#state.actionLog.filter(e=>e.accepted&&e.action.controllerId===controllerId&&e.action.type==='DEPLOY_REINFORCEMENT').map(e=>e.action.type==='DEPLOY_REINFORCEMENT'?e.action.reinforcementId:''));
    const reinforcements=seat.side==='SOVIET'?{
      availableIds:deriveSovietReinforcementSlots(this.#scenario).filter(s=>s.scheduledTurn<=view.turn&&!consumed.has(s.id)).map(s=>s.id),
      entries:this.#scenario.sovietEastRailExits.map(h=>({q:h.q,r:h.r})),
    }:null;
    const observationKey=sha256(stable({view,rules,deployment,reinforcements}));
    const input=freeze(structuredClone({schema:'fair-player-view-v1' as const,observationKey,scope:{matchId:this.#matchId,controllerId,side:seat.side},view,rules,deployment,reinforcements,
      history:memory.history,agentRandom:{seed:memory.seed,decisionIndex:memory.decisions}}));
    const provider=this.#planProviders[seat.side];
    if(!provider)return input; // Disabled means exactly the original v1 DTO.
    if(!view.phase.endsWith('_MOVEMENT')||view.activeSide!==seat.side||view.pendingDecision){memory.plan=null;delete memory.prepared;return input;}
    // Cache only authorized observation + own decision sequence, never hidden authority revisions.
    const cached=memory.prepared;
    if(cached&&cached.decisionIndex===memory.decisions&&cached.observationKey===observationKey)return cached.input;
    // Provider sees a copied/frozen seat-local plan, never authority state or global revisions.
    const spec=validatePlanSpec(input,provider(input,memory.plan?freeze(structuredClone(memory.plan)):null));
    memory.plan=spec?{...spec,schema:'fair-plan-v1',scope:{...input.scope},observationKey,decisionIndex:memory.decisions,revision:++memory.planRevision}:null;
    const prepared=memory.plan?freeze(structuredClone({...input,plan:memory.plan})):input;
    memory.prepared={decisionIndex:memory.decisions,observationKey,input:prepared};
    return prepared;
  }
  step(agents:Record<Side,FairAgent>):HostStep {
    this.#lastResult=null;
    if(this.#terminal)return {...this.#terminal};
    if((this.#state as GameState).phase==='GAME_OVER'||this.#state.victory.winner)return this.#finish('GAME_OVER',null);
    const controllerId=this.#state.pendingDecision?.decisionOwnerControllerId??Object.values(this.#state.controllers).find(c=>c.side===this.#state.activeSide)!.id;
    const seat=this.#state.controllers[controllerId]!,memory=this.#memory.get(controllerId)!;
    let input:DeepReadonly<FairInput>,decision:ReturnType<FairAgent>;
    try{input=this.observe(controllerId);const policy=agents[seat.side];decision=policy(input);}catch{return this.#finish('AGENT_ERROR',seat.side);}
    memory.decisions++;
    if(decision?.kind==='STOP')return this.#finish('AGENT_STOP',seat.side,decision.reason==='UNSUPPORTED_RETREAT'?'UNSUPPORTED_RETREAT':'NO_CANDIDATE');
    // Exact existing intent schema plus observation-only admission. No forged controller/action IDs,
    // invisible targets, hidden IDs, support probes, preview calls or unrelated action capabilities.
    const proposed=decision?.kind==='INTENT'?decision.intent:null;
    const candidates=observationCandidates(input);
    const admitted=isNetworkAction(proposed)?candidates.find(c=>stable(c)===stable(proposed)):undefined;
    let accepted=false;
    if(admitted){
      const result=this.#engine.apply(this.#state,toCoreAction(admitted,controllerId));
      if(result.accepted){
        this.#accept(result);accepted=true;
      }
      // result.state/events/issues/actionId/random are NEVER returned to the policy.
    }
    memory.history.push({observationKey:input.observationKey,intent:admitted?structuredClone(admitted):null,outcome:accepted?'ACCEPTED':'REJECTED'});
    memory.history=memory.history.slice(-HISTORY_LIMIT);memory.rejections=accepted?0:memory.rejections+1;
    if(accepted&&validateGameStateIntegrity(this.#state,this.#rules,this.#scenario).length)return this.#finish('INTEGRITY_FAILURE',seat.side);
    if((this.#state as GameState).phase==='GAME_OVER'||this.#state.victory.winner)return this.#finish('GAME_OVER',seat.side);
    if(memory.rejections>=REJECTION_LIMIT)return this.#finish('REJECTION_LIMIT',seat.side);
    return {status:accepted?'ACCEPTED':'REJECTED',side:seat.side};
  }
  #accept(result:import('../../src/core-adapter/core.js').ActionResult):void {
    const before=this.#state;this.#state=result.state;this.#lastResult=result;
    // Public phase/turn boundaries invalidate plans even during human takeover.
    if(before.phase!==this.#state.phase||before.turn!==this.#state.turn)for(const memory of this.#memory.values()){memory.plan=null;delete memory.prepared;}
    for(const side of ['GERMAN','SOVIET'] as const){
      const prior=rememberPlayerView(derivePlayerView(before,side,this.#rules,this.#knowledge[side]))!;
      this.#knowledge[side]=rememberPlayerView(derivePlayerView(this.#state,side,this.#rules,prior))!;
    }
  }
  /** TRUSTED human transport only; caller additionally enforces recipient-visible target rules.
   * Never supplied to a fair policy as a callback or oracle. */
  submitHuman(controllerId:string,action:NetworkAction):boolean {
    this.#lastResult=null;
    if(this.#terminal||this.#state.victory.winner||!isNetworkAction(action))return false;
    const owner=this.#state.pendingDecision?.decisionOwnerControllerId??Object.values(this.#state.controllers).find(c=>c.side===this.#state.activeSide)?.id;
    if(owner!==controllerId)return false;
    const result=this.#engine.apply(this.#state,toCoreAction(action,controllerId));
    if(!result.accepted)return false;
    this.#accept(result);
    if(validateGameStateIntegrity(this.#state,this.#rules,this.#scenario).length)this.#finish('INTEGRITY_FAILURE',this.#state.controllers[controllerId]!.side);
    return true;
  }
  /** Explicit manual takeover may release policy stops, never integrity or terminal failures. */
  takeOver():boolean {
    if(this.#terminal&& !['AGENT_STOP','AGENT_ERROR','REJECTION_LIMIT'].includes(this.#terminal.status))return false;
    this.#terminal=null;return true;
  }
  auditTransition(){return structuredClone({result:this.#lastResult,knowledge:this.#knowledge,terminal:this.#terminal});}
  #finish(status:StepStatus,side:Side|null,reason?:string):HostStep {this.#terminal={status,side,...(reason?{reason}:{})};return {...this.#terminal};}
  /** PRIVILEGED EVALUATION ONLY. Not exported by ai/fair/index and never a policy input. */
  auditOmniscient():GameState{return structuredClone(this.#state);}
}
export function runFairGame(host:FairHost,agents:Record<Side,FairAgent>,maxDecisions=1000):{termination:HostStep|{status:'ACTION_LIMIT'};steps:HostStep[]}{
  if(!Number.isSafeInteger(maxDecisions)||maxDecisions<=0||maxDecisions>10000)throw new Error('Bounded maxDecisions must be 1..10000.');
  const steps:HostStep[]=[];
  for(let i=0;i<maxDecisions;i++){const result=host.step(agents);steps.push(result);if(result.status!=='ACCEPTED'&&result.status!=='REJECTED')return {termination:result,steps};}
  return {termination:{status:'ACTION_LIMIT'},steps};
}

/** Privileged verification harness. Never imported by the fair graph. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {host,RulesEngine,defaultRules,defaultScenario,microScenario} from './helpers.mjs';
import {minimalAgent,observationCandidates} from '../../.ai-dist/ai/fair/index.js';
export const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function record(initial,{policy=minimalAgent,limit=1000,seeds={GERMAN:101,SOVIET:202}}={}){
 const h=host(initial,'AI002-repro',{agentSeeds:seeds}),trace=[];let current=null,termination;
 const wrapped=input=>{const decision=policy(input);current={side:input.scope.side,turn:input.view.turn,phase:input.view.phase,pending:input.view.pendingDecision?.kind??null,observationKey:input.observationKey,decisionIndex:input.agentRandom.decisionIndex,decision:structuredClone(decision)};return decision;};
 for(let i=0;i<limit;i++){
  current=null;const result=h.step({GERMAN:wrapped,SOVIET:wrapped});trace.push({...current,result});
  if(!['ACCEPTED','REJECTED'].includes(result.status)){termination=result;break;}
 }
 const end=h.auditOmniscient(),actions=end.actionLog.slice(initial.actionLog.length).filter(e=>e.accepted).map(e=>e.action);
 return {h,end,report:{initialSeed:initial.random.seed,agentSeeds:seeds,termination:termination??{status:'ACTION_LIMIT'},accepted:actions.length,rejected:trace.filter(e=>['REJECTED','REJECTION_LIMIT'].includes(e.result.status)).length,turn:end.turn,phase:end.phase,finalHash:digest(end),traceHash:digest(trace),trace,actions}};
}
export function replay(initial,run){
 const scenario=initial.scenarioId===microScenario.id?microScenario:defaultScenario,engine=new RulesEngine(defaultRules,scenario);let state=initial;
 for(const action of run.report.actions){const result=engine.apply(state,action);assert(result.accepted,JSON.stringify(result.issues));state=result.state;}
 assert.deepEqual(state,run.end);
}
export function save(name,report){const dir=new URL('../../evidence/ai002/',import.meta.url);mkdirSync(dir,{recursive:true});writeFileSync(new URL(name+'.json',dir),JSON.stringify(report,null,2)+'\n');}
/** Fixture-independent observation policy: attack once per seat, then process the battle.
 * Optional moves use authorized candidates only; it never closes over the host/real state. */
export function battlePolicy({advance=false,breakthrough=false,secondAttack=false}={}){
 return input=>{
  const candidates=observationCandidates(input),p=input.view.pendingDecision;
  const rejected=new Set(input.history.filter(e=>e.observationKey===input.observationKey&&e.outcome==='REJECTED').map(e=>JSON.stringify(e.intent)));
  let pick;
  if(!p&&input.agentRandom.decisionIndex===0)pick=candidates.find(a=>a.type==='ATTACK');
  if(advance&&p?.kind==='ADVANCE_AFTER_COMBAT')pick=candidates.find(a=>a.type==='ADVANCE_AFTER_COMBAT'&&!rejected.has(JSON.stringify(a)));
  if(breakthrough&&p?.kind==='BREAKTHROUGH_OPTION')pick=candidates.find(a=>a.type==='BREAKTHROUGH'&&a.path[0].q===1&&a.path[0].r===0&&!rejected.has(JSON.stringify(a)));
  if(secondAttack&&p?.kind==='SCHWERPUNKT_OPTION')pick=candidates.find(a=>a.type==='SCHWERPUNKT_ATTACK'&&!rejected.has(JSON.stringify(a)));
  return pick?{kind:'INTENT',intent:pick}:minimalAgent(input);
 };
}

// Trusted offline evaluator ONLY. Never imported by fair policy or browser runtime.
import {mkdirSync,writeFileSync} from 'node:fs';
import {host,production,RulesEngine,defaultRules,defaultScenario} from './helpers.mjs';
import {basicAgent,scoreIntent,observationCandidates} from '../../.ai-dist/ai/fair/index.js';
import {toCoreAction} from '../../.ai-dist/src/multiplayer/gameplayProtocol.js';
const [label='before',seedText='17']=process.argv.slice(2),seed=Number(seedText);
const initial=production(); initial.random={...initial.random,seed,state:seed};
const h=host(initial,'ai004r1-campaign'),engine=new RulesEngine(defaultRules,defaultScenario);
const rejected=[],steps=[],combat=[],seen=new Map();
let lastInput,lastDecision;
const agent=input=>{lastInput=input;lastDecision=basicAgent(input);return lastDecision;};
for(let n=0;n<2000;n++){
 const state=h.auditOmniscient(),result=h.step({GERMAN:agent,SOVIET:agent});
 const intent=lastDecision?.intent;
 steps.push({n,turn:state.turn,phase:state.phase,pending:state.pendingDecision?.kind??null,intent,result});
 if(result.status==='REJECTED'){
  // Post hoc replay on a clone: result and issue text stay in this evaluator.
  const replay=engine.apply(structuredClone(state),toCoreAction(intent,lastInput.scope.controllerId));
  const repeatedKey=JSON.stringify([state.turn,state.phase,intent]),repeat=(seen.get(repeatedKey)??0)+1;seen.set(repeatedKey,repeat);
  const own=intent.unitId?lastInput.view.units.find(u=>u.id===intent.unitId):null;
  rejected.push({n,turn:state.turn,phase:state.phase,pending:state.pendingDecision?.kind??null,intent,issues:replay.issues,repeat,observationKey:lastInput.observationKey,own,
    visibleEnemies:lastInput.view.units.filter(u=>u.side!==lastInput.view.viewer),
    destination:intent.path?.length?lastInput.view.hexes.find(h=>JSON.stringify(h.coord)===JSON.stringify(intent.path.at(-1))):null});
 }
 if(state.phase.endsWith('_COMBAT')&&!state.pendingDecision){
  const attacks=observationCandidates(lastInput).filter(a=>a.type==='ATTACK');
  combat.push({turn:state.turn,phase:state.phase,visibleEnemies:lastInput.view.units.filter(u=>u.side!==lastInput.view.viewer).length,
    candidates:attacks.length,favorable:attacks.filter(a=>Number.isFinite(scoreIntent(lastInput,a))).length,chosen:intent?.type,
    scores:attacks.map(a=>({intent:a,score:scoreIntent(lastInput,a)}))});
 }
 if(!['ACCEPTED','REJECTED'].includes(result.status))break;
}
const state=h.auditOmniscient(),count={};for(const e of state.actionLog)if(e.accepted)count[e.action.type]=(count[e.action.type]??0)+1;
const reasons={};for(const e of rejected)for(const i of e.issues)reasons[JSON.stringify(i)]=(reasons[JSON.stringify(i)]??0)+1;
const summary={seed,termination:steps.at(-1).result,accepted:steps.filter(s=>s.result.status==='ACCEPTED').length,rejected:rejected.length,count,reasons,combatDecisions:combat.length,combatWithAdjacent:combat.filter(x=>x.candidates).length,combatWithFavorable:combat.filter(x=>x.favorable).length,repeated:rejected.filter(x=>x.repeat>1).length};
mkdirSync('evidence/ai004r1',{recursive:true});writeFileSync(`evidence/ai004r1/${label}-${seed}.json`,JSON.stringify({summary,rejected,combat,steps,finalRandom:state.random},null,2)+'\n');
console.log(JSON.stringify(summary,null,2));

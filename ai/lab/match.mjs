// Trusted runner; policies receive only FairHost's frozen PlayerView DTO.
import {appendFileSync,readFileSync} from 'node:fs';
import {FairHost} from '../../.ai-dist/ai/authority/FairHost.js';
import {minimalAgent} from '../../.ai-dist/ai/fair/index.js';
import {createDeploymentGameState,importLegacyMap,defaultRules,defaultScenario,RulesEngine} from '../../.ai-dist/vendor/eastfront-digital-core/dist/index.js';
import {basicAgent} from '../../.ai-dist/ai/lab/frozenBasic.js';
import {createBasicAgent} from '../../.ai-dist/ai/fair/basicAgent.js';
import {hexDistance,hexKey} from '../../.ai-dist/vendor/eastfront-digital-core/dist/core/hex.js';
import {toCoreAction} from '../../.ai-dist/src/multiplayer/gameplayProtocol.js';
import {hash,atomic,root} from './common.mjs';
export function initial(seed){const map=importLegacyMap(JSON.parse(readFileSync(root+'/vendor/eastfront-digital-core/reference/strategic-reset-f-map.json')));return createDeploymentGameState({scenario:defaultScenario,rules:defaultRules,hexes:map.hexes,edges:map.edges,seed});}
export const rulesIdentity=()=>({rulesId:defaultRules.id,scenarioId:defaultScenario.id,rulesHash:hash(defaultRules),scenarioHash:hash(defaultScenario),mapHash:hash(readFileSync(root+'/vendor/eastfront-digital-core/reference/strategic-reset-f-map.json'))});
export function run(job,limits,journal){
 const state=initial(job.seed),host=new FairHost({matchId:job.id,initialState:state,rules:defaultRules,scenario:defaultScenario,agentSeeds:{GERMAN:101,SOVIET:202}});
 const policies=Object.fromEntries(['GERMAN','SOVIET'].map(side=>[side,job.seats[side].version==='ai005-param-v1'?createBasicAgent(job.seats[side].params):job.seats[side].version==='ai005'?basicAgent:minimalAgent]));let decision=null;const started=performance.now();let termination={status:'ACTION_LIMIT'},count=0;
 const agents=Object.fromEntries(['GERMAN','SOVIET'].map(side=>[side,input=>{const choice=policies[side](input);decision={side,controllerId:input.scope.controllerId,turn:input.view.turn,phase:input.view.phase,observationKey:input.observationKey,choice};return choice;}]));
 for(let n=0;n<limits.maxDecisions;n++){
  if(performance.now()-started>=limits.matchMs){termination={status:'TIMEOUT'};break;}
  decision=null;const result=host.step(agents);count++;
  appendFileSync(journal,JSON.stringify({n,...decision,result})+'\n');
  if(!['ACCEPTED','REJECTED'].includes(result.status)){termination=result;break;}
 }
 // First authoritative audit is AFTER decisions finish. No full state is fed back.
 const end=host.auditOmniscient(),actions=end.actionLog.filter(e=>e.accepted).map(e=>e.action);
 const goals=defaultScenario.capitalCoreHexes;
 const progress={germanControlledCapitalHexes:goals.filter(h=>end.hexes[hexKey(h)]?.control==='GERMAN').length,capitalHexes:goals.length,nearestGermanToCapital:Math.min(...Object.values(end.units).filter(u=>u.alive&&u.side==='GERMAN').flatMap(u=>goals.map(g=>hexDistance(u.hex,g))))};
 if(!Number.isFinite(progress.nearestGermanToCapital))progress.nearestGermanToCapital=null;
 return {objectiveProgress:progress,termination,decisions:count,turn:end.turn,winner:termination.status==='GAME_OVER'?end.victory.winner:null,accepted:actions.length,attacks:actions.filter(a=>a.type==='ATTACK').length,elapsedMs:performance.now()-started,finalHash:hash(end),finalRandom:end.random,...rulesIdentity()};
}
export function replay(job,records,expected){
 let state=initial(job.seed);const engine=new RulesEngine(defaultRules,defaultScenario);
 for(const row of records){if(!['ACCEPTED','GAME_OVER','INTEGRITY_FAILURE'].includes(row.result.status)||row.choice?.kind!=='INTENT')continue;
  const result=engine.apply(state,toCoreAction(row.choice.intent,row.controllerId));
  if(!result.accepted){if(row.result.status==='GAME_OVER')continue;throw Error(`Replay rejected at ${row.n}`);}state=result.state;
 }
 const finalHash=hash(state);if(expected&&expected!==finalHash)throw Error('Replay hash mismatch');return {actions:state.actionLog.filter(e=>e.accepted).length,finalHash};
}
if(process.argv[2]==='--child'){
 try{const {job,limits,journal,result}=JSON.parse(readFileSync(process.argv[3]));atomic(result,run(job,limits,journal));}
 catch(e){console.error(e.stack);process.exitCode=1;}
}

/** Trusted headless test host, not a frontend or Human-vs-AI entry. */
import {readFileSync} from 'node:fs';
import {createDeploymentGameState,importLegacyMap,defaultRules,defaultScenario} from '../.ai-dist/vendor/eastfront-digital-core/dist/index.js';
import {FairHost,runFairGame} from '../.ai-dist/ai/authority/FairHost.js';
import {minimalAgent} from '../.ai-dist/ai/fair/index.js';
const map=importLegacyMap(JSON.parse(readFileSync(new URL('../vendor/eastfront-digital-core/reference/strategic-reset-f-map.json',import.meta.url),'utf8')));
const initial=createDeploymentGameState({scenario:defaultScenario,rules:defaultRules,hexes:map.hexes,edges:map.edges,seed:17});
const host=new FairHost({matchId:'AI002-demo-only',initialState:initial,rules:defaultRules,scenario:defaultScenario,agentSeeds:{GERMAN:101,SOVIET:202}});
const run=runFairGame(host,{GERMAN:minimalAgent,SOVIET:minimalAgent},1000);
// Host-only audit. Never passed to the policy or emitted as a full state.
const end=host.auditOmniscient();
console.log(JSON.stringify({task:'AI-002',mode:'fair-boundary-verification-only',strategy:'passive minimal agent; not strategic AI',termination:run.termination,
 decisions:run.steps.length,accepted:end.actionLog.filter(e=>e.accepted).length-initial.actionLog.filter(e=>e.accepted).length,rejected:run.steps.filter(s=>s.status==='REJECTED').length,
 sides:[...new Set(run.steps.map(s=>s.side))],turn:end.turn,phase:end.phase,combatRngUnchanged:JSON.stringify(initial.random)===JSON.stringify(end.random),
 limitation:'Observation-only proposals can exhaust bounded retries with hidden blockers. Passive whole-game run is not combat coverage. No Human-vs-AI UI or production integration.'},null,2));

import {readFileSync} from 'node:fs';
import {RulesEngine,createGameState,createDeploymentGameState,defaultRules,defaultScenario,importLegacyMap,deploymentHexKeysForSide} from '../../.ai-dist/vendor/eastfront-digital-core/dist/index.js';
import {FairHost} from '../../.ai-dist/ai/authority/FairHost.js';
export {defaultRules,defaultScenario,RulesEngine};
export const G='G-HUMAN-1',S='S-AI-1';
// Test-only small-map scenario; rules and turn limit remain the production values.
export const microScenario=structuredClone(defaultScenario);delete microScenario.deployment;
Object.assign(microScenario,{id:'ai001-micro-fixture',initialUnits:[],capitalCoreHexes:[{q:4,r:4},{q:4,r:5}],capitalOuterHexes:[],germanWestRailEntries:[{q:-5,r:0}],sovietEastRailExits:[{q:5,r:0}],sovietSupplySources:[{q:5,r:0}]});
export const unit=(id,templateId,side,type,hex)=>({id,templateId,side,type,step:0,alive:true,hex:{...hex},supplyState:'SUPPLIED',entrenched:false,hasMoved:false,hasAttacked:false,controllerId:side==='GERMAN'?G:S,temporarySupply:false,dedicatedRailRepair:false,reconZocIgnoreUsed:false,artillerySupportUsed:false,lastHQCommandTurn:null});
export function fixture(seed=2722,units=[unit('g','G-INF','GERMAN','INFANTRY',{q:0,r:0}),unit('secret-enemy','S-INF','SOVIET','INFANTRY',{q:5,r:0})],phase='GERMAN_MOVEMENT'){
 const hexes=[];for(let q=-5;q<=5;q++)for(let r=-5;r<=5;r++)hexes.push({coord:{q,r},terrain:'PLAIN',control:null});
 const state=createGameState({scenario:microScenario,rules:defaultRules,hexes,edges:[],units,seed});
 for(const u of Object.values(state.units))if(u.alive)u.supplyState='SUPPLIED';state.phase=phase;state.activeSide=phase.startsWith('SOVIET')?'SOVIET':'GERMAN';return state;
}
export const host=(state,matchId='test-match',extra={})=>new FairHost({matchId,initialState:state,rules:defaultRules,scenario:state.scenarioId===microScenario.id?microScenario:defaultScenario,agentSeeds:{GERMAN:101,SOVIET:202},...extra});
export const intent=action=>()=>({kind:'INTENT',intent:action});
export function production(){const raw=JSON.parse(readFileSync(new URL('../../vendor/eastfront-digital-core/reference/strategic-reset-f-map.json',import.meta.url),'utf8'));const map=importLegacyMap(raw);return createDeploymentGameState({scenario:defaultScenario,rules:defaultRules,hexes:map.hexes,edges:map.edges,seed:17});}
export function germanDeployment(){let s=production();const engine=new RulesEngine(defaultRules,defaultScenario),zone=deploymentHexKeysForSide(s,defaultScenario,'SOVIET');let i=0;
 for(const u of defaultScenario.deployment.units.filter(u=>u.side==='SOVIET')){const r=engine.apply(s,{type:'DEPLOY_INITIAL_UNIT',controllerId:S,deploymentUnitId:u.id,hex:s.hexes[zone[i++]].coord});if(!r.accepted)throw new Error(JSON.stringify(r.issues));s=r.state;}
 const r=engine.apply(s,{type:'READY_FOR_PHASE_END',controllerId:S});if(!r.accepted)throw new Error(JSON.stringify(r.issues));return r.state;
}
export function attackFixture(seed=8246){return fixture(seed,[unit('g','G-PANZER','GERMAN','PANZER',{q:-1,r:0}),unit('d','S-ELITE','SOVIET','ELITE_INFANTRY',{q:0,r:0}),unit('d2','S-INF','SOVIET','INFANTRY',{q:0,r:0})],'GERMAN_COMBAT');}

import {RulesEngine,createGameState,defaultRules,defaultScenario} from '../../dist/vendor/eastfront-digital-core/dist/index.js';
import {createPresentationState} from '../../dist/app/state/presentation.js';
export const G='G-HUMAN-1',S='S-AI-1';
export const key=h=>`${h.q},${h.r}`;
export const unit=(id,templateId,side,type,hex)=>({id,templateId,side,type,step:0,alive:true,hex:{...hex},supplyState:'SUPPLIED',entrenched:false,hasMoved:false,hasAttacked:false,controllerId:side==='GERMAN'?G:S,temporarySupply:false,dedicatedRailRepair:false,reconZocIgnoreUsed:false,artillerySupportUsed:false,lastHQCommandTurn:null});
export const ordinary=()=>[unit('g','G-INF','GERMAN','INFANTRY',{q:-1,r:0}),unit('d','S-ELITE','SOVIET','ELITE_INFANTRY',{q:0,r:0})];
export function fixture(seed=2722,units=ordinary()){
 const hexes=[];for(let q=-5;q<=5;q++)for(let r=-5;r<=5;r++)hexes.push({coord:{q,r},terrain:'PLAIN',control:null});
 const state=createGameState({scenario:defaultScenario,rules:defaultRules,hexes,edges:[],units,seed});
 for(const u of Object.values(state.units))if(u.alive)u.supplyState='SUPPLIED';
 state.phase='GERMAN_COMBAT';state.activeSide='GERMAN';
 return {s:{state,scenario:defaultScenario,rules:defaultRules,engine:new RulesEngine(defaultRules,defaultScenario),activeViewerControllerId:G,lastResult:null,integrityIssues:[]},p:createPresentationState(false,false)};
}

export async function productionFixture(seed=17){
 const {readFile}=await import('node:fs/promises');
 const {createLocalGameSession,dispatchGameAction}=await import('../../dist/app/core-adapter/session.js');
 const {deploymentHexKeysForSide}=await import('../../dist/app/core-adapter/core.js');
 const raw=JSON.parse(await readFile(new URL('../../vendor/eastfront-digital-core/reference/strategic-reset-f-map.json',import.meta.url),'utf8'));
 const s=createLocalGameSession(raw,seed);
 const apply=action=>{const r=dispatchGameAction(s,action).result;if(!r.accepted)throw new Error(JSON.stringify(r.issues));};
 for(const [side,cid,special]of [['SOVIET',S,{'S-I-01':'3,-1'}],['GERMAN',G,{'G-PZ-01':'2,-1'}]]){
  s.activeViewerControllerId=cid;const counts={},zone=deploymentHexKeysForSide(s.state,s.scenario,side),ids=s.scenario.deployment.units.filter(u=>u.side===side).map(u=>u.id).sort();
  for(const [id,k]of Object.entries(special)){apply({type:'DEPLOY_INITIAL_UNIT',controllerId:cid,deploymentUnitId:id,hex:s.state.hexes[k].coord});counts[k]=(counts[k]??0)+1;}
  for(const id of ids){if(id in special)continue;const k=zone.find(k=>(counts[k]??0)<2&&!Object.values(special).includes(k));apply({type:'DEPLOY_INITIAL_UNIT',controllerId:cid,deploymentUnitId:id,hex:s.state.hexes[k].coord});counts[k]=(counts[k]??0)+1;}
  apply({type:'READY_FOR_PHASE_END',controllerId:cid});
 }
 while(s.state.phase!=='GERMAN_COMBAT')apply({type:'READY_FOR_PHASE_END',controllerId:G});
 return {s,p:createPresentationState(false,false)};
}

import {createGameState,hexKey} from '../../vendor/eastfront-digital-core/dist/index.js';
import {createLocalGameSession,type LocalGameSession} from '../../src/core-adapter/session.js';
import {defaultRules,defaultScenario,RulesEngine,getNeighbors,type Side,type UnitState} from '../../src/core-adapter/core.js';
import type {LocalStart} from '../../src/local-ai/types.js';
import {FairHost} from '../authority/FairHost.js';
import {basicAgent} from '../fair/basicAgent.js';
import {minimalAgent} from '../fair/minimalAgent.js';
import {observationCandidates} from '../fair/candidates.js';
import type {FairAgent} from '../fair/types.js';
/** Fixed scenario fixtures, not a strategic agent. No pending decision is manufactured. */
export function prepareLocalScenario(options:LocalStart):{session:LocalGameSession;policy:FairAgent}{
 const session=createLocalGameSession(options.map,options.seed);
 if(options.scenario==='campaign')return {session,policy:basicAgent};
 if(options.scenario==='reinforcement'||options.scenario==='terminal'){
  const host=new FairHost({matchId:'AI003-scenario-preparation',initialState:session.state,rules:session.rules,scenario:session.scenario,agentSeeds:{GERMAN:101,SOVIET:202}});
  let ready=false;
  for(let i=0;i<1000;i++){
   const state=host.auditOmniscient();ready=options.scenario==='reinforcement'?state.turn===4&&state.phase==='SOVIET_REINFORCEMENT_SUPPLY':state.turn===session.scenario.turnLimit&&state.phase==='GERMAN_ENTRENCHMENT';
   if(ready){session.state=state;session.knowledge=host.auditTransition().knowledge;break;}
   const step=host.step({GERMAN:minimalAgent,SOVIET:minimalAgent});if(!['ACCEPTED','REJECTED'].includes(step.status))throw new Error('Scenario preparation stopped: '+step.status);
  }
  if(!ready)throw new Error('Scenario preparation limit');return {session,policy:minimalAgent};
 }
 const scenario=structuredClone(defaultScenario);delete scenario.deployment;scenario.id='AI003-fixed-combat';scenario.initialUnits=[];
 const state=session.state;
 const origin=Object.values(state.hexes).find(h=>h.coord.q>8&&h.coord.q<20&&[-1,0,1,2].every(d=>state.hexes[hexKey({q:h.coord.q+d,r:h.coord.r})]?.terrain==='PLAIN')&&!Object.values(state.edges).some(e=>e.river&&[e.a,e.b].some(c=>c.r===h.coord.r&&c.q>=h.coord.q-1&&c.q<=h.coord.q+2)))?.coord;
 if(!origin)throw new Error('Fixture plain corridor unavailable');
 const humanAttack=options.scenario==='human-attack';const attacker:Side=options.scenario==='breakthrough'?'GERMAN':humanAttack||options.scenario==='stop'?options.humanSide:options.humanSide==='GERMAN'?'SOVIET':'GERMAN';
 const defender:Side=attacker==='GERMAN'?'SOVIET':'GERMAN';
 const controller=(side:Side)=>Object.values(state.controllers).find(c=>c.side===side)!.id;
 const unit=(id:string,side:Side,templateId:string,q:number,r:number):UnitState=>({id,side,templateId,type:defaultRules.unitTemplates[templateId]!.type,hex:{q,r},step:0,alive:true,supplyState:'SUPPLIED',entrenched:false,hasMoved:false,hasAttacked:false,controllerId:controller(side),temporarySupply:false,dedicatedRailRepair:false,reconZocIgnoreUsed:false,artillerySupportUsed:false,lastHQCommandTurn:null});
 const units=[unit('attacker',attacker,attacker==='GERMAN'?'G-PANZER':'S-TANK',origin.q-1,origin.r),unit('defender',defender,defender==='GERMAN'?'G-INF':'S-TANK',origin.q,origin.r),unit('reserve',defender,defender==='GERMAN'?'G-INF':'S-INF',origin.q+2,origin.r)];
 if(options.scenario==='ai-attack'){
  const supportHex=getNeighbors({q:origin.q,r:origin.r+1}).find(h=>state.hexes[hexKey(h)]?.terrain!=='LAKE'&&state.hexes[hexKey(h)]&&h.q!==origin.q-1);
  if(supportHex)units.push(unit('human-support',defender,defender==='GERMAN'?'G-ARTY':'S-ARTY',supportHex.q,supportHex.r));
 }
 session.scenario=scenario;session.engine=new RulesEngine(defaultRules,scenario);
 session.state=createGameState({scenario,rules:defaultRules,hexes:Object.values(state.hexes),edges:Object.values(state.edges),units,seed:8246});
 // Explicit valid scenario initial condition, matching AI002 combat fixtures. Subsequent stages
 // are reached only by accepted Actions; this is not a production campaign progress claim.
 session.state.phase=attacker==='GERMAN'?'GERMAN_COMBAT':'SOVIET_COMBAT';session.state.activeSide=attacker;
 for(const u of Object.values(session.state.units))u.supplyState='SUPPLIED';
 if(options.scenario==='stop'){
  // Existing stop fixture now retains a real pending reaction. Never manufacture
  // a pending object; the original Core accepts the fixture's opening attack.
  const result=session.engine.apply(session.state,{type:'ATTACK',controllerId:controller(attacker),attackerUnitIds:['attacker'],target:{q:origin.q,r:origin.r}});
  if(!result.accepted||!result.state.pendingDecision)throw new Error('Stop fixture attack failed');
  session.state=result.state;session.lastResult=result;
  return {session,policy:()=>({kind:'STOP',reason:'NO_CANDIDATE'})};
 }
 if(options.scenario==='breakthrough'){
  const host=new FairHost({matchId:'AI003-breakthrough-preparation',initialState:session.state,rules:session.rules,scenario,agentSeeds:{GERMAN:101,SOVIET:202}});
  for(let i=0;i<12;i++){
   const current=host.auditOmniscient();if(current.pendingDecision?.kind==='ADVANCE_AFTER_COMBAT'){session.state=current;session.knowledge=host.auditTransition().knowledge;session.lastResult=host.auditTransition().result;return {session,policy:minimalAgent};}
   const policy:FairAgent=input=>input.agentRandom.decisionIndex===0&&!input.view.pendingDecision?{kind:'INTENT',intent:observationCandidates(input).find(a=>a.type==='ATTACK')!}:minimalAgent(input);
   const result=host.step({GERMAN:policy,SOVIET:policy});if(result.status!=='ACCEPTED')throw new Error('Breakthrough fixture '+result.status);
  }
  throw new Error('Breakthrough fixture limit');
 }
 const scripted:FairAgent=input=>{
  if(input.agentRandom.decisionIndex===0&&!input.view.pendingDecision){const attack=observationCandidates(input).find(a=>a.type==='ATTACK');if(attack)return {kind:'INTENT',intent:attack};}
  return minimalAgent(input);
 };
 return {session,policy:humanAttack?minimalAgent:scripted};
}

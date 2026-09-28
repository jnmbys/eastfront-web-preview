import {createLocalGameSession,controllerIdForSide,setActiveViewer,dispatchGameAction} from '../app/core-adapter/session.js';
import {deploymentHexKeysForSide,getLegalRetreatStepOptions,validateGameStateIntegrity} from '../vendor/eastfront-digital-core/dist/index.js';
export function createScene(raw,kind='movement'){
 const s=createLocalGameSession(raw,17),actions=[];
 const send=a=>{const r=dispatchGameAction(s,a);if(!r.result.accepted)throw Error(JSON.stringify(r.result.issues));actions.push(a);return r.result;};
 for(const side of ['SOVIET','GERMAN']){
  const cid=controllerIdForSide(s,side);setActiveViewer(s,cid);const zone=deploymentHexKeysForSide(s.state,s.scenario,side),counts={};
  const special=kind==='combat'?(side==='SOVIET'?{'S-I-01':'3,-1'}:{'G-PZ-01':'2,-1'}):{};
  for(const [id,key] of Object.entries(special)){send({type:'DEPLOY_INITIAL_UNIT',controllerId:cid,deploymentUnitId:id,hex:s.state.hexes[key].coord});counts[key]=(counts[key]||0)+1;}
  for(const u of s.scenario.deployment.units.filter(u=>u.side===side).sort((a,b)=>a.id.localeCompare(b.id))){if(u.id in special)continue;const key=zone.find(k=>(counts[k]||0)<2&&!Object.values(special).includes(k));if(!key)throw Error('No legal deployment slot');send({type:'DEPLOY_INITIAL_UNIT',controllerId:cid,deploymentUnitId:u.id,hex:s.state.hexes[key].coord});counts[key]=(counts[key]||0)+1;}
  send({type:'READY_FOR_PHASE_END',controllerId:cid});
 }
 let battleId=null;
 if(kind==='combat'){
  const G=controllerIdForSide(s,'GERMAN'),S=controllerIdForSide(s,'SOVIET');setActiveViewer(s,G);
  send({type:'READY_FOR_PHASE_END',controllerId:G});send({type:'READY_FOR_PHASE_END',controllerId:G});
  battleId=send({type:'ATTACK',controllerId:G,attackerUnitIds:['G-PZ-01'],target:{q:3,r:-1}}).battleId;
  setActiveViewer(s,S);send({type:'PASS_REACTION',controllerId:S,battleId});
  let budget=30;
  while(s.state.pendingDecision){if(--budget<0)throw Error('Bounded fixture did not settle');const p=s.state.pendingDecision,cid=p.decisionOwnerControllerId;setActiveViewer(s,cid);let a;
   if(p.kind==='LOSS_ALLOCATION')a={type:'ALLOCATE_LOSSES',controllerId:cid,battleId,unitIdsByStep:Array.from({length:p.lossSteps},(_,i)=>p.eligibleUnitIds[i%p.eligibleUnitIds.length])};
   else if(p.kind==='RETREAT')a={type:'RETREAT',controllerId:cid,battleId,retreats:p.unitIds.map(id=>{const path=[],sim=structuredClone(s.state);let from={...sim.units[id].hex};for(let i=0;i<p.retreatSteps;i++){const next=getLegalRetreatStepOptions(sim,s.rules,sim.units[id],from)[0];if(!next)break;path.push(next);sim.units[id].hex={...next};from={...next};}return {unitId:id,path};})};
   else {const types={ADVANCE_AFTER_COMBAT:'PASS_ADVANCE',BREAKTHROUGH_OPTION:'PASS_BREAKTHROUGH',SCHWERPUNKT_OPTION:'PASS_SCHWERPUNKT'};if(!types[p.kind])throw Error('Unhandled decision '+p.kind);a={type:types[p.kind],controllerId:cid,battleId};}send(a);
  }
  setActiveViewer(s,G);
 }
 const issues=validateGameStateIntegrity(s.state,s.rules,s.scenario);if(issues.length)throw Error(JSON.stringify(issues));
 return {session:s,battleId,actions};
}

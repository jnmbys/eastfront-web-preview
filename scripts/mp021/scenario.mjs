// Exact MP017/MP020 fixture; no new gameplay behavior.
export function makeScenario({createLocalGameSession,dispatchGameAction,controllerIdForSide},core,raw,assert){
const SEED=17;
function scenario(name){
 const s=createLocalGameSession(raw,SEED);if(name==='deployment')return s;
 const apply=action=>{const r=dispatchGameAction(s,action).result;assert(r.accepted,'Pinned scenario preparation must remain legal');};
 for(const [side,special] of [['SOVIET',{'S-I-01':'3,-1'}],['GERMAN',{'G-PZ-01':'2,-1','G-I-01':'1,0','G-J-01':'2,0'}]]){
  const controllerId=controllerIdForSide(s,side),zone=core.deploymentHexKeysForSide(s.state,s.scenario,side),counts={};
  for(const [deploymentUnitId,key] of Object.entries(special)){apply({type:'DEPLOY_INITIAL_UNIT',controllerId,deploymentUnitId,hex:s.state.hexes[key].coord});counts[key]=(counts[key]??0)+1;}
  for(const u of s.scenario.deployment.units.filter(u=>u.side===side).sort((a,b)=>a.id.localeCompare(b.id))){if(u.id in special)continue;const key=zone.find(k=>(counts[k]??0)<2&&!Object.values(special).includes(k));apply({type:'DEPLOY_INITIAL_UNIT',controllerId,deploymentUnitId:u.id,hex:s.state.hexes[key].coord});counts[key]=(counts[key]??0)+1;}
  apply({type:'READY_FOR_PHASE_END',controllerId});
 }
 apply({type:'READY_FOR_PHASE_END',controllerId:controllerIdForSide(s,'GERMAN')});return s;
}
return scenario('move');
}

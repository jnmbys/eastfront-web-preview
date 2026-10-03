// Original Core and 005 read-only guards. No application of a recovery action.
import fs from 'node:fs';
import * as c from './.runtime/base6/experiments/industry-integrate-006/.runtime/live/experiments/supply-exp-005/core/dist/index.js';
import {queryRecoveryEligibility,planRecoveryPayment} from './.runtime/base6/experiments/industry-integrate-006/.runtime/planner/experiments/industry-integrate-005/service.mjs';
import {snapshotHash,mapData} from './.runtime/base6/experiments/industry-integrate-006/.runtime/planner/experiments/industry-integrate-005/inputs.mjs';
const {bundle,unitId='G-I-01',controllerId='G-HUMAN-1'}=JSON.parse(fs.readFileSync(0,'utf8')),before=JSON.stringify(bundle),state=bundle.core;
const request={unitId,controllerId,expectedRevision:bundle.revision,snapshotHash:snapshotHash(bundle),paymentMode:'PE'};
const common=queryRecoveryEligibility(bundle,request),rp=planRecoveryPayment(bundle,{...request,paymentMode:'RP'});
const labels=['A10','B10','C10'];
const nodes=labels.map(label=>{
  const coord=c.parsePaperHex(label),key=c.hexKey(coord),h=state.hexes[key];
  const mapping=mapData.nodes.find(n=>n.nodeId===label);
  if(mapping&&mapping.key!==key)throw Error('CORRECTED_MAPPING_DISAGREES_WITH_CORE');
  const issues=[];
  if(!h||!Object.hasOwn(h,'control'))issues.push('UNKNOWN_CONTROL');
  else if(h.control!==null&&h.control!=='GERMAN')issues.push('ENEMY_CONTROL');
  const occupants=Object.values(state.units).filter(u=>u.alive&&c.hexKey(u.hex)===key).map(u=>({id:u.id,side:u.side}));
  if(occupants.some(u=>u.side!=='GERMAN'))issues.push('ENEMY_OCCUPATION');
  const enemyZoc=c.zocHexKeys(state,c.defaultRules,'SOVIET').has(key);if(enemyZoc)issues.push('ENEMY_ZOC');
  return {label,key,coord,correctedMappingPresent:!!mapping,exists:!!h,control:h?.control,occupants,enemyZoc,issues,nullIsNotAuthority:h?.control===null};
});
const edges=nodes.slice(0,-1).map((n,i)=>{
  const next=nodes[i+1],entry=Object.entries(state.edges).find(([key])=>{const a=key.split('|');return a.includes(n.key)&&a.includes(next.key);});
  return {from:n.label,to:next.label,coreKey:entry?.[0]??null,distance:c.hexDistance(n.coord,next.coord),coreEdge:entry?.[1]??null};
});
let nextAction={type:'END_PHASE',controllerId:Object.values(state.controllers).find(x=>x.side===state.activeSide)?.id};
if(state.pendingDecision)nextAction=null;
if(state.phase==='SOVIET_REINFORCEMENT_SUPPLY'){
 const slots=c.getAvailableSovietReinforcements(state,c.defaultScenario),entries=c.computeLegalSovietReinforcementEntryHexKeys(state,c.defaultRules,c.defaultScenario);
 if(slots.length&&entries.length){const [q,r]=entries[0].split(',').map(Number);nextAction={type:'DEPLOY_REINFORCEMENT',controllerId:nextAction.controllerId,reinforcementId:slots[0].id,entryHex:{q,r}};}
}
if(JSON.stringify(bundle)!==before)throw Error('QUERY_MUTATED_BUNDLE');
console.log(JSON.stringify({common,rpQuote:rp.payment,nextAction,map:{nodes,edges,correctedMappingHash:'3598aa9eaa2a725ac6c05edd684b0edad71e2164a98f63b5c60fc1bfd698f5ca',targetHex:state.units[unitId]?.hex??null,integrity:c.validateGameStateIntegrity(state,c.defaultRules,c.defaultScenario)}}));

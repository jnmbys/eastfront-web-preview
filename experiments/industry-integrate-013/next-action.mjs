// Read-only selection of required scenario reinforcements; not industrial formation.
import fs from 'node:fs';
import * as c from './.runtime/base6/experiments/industry-integrate-006/.runtime/live/experiments/supply-exp-005/core/dist/index.js';
const state=JSON.parse(fs.readFileSync(0,'utf8')), before=JSON.stringify(state);
if(state.pendingDecision!==null)throw Error('PENDING_REQUIRES_EXPLICIT_LEGAL_RESOLUTION');
const controllerId=Object.values(state.controllers).find(x=>x.side===state.activeSide).id;
let action={type:'END_PHASE',controllerId};
if(state.phase==='SOVIET_REINFORCEMENT_SUPPLY'){
  const slots=c.getAvailableSovietReinforcements(state,c.defaultScenario);
  const entries=c.computeLegalSovietReinforcementEntryHexKeys(state,c.defaultRules,c.defaultScenario);
  if(slots.length&&entries.length){
    const [q,r]=entries[0].split(',').map(Number);
    action={type:'DEPLOY_REINFORCEMENT',controllerId,reinforcementId:slots[0].id,entryHex:{q,r}};
    const issues=c.validateDeploySovietReinforcementAction(state,c.defaultRules,c.defaultScenario,action);
    if(issues.length)throw Error(JSON.stringify(issues));
  }
}
if(JSON.stringify(state)!==before)throw Error('QUERY_MUTATED_CORE');
console.log(JSON.stringify(action));

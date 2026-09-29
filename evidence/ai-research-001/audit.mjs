// Offline replay audit: reconstruct authorized observations, never feed evaluation to policy.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {FairHost} from '../../.ai-dist/ai/authority/FairHost.js';
import {defaultRules,defaultScenario} from '../../.ai-dist/vendor/eastfront-digital-core/dist/index.js';
import {hexDistance,hexKey} from '../../.ai-dist/vendor/eastfront-digital-core/dist/core/hex.js';
import {observationCandidates} from '../../.ai-dist/ai/fair/index.js';
import {scoreIntent,createBasicAgent} from '../../.ai-dist/ai/fair/basicAgent.js';
import {parseParameters} from '../../.ai-dist/ai/fair/parameters.js';
import {initial} from '../../ai/lab/match.mjs';
import {hash} from '../../ai/lab/common.mjs';
import {records} from '../../ai/lab/runner.mjs';
const proposed=parseParameters({attackRatio:1.2,penaltyWeight:0.75}),previous=parseParameters({attackRatio:1.25,penaltyWeight:0.5});
const output=[];
// Only the two original intact journals. Recovered opposite-seat copies are excluded.
for(const [seed,seat] of [[17,'GERMAN'],[18,'SOVIET']]){
 const path=`evidence/ai-lab-002/batch/tune-${seed}-${seat}/attempt-1/`,record=JSON.parse(readFileSync(path+'record.json')),trace=records(path+'trace.ndjson');
 assert.equal(hash(trace),record.traceHash);assert.equal(trace.length,record.decisions);
 const host=new FairHost({matchId:record.job.id,initialState:initial(seed),rules:defaultRules,scenario:defaultScenario,agentSeeds:{GERMAN:101,SOVIET:202}});
 const sides=Object.fromEntries(['GERMAN','SOVIET'].map(s=>[s,{observations:0,identifiedObservations:0,adjacentObservations:0,firstIdentifiedTurn:null,firstAdjacentTurn:null,adjacentTurns:new Set(),combatDecisions:0,attackOpportunityDecisions:0,candidateAttacks:0,uniqueAttacks:new Set(),blockedDefault:0,blockedPrevious:0,blockedProposed:0,newlyAllowedVsDefault:0,changedChoiceVsDefault:0,examples:[]} ]));
 for(const row of trace){
  const input=host.observe(row.controllerId);assert.equal(input.observationKey,row.observationKey);
  const s=sides[row.side];s.observations++;
  const own=input.view.units.filter(u=>u.side===row.side),enemies=input.view.units.filter(u=>u.side!==row.side);
  if(enemies.length){s.identifiedObservations++;s.firstIdentifiedTurn??=input.view.turn;}
  if(own.some(u=>enemies.some(e=>hexDistance(u.hex,e.hex)===1))){s.adjacentObservations++;s.firstAdjacentTurn??=input.view.turn;s.adjacentTurns.add(input.view.turn);}
  if(!input.deployment&&!input.view.pendingDecision&&input.view.phase.endsWith('_COMBAT')){
   s.combatDecisions++;const attacks=observationCandidates(input).filter(a=>a.type==='ATTACK');if(attacks.length)s.attackOpportunityDecisions++;
   for(const a of attacks){
    s.candidateAttacks++;s.uniqueAttacks.add(JSON.stringify([input.view.turn,a.attackerUnitIds,a.target]));
    const values=[scoreIntent(input,a),scoreIntent(input,a,previous),scoreIntent(input,a,proposed)].map(Number.isFinite);
    if(!values[0])s.blockedDefault++;if(!values[1])s.blockedPrevious++;if(!values[2])s.blockedProposed++;
    if(!values[0]&&values[2]){s.newlyAllowedVsDefault++;if(s.examples.length<5)s.examples.push({n:row.n,turn:input.view.turn,intent:a});}
   }
   if(attacks.length&&JSON.stringify(createBasicAgent()(input))!==JSON.stringify(createBasicAgent(proposed)(input)))s.changedChoiceVsDefault++;
  }
  const result=host.step({GERMAN:()=>row.choice,SOVIET:()=>row.choice});assert.deepEqual(result,row.result);
 }
 assert.equal(hash(host.auditOmniscient()),record.finalHash);
 for(const s of Object.values(sides)){s.adjacentTurns=[...s.adjacentTurns];s.uniqueAttacks=s.uniqueAttacks.size;}
 output.push({seed,source:path,integrity:'original-intact',sides});
}
const report={previousCandidate:previous,proposed,baseline:parseParameters(),sources:output,definitions:{adjacent:'authorized identified enemy within one hex; observations repeat; adjacentTurns deduplicated',opportunity:'observationCandidates ATTACK during unforced combat; not an authoritative legality or winning-combat guarantee',blocked:'nonfinite existing attack score; cannot diagnose lack of approach or all other strategy bottlenecks',counterfactual:'same historical authorized observations, not a new match or outcome prediction'},exclude:['recovered tune-17-SOVIET','recovered tune-18-GERMAN'],holdoutRead:false};
writeFileSync('evidence/ai-research-001/opportunities.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(output));

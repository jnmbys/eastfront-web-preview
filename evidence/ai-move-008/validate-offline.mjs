// Run ONLY after the fair search has been sealed to disk. No feedback to search/policy.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {hash} from '../../ai/lab/common.mjs';
import {defaultRules,defaultScenario,RulesEngine} from '../../.ai-dist/vendor/eastfront-digital-core/dist/index.js';
import {validateMoveAction} from '../../.ai-dist/vendor/eastfront-digital-core/dist/rules/movement.js';
const out='evidence/ai-move-008',reports=[];
for(const seed of [17,18]){
 const state=JSON.parse(readFileSync(`.ai-dist/move007-state-${seed}.json`));
 const checkpoint=JSON.parse(readFileSync(`evidence/ai-move-007/seed-${seed}-before.json`));assert.equal(hash(state),checkpoint.stateHash);
 const input=JSON.parse(gunzipSync(readFileSync(`evidence/ai-move-007/seed-${seed}-input.json.gz`)));
 const raw=readFileSync(`${out}/seed-${seed}-search.json`),report=JSON.parse(raw),results=[];
 const engine=new RulesEngine(defaultRules,defaultScenario);
 for(const u of report.results){
  const paths=[...u.firstSteps.map(x=>({path:[x.hex],kind:'retreat-first-step-control'})),...u.improving.map(x=>({...x,kind:'improving-path'}))];
  for(const p of paths){
   const action={type:'MOVE',controllerId:input.scope.controllerId,unitId:u.unitId,path:p.path};
   const v=validateMoveAction(state,defaultRules,action),r=engine.apply(state,action);
   assert.equal(r.accepted,!v.issues.length);assert.equal(hash(state),checkpoint.stateHash);
   // Core logs rejected attempts; FairHost discards that returned state.
   // Gameplay (including unit positions/eligibility and RNG) must remain unchanged.
   if(!r.accepted){const {actionLog:al,idCounters:ic,...gameplay}=r.state;const {actionLog:bl,idCounters:bc,...prior}=state;assert.equal(hash(gameplay),hash(prior));assert.equal(al.length,bl.length+1);assert.equal(ic.nextAction,bc.nextAction+1);}
   results.push({unitId:u.unitId,...p,accepted:r.accepted,issues:r.issues,spentMP:v.spentMP,maxMP:v.maxMP,events:r.events});
  }
 }
 reports.push({seed,checkpointHash:checkpoint.stateHash,sealedSearchHash:hash(raw),noFeedback:true,results});
 console.log(JSON.stringify({seed,results:results.map(({unitId,path,kind,accepted,issues})=>({unitId,path,kind,accepted,issues}))}));
 assert.equal(hash(readFileSync(`${out}/seed-${seed}-search.json`)),hash(raw));
}
writeFileSync(`${out}/offline-validation.json`,JSON.stringify(reports,null,2)+'\n');

// Offline replay only. Archived actions, not freshly generated game decisions.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const frozen=resolve(process.env.COMBAT009_RUNTIME??'../combat009-runtime');
const {observationCandidates}=await import(pathToFileURL(frozen+'/ai/fair/candidates.js'));
const {basicAgent}=await import(pathToFileURL(frozen+'/ai/fair/basicAgent.js'));
const {FairHost}=await import(pathToFileURL(frozen+'/ai/authority/FairHost.js'));
import {RulesEngine,defaultRules,defaultScenario} from '../../.ai-dist/vendor/eastfront-digital-core/dist/index.js';
import {getLegalRetreatStepOptions,getMaxLegalRetreatDistance} from '../../.ai-dist/vendor/eastfront-digital-core/dist/rules/retreat.js';
import {toCoreAction} from '../../.ai-dist/src/multiplayer/gameplayProtocol.js';
import {initial} from '../../ai/lab/match.mjs';
import {hash,atomic} from '../../ai/lab/common.mjs';
const out='evidence/ai-retreat-010/checkpoints';mkdirSync(out,{recursive:true});
for(const [seed,side,start] of [[17,'SOVIET',739],[18,'GERMAN',632]]){
 const id=`tune-${seed}-${side}`,dir=`evidence/ai-combat-009/batch/${id}`;
 const rows=readFileSync(`${dir}/trace.ndjson`,'utf8').trim().split('\n').map(JSON.parse),record=JSON.parse(readFileSync(`${dir}/record.json`));
 assert.equal(hash(rows),record.traceHash);assert.equal(readFileSync(`${dir}/trace.ndjson`).length,record.traceBytes);
 const host=new FairHost({matchId:id,initialState:initial(seed),rules:defaultRules,scenario:defaultScenario,agentSeeds:{GERMAN:101,SOVIET:202}});
 for(const row of rows.slice(0,start)){
  const submit=input=>{assert.equal(input.observationKey,row.observationKey);return row.choice;};
  assert.deepEqual(host.step({GERMAN:submit,SOVIET:submit}),row.result);
 }
 const state=host.auditOmniscient(),input=host.observe(rows[start].controllerId);
 assert.equal(hash(state),record.finalHash,'failed actions did not change state');
 assert.equal(input.observationKey,rows[start].observationKey);
 for(const [kind,value] of [['state',state],['input',input]])writeFileSync(`${out}/${id}-${kind}.json.gz`,gzipSync(JSON.stringify(value)));
 const engine=new RulesEngine(defaultRules,defaultScenario),candidates=observationCandidates(input);
 const adjudicated=candidates.map((intent,index)=>{const r=engine.apply(state,toCoreAction(intent,input.scope.controllerId));return {index,intent,accepted:r.accepted,issues:r.issues};});
 const attempts=rows.slice(start).map(row=>{const x=host.observe(row.controllerId);assert.equal(x.observationKey,row.observationKey);assert.deepEqual(basicAgent(x),row.choice);
  const r=engine.apply(state,toCoreAction(row.choice.intent,row.controllerId));assert(!r.accepted);assert.deepEqual(host.step({GERMAN:()=>row.choice,SOVIET:()=>row.choice}),row.result);assert.equal(hash(host.auditOmniscient()),hash(state));
  return {...row,issues:r.issues,historyRejected:x.history.filter(h=>h.outcome==='REJECTED'&&h.observationKey===x.observationKey).length};});
 const report={id,source:'d6470f331a7afd3758a6eeb0f5935e8201f98767',start,controller:input.scope,phase:state.phase,pending:input.view.pendingDecision,viewHash:hash(input.view),stateHash:hash(state),inputHash:hash(input),visibleEnemies:input.view.units.filter(u=>u.side!==input.scope.side),contacts:input.view.contacts,lastKnown:input.view.lastKnown,
  own:input.view.units.filter(u=>input.view.pendingDecision.unitIds.includes(u.id)),attempts,candidates:adjudicated,
  offlineOnlyLegalOptions:input.view.pendingDecision.unitIds.map(id=>({unitId:id,hex:state.units[id].hex,options:getLegalRetreatStepOptions(state,defaultRules,state.units[id]),max:(()=>{const copy=structuredClone(state);return getMaxLegalRetreatDistance(copy,defaultRules,copy.units[id],input.view.pendingDecision.retreatSteps);})()}))};
 atomic(`${out}/${id}-diagnosis.json`,report);
 console.log(JSON.stringify({id,start,pending:report.pending,visible:report.visibleEnemies.map(u=>({id:u.id,type:u.type,hex:u.hex})),legal:report.offlineOnlyLegalOptions,candidateCount:candidates.length,firstAccepted:adjudicated.find(x=>x.accepted)}));
}

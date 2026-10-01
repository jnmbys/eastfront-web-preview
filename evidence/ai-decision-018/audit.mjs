import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {FairHost} from '../../.ai-dist/ai/authority/FairHost.js';
import {defaultRules,defaultScenario} from '../../.ai-dist/vendor/eastfront-digital-core/dist/index.js';
import {hexDistance,hexKey} from '../../.ai-dist/vendor/eastfront-digital-core/dist/core/hex.js';
import {basicAgent,scoreIntent} from '../../.ai-dist/ai/fair/basicAgent.js';
import {createMoveScorer} from '../../.ai-dist/ai/fair/routing.js';
import {agentOrder} from '../../.ai-dist/ai/fair/minimalAgent.js';
import {observationCandidates} from '../../.ai-dist/ai/fair/candidates.js';
import {initial} from '../../ai/lab/match.mjs';
import {hash,atomic} from '../../ai/lab/common.mjs';
import {records} from '../../ai/lab/runner.mjs';
import {validateAttackAction} from '../../.ai-dist/vendor/eastfront-digital-core/dist/rules/combat.js';
const out='evidence/ai-decision-018',cfg=JSON.parse(readFileSync(out+'/config.json')),checkpoints=[],reports=[];
function attacks(input){const i=structuredClone(input);i.view.phase='GERMAN_COMBAT';i.view.pendingDecision=null;return observationCandidates(i).filter(a=>a.type==='ATTACK').map(intent=>({intent,score:scoreIntent(i,intent)})).filter(x=>Number.isFinite(x.score)).sort((a,b)=>b.score-a.score);}
function targetAttacks(input,target){return attacks(input).filter(x=>hexKey(x.intent.target)===hexKey(target));}
for(const w of cfg.windows){
 const dir=`evidence/ai-maneuver-017/batch/development-${w.seed}-experiment-GERMAN`,record=JSON.parse(readFileSync(dir+'/record.json')),rows=records(dir+'/trace.ndjson');
 assert.equal(record.integrity,'PASS');assert.equal(hash(readFileSync(dir+'/trace.ndjson')),record.traceFileHash);assert.equal(hash(rows),record.traceHash);
 const host=new FairHost({matchId:record.job.id,initialState:initial(w.seed),rules:defaultRules,scenario:defaultScenario,agentSeeds:{GERMAN:101,SOVIET:202}});
 const report={...w,source:dir,traceFileHash:record.traceFileHash,window:[]};let pre=null;
 for(const row of rows.slice(0,w.lastN+1)){
  let current,opportunityBefore;
  const agent=input=>{current=input;assert.equal(input.observationKey,row.observationKey);if(row.inputHash)assert.equal(hash(input),row.inputHash);
   if(row.n===w.n){
    pre=structuredClone(input);assert.deepEqual(basicAgent(input),row.choice);
    const scorer=createMoveScorer(input),rejected=new Set(input.history.filter(h=>h.outcome==='REJECTED'&&h.observationKey===input.observationKey).map(h=>JSON.stringify(h.intent))),failures=input.history.filter(h=>h.outcome==='REJECTED'&&h.observationKey===input.observationKey).length;
    report.rankedMovement=observationCandidates(input,false).filter(a=>!rejected.has(JSON.stringify(a))&&(failures<3||a.type==='READY_FOR_PHASE_END')).map((a,i)=>({intent:a,score:a.type==='MOVE'?scorer.score(a):scoreIntent(input,a),tie:agentOrder(input.agentRandom.seed,i)})).filter(x=>Number.isFinite(x.score)).sort((a,b)=>b.score-a.score||a.tie-b.tie).map(x=>({...x,prefix:scorer.prefix(x.intent)}));
    report.search=scorer.metrics;report.beforeTarget=targetAttacks(input,w.target);report.beforeUnit=input.view.units.find(u=>u.id===w.unitId);report.beforeVisibleTarget=input.view.units.filter(u=>hexKey(u.hex)===hexKey(w.target));
    checkpoints.push({seed:w.seed,n:row.n,kind:'before',hash:hash(input),input});
   }
   if(row.n>=w.n&&row.phase==='GERMAN_MOVEMENT'&&row.choice?.intent?.type==='MOVE'){
    opportunityBefore=targetAttacks(input,w.target);
    if(row.n===945&&w.seed===1017)checkpoints.push({seed:w.seed,n:row.n,kind:'last-carrier-before',hash:hash(input),input});
    const state=host.auditOmniscient();state.phase='GERMAN_COMBAT';state.activeSide='GERMAN';state.pendingDecision=null;
    report.offlineCoreChecks??=[];report.offlineCoreChecks.push({n:row.n,note:'Static combat-phase clone of authoritative checkpoint; no action executed or dice rolled. Does not assert current MOVEMENT-phase legality or future state.',attacks:opportunityBefore.map(x=>({intent:x.intent,issues:validateAttackAction(state,defaultRules,{...x.intent,controllerId:input.scope.controllerId})}))});
   }
   if(row.n>w.n&&row.phase==='GERMAN_COMBAT'&&row.choice?.intent?.type==='ATTACK'){
    report.actualCombat={n:row.n,choice:row.choice,targetCombos:targetAttacks(input,w.target),inputHash:hash(input)};
    const held=structuredClone(input),u=held.view.units.find(u=>u.id===w.unitId);if(u){u.hex=structuredClone(pre.view.units.find(u=>u.id===w.unitId).hex);report.staticHold={note:'Only restore this own unit position in actual later authorized view; other actual actions held fixed. Not a realizable counterfactual trajectory, prediction, or policy input.',targetCombos:targetAttacks(held,w.target)};}
    checkpoints.push({seed:w.seed,n:row.n,kind:'combat',hash:hash(input),input});
   }
   return row.choice;
  };
  assert.deepEqual(host.step({GERMAN:agent,SOVIET:agent}),row.result);
  if(row.n>=w.n)report.window.push(row);
  if(opportunityBefore){const after=host.observe(current.scope.controllerId),afterCombos=targetAttacks(after,w.target);report.targetTimeline??=[];report.targetTimeline.push({n:row.n,unitId:row.choice.intent.unitId,before:opportunityBefore,after:afterCombos});if(opportunityBefore.length&&!afterCombos.length){checkpoints.push({seed:w.seed,n:row.n,kind:'last-carrier-after',hash:hash(after),input:after});report.extinction={n:row.n,intent:row.choice.intent,before:opportunityBefore,after:afterCombos};}}
  if(row.n===w.n){const after=host.observe(current.scope.controllerId);report.afterTarget=targetAttacks(after,w.target);report.afterUnit=inputUnit(after,w.unitId);report.afterUnitAttacks=attacks(after).filter(x=>x.intent.attackerUnitIds.includes(w.unitId));checkpoints.push({seed:w.seed,n:row.n,kind:'after',hash:hash(after),input:after});}
 }
 report.verifiedPrefixRows=w.lastN+1;reports.push(report);
 console.log(JSON.stringify({seed:w.seed,selected:report.rankedMovement[0],beforeUnit:report.beforeUnit,beforeTargetCount:report.beforeTarget.length,beforeTop:report.beforeTarget.slice(0,3),beforeWithoutUnit:report.beforeTarget.filter(x=>!x.intent.attackerUnitIds.includes(w.unitId)).slice(0,3),afterTop:report.afterTarget.slice(0,3),afterUnitAttacks:report.afterUnitAttacks,combat:report.actualCombat,staticHold:report.staticHold?.targetCombos.slice(0,5)}));
}
function inputUnit(input,id){return input.view.units.find(u=>u.id===id);}
atomic(out+'/audit.json',reports);
const raw=Buffer.from(JSON.stringify(checkpoints)),gz=gzipSync(raw,{level:9});writeFileSync(out+'/checkpoints.json.gz',gz);atomic(out+'/checkpoint-index.json',{archiveSha256:hash(gz),rawSha256:hash(raw),entries:checkpoints.map(({input,...meta})=>meta)});

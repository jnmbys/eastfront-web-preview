// Reconstruct archived decisions through T6 movement; stop before T6 combat.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {gzipSync,gunzipSync} from 'node:zlib';
import {FairHost} from '../../.ai-dist/ai/authority/FairHost.js';
import {basicAgent,scoreIntent} from '../../.ai-dist/ai/fair/basicAgent.js';
import {observationCandidates} from '../../.ai-dist/ai/fair/candidates.js';
import {createMoveScorer} from '../../.ai-dist/ai/fair/routing.js';
import {agentOrder} from '../../.ai-dist/ai/fair/minimalAgent.js';
import {defaultRules,defaultScenario} from '../../.ai-dist/vendor/eastfront-digital-core/dist/index.js';
import {validateMoveAction} from '../../.ai-dist/vendor/eastfront-digital-core/dist/rules/movement.js';
import {getUnitStats} from '../../.ai-dist/vendor/eastfront-digital-core/dist/rules/unit.js';
import {hexDistance} from '../../.ai-dist/vendor/eastfront-digital-core/dist/core/hex.js';
import {toCoreAction} from '../../.ai-dist/src/multiplayer/gameplayProtocol.js';
import {initial} from '../../ai/lab/match.mjs';
import {hash,atomic} from '../../ai/lab/common.mjs';
import {records} from '../../ai/lab/runner.mjs';
const out='evidence/ai-midgame-015',base='a655892a1eed5f8a136b6c73b9d9000560df8d91',source='evidence/ai-advance-014/batch/development-1017-experiment-GERMAN';mkdirSync(out,{recursive:true});
const provenance=[];for(const path of [source+'/trace.ndjson',source+'/events.ndjson',source+'/record.json','evidence/ai-advance-014/build-identity.json','evidence/ai-advance-014/tests.log','ai/fair/basicAgent.ts','ai/fair/candidates.ts','ai/fair/routing.ts']){const sha=execFileSync('git',['rev-parse',base+':'+path],{encoding:'utf8'}).trim();assert.equal(execFileSync('git',['hash-object',path],{encoding:'utf8'}).trim(),sha);provenance.push({path,sha});}
const build=JSON.parse(readFileSync('evidence/ai-advance-014/build-identity.json'));for(const [p,h] of build.experiment)assert.equal(hash(readFileSync('.ai-dist/'+p)),h,p);
const rows=records(source+'/trace.ndjson'),events=records(source+'/events.ndjson'),record=JSON.parse(readFileSync(source+'/record.json'));
assert.equal(hash(readFileSync(source+'/trace.ndjson')),record.traceFileHash);assert.equal(hash(rows),record.traceHash);
const phase=rows.filter(r=>r.turn===6&&r.phase==='GERMAN_MOVEMENT'),first=phase[0].n,last=phase.at(-1).n;assert.deepEqual(phase.map(r=>r.n),Array.from({length:last-first+1},(_,i)=>first+i));
const host=new FairHost({matchId:record.job.id,initialState:initial(1017),rules:defaultRules,scenario:defaultScenario,agentSeeds:{GERMAN:101,SOVIET:202}}),checkpoints=[],decisions=[];
const dist=h=>Math.min(...defaultScenario.capitalCoreHexes.map(g=>hexDistance(h,g)));
const unit=u=>{const stats=getUnitStats(u,defaultRules),max=defaultRules.unitTemplates[u.templateId].maxDamageSteps;return {id:u.id,type:u.type,hex:u.hex,alive:u.alive,damageStep:u.step,maxDamageSteps:max,remainingDamageCapacity:u.alive?max-u.step:0,stats,effectiveAttack:u.supplyState==='OUT_OF_SUPPLY'?Math.ceil(stats.attack*defaultRules.supply.oosAttackMultiplier):stats.attack,supplyState:u.supplyState,distance:dist(u.hex),hasMoved:u.hasMoved,dedicatedRailRepair:u.dedicatedRailRepair,controllerId:u.controllerId,baseMP:Math.max(0,stats.movement-(u.supplyState==='OUT_OF_SUPPLY'?defaultRules.supply.oosMovementPenalty:0))};};
let phaseStart,phaseEnd,checkedPrefixRows=0;
for(const row of rows.filter(r=>r.n<=last)){
 const observe=input=>{
  assert.equal(input.observationKey,row.observationKey);assert.equal(input.scope.controllerId,row.controllerId);checkedPrefixRows++;
  if(row.n>=first){
   const state=host.auditOmniscient();if(!phaseStart)phaseStart=state;
   const before=hash(input);assert.deepEqual(basicAgent(input),row.choice);assert.equal(hash(input),before);
   const moves=createMoveScorer(input),rejected=new Set(input.history.filter(h=>h.outcome==='REJECTED'&&h.observationKey===input.observationKey).map(h=>JSON.stringify(h.intent))),failures=input.history.filter(h=>h.outcome==='REJECTED'&&h.observationKey===input.observationKey).length;
   const baseCandidates=observationCandidates(input,false),candidateScores=baseCandidates.filter(a=>!rejected.has(JSON.stringify(a))&&(failures<3||a.type==='READY_FOR_PHASE_END')).map((a,i)=>({intent:a,score:a.type==='MOVE'?moves.score(a):scoreIntent(input,a),tie:agentOrder(input.agentRandom.seed,i)}));
   const ranked=candidateScores.filter(x=>Number.isFinite(x.score)).sort((a,b)=>b.score-a.score||a.tie-b.tie);assert.deepEqual(moves.prefix(ranked[0].intent),row.choice.intent);
   const hostCandidates=observationCandidates(input),validated=hostCandidates.filter(a=>a.type==='MOVE').map(intent=>({intent,core:validateMoveAction(state,defaultRules,toCoreAction(intent,row.controllerId)),distance:dist(intent.path.at(-1))}));
   checkpoints.push({n:row.n,input,state});
   decisions.push({n:row.n,traceLine:row.n+1,choice:row.choice,result:row.result,inputHash:hash(input),stateHash:hash(state),observationKey:input.observationKey,recordedStrategicTarget:null,recordedScores:null,reconstructedGoalMode:input.view.units.some(u=>u.side!=='GERMAN')?'safe cells adjacent to any identified enemy':'public objectives',visibleEnemies:input.view.units.filter(u=>u.side!=='GERMAN').map(u=>({id:u.id,hex:u.hex,type:u.type,stats:u.stats})),units:Object.values(state.units).filter(u=>u.side==='GERMAN').map(unit),baseCandidateCount:baseCandidates.length,hostCandidateCount:hostCandidates.length,rankingReproduced:true,scorerMetrics:{...moves.metrics},candidateScores:candidateScores.map(c=>({...c,score:Number.isFinite(c.score)?c.score:String(c.score)})),offlineCoreCandidates:validated});
  }
  return row.choice;
 };
 assert.deepEqual(host.step({GERMAN:observe,SOVIET:observe}),row.result);
 const transition=host.auditTransition().result;
 if(transition){const e=events.find(e=>e.n===row.n);assert(e);assert.deepEqual(e.events,transition.events);assert.deepEqual(e.random,transition.state.random);}
}
phaseEnd=host.auditOmniscient();assert.equal(phaseEnd.turn,6);assert.equal(phaseEnd.phase,'GERMAN_COMBAT');
const raw=Buffer.from(JSON.stringify({checkpoints,phaseEnd})),zipped=gzipSync(raw,{level:9});assert.deepEqual(gunzipSync(zipped),raw);writeFileSync(out+'/checkpoints.json.gz',zipped);
atomic(out+'/checkpoint-index.json',{task:'AI-MIDGAME-015',base,management:'c7531c70fab4b7c7402cd2f7d927c2134adee228',source,provenance,runtimeIdentitySource:'evidence/ai-advance-014/build-identity.json',scope:{seed:1017,version:'experiment',turn:6,phase:'GERMAN_MOVEMENT',first,last,decisions:phase.length,checkedPrefixRows,newGames:0},archive:{file:'checkpoints.json.gz',sha256:hash(zipped),bytes:zipped.length,format:'gzip UTF-8 JSON {checkpoints:[{n,input,state}],phaseEnd}; input and authoritative state remain separate'},checkpoints:decisions.map(({n,traceLine,inputHash,stateHash,observationKey})=>({n,traceLine,inputHash,stateHash,observationKey})),phaseEnd:{afterN:last,stateHash:hash(phaseEnd),turn:phaseEnd.turn,phase:phaseEnd.phase},testReuse:'Original 13 passing tests.log verified by Git blob; no test suite rerun.'});
atomic(out+'/decisions.json',decisions);
atomic(out+'/phase.json',{before:{n:first,hash:hash(phaseStart),units:Object.values(phaseStart.units).filter(u=>u.side==='GERMAN').map(unit)},after:{afterN:last,hash:hash(phaseEnd),units:Object.values(phaseEnd.units).filter(u=>u.side==='GERMAN').map(unit)},rngBefore:phaseStart.random,rngAfter:phaseEnd.random});
console.log(JSON.stringify({scope:[first,last],decisions:phase.length,units:decisions[0].units.length,acceptedMoves:phase.filter(r=>r.choice.intent.type==='MOVE'&&r.result.status==='ACCEPTED').length,rejections:phase.filter(r=>r.result.status==='REJECTED').length,archiveBytes:zipped.length,allOriginalObservationsResultsEventsMatched:true,policyChoicesAndRankingsReproduced:true}));

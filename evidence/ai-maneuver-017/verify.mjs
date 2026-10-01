import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {FairHost} from '../../.ai-dist/ai/authority/FairHost.js';
import {defaultRules,defaultScenario} from '../../.ai-dist/vendor/eastfront-digital-core/dist/index.js';
import {getNeighbors,hexKey,hexDistance} from '../../.ai-dist/vendor/eastfront-digital-core/dist/core/hex.js';
import {initial,rulesIdentity} from '../../ai/lab/match.mjs';
import {hash,atomic} from '../../ai/lab/common.mjs';
import {records} from '../../ai/lab/runner.mjs';
const out='evidence/ai-maneuver-017',config=JSON.parse(readFileSync(out+'/config.json')),build=JSON.parse(readFileSync(out+'/build-identity.json')),manifest=JSON.parse(readFileSync(out+'/manifest.json')),summary=JSON.parse(readFileSync(out+'/summary.json'));
assert.equal(hash(readFileSync(out+'/config.json')),build.configHash);assert.equal(hash(build),manifest.buildIdentityHash);assert.deepEqual(rulesIdentity(),manifest.rules);assert.equal(summary.games.length,4);assert.equal(manifest.jobs.length,2);
for(const [p,h] of build.experiment)assert.equal(hash(readFileSync('.ai-dist/'+p)),h,p);
assert.deepEqual(execFileSync('git',['diff',config.baseline,'--name-only','--','ai/fair','ai/authority','src','vendor'],{encoding:'utf8'}).trim().split('\n'),['ai/fair/routing.ts']);
assert.equal(execFileSync('git',['diff','5b6bce366f2ffb8780b984a927d229e6cb847881','--','ai/fair/routing.ts','ai/tests/maneuver017.test.mjs',out+'/config.json',out+'/run.mjs',out+'/observe.mjs'],{encoding:'utf8'}),'');
const checks=[];
for(const seed of config.seeds){
 const dir=`${out}/batch/development-${seed}-experiment-GERMAN`,rows=records(dir+'/trace.ndjson'),record=JSON.parse(readFileSync(dir+'/record.json')),audit=JSON.parse(readFileSync(`${out}/${seed}-017-audit.json`)),old=JSON.parse(readFileSync(`evidence/ai-advance-014/batch/development-${seed}-experiment-GERMAN/record.json`));
 assert.equal(record.integrity,'PASS');assert.equal(record.status,'GAME_OVER');assert.equal(record.turn,16);assert.equal(record.decisions,rows.length);assert.equal(hash(readFileSync(dir+'/trace.ndjson')),record.traceFileHash);assert.equal(record.metrics.initialHash,old.metrics.initialHash);assert.deepEqual(record.rules,old.rules);assert.equal(audit.final.units.length,26);assert.equal(audit.turns.length,16);assert(audit.turns.every(t=>t.units.length===26&&t.statistics.n+t.dead.length===26));
 const host=new FairHost({matchId:record.job.id,initialState:initial(seed),rules:defaultRules,scenario:defaultScenario,agentSeeds:config.agentSeeds}),rejectionEvidence=[];let movesChecked=0;
 for(const row of rows){
  const agent=input=>{
   assert.equal(input.observationKey,row.observationKey);assert.equal(hash(input),row.inputHash);
   const a=row.choice?.intent;if(row.side==='GERMAN'&&a?.type==='MOVE'){
    movesChecked++;const enemies=input.view.units.filter(e=>e.side!=='GERMAN'),knownZoc=new Set(enemies.filter(e=>{const ts=Object.values(input.rules.templates).filter(t=>t.side===e.side&&t.type===e.type);return ts.length&&ts.every(t=>t.exertsZoc);}).flatMap(e=>getNeighbors(e.hex).map(hexKey))),u=input.view.units.find(u=>u.id===a.unitId),path=[u.hex,...a.path];
    assert(!(knownZoc.has(hexKey(path[0]))&&knownZoc.has(hexKey(path[1]))),'known ZOC first hop '+row.n);
    for(const h of a.path.slice(0,-1)){assert(!knownZoc.has(hexKey(h)),'known ZOC midpoint '+row.n);assert(!enemies.some(e=>hexDistance(e.hex,h)===1),'identified enemy midpoint '+row.n);}
    if(row.result.status==='REJECTED')rejectionEvidence.push({n:row.n,turn:row.turn,intent:a,issues:record.metrics.rejected.find(r=>r.n===row.n).issues,visibleEnemies:enemies.map(e=>({id:e.id,type:e.type,hex:e.hex})),pathKnownZoc:path.map(h=>({hex:h,knownZoc:knownZoc.has(hexKey(h))})),pathVisibleOccupancy:a.path.map(h=>({hex:h,enemies:enemies.filter(e=>hexKey(e.hex)===hexKey(h)).map(e=>e.id),contacts:input.view.contacts.filter(c=>hexKey(c.hex)===hexKey(h)).map(c=>c.contactId)})),publicFirstHopAndMidpointConstraintsPassed:true});
   }
   return row.choice;
  };
  assert.deepEqual(host.step({GERMAN:agent,SOVIET:agent}),row.result);
 }
 assert.equal(hash(host.auditOmniscient()),record.finalHash);assert.equal(rejectionEvidence.length,record.metrics.sides.GERMAN.rejections);checks.push({seed,movesChecked,rejectionEvidence,finalHash:record.finalHash});
}
atomic(out+'/verification.json',{runtimeFiles:build.experiment.length,onlyRoutingChanged:true,configAndSourceFrozen:true,twoGamesExactly:true,allFourAuditTrajectoriesComplete:true,newGamesReplayChecks:checks,limits:'Known rule constraints verified on actual authorized inputs. Hidden ZOC/occupancy remains unknown; detailed Core reasons are offline only.'});writeFileSync(out+'/minimal.diff',execFileSync('git',['diff',config.baseline,'--','ai/fair/routing.ts']));console.log('PASS: frozen config/source/runtime, two complete games, same014 initial states/rules, every German MOVE obeys known first-hop/midpoint constraints; replay views/results/final hashes exact.');

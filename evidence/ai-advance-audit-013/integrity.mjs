import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {hash,atomic} from '../../ai/lab/common.mjs';
import {initial,replay,rulesIdentity} from '../../ai/lab/match.mjs';
import {records} from '../../ai/lab/runner.mjs';
import {RulesEngine,defaultRules,defaultScenario} from '../../.ai-dist/vendor/eastfront-digital-core/dist/index.js';
import {hexDistance,hexKey} from '../../.ai-dist/vendor/eastfront-digital-core/dist/core/hex.js';
import {toCoreAction} from '../../.ai-dist/src/multiplayer/gameplayProtocol.js';
const source='evidence/ai-eval-012',out='evidence/ai-advance-audit-013',base='e4beb9ae04286e853fc244d5dd6bbb59637a1e5e';
mkdirSync(out,{recursive:true});
const git=args=>execFileSync('git',args,{encoding:'utf8'}).trim();
const verifyBlob=path=>{const want=git(['rev-parse',base+':'+path]),actual=git(['hash-object',path]);assert.equal(actual,want,path);return {path,blob:actual};};
const manifest=JSON.parse(readFileSync(source+'/manifest.json')),summary=JSON.parse(readFileSync(source+'/summary.json')),build=JSON.parse(readFileSync(source+'/build-identity.json'));
const sources=['manifest.json','config.json','build-identity.json','summary.json','batch-run.log','batch-resume.log','run.mjs','run-initial.mjs.txt','tests.log','lab-tests.log'].map(p=>verifyBlob(source+'/'+p));
for(const [name,dir] of [['candidate','.ai-dist'],['baseline','.evaluation/baseline/.ai-dist'],['opponent','.evaluation/ai005/.ai-dist']])for(const [path,digest] of build[name])assert.equal(hash(readFileSync(join(dir,path))),digest,path);
const result=[];
for(const job of manifest.jobs){
 const dir=source+'/batch/'+job.id,blobs=['trace.ndjson','events.ndjson','record.json','process.log'].map(p=>verifyBlob(dir+'/'+p));
 const rec=JSON.parse(readFileSync(dir+'/record.json')),traceBytes=readFileSync(dir+'/trace.ndjson'),rows=records(dir+'/trace.ndjson'),eventRows=records(dir+'/events.ndjson');
 assert.equal(traceBytes.at(-1),10);assert.equal(traceBytes.length,rec.traceBytes);assert.equal(hash(traceBytes),rec.traceFileHash);assert.equal(hash(rows),rec.traceHash);assert.equal(rows.length,rec.decisions);
 rows.forEach((r,n)=>assert.equal(r.n,n));assert.equal(rows.at(-1).result.status,'GAME_OVER');assert(rows.slice(0,-1).every(r=>['ACCEPTED','REJECTED'].includes(r.result.status)));
 assert.deepEqual(rec.rules,rulesIdentity());assert.equal(rec.configHash,hash(readFileSync(source+'/config.json')));assert.equal(rec.buildIdentityHash,hash(build));
 assert.equal(hash(eventRows),rec.metrics.eventsHash);assert.deepEqual(summary.games.find(g=>g.job.id===job.id).metrics,rec.metrics);
 let state=initial(job.seed),index=0;const engine=new RulesEngine(defaultRules,defaultScenario),sides=Object.fromEntries(['GERMAN','SOVIET'].map(s=>[s,{attacks:0,advances:0,passAdvances:0,lossSteps:0,destroyedUnits:0,rejections:0}]));
 for(const row of rows){
  if(row.choice?.kind!=='INTENT')continue;
  const r=engine.apply(state,toCoreAction(row.choice.intent,row.controllerId)),a=row.choice.intent;
  if(row.result.status==='REJECTED'){assert(!r.accepted);sides[row.side].rejections++;continue;}
  assert(r.accepted);assert.deepEqual(eventRows[index++],{n:row.n,turn:state.turn,phase:state.phase,activeSide:state.activeSide,events:r.events,random:r.state.random});state=r.state;
  if(a.type==='ATTACK')sides[row.side].attacks++;
  if(a.type==='PASS_ADVANCE')sides[row.side].passAdvances++;
  for(const e of r.events){const key={UnitAdvanced:'advances',UnitStepLost:'lossSteps',UnitDestroyed:'destroyedUnits'}[e.type];if(key)sides[state.units[e.unitId].side][key]++;}
 }
 assert.equal(index,eventRows.length);assert.equal(state.phase,'GAME_OVER');assert.equal(state.victory.winner,rec.winner);assert.equal(state.turn,rec.turn);assert.equal(hash(state),rec.finalHash);assert.deepEqual(sides,rec.metrics.sides);assert.deepEqual(state.random,rec.finalRandom);
 const controlled=defaultScenario.capitalCoreHexes.filter(h=>state.hexes[hexKey(h)].control==='GERMAN').length,nearest=Math.min(...Object.values(state.units).filter(u=>u.alive&&u.side==='GERMAN').flatMap(u=>defaultScenario.capitalCoreHexes.map(h=>hexDistance(u.hex,h))));
 assert.equal(controlled,rec.metrics.objectiveProgress.germanControlledCapitalHexes);assert.equal(nearest,rec.metrics.objectiveProgress.nearestGermanToCapital);
 const canonical=replay(job,rows,rec.finalHash);
 result.push({job,blobs,traceRows:rows.length,traceBytes:traceBytes.length,traceFileHash:rec.traceFileHash,acceptedEventRows:index,lastRow:rows.at(-1),finalHash:hash(state),canonical,turn:state.turn,winner:state.victory.winner,nearest,controlled,sides,complete:true});
 console.log(job.id+': exact blobs, contiguous trace, terminal state, all events and summary verified');
}
sources.push(verifyBlob(source+'/batch/holdout-1017-baseline-GERMAN/process-failure.json'));
atomic(out+'/integrity.json',{base,management:'c7531c70fab4b7c7402cd2f7d927c2134adee228',sources,results:result,affectedStatisticalSamples:[],processAnomaly:{sample:'holdout-1017-baseline-GERMAN',cause:'Imported ai/lab/match.mjs CLI recognized --child and attempted to read JSON job argument as a filename before the intended audit driver ran; caught ENOENT set process.exitCode=1 but did not abort module evaluation. Main game then reached GAME_OVER and journal fsync, record and replays completed.',scope:'Driver exit code only; original first-game process.log and error retained. Resume skipped it after integrity checks; exactly 8 directories/8 complete games. No replay of policy-generated new game in audit.'},validation:'Existing lab helpers reused; deterministic recorded Actions replayed. No test suite or policy match rerun.'});

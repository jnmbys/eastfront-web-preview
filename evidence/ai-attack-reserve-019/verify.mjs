import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {hash,atomic} from '../../ai/lab/common.mjs';
import {records} from '../../ai/lab/runner.mjs';
const out='evidence/ai-attack-reserve-019',b=JSON.parse(readFileSync(out+'/build-identity.json')),c=JSON.parse(readFileSync(out+'/config.json')),manifest=JSON.parse(readFileSync(out+'/manifest.json')),games=[];
assert.equal(hash(readFileSync(out+'/config.json')),b.configHash);assert.equal(hash(b),manifest.buildIdentityHash);assert.deepEqual(c.seeds,[1017,1018]);assert.equal(manifest.jobs.length,2);
for(const [name,dir] of [['experiment','.ai-dist'],['experiment017','.evaluation/experiment017/.ai-dist'],['baseline014','.evaluation/baseline014/.ai-dist'],['opponent','.evaluation/ai005/.ai-dist']])for(const [p,h] of b[name])assert.equal(hash(readFileSync(dir+'/'+p)),h);
const sourceChanges=execFileSync('git',['diff','9bb88da5cee689007983b929d88d31f32b5a9438','--name-only','--','ai/fair','ai/authority','vendor','src'],{encoding:'utf8'}).trim().split('\n');assert.deepEqual(sourceChanges,['ai/fair/attackReserve.ts','ai/fair/basicAgent.ts','ai/fair/candidates.ts']);
for(const seed of c.seeds){
 const dir=`${out}/batch/development-${seed}-experiment-GERMAN`,r=JSON.parse(readFileSync(dir+'/record.json')),old=JSON.parse(readFileSync(`evidence/ai-maneuver-017/batch/development-${seed}-experiment-GERMAN/record.json`)),a=JSON.parse(readFileSync(`${out}/${seed}-019-audit.json`)),rows=records(dir+'/trace.ndjson');
 assert.equal(r.integrity,'PASS');assert.equal(r.status,'GAME_OVER');assert.equal(r.configHash,b.configHash);assert.equal(r.buildIdentityHash,hash(b));assert.equal(hash(rows),r.traceHash);assert.equal(hash(readFileSync(dir+'/trace.ndjson')),r.traceFileHash);assert.equal(rows.length,r.decisions);assert(rows.every((r,i)=>r.n===i));assert.deepEqual(r.rules,old.rules);assert.equal(a.finalHash,r.finalHash);assert.equal(a.final.units.length,26);assert.equal(a.final.units.filter(u=>u.alive).length+a.final.dead.length,26);
 const probes=rows.filter(r=>r.movementProbe?.reserve);for(const row of probes){const p=row.movementProbe;assert(p.newMetrics.expanded<=32768);assert(p.reserve.metrics.pools<=129);assert(p.reserve.metrics.scored<=129*127);assert.deepEqual(p.reserve.checks.find(c=>!c.blocked)?.intent,row.choice.intent);assert(p.reserve.checks.filter(c=>c.blocked).every(c=>c.protectedTargets.length>0));}
 games.push({seed,decisions:r.decisions,finalHash:r.finalHash,finalAlive:a.final.units.filter(u=>u.alive).length,dead:a.final.dead,policyProbeDecisions:probes.length});
}
atomic(out+'/verification.json',{status:'PASS',exactNewGames:2,oldGamesRerun:0,sourceChanges,runtimeChanges:b.runtimeChanges,configAndRuntimeStillFrozen:true,traceIntegrityAndCanonicalReplay:true,fairHostReplay:'analyze.mjs asserted all stored observations/input hashes/receipts/final states; run.mjs performed canonical replay',registrationCaveat:'See registration-note.json; manifest preRegistrationCommit is parent018, not019.',games});
console.log('PASS: exact two games, stored hashes and receipts, full unit accounting, original budgets, and frozen config/runtime.');

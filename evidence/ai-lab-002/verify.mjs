// Post-game verification only. Does not run policies or inspect held-out games.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {identity,hash} from '../../ai/lab/common.mjs';
import {records} from '../../ai/lab/runner.mjs';
import {replay} from '../../ai/lab/match.mjs';
const dir='evidence/ai-lab-002',summary=JSON.parse(readFileSync(dir+'/batch/summary.json'));
assert.equal(summary.recorded,4);assert(summary.games.every(g=>[17,18].includes(g.seed)&&g.split==='tune'));
const runtime=identity().runtimeHash,results=[];
for(const game of summary.games){
 const work=`${dir}/batch/${game.id}/attempt-${game.attempt}`;
 const record=JSON.parse(readFileSync(work+'/record.json')),rows=records(work+'/trace.ndjson');
 assert.equal(runtime,record.build.runtimeHash);assert.equal(hash(rows),record.traceHash);
 const verified=replay(record.job,rows,record.finalHash);
 const old=JSON.parse(readFileSync(`evidence/ai005/ai005-${game.seed}-summary.json`)).summary;
 results.push({id:game.id,...verified,baselineStateHash:old.stateHash,sameFinalStateAsHistoricalAI005:verified.finalHash===old.stateHash});
}
writeFileSync(dir+'/replay-validation.json',JSON.stringify({results,holdoutExecuted:false,scope:'4 action replays, not additional policy games'},null,2)+'\n');
summary.artifactIntegrity={recovered:2,index:'../journal-integrity.json',note:'2 incomplete journals preserved and recovered from matching pre-existing trace hashes; cause unresolved'};
writeFileSync(dir+'/batch/summary.json',JSON.stringify(summary,null,2)+'\n');
console.log('PASS: four final-state replays; retained held-out split untouched');

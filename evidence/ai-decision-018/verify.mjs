import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {hash,atomic} from '../../ai/lab/common.mjs';
const p='evidence/ai-decision-018/',r=JSON.parse(readFileSync(p+'audit.json')),index=JSON.parse(readFileSync(p+'checkpoint-index.json')),gz=readFileSync(p+'checkpoints.json.gz'),raw=gunzipSync(gz),snapshots=JSON.parse(raw);
assert.equal(hash(gz),index.archiveSha256);assert.equal(hash(raw),index.rawSha256);assert.equal(snapshots.length,index.entries.length);
for(const [i,s] of snapshots.entries()){assert.equal(hash(s.input),s.hash);assert.equal(s.hash,index.entries[i].hash);}
assert.deepEqual(r.map(x=>[x.seed,x.n,x.lastN]),[[1017,942,962],[1018,956,959]]);
assert.equal(r[0].extinction.n,945);assert(r[0].extinction.before.length>0);assert.equal(r[0].extinction.after.length,0);
assert(r[0].afterTarget.length>0);assert(r[1].afterTarget.length>0);assert.equal(r[1].afterUnitAttacks.length,0);
assert.equal(r[1].actualCombat.n,959);assert.equal(r[1].actualCombat.targetCombos[0].score,14);
assert(r.every(x=>x.offlineCoreChecks.every(c=>c.attacks.every(a=>a.issues.length===0))));
atomic(p+'verification.json',{status:'PASS',newGames:0,windows:2,verifiedStoredPrefixRows:r.reduce((n,x)=>n+x.verifiedPrefixRows,0),checkpointCount:snapshots.length,originalChoicesReproduced:2,staticAttackCoreIssues:0,sourceChanged:false,note:'Source diff checked separately against parent; assertions verify evidence integrity and opportunity distinction, not a future policy or strategic gain.'});
console.log('PASS: two windows, checkpoint hashes, receipts, distinction between personal and target opportunity, static Core checks.');

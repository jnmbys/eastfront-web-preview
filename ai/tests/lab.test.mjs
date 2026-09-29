import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validate,jobs} from '../lab/common.mjs';
import {execute,summarize,records} from '../lab/runner.mjs';
const base=JSON.parse(readFileSync('ai/lab/example.json'));
test('LAB configuration separates held-out seeds and seat pairs; rejects unsupported params and unbounded budgets',()=>{
 const c=validate(structuredClone(base));assert.equal(jobs(c,'tune').length,2);assert.deepEqual(jobs(c,'tune').map(j=>j.candidateSide),['GERMAN','SOVIET']);assert.equal(jobs(c,'holdout')[0].seed,1017);
 for(const mutate of [c=>c.seeds.holdout=[17],c=>c.candidate.params={attackWeight:2},c=>c.limits.maxGames=3,c=>c.limits.matchMs=Infinity,c=>c.limits.maxDecisions=10001,c=>c.baseline.version='minimal',c=>c.candidate.version='/tmp/omniscient.mjs']){const x=structuredClone(base);mutate(x);assert.throws(()=>validate(x));}
});
test('LAB watchdog terminates synchronously blocked process, SIGINT-style abort, and error classification',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'lab-limits-'));
 try{const hung=join(dir,'hang.mjs'),bad=join(dir,'bad.mjs');writeFileSync(hung,'while(true){}');writeFileSync(bad,'throw Error("fixture")');
  const timeout=await execute({entry:hung,ms:80});assert.equal(timeout.reason,'TIMEOUT');assert(timeout.elapsedMs<2000);
  const abort=new AbortController();const pending=execute({entry:hung,ms:1000,signal:abort.signal});setTimeout(()=>abort.abort(),30);assert.equal((await pending).reason,'INTERRUPTED');
  assert.equal((await execute({entry:bad,ms:1000})).reason,'ERROR');
 }finally{rmSync(dir,{recursive:true});}
});
test('LAB abnormal outcomes excluded from seat win rates; partial journal preserves replayable prefix',()=>{
 const normal={job:{candidateSide:'GERMAN'},status:'GAME_OVER',winner:'GERMAN',elapsedMs:2};
 const report=summarize([normal,...['TIMEOUT','ERROR','ACTION_LIMIT','AGENT_STOP','REJECTION_LIMIT','INTERRUPTED','BATCH_TIMEOUT'].map(status=>({...normal,status,winner:'SOVIET'}))],8);
 assert.equal(report.normal,1);assert.equal(report.candidateBySeat.GERMAN.wins,1);assert.equal(report.candidateBySeat.GERMAN.losses,0);assert.equal(report.abnormal,7);
 const dir=mkdtempSync(join(tmpdir(),'lab-journal-'));try{const file=join(dir,'trace');writeFileSync(file,'{"n":0}\n{"n":');assert.deepEqual(records(file),[{n:0}]);}finally{rmSync(dir,{recursive:true});}
});

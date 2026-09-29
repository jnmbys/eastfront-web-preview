// Small bounded CLI validation; no full campaign beyond the separately saved smoke pair.
import {spawn,execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync,mkdtempSync} from 'node:fs';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
const root=process.env.LAB_TEST_OUTPUT?resolve(process.env.LAB_TEST_OUTPUT):mkdtempSync(join(tmpdir(),'ai-lab-test-')),base=JSON.parse(readFileSync('ai/lab/example.json'));
mkdirSync(root,{recursive:true});
function config(name,limits){const path=join(root,name+'.json');writeFileSync(path,JSON.stringify({...base,limits:{...base.limits,...limits}},null,2));return path;}
function run(c,out){return execFileSync(process.execPath,['ai/lab/runner.mjs',c,'tune',out],{encoding:'utf8',timeout:20000});}
const limited=join(root,'action-limit'),lc=config('action-limit-config',{maxDecisions:1,matchMs:5000,batchMs:15000});
run(lc,limited);const s=JSON.parse(readFileSync(join(limited,'summary.json')));assert.equal(s.statusCounts.ACTION_LIMIT,2);assert.equal(s.normal,0);
run(lc,limited);assert.equal(readdirSync(join(limited,'tune-17-GERMAN')).filter(n=>n.startsWith('attempt-')).length,1);
const mismatch=config('mismatch-config',{maxDecisions:2,matchMs:5000,batchMs:15000});assert.throws(()=>run(mismatch,limited));
const batchcap=join(root,'batch-cap'),bc=config('batch-cap-config',{matchMs:5000,batchMs:50});run(bc,batchcap);assert.equal(JSON.parse(readFileSync(join(batchcap,'summary.json'))).statusCounts.BATCH_TIMEOUT,1);
const timeout=join(root,'timeout'),tc=config('timeout-config',{matchMs:50,batchMs:15000});run(tc,timeout);assert.equal(JSON.parse(readFileSync(join(timeout,'summary.json'))).statusCounts.TIMEOUT,2);
const interrupt=join(root,'interrupted'),ic=config('interrupted-config',{maxDecisions:10,matchMs:5000,batchMs:15000});
await new Promise((done,reject)=>{
 const child=spawn(process.execPath,['ai/lab/runner.mjs',ic,'tune',interrupt],{stdio:['ignore','ignore','pipe']});let signalled=false,stderr='';child.stderr.on('data',b=>stderr+=b);
 const trace=join(interrupt,'tune-17-GERMAN/attempt-1/trace.ndjson');
 const poll=setInterval(()=>{if(!signalled&&existsSync(trace)&&readFileSync(trace).length){signalled=true;child.kill('SIGINT');}},5);
 const deadline=setTimeout(()=>{child.kill('SIGKILL');reject(Error('interrupt test deadline'));},15000);
 child.once('exit',code=>{clearInterval(poll);clearTimeout(deadline);try{assert(signalled);assert.equal(code,0,stderr);done();}catch(e){reject(e);}});
});
assert.equal(JSON.parse(readFileSync(join(interrupt,'summary.json'))).statusCounts.INTERRUPTED,1);
run(ic,interrupt);const resumed=JSON.parse(readFileSync(join(interrupt,'summary.json')));assert.equal(resumed.statusCounts.ACTION_LIMIT,2);assert.equal(JSON.parse(readFileSync(join(interrupt,'tune-17-GERMAN/latest.json'))).attempt,2);
assert(JSON.parse(readFileSync(join(interrupt,'anomalies.json'))).some(r=>r.status==='INTERRUPTED'));
console.log('PASS CLI action cap, completed-game resume, identity mismatch refusal, timeout, interrupt/restart with retained attempt index');

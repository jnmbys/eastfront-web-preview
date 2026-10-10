import fs from 'node:fs';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {pathToFileURL,fileURLToPath} from 'node:url';
import {Campaign as Candidate} from '../grand-release-001/territory.mjs';
import {Campaign as Division} from '../grand-division-002/authority.mjs';
const sha='e579dd95dcaea8f1ad885c82ecadc1adde25dac8',file=fileURLToPath(new URL('../grand-release-001/.release002-online-reference.mjs',import.meta.url));
const clean=x=>JSON.parse(JSON.stringify(x,(k,v)=>/Ms$/.test(k)||['metrics','generatedAt','ms'].includes(k)?undefined:v));
try{
 fs.writeFileSync(file,execFileSync('git',['show',sha+':experiments/grand-release-001/territory.mjs']));
 const {Campaign:Online}=await import(pathToFileURL(file)),old=new Online(),now=new Candidate(),initial=old.save();now.restore(initial,false);old.clock.paused=false;old.clock.autopause=false;now.clock.paused=false;now.clock.autopause=false;
 for(let n=0;n<24;n++){old.tick();now.tick();}
 assert.deepEqual(clean(now.state),clean(old.state));assert.deepEqual(clean(now.econ),clean(old.econ));assert.deepEqual(clean(now.clock),clean(old.clock));assert.equal(now.clock.rng,old.clock.rng);
 const experimental=new Division();assert.throws(()=>now.restore(experimental.save()),/DIVISION_NEW_RULE/);assert.throws(()=>experimental.restore(initial),/DIVISION_NEW_CAMPAIGN/);
 fs.mkdirSync('evidence/grand-release-002',{recursive:true});fs.writeFileSync('evidence/grand-release-002/compatibility.json',JSON.stringify({onlineSHA:sha,steps:24,authorityStateEconomyClockRngEqual:true,newAndOldSaveMutuallyRejected:true,scope:'Online territory entry extracted by SHA; shared engine dependencies in candidate. Prior full legacy regression is reused, not claimed to be a new full campaign comparison.'},null,2));
 console.log('Compatibility passed');
}finally{if(fs.existsSync(file))fs.unlinkSync(file);}

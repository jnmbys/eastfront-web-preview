import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,cpSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {join,basename,relative} from 'node:path';
import ts from 'typescript';
import {hash,atomic} from '../../ai/lab/common.mjs';
const out='evidence/ai-plan-023',prior='evidence/ai-eval-012';
const config=JSON.parse(readFileSync(out+'/config.json')),manifest=JSON.parse(readFileSync(prior+'/source-manifest.json')),old=JSON.parse(readFileSync('evidence/ai-advance-014/build-identity.json'));
const blob=b=>createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex');
execFileSync(process.execPath,['ai/build.mjs'],{stdio:'inherit'});
const dir='.evaluation/ai005';mkdirSync(dir+'/ai/fair',{recursive:true});
for(const x of manifest.opponentFair){const data=readFileSync(prior+'/frozen/ai005/'+basename(x.path));assert.equal(blob(data),x.sha,x.path);writeFileSync(join(dir,x.path),data);}
for(const name of ['src','vendor'])cpSync(name,join(dir,name),{recursive:true});
writeFileSync(dir+'/tsconfig.json',JSON.stringify({extends:'../../tsconfig.json',compilerOptions:{rootDir:'.',outDir:'.ai-dist'},include:['ai/fair/**/*.ts']}));
execFileSync(process.execPath,['node_modules/typescript/bin/tsc','-p',dir+'/tsconfig.json'],{stdio:'inherit'});cpSync('vendor',dir+'/.ai-dist/vendor',{recursive:true});
const files=p=>readdirSync(p,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>e.isDirectory()?files(join(p,e.name)):[join(p,e.name)]);
const runtime=dir=>files(dir).filter(p=>p.endsWith('.js')).map(p=>[relative(dir,p).replaceAll('\\','/'),hash(readFileSync(p))]);
const candidate=runtime('.ai-dist'),opponent=runtime(dir+'/.ai-dist');assert.equal(opponent.length,67);assert.deepEqual(opponent,old.opponent);
// Frozen 014 policy invariants remain byte-identical, apart from the separately tested 022 interface.
for(const p of ['ai/fair/basicAgent.js','ai/fair/advance.js','ai/fair/parameters.js','ai/fair/minimalAgent.js','ai/fair/candidates.js'])assert.equal(candidate.find(([q])=>q===p)?.[1],old.experiment.find(([q])=>q===p)?.[1],p);
const changes=candidate.filter(([p,h])=>old.experiment.find(([q])=>q===p)?.[1]!==h).map(([p])=>p);
assert.deepEqual(changes,['ai/authority/FairHost.js','ai/fair/mainAttackPlan.js','ai/fair/plan.js','ai/fair/routing.js']);
const sources=[...files('ai').filter(p=>/\.(?:ts|mjs|json)$/.test(p)),...['config.json','build.mjs','run.mjs','analyze.mjs'].map(p=>out+'/'+p)].sort().map(p=>[p,hash(readFileSync(p))]);
const baseline=config.baselineLogs.map(dir=>{const record=JSON.parse(readFileSync(dir+'/record.json')),trace=readFileSync(dir+'/trace.ndjson');assert.equal(hash(trace),record.traceFileHash);assert.equal(record.integrity,'PASS');return {dir,recordHash:hash(readFileSync(dir+'/record.json')),traceHash:hash(trace),finalHash:record.finalHash};});
atomic(out+'/build-identity.json',{node:process.version,typescript:ts.version,configHash:hash(readFileSync(out+'/config.json')),candidate,opponent,sources,baseline});
console.log('PASS: 67 opponent runtime JS hashes exactly match 014; 014 policy invariant runtime hashes unchanged; both old baseline journals verified.');

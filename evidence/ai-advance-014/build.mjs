import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,cpSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve,join,basename,relative} from 'node:path';
import ts from 'typescript';
import {hash,atomic} from '../../ai/lab/common.mjs';
const root=resolve('.'),out='evidence/ai-advance-014',prior='evidence/ai-eval-012';
const manifest=JSON.parse(readFileSync(prior+'/source-manifest.json')),oldBuild=JSON.parse(readFileSync(prior+'/build-identity.json'));
const blob=b=>createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex');
for(const x of manifest.candidate)if(!['ai/lab/common.mjs','ai/fair/advance.ts'].includes(x.path))assert.equal(blob(readFileSync(x.path)),x.sha,x.path);
execFileSync(process.execPath,['ai/build.mjs'],{stdio:'inherit'});
// Only advance differs; reconstruct the original runtime for passive comparisons.
cpSync('.ai-dist','.evaluation/original/.ai-dist',{recursive:true});
const source=execFileSync('git',['show','92805a8550ddfb314fa77828d6c83b5a2f7f5e27:ai/fair/advance.ts'],{encoding:'utf8'});
const parsed=ts.parseJsonConfigFileContent(ts.readConfigFile('ai/tsconfig.json',ts.sys.readFile).config,ts.sys,resolve('ai'));
const output=ts.transpileModule(source,{compilerOptions:parsed.options,fileName:'advance.ts'}).outputText;
writeFileSync('.evaluation/original/.ai-dist/ai/fair/advance.js',output);
assert.equal(hash(Buffer.from(output)),oldBuild.candidate.find(([p])=>p==='ai/fair/advance.js')[1]);
// Frozen AI005 opponent uses the exact prior source blobs, not the current policy.
const dir='.evaluation/ai005';mkdirSync(dir+'/ai/fair',{recursive:true});
for(const x of manifest.opponentFair){const same=manifest.candidate.some(y=>y.path===x.path&&y.sha===x.sha);const data=readFileSync(same?x.path:prior+'/frozen/ai005/'+basename(x.path));assert.equal(blob(data),x.sha,x.path);writeFileSync(join(dir,x.path),data);}
for(const name of ['src','vendor'])cpSync(name,join(dir,name),{recursive:true});
writeFileSync(dir+'/tsconfig.json',JSON.stringify({extends:'../../tsconfig.json',compilerOptions:{rootDir:'.',outDir:'.ai-dist'},include:['ai/fair/**/*.ts']}));
execFileSync(process.execPath,['node_modules/typescript/bin/tsc','-p',dir+'/tsconfig.json'],{stdio:'inherit'});cpSync('vendor',dir+'/.ai-dist/vendor',{recursive:true});
const files=p=>readdirSync(p,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>e.isDirectory()?files(join(p,e.name)):[join(p,e.name)]);
const runtime=dir=>files(dir).filter(p=>p.endsWith('.js')).map(p=>[relative(dir,p).replaceAll('\\','/'),hash(readFileSync(p))]);
const experiment=runtime('.ai-dist'),original=runtime('.evaluation/original/.ai-dist'),opponent=runtime(dir+'/.ai-dist');
assert.deepEqual(original,oldBuild.candidate);assert.deepEqual(opponent,oldBuild.opponent);
const changes=experiment.filter(([p,h])=>original.find(([q])=>q===p)?.[1]!==h).map(([p])=>p);assert.deepEqual(changes,['ai/fair/advance.js']);
atomic(out+'/build-identity.json',{node:process.version,typescript:ts.version,configHash:hash(readFileSync(out+'/config.json')),runtimeChanges:changes,experiment,original,opponent});
console.log('PASS: original/opponent exact prior hashes; experiment runtime differs only ai/fair/advance.js; all other manifest source blobs unchanged.');

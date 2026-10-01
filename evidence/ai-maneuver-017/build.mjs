import assert from 'node:assert/strict';
import {readFileSync,readdirSync,writeFileSync,mkdirSync,cpSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join,relative,resolve,basename} from 'node:path';
import ts from 'typescript';
import {createHash} from 'node:crypto';
import {hash,atomic} from '../../ai/lab/common.mjs';
const out='evidence/ai-maneuver-017',old=JSON.parse(readFileSync('evidence/ai-advance-014/build-identity.json'));
// Existing frozen runtimes must match before any compilation. A fresh checkout
// can instead reconstruct them below from immutable source blobs.
for(const [name,dir] of [['experiment','.evaluation/baseline014/.ai-dist'],['opponent','.evaluation/ai005/.ai-dist']])if(existsSync(dir))for(const [p,h] of old[name])assert.equal(hash(readFileSync(dir+'/'+p)),h);
execFileSync(process.execPath,['node_modules/typescript/bin/tsc','-p','ai/tsconfig.json'],{stdio:'inherit'});
cpSync('vendor','.ai-dist/vendor',{recursive:true});
if(!existsSync('.evaluation/baseline014/.ai-dist')){
 cpSync('.ai-dist','.evaluation/baseline014/.ai-dist',{recursive:true});
 const source=execFileSync('git',['show','a655892a1eed5f8a136b6c73b9d9000560df8d91:ai/fair/routing.ts'],{encoding:'utf8'}),parsed=ts.parseJsonConfigFileContent(ts.readConfigFile('ai/tsconfig.json',ts.sys.readFile).config,ts.sys,resolve('ai'));
 writeFileSync('.evaluation/baseline014/.ai-dist/ai/fair/routing.js',ts.transpileModule(source,{compilerOptions:parsed.options,fileName:'routing.ts'}).outputText);
}
if(!existsSync('.evaluation/ai005/.ai-dist')){
 const prior='evidence/ai-eval-012',manifest=JSON.parse(readFileSync(prior+'/source-manifest.json')),dir='.evaluation/ai005',blob=b=>createHash('sha1').update(Buffer.from(`blob ${b.length}\0`)).update(b).digest('hex');mkdirSync(dir+'/ai/fair',{recursive:true});
 for(const x of manifest.opponentFair){const same=manifest.candidate.some(y=>y.path===x.path&&y.sha===x.sha),b=readFileSync(same?x.path:prior+'/frozen/ai005/'+basename(x.path));assert.equal(blob(b),x.sha);writeFileSync(join(dir,x.path),b);}
 for(const name of ['src','vendor'])cpSync(name,join(dir,name),{recursive:true});writeFileSync(dir+'/tsconfig.json',JSON.stringify({extends:'../../tsconfig.json',compilerOptions:{rootDir:'.',outDir:'.ai-dist'},include:['ai/fair/**/*.ts']}));execFileSync(process.execPath,['node_modules/typescript/bin/tsc','-p',dir+'/tsconfig.json'],{stdio:'inherit'});cpSync('vendor',dir+'/.ai-dist/vendor',{recursive:true});
}
// ADVANCE014's unchanged regression file compares its guard to the older011
// advance function. Restore that test-only runtime on a fresh checkout as well.
if(!existsSync('.evaluation/original/.ai-dist')){
 cpSync('.evaluation/baseline014/.ai-dist','.evaluation/original/.ai-dist',{recursive:true});const source=execFileSync('git',['show','92805a8550ddfb314fa77828d6c83b5a2f7f5e27:ai/fair/advance.ts'],{encoding:'utf8'}),parsed=ts.parseJsonConfigFileContent(ts.readConfigFile('ai/tsconfig.json',ts.sys.readFile).config,ts.sys,resolve('ai'));writeFileSync('.evaluation/original/.ai-dist/ai/fair/advance.js',ts.transpileModule(source,{compilerOptions:parsed.options,fileName:'advance.ts'}).outputText);
}
for(const [p,h] of old.original)assert.equal(hash(readFileSync('.evaluation/original/.ai-dist/'+p)),h);
for(const [name,dir] of [['experiment','.evaluation/baseline014/.ai-dist'],['opponent','.evaluation/ai005/.ai-dist']])for(const [p,h] of old[name])assert.equal(hash(readFileSync(dir+'/'+p)),h);
const files=p=>readdirSync(p,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>e.isDirectory()?files(join(p,e.name)):[join(p,e.name)]);
const experiment=files('.ai-dist').filter(p=>p.endsWith('.js')).map(p=>[relative('.ai-dist',p).replaceAll('\\','/'),hash(readFileSync(p))]);
const changes=experiment.filter(([p,h])=>old.experiment.find(([q])=>p===q)?.[1]!==h).map(([p])=>p);assert.deepEqual(changes,['ai/fair/routing.js']);
const sourceChanges=execFileSync('git',['diff','a655892a1eed5f8a136b6c73b9d9000560df8d91','--name-only','--','ai/fair','ai/authority','vendor','src'],{encoding:'utf8'}).trim().split('\n');assert.deepEqual(sourceChanges,['ai/fair/routing.ts']);
atomic(out+'/build-identity.json',{node:process.version,sourceChanges,runtimeChanges:changes,experiment,baseline014:old.experiment,opponent:old.opponent,configHash:hash(readFileSync(out+'/config.json'))});console.log('PASS: only routing source/runtime differs from014; frozen014/opponent hashes match; 014 advance protection, Host, Core and protocol unchanged.');

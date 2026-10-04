import {readFileSync,writeFileSync,mkdirSync,cpSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {dirname} from 'node:path';
import assert from 'node:assert/strict';
const dir='.evaluation/playtest001-source',frozen=JSON.parse(readFileSync('evidence/ai-playtest-002/frozen-human.json'));
mkdirSync(dir,{recursive:true});
for(const name of ['src','server','vendor'])cpSync(name,dir+'/'+name,{recursive:true});
for(const file of frozen.files){const b=Buffer.from(file.content);assert.equal(createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex'),file.gitBlob);mkdirSync(dirname(dir+'/'+file.path),{recursive:true});writeFileSync(dir+'/'+file.path,b);}
writeFileSync(dir+'/tsconfig.json',JSON.stringify({extends:'../../tsconfig.json',compilerOptions:{rootDir:'.',outDir:'../playtest001-runtime'},include:['ai/fair/**/*.ts']}));
execFileSync(process.execPath,['node_modules/typescript/bin/tsc','-p',dir+'/tsconfig.json'],{stdio:'inherit'});
cpSync('vendor/eastfront-digital-core/dist','.evaluation/playtest001-runtime/vendor/eastfront-digital-core/dist',{recursive:true});
console.log('Rebuilt frozen 001 fair human proxy; public map/Core unchanged.');

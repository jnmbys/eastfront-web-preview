import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,cpSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve,join,basename,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {hash,atomic} from '../../ai/lab/common.mjs';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url))),out=join(root,'evidence/ai-eval-012');
const manifest=JSON.parse(readFileSync(join(out,'source-manifest.json')));
const blob=b=>createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex');
// Only the cross-platform filesystem conversion in lab/common.mjs differs.
for(const x of manifest.candidate)if(x.path!=='ai/lab/common.mjs')assert.equal(blob(readFileSync(join(root,x.path))),x.sha,x.path);
execFileSync(process.execPath,['ai/build.mjs'],{cwd:root,stdio:'inherit'});
for(const [name,entries] of [['baseline',manifest.baselineFair],['ai005',manifest.opponentFair]]){
 const dir=join(root,'.evaluation',name);mkdirSync(join(dir,'ai/fair'),{recursive:true});
 for(const x of entries){const same=manifest.candidate.some(y=>y.path===x.path&&y.sha===x.sha);
  const data=readFileSync(same?join(root,x.path):join(out,'frozen',name,basename(x.path)));assert.equal(blob(data),x.sha,x.path);writeFileSync(join(dir,x.path),data);
 }
 for(const name of ['src','vendor'])cpSync(join(root,name),join(dir,name),{recursive:true});
 writeFileSync(join(dir,'tsconfig.json'),JSON.stringify({extends:'../../tsconfig.json',compilerOptions:{rootDir:'.',outDir:'.ai-dist'},include:['ai/fair/**/*.ts']}));
 execFileSync(process.execPath,['node_modules/typescript/bin/tsc','-p',join(dir,'tsconfig.json')],{cwd:root,stdio:'inherit'});
 cpSync(join(root,'vendor'),join(dir,'.ai-dist/vendor'),{recursive:true});
}
const files=p=>readdirSync(p,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>e.isDirectory()?files(join(p,e.name)):[join(p,e.name)]);
const runtime=dir=>files(dir).filter(p=>p.endsWith('.js')).map(p=>[relative(dir,p).replaceAll('\\','/'),hash(readFileSync(p))]);
atomic(join(out,'build-identity.json'),{node:process.version,typescript:JSON.parse(readFileSync(join(root,'node_modules/typescript/package.json'))).version,sourceManifestHash:hash(readFileSync(join(out,'source-manifest.json'))),configHash:hash(readFileSync(join(out,'config.json'))),candidate:runtime(join(root,'.ai-dist')),baseline:runtime(join(root,'.evaluation/baseline/.ai-dist')),opponent:runtime(join(root,'.evaluation/ai005/.ai-dist'))});
console.log('Verified immutable sources and built candidate, baseline and frozen opponent.');

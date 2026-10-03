import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,cpSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {VERSIONS,SERVER_SHA,FORMAT,SEED,MODES,CACHE} from './config.mjs';
import {artifacts,inventory,hash,verifyArtifacts} from './integrity.mjs';
import {verifyArtifacts as verifyOld,artifacts as oldArtifacts} from '../mp010/integrity.mjs';
const repo=resolve(import.meta.dirname,'../..'),cache=resolve(repo,'.mp010-build/mp017'),git=args=>execFileSync('git',args,{cwd:repo,maxBuffer:50*1024*1024});
const old=verifyOld();if(old.serverSha!==SERVER_SHA)throw Error('Pinned original server mismatch');
const diff=git(['diff','--name-only',VERSIONS.control,VERSIONS.candidate,'--','src','server','vendor','core','public','index.html','styles.css','multiplayer.css','package.json','package-lock.json','tsconfig.json','scripts/copy-static.mjs']).toString().trim().split('\n').sort();
const reviewed=['src/multiplayer/diagnosticTiming.ts','src/multiplayer/networkSession.ts'];
if(JSON.stringify(diff)!==JSON.stringify(reviewed))throw Error('Unreviewed source differences: '+diff.join(','));
if(existsSync(artifacts)){verifyArtifacts();console.log('Existing MP017 package verified; no files replaced.');process.exit();}
mkdirSync(cache,{recursive:true});mkdirSync(artifacts);
const diagnosticHashes=inventory(join(import.meta.dirname,'web')),diagnosticSha256=hash(JSON.stringify(diagnosticHashes));
const harnessPaths=Object.keys(inventory(import.meta.dirname)).map(p=>'scripts/mp017/'+p).concat(['scripts/mp011-r1/owner-preview.mjs','scripts/mp011-r1/diagnostics.mjs','scripts/mp014/closure-policy.ps1']);
const harnessHashes=Object.fromEntries(harnessPaths.map(p=>[p,hash(readFileSync(p))]));
const builds={};
for(const[label,ref]of Object.entries(VERSIONS)){
 const source=join(cache,'sources',ref);mkdirSync(source,{recursive:true});
 const archive=join(cache,label+'-source.tar');
 execFileSync('git',['archive','--format=tar','--output='+archive,ref,'src','public','vendor','server','index.html','styles.css','multiplayer.css','package.json','package-lock.json','tsconfig.json','scripts/copy-static.mjs'],{cwd:repo});
 execFileSync('tar',['-xf',archive,'-C',source]);
 // The archive sits under another Git checkout. Pin ONLY build-version metadata
 // to the archived ref instead of inheriting that enclosing checkout's HEAD.
 const copyPath=join(source,'scripts/copy-static.mjs');const original=readFileSync(copyPath,'utf8');
 if(!original.includes("['rev-parse','HEAD']"))throw Error('Build stamp seam changed');
 writeFileSync(copyPath,original.replace("['rev-parse','HEAD']",`['rev-parse','${ref}']`));
 const run=args=>execFileSync(process.execPath,args,{cwd:source,stdio:'inherit',env:{...process.env,MULTIPLAYER_SERVER_URL:''}});
 run([join(repo,'node_modules/typescript/bin/tsc')]);run(['scripts/copy-static.mjs']);
 const raw=inventory(join(source,'dist')),target=join(artifacts,label);cpSync(join(source,'dist'),target,{recursive:true});
 const index=readFileSync(join(target,'index.html'),'utf8');if(!index.includes('src="./app/main.js"'))throw Error('Entry mismatch');
 writeFileSync(join(target,'index.html'),index.replace('src="./app/main.js"','src="./mp017/entry.mjs"'));
 cpSync(join(import.meta.dirname,'web'),join(target,'mp017'),{recursive:true});
 const metadata={label,sourceSha:ref,serverSha:SERVER_SHA,snapshotFormat:FORMAT,scenarioSeed:SEED,diagnosticSha256,cachePolicy:CACHE};
 writeFileSync(join(target,'mp010-build.json'),JSON.stringify(metadata,null,2)+'\n');
 const hashes=inventory(target);for(const[p,h]of Object.entries(raw))if(p!=='index.html'&&hashes[p]!==h)throw Error('Application byte changed: '+p);
 builds[label]={...metadata,rawHashes:raw,rawTreeSha256:hash(JSON.stringify(raw)),hashes,treeSha256:hash(JSON.stringify(hashes))};
}
cpSync(join(oldArtifacts,'server'),join(artifacts,'server'),{recursive:true});const serverHashes=inventory(join(artifacts,'server'));
if(JSON.stringify(serverHashes)!==JSON.stringify(old.server.hashes))throw Error('Original server bytes changed');
const rawDiff=Object.keys(builds.control.rawHashes).filter(p=>builds.control.rawHashes[p]!==builds.candidate.rawHashes[p]);
const allowed=['app/multiplayer/networkSession.js','app/multiplayer/diagnosticTiming.js','app/web/startupDiagnostics.js','diagnostics/transport/build.json'];
if(rawDiff.some(p=>!allowed.includes(p))||Object.keys(builds.control.rawHashes).length!==Object.keys(builds.candidate.rawHashes).length)throw Error('Unreviewed built difference: '+rawDiff);
const manifest={versions:VERSIONS,serverSha:SERVER_SHA,snapshotFormat:FORMAT,seed:SEED,modes:MODES,cachePolicy:CACHE,node:process.version,typescript:JSON.parse(readFileSync('node_modules/typescript/package.json')).version,lockfileSha256:hash(readFileSync('package-lock.json')),sourceDiff:diff,rawDiff,diagnosticHashes,diagnosticSha256,harnessHashes,builds,server:{hashes:serverHashes,treeSha256:hash(JSON.stringify(serverHashes))}};
writeFileSync(join(artifacts,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
mkdirSync('evidence/mp-017',{recursive:true});writeFileSync('evidence/mp-017/build-manifest.json',JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({versions:VERSIONS,sourceDiff:diff,rawDiff,diagnosticSha256,artifacts},null,2));

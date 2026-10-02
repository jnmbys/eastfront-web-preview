import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,cpSync,readdirSync,existsSync,rmSync} from 'node:fs';
import {resolve,relative,join} from 'node:path';
import {createHash} from 'node:crypto';
import {VERSIONS,SERVER_SHA,FORMAT,SEED,MODES} from './config.mjs';
const repo=resolve(import.meta.dirname,'../..'),cache=join(repo,'.mp010-build'),out=join(cache,'artifacts');
const git=(args,cwd=repo)=>execFileSync('git',args,{cwd,encoding:'utf8',maxBuffer:20*1024*1024});
const sha=b=>createHash('sha256').update(b).digest('hex');
function files(root){return readdirSync(root,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(root,e.name)):[join(root,e.name)]).sort();}
function replaceCopy(from,label){const target=resolve(out,label);if(!['candidate','control','server'].includes(label)||relative(out,target)!==label)throw Error('Unsafe artifact target');rmSync(target,{recursive:true,force:true});cpSync(from,target,{recursive:true});}
const shared=['server','vendor','src/core-adapter','src/player-view','src/fog','src/geometry','src/multiplayer/protocol.ts','src/multiplayer/gameplayProtocol.ts','src/multiplayer/snapshotCodec.ts','src/multiplayer/mapEncoding.ts','package-lock.json','tsconfig.json'];
if(git(['diff','--name-only',VERSIONS.control,VERSIONS.candidate,'--',...shared]).trim())throw Error('Two versions no longer share protected dependencies');
mkdirSync(out,{recursive:true});
const samplerFiles=files(join(repo,'scripts/mp010/web'));
const samplerHashes=Object.fromEntries(samplerFiles.map(p=>[relative(join(repo,'scripts/mp010/web'),p).replaceAll('\\','/'),sha(readFileSync(p))]));
const samplerSha256=sha(JSON.stringify(samplerHashes));
const harnessHashes=Object.fromEntries(files(join(repo,'scripts/mp010')).map(p=>[relative(join(repo,'scripts/mp010'),p).replaceAll('\\','/'),sha(readFileSync(p))]));
const harnessSha256=sha(JSON.stringify(harnessHashes));
const builds={};
for(const [label,ref] of Object.entries(VERSIONS)){
 const source=join(cache,'sources',ref);mkdirSync(resolve(source,'..'),{recursive:true});
 if(!existsSync(source))git(['worktree','add','--detach',source,ref]);
 if(git(['rev-parse','HEAD'],source).trim()!==ref||git(['status','--porcelain'],source).trim())throw Error('Build checkout must be clean and exactly pinned: '+source);
 const run=(args)=>execFileSync(process.execPath,args,{cwd:source,stdio:'inherit',env:{...process.env,MULTIPLAYER_SERVER_URL:''}});
 run(['scripts/clean-dist.mjs']);run([join(repo,'node_modules/typescript/bin/tsc')]);run(['scripts/copy-static.mjs']);
 if(label==='candidate'){run([join(repo,'node_modules/typescript/bin/tsc'),'-p','server/tsconfig.json']);run(['server/copy-runtime.mjs']);replaceCopy(join(source,'.server-dist'),'server');}
 const dist=join(source,'dist');
 const rawHashes=Object.fromEntries(files(dist).map(p=>[relative(dist,p).replaceAll('\\','/'),sha(readFileSync(p))]));
 // Only the review package entry is changed. All compiled app modules stay byte exact.
 const index=readFileSync(join(dist,'index.html'),'utf8');
 if(!index.includes('src="./app/main.js"'))throw Error('Unrecognized application entry');
 writeFileSync(join(dist,'index.html'),index.replace('src="./app/main.js"','src="./mp010/bootstrap.mjs"'));
 cpSync(join(repo,'scripts/mp010/web'),join(dist,'mp010'),{recursive:true});
 const metadata={label,sourceSha:ref,serverSha:SERVER_SHA,snapshotFormat:FORMAT,scenarioSeed:SEED,samplerSha256,harnessSha256,samplerHashes,rawTreeSha256:sha(JSON.stringify(rawHashes)),rawEntrySha256:rawHashes['index.html'],measurement:'MP010 common observer v1; rAF is only an opportunity proxy'};
 writeFileSync(join(dist,'mp010-build.json'),JSON.stringify(metadata,null,2)+'\n');
 const hashes=Object.fromEntries(files(dist).map(p=>[relative(dist,p).replaceAll('\\','/'),sha(readFileSync(p))]));
 for(const [path,hash] of Object.entries(rawHashes))if(path!=='index.html'&&hashes[path]!==hash)throw Error('Compiled application changed: '+path);
 replaceCopy(dist,label);
 builds[label]={...metadata,fileCount:Object.keys(hashes).length,treeSha256:sha(JSON.stringify(hashes)),hashes};
}
const serverHashes=Object.fromEntries(files(join(out,'server')).map(p=>[relative(join(out,'server'),p).replaceAll('\\','/'),sha(readFileSync(p))]));
const manifest={versions:VERSIONS,serverSha:SERVER_SHA,snapshotFormat:FORMAT,seed:SEED,modes:MODES,node:process.version,typescript:JSON.parse(readFileSync(join(repo,'node_modules/typescript/package.json'))).version,lockfileSha256:sha(readFileSync(join(repo,'package-lock.json'))),samplerSha256,harnessSha256,harnessHashes,server:{treeSha256:sha(JSON.stringify(serverHashes)),hashes:serverHashes},builds};
writeFileSync(join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
mkdirSync(join(repo,'evidence/mp-010-r1'),{recursive:true});writeFileSync(join(repo,'evidence/mp-010-r1/build-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('MP010 artifacts:',out);for(const [label,b] of Object.entries(builds))console.log(label,b.sourceSha,b.treeSha256);

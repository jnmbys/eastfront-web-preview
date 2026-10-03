// Reproducible local-only evidence. New directory required; never touches old runs.
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,cpSync,readdirSync} from 'node:fs';
import {resolve,join,basename} from 'node:path';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {verifyArtifacts} from '../mp010/integrity.mjs';
const baseline='4db081bcfcd89c584fe7f53015b2a6ade63d87bf',r1='6ea4983047757a4a32a707a23d61f4962bca36d3';
const requested=process.argv[2];
if(!requested||!/^run-[a-z0-9-]+$/.test(requested))throw Error('Usage: node scripts/mp016/verify.mjs run-<unique-name>; build both runtimes first');
const root=resolve('evidence/mp-016');mkdirSync(root,{recursive:true});const out=join(root,requested);mkdirSync(out);
const save=(name,value)=>writeFileSync(join(out,name),typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});
save('fixed-packages.json',verifyArtifacts());
const git=(args)=>execFileSync('git',args,{maxBuffer:50*1024*1024});
const hash=b=>createHash('sha256').update(b).digest('hex');
const tests=['tests/mp016-query-wait.test.mjs','tests/mp003-scheduling.test.mjs','tests/mp009-pending.test.mjs','tests/mp009-r1-correlation.test.mjs','tests/mp009-r1-recovery.test.mjs','tests/move001-network.test.mjs'];
const run=(name,args,env={})=>{const r=spawnSync(process.execPath,args,{env:{...process.env,...env},encoding:'utf8'});save(name,r.stdout+r.stderr);if(r.status!==0)throw Error(name+' failed: '+r.status);};
const shared=['src',':!src/multiplayer','server','vendor','core','tsconfig.json'];
if(git(['diff','--name-only',baseline,'--',...shared]).toString().trim())throw Error('Shared/runtime dependency changed');
const protectedPaths=['server','vendor','core','src/multiplayer/protocol.ts','src/multiplayer/gameplayProtocol.ts','src/multiplayer/client.ts','src/multiplayer/actionCompletion.ts','src/multiplayer/pendingAction.ts','src/multiplayer/snapshotCodec.ts','src/player-view','tests/fixtures','scripts/mp010','scripts/mp011','scripts/mp011-r1','scripts/mp012','scripts/mp013','scripts/mp014','scripts/mp014-public','scripts/mp015',...['007','008','009','009-r1','010','010-r1','011','011-r1','012','013','014','014-public','015'].map(n=>'evidence/mp-'+n)];
const protectedDiff=git(['diff','--name-only',baseline,'--',...protectedPaths]).toString().trim();if(protectedDiff)throw Error('Protected path changed: '+protectedDiff);
const r1Diff=git(['diff','--name-only',r1,baseline,'--','src/multiplayer','src/main.ts']).toString().trim();if(r1Diff)throw Error('Unexpected original candidate divergence');
const cache=resolve('node_modules/.cache/mp016-baseline');mkdirSync(cache,{recursive:true});cpSync('dist/app',cache+'/app',{recursive:true});cpSync('dist/vendor',cache+'/vendor',{recursive:true});writeFileSync(cache+'/package.json','{"type":"module"}');
const files=git(['ls-tree','-r','--name-only',baseline,'src/multiplayer']).toString().trim().split('\n').filter(p=>p.endsWith('.ts'));
const options=ts.convertCompilerOptionsFromJson(JSON.parse(readFileSync('tsconfig.json')).compilerOptions,'.').options;
const sources={};for(const path of files){const source=git(['show',baseline+':'+path]);sources[path]=hash(source);writeFileSync(cache+'/app/'+path.slice(4,-3)+'.js',ts.transpileModule(source.toString(),{compilerOptions:options,fileName:path}).outputText);}
save('provenance.json',{baseline,originalCandidate:r1,originalCandidateMultiplayerAndMainIdentical:true,clientModulesFromGit:sources,sharedDependencies:shared,sharedUnchanged:true,protectedPaths,protectedDiff,workingFiles:Object.fromEntries(['src/multiplayer/networkSession.ts','src/multiplayer/diagnosticTiming.ts','tests/mp016-query-wait.test.mjs'].map(p=>[p,hash(readFileSync(p))])),noPublicTunnel:true});
run('baseline-comparison.txt',['--test','tests/mp016-query-wait.test.mjs'],{MP016_CLIENT_DIST:cache+'/app',MP016_BASELINE:'1',MP016_TRACE_DIR:join(out,'baseline')});
run('baseline-recovery.txt',['--test','tests/mp009-r1-recovery.test.mjs'],{MP009_CLIENT_DIST:cache+'/app',MP009_TRACE_DIR:join(out,'baseline-recovery')});
run('candidate-regression.txt',['--test',...tests],{MP016_CLIENT_DIST:resolve('dist/app'),MP016_BASELINE:'0',MP016_TRACE_DIR:join(out,'candidate'),MP009_TRACE_DIR:join(out,'recovery')});
run('reconnect-regression.txt',['--test','tests/mp003-network.test.mjs']);
run('client-typecheck.txt',['node_modules/typescript/bin/tsc','--noEmit']);
run('server-typecheck.txt',['node_modules/typescript/bin/tsc','-p','server/tsconfig.json','--noEmit']);
const frozen=spawnSync(process.execPath,['--test','--test-reporter=tap','--test-name-pattern=frozen baseline','tests/ua002-tactical.test.mjs','tests/ua003-presence.test.mjs','tests/ua003r1-grounding.test.mjs'],{encoding:'utf8'});
save('historical-frozen-reds.txt',frozen.stdout+frozen.stderr);
if(frozen.status!==1||!/^# fail 3$/m.test(frozen.stdout))throw Error('Unexpected frozen-check outcome; inspect all entries below');
// Full manifest enumeration, not just the first failure. Keep all original bytes.
const tree=new Map(git(['ls-tree','-r','-z',baseline]).toString().split('\0').filter(Boolean).map(row=>{const[meta,p]=row.split('\t');return[p,meta.split(' ')[2]];})),blobs=new Map();
const original=p=>{const id=tree.get(p);if(!id)return null;if(!blobs.has(id))blobs.set(id,git(['cat-file','blob',id]));return blobs.get(id);};
const rows=[],manifests=[];
for(const file of readdirSync('tests/fixtures').filter(f=>f.endsWith('sha256.json')).sort()){
 const path='tests/fixtures/'+file,raw=readFileSync(path);if(hash(raw)!==hash(original(path)))throw Error('Manifest changed');
 for(const [p,expected]of Object.entries(JSON.parse(raw))){const before=original(p);let after;try{after=readFileSync(p);}catch{after=null;}
   const b=before?hash(before):null,a=after?hash(after):null;rows.push({manifest:path,path:p,expected,baseline:b,candidate:a,historicalMismatch:b!==expected,newMismatch:b===expected&&a!==expected,changed:b!==a});}
 manifests.push({path,sha256:hash(raw)});
}
save('frozen-audit.json',{baseline,entryCount:rows.length,manifests,rows,historicalMismatchEntries:rows.filter(r=>r.historicalMismatch).length,newMismatchEntries:rows.filter(r=>r.newMismatch),changedEntries:rows.filter(r=>r.changed),limits:'Raw hashes; historical normalization/assertion exceptions remain as documented in MP009R1. UA002/UA003/UA003R1 historical reds retained. No manifest refresh, no full-suite Green claim.'});
const summary=[];
for(const label of ['baseline','candidate'])for(const file of ['render-0.json','render-120.json','snapshot-first.json']){
 const d=JSON.parse(readFileSync(join(out,label,file))),events=d.trace,relative=e=>e?Math.round((e.at-d.epoch)*10)/10:null;
 const completion=events.find(e=>e.timingStage==='snapshot-applied'),selected=events.find(e=>e.revision===1&&e.canSelect===true),options=events.find(e=>e.revision===1&&e.legalOptionsReady===true),submit=events.find(e=>e.revision===1&&e.canSubmit===true),query=events.find(e=>e.stage==='send'&&e.type==='QUERY_MATCH');
 summary.push({label,fixture:basename(file,'.json'),actionCompletedMs:relative(completion),canSelectMs:relative(selected),legalOptionsReadyMs:relative(options),canSubmitMs:relative(submit),querySentMs:relative(query),queryCount:events.filter(e=>e.stage==='send'&&e.type==='QUERY_MATCH').length,resyncCount:events.filter(e=>e.stage==='send'&&e.type==='RESYNC_MATCH').length});
}
save('timing-comparison.json',{clock:'same client virtual monotonic clock, ms from submitted input',labels:'Action completion keeps original actual apply time even if late ACK publishes later. Selection, options and submit gates remain separate. Zero means observed zero; unobserved is null.',measurements:summary,limits:'Fixed-delay and CPU-busy fixture only; no real device speedup or network reduction claimed.'});
const faultCounts=[];
for(const scenario of ['rapid-selection','sequence-gap','rejection','disconnect']){
 const counts={};for(const label of ['baseline','candidate']){const d=JSON.parse(readFileSync(join(out,label,scenario+'.json')));counts[label]=Object.fromEntries(['QUERY_MATCH','RESYNC_MATCH','SUBMIT_ACTION'].map(type=>[type,d.trace.filter(e=>e.stage==='send'&&e.type===type).length]));}
 if(JSON.stringify(counts.baseline)!==JSON.stringify(counts.candidate))throw Error('Fault fixture count regression: '+scenario);
 faultCounts.push({scenario,...counts});
}
save('fault-counts.json',{faultCounts,limits:'sequence-gap independently delivers delayed old ACK/query frames; bounded observation with four recoveries, not asserted stable completion. Recovery FIFO/old-snapshot cases separately verify convergence.'});
const checksumFiles=(dir,prefix='')=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?checksumFiles(join(dir,e.name),prefix+e.name+'/'):[[prefix+e.name,hash(readFileSync(join(dir,e.name)))]]);
save('checksums.json',Object.fromEntries(checksumFiles(out)));console.log(JSON.stringify({out,measurements:summary,newFrozenDifferences:rows.filter(r=>r.newMismatch||r.changed).length},null,2));

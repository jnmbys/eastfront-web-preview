import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyArtifacts,artifacts,hash} from './integrity.mjs';
import {verifyArtifacts as verifyOld} from '../mp010/integrity.mjs';
const name=process.argv[2];if(!/^verify-[a-z0-9-]+$/.test(name??''))throw Error('Pass a unique verify-<name>; existing evidence is never overwritten');
const out=resolve('evidence/mp-017',name);mkdirSync(out);const save=(p,data)=>writeFileSync(join(out,p),typeof data==='string'?data:JSON.stringify(data,null,2)+'\n',{flag:'wx'});
const m=verifyArtifacts(),old=verifyOld();save('packages.json',{newVersions:m.versions,serverHash:m.server.treeSha256,diagnosticSha256:m.diagnosticSha256,oldVersions:old.versions,oldTrees:Object.fromEntries(Object.entries(old.builds).map(([k,v])=>[k,v.treeSha256]))});
const git=args=>execFileSync('git',args,{encoding:'utf8'});
const protectedPaths=['src','server','core','vendor','public','tests/fixtures','scripts/mp010','scripts/mp011','scripts/mp011-r1','scripts/mp012','scripts/mp013','scripts/mp014','scripts/mp014-public','scripts/mp015','scripts/mp016',...['007','008','009','009-r1','010','010-r1','011','011-r1','012','013','014','014-public','015','016'].map(n=>'evidence/mp-'+n)];
const diff=git(['diff','--name-only',m.versions.candidate,'--',...protectedPaths]).trim();if(diff)throw Error('Protected paths changed: '+diff);
const run=(file,args,env={})=>{const r=spawnSync(process.execPath,args,{encoding:'utf8',env:{...process.env,...env}});save(file,r.stdout+r.stderr);if(r.status!==0)throw Error(file+' failed');};
run('components.txt',['--test','tests/mp017-diagnostics.test.mjs','tests/mp017-controller.test.mjs']);
run('local-tls.txt',['--test','tests/mp017-owner-integration.test.mjs']);
// Reuse the reviewed MP016 fixture unchanged; only install the shared observer
// in a derived, ignored test module. Four runs prove identical dispatch/gates.
const cache=resolve('.mp010-build/mp017/verification');mkdirSync(cache,{recursive:true});
let source=readFileSync('tests/mp016-query-wait.test.mjs','utf8').replaceAll("'./helpers/mp002.mjs'",JSON.stringify(pathToFileURL(resolve('tests/helpers/mp002.mjs')).href)).replaceAll("'./helpers/move001.mjs'",JSON.stringify(pathToFileURL(resolve('tests/helpers/move001.mjs')).href));
source=source.replace("const {serverMessage}=await load('multiplayer/protocol.js');",`const {serverMessage}=await load('multiplayer/protocol.js');
const {installObserver}=await import(${JSON.stringify(pathToFileURL(resolve('scripts/mp017/web/observer.mjs')).href)});
const {ComparisonTimeline}=await import(${JSON.stringify(pathToFileURL(resolve('scripts/mp017/web/timeline.mjs')).href)});
const sharedTimeline=new ComparisonTimeline();
installObserver({NetworkPlayerSession,LobbyClient,timeline:sharedTimeline,queryDraft,inputAt:()=>performance.now()});
process.once('exit',()=>{if(process.env.MP017_OBSERVER_REPORT)writeFileSync(process.env.MP017_OBSERVER_REPORT,JSON.stringify({kind:'synthetic common observer report, not device data',report:sharedTimeline.report()},null,2));});`);
const observed=join(cache,'observed.test.mjs');writeFileSync(observed,source);
const comparisons=[];
for(const label of ['control','candidate']){
 for(const observer of ['off','on']){const trace=join(out,label+'-'+observer);run(label+'-'+observer+'.txt',['--test',observer==='on'?observed:'tests/mp016-query-wait.test.mjs'],{MP016_CLIENT_DIST:join(artifacts,label,'app'),MP016_BASELINE:label==='control'?'1':'0',MP016_TRACE_DIR:trace,MP017_OBSERVER_REPORT:join(out,label+'-observer.json')});}
 for(const fixture of ['render-0','render-120','rapid-selection','snapshot-first','sequence-gap','rejection','disconnect']){
  const rows={};for(const observer of ['off','on']){const t=JSON.parse(readFileSync(join(out,label+'-'+observer,fixture+'.json')));rows[observer]=t.trace.filter(e=>e.stage==='send'||e.stage==='before-render'||e.stage==='after-receive').map(e=>({stage:e.stage,at:e.at-t.epoch,type:e.type,revision:e.revision,canSelect:e.canSelect,legalOptionsReady:e.legalOptionsReady,canSubmit:e.canSubmit,expectedRevision:e.expectedRevision}));}
  if(JSON.stringify(rows.off)!==JSON.stringify(rows.on))throw Error('Observer changed fixture scheduling or gate state: '+label+'/'+fixture);comparisons.push({label,fixture,identical:true});
 }
 run(label+'-recovery.txt',['--test','tests/mp009-r1-recovery.test.mjs'],{MP009_CLIENT_DIST:join(artifacts,label,'app'),MP009_TRACE_DIR:join(out,label+'-recovery')});
}
save('observer-equivalence.json',{comparisons,limit:'Zero virtual-time overhead is not zero real CPU overhead. No browser, device or public test performed.'});
const previous=JSON.parse(readFileSync('evidence/mp-016/run-20261003-local/frozen-audit.json')),rows=previous.rows.map(r=>({...r,mp017:hash(readFileSync(r.path))}));
if(rows.some(r=>r.mp017!==r.candidate))throw Error('Frozen file changed');save('frozen-audit.json',{source:'MP016 exhaustive baseline; every file rehashed',entries:rows.length,newDifferences:[],rows});
const frozen=spawnSync(process.execPath,['--test','--test-reporter=tap','--test-name-pattern=frozen baseline','tests/ua002-tactical.test.mjs','tests/ua003-presence.test.mjs','tests/ua003r1-grounding.test.mjs'],{encoding:'utf8'});save('historical-reds.txt',frozen.stdout+frozen.stderr);if(frozen.status!==1||!/^# fail 3$/m.test(frozen.stdout))throw Error('Unexpected frozen results');
// The original test writes its own MP014 evidence. Redirect only that output in
// an ignored derived copy; never execute it against the historical directory.
const quotePS=s=>"'"+s.replaceAll("'","''")+"'";
const closureSource=readFileSync('tests/mp014-closure.test.ps1','utf8')
 .replace("(Join-Path $PSScriptRoot '../scripts/mp014/closure-policy.ps1')",quotePS(resolve('scripts/mp014/closure-policy.ps1')))
 .replace("Join-Path $PSScriptRoot '../evidence/mp-014'",quotePS(out));
const closurePath=join(cache,'closure.test.ps1');writeFileSync(closurePath,closureSource);
const closure=spawnSync('pwsh',['-NoProfile','-File',closurePath],{encoding:'utf8',windowsHide:true});save('closure-policy.txt',closure.stdout+closure.stderr);if(closure.status!==0)throw Error('Closure policy failed');
const finalProtectedDiff=git(['diff','--name-only',m.versions.candidate,'--',...protectedPaths]).trim();if(finalProtectedDiff)throw Error('Verification changed protected files: '+finalProtectedDiff);
save('scope.json',{baseline:m.versions.candidate,protectedPaths,protectedDiff:diff,authSha256:hash(readFileSync('scripts/mp011-r1/owner-preview.mjs')),sourceDiff:m.sourceDiff,rawDiff:m.rawDiff,publicOpened:false,browserControlled:false,systemTrustChanged:false});
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)]);save('checksums.json',Object.fromEntries(walk(out).map(p=>[p.slice(out.length+1).replaceAll('\\','/'),hash(readFileSync(p))])));console.log('MP017 local evidence: '+out);

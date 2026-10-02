// Run after npm run build && npm run server:build. Never overwrite MP009 evidence.
import {spawnSync,execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root='evidence/mp-009-r1',base='33e7e8e292a509760f69ebdea29e541df69aea6c';
mkdirSync(root,{recursive:true});
const results=[];
function run(name,args,extra={},expected=0){
 const env={...process.env};delete env.MP009_CLIENT_DIST;delete env.MP009_TRACE_DIR;
 const r=spawnSync(process.execPath,args,{env:{...env,...extra},encoding:'utf8',maxBuffer:30*1024*1024});
 const output=((r.stdout??'')+(r.stderr??'')).replace(/\r\n/g,'\n').replace(/[ \t]+$/gm,'');
 writeFileSync(`${root}/${name}.txt`,output);
 results.push({name,command:[process.execPath,...args],env:extra,expectedExit:expected,actualExit:r.status,expectedOutcome:r.status===expected});
 console.log(name,'exit',r.status,'expected',expected);
 if(r.error||r.status!==expected)throw r.error??Error(`${name} unexpected exit ${r.status}`);
}
run('prepare-baselines',['scripts/prepare-mp009-r1-baselines.mjs']);
run('original-correlation-red',['--test','tests/mp009-r1-correlation.test.mjs'],{MP009_CLIENT_DIST:'node_modules/.cache/mp009-r1/mp009/app'},1);
// A red exit must be an assertion reproducer, not a missing module/build failure.
const red=readFileSync(`${root}/original-correlation-red.txt`,'utf8');
if(!red.includes('ERR_ASSERTION')||!/(?:tests|ℹ tests) 6/.test(red))throw Error('Original reproducer did not execute all six cases');
run('candidate-correlation',['--test','tests/mp009-r1-correlation.test.mjs']);
for(const label of ['development','mp009','candidate'])run(`${label}-recovery`,['--test','tests/mp009-r1-recovery.test.mjs'],{MP009_CLIENT_DIST:label==='candidate'?'dist/app':`node_modules/.cache/mp009-r1/${label}/app`,MP009_TRACE_DIR:`${root}/recovery/${label}`});
run('frozen-audit',['scripts/audit-mp009-r1-frozen.mjs']);
const sha=b=>createHash('sha256').update(b).digest('hex');
const originals=execFileSync('git',['ls-tree','-r','--name-only',base,'evidence/mp-009'],{encoding:'utf8'}).trim().split('\n').map(path=>{
 const before=sha(execFileSync('git',['show',`${base}:${path}`],{maxBuffer:30*1024*1024})),after=sha(readFileSync(path));
 if(before!==after)throw Error('Original evidence changed: '+path);return {path,before,after,unchanged:true};
});
const protectedPaths=['server','vendor','src/core-adapter','src/player-view','src/geometry','src/fog','src/multiplayer/protocol.ts','src/multiplayer/gameplayProtocol.ts','src/multiplayer/snapshotCodec.ts','tests/fixtures'];
const protectedDiff=execFileSync('git',['diff','--name-only',base,'--',...protectedPaths],{encoding:'utf8'}).trim();
if(protectedDiff)throw Error('Protected scope changed: '+protectedDiff);
writeFileSync(`${root}/verification.json`,JSON.stringify({base,runtime:{node:process.version,platform:process.platform,typescript:JSON.parse(readFileSync('node_modules/typescript/package.json')).version},results,originals,protectedPaths,protectedDiff},null,2)+'\n');
const requests=JSON.parse(readFileSync('evidence/mp-009/timeout-recovery.json')).requests;
const timings=JSON.parse(readFileSync('evidence/mp-009/browser-timing.json')).timings;
const clientResyncs=timings.filter(r=>r.stage==='send'&&r.type==='RESYNC_MATCH');
const serverResyncs=requests.filter(r=>r.type==='RESYNC_MATCH');
if(clientResyncs.length!==3||serverResyncs.length!==3)throw Error('Historical recovery counts differ');
writeFileSync(`${root}/original-recovery-audit.json`,JSON.stringify({
 sources:['evidence/mp-009/timeout-recovery.json','evidence/mp-009/browser-timing.json'],
 clocks:'Browser and server performance clocks are separate; do not subtract across them.',
 clientResyncs,serverResyncs,
 timeoutTimelines:timings.filter(r=>r.at>=336735&&r.at<=348820||r.at>=407373),
 inference:'Two deadline recoveries plus one additional recovery. Original evidence lacks raw discarded receive frames and trigger reasons; replay demonstrates a plausible fixture reorder mechanism, not proof of the historical packet order.'
},null,2)+'\n');

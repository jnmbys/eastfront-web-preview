// Run from clean source a0c1485; creates isolated candidate and instrumentation-only control.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,cpSync,readdirSync,statSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
const source='a0c1485d9841eaea1ec6ed2bd9b97a569ff5c9cb',old='f3fac5a9b58deab1f9391fd46e782c728711ef76';
if(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()!==source)throw Error('Wrong source');
execFileSync('git',['diff','--exit-code',source,'--','src','ai','server','vendor','core','scripts'],{stdio:'inherit'});
execFileSync(process.execPath,['ai/local/build.mjs'],{stdio:'inherit'});
const root='.ai003-preview',before='.ai006-before';rmSync(before,{recursive:true,force:true});cpSync(root,before,{recursive:true});
const original=execFileSync('git',['show',old+':src/main.js'],{encoding:'utf8'});
const slice=s=>s.slice(s.indexOf('function updateLocalAiStatus('),s.indexOf('function updateTerrainDetailStatus('));
const oldStatus=slice(original).replace("revision: client.state.snapshot?.matchRevision", "revision: client.state.snapshot?.matchRevision, performance: perf006.report()");
if(!oldStatus.includes('performance: perf006.report()'))throw Error('Missing old diagnostic marker');
const current=readFileSync(before+'/src/main.js','utf8');writeFileSync(before+'/src/main.js',current.replace(slice(current),oldStatus));
for(const [dir,variant]of [[root,'candidate'],[before,'old-status-control']]){
 const build={task:'AI-PERF-PREVIEW-006',sourceCommit:source,strategySource:'695ca0524eb039808491b18c69cea1fb74da0cca',oldRelease:old,variant,performanceQuery:'?aiPerf006=1&aiSeed=17',productionConnection:false};
 writeFileSync(dir+'/ai003-build.json',JSON.stringify(build,null,2)+'\n');
 const p=dir+'/src/local-ai/performance.js',code=readFileSync(p,'utf8');if(!code.includes("version: 'AI-PERF-006'"))throw Error('Missing provenance marker');
 writeFileSync(p,code.replace("version: 'AI-PERF-006'",`version: 'AI-PERF-006', build: ${JSON.stringify(build)}`));
 const entries=[];function walk(d){for(const name of readdirSync(d).sort()){const f=d+'/'+name;if(statSync(f).isDirectory())walk(f);else{const bytes=readFileSync(f);entries.push({path:f.slice(dir.length+1),size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),gitBlob:createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')});}}}walk(dir);
 writeFileSync(dir+'/AI-PREVIEW-MANIFEST.json',JSON.stringify({...build,files:entries},null,2)+'\n');
}
for(const file of ['ai/fair/basicAgent.js','ai/fair/routing.js'])if(readFileSync(root+'/'+file,'utf8')!==execFileSync('git',['show',old+':'+file],{encoding:'utf8'}))throw Error('Strategy changed');
execFileSync(process.execPath,['ai/local/audit.mjs'],{stdio:'inherit'});
console.log('Candidate + same-seed/diagnostics old-status control ready; no deployment performed by build.');

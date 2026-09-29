import {spawn,execFileSync} from 'node:child_process';
import {mkdirSync,existsSync,readFileSync,writeFileSync,rmSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validate,jobs,identity,hash,atomic,root} from './common.mjs';
export function records(path){if(!existsSync(path))return [];const lines=readFileSync(path,'utf8').trim().split('\n').filter(Boolean);return lines.flatMap((line,i)=>{try{return [JSON.parse(line)];}catch(e){if(i===lines.length-1)return [];throw e;}});}
export function execute({entry,args=[],cwd=root,ms,signal,stderr}){
 return new Promise(resolve=>{
  const start=performance.now(),child=spawn(process.execPath,[entry,...args],{cwd,stdio:['ignore','ignore','pipe']});let reason=null,errors='';
  child.stderr.on('data',b=>{errors=(errors+b.toString()).slice(-8192);});
  const stop=()=>{reason='INTERRUPTED';child.kill('SIGKILL');};
  const timer=setTimeout(()=>{reason='TIMEOUT';child.kill('SIGKILL');},ms);
  signal?.addEventListener('abort',stop,{once:true});if(signal?.aborted)stop();
  const finish=(code,error)=>{clearTimeout(timer);signal?.removeEventListener('abort',stop);if(stderr)writeFileSync(stderr,errors+(error?.message??''));resolve({reason:reason??(error||code!==0?'ERROR':null),elapsedMs:performance.now()-start,exitCode:code});};
  child.once('error',e=>finish(null,e));child.once('exit',code=>finish(code));
 });
}
export function summarize(results,planned){
 const normal=results.filter(r=>r.status==='GAME_OVER');
 const seats=Object.fromEntries(['GERMAN','SOVIET'].map(side=>{const rows=normal.filter(r=>r.job.candidateSide===side);return [side,{normal:rows.length,wins:rows.filter(r=>r.winner===side).length,losses:rows.filter(r=>r.winner&&r.winner!==side).length,draws:rows.filter(r=>!r.winner).length}];}));
 return {planned,recorded:results.length,normal:normal.length,abnormal:results.length-normal.length,statusCounts:Object.fromEntries([...new Set(results.map(r=>r.status))].map(s=>[s,results.filter(r=>r.status===s).length])),candidateBySeat:seats,totalElapsedMs:results.reduce((n,r)=>n+r.elapsedMs,0),games:results.map(({job,status,winner,turn,attacks,rejected,elapsedMs,reason,attempt,finalHash,accepted,objectiveProgress})=>({id:job.id,seed:job.seed,split:job.split,candidateSide:job.candidateSide,seats:job.seats,status,winner,turn,attacks,rejected,accepted,elapsedMs,reason,attempt,finalHash,objectiveProgress}))};
}
export async function batch(configFile,split,out){
 const config=validate(JSON.parse(readFileSync(configFile)));out=resolve(out);mkdirSync(out,{recursive:true});
 const lock=join(out,'.lock');mkdirSync(lock);writeFileSync(join(lock,'owner.json'),JSON.stringify({pid:process.pid}));
 const abort=new AbortController(),stop=()=>abort.abort();process.once('SIGINT',stop);process.once('SIGTERM',stop);
 try{
  // Every invocation rebuilds from the frozen checkout; this is compilation, not a test suite.
  execFileSync(process.execPath,['ai/build.mjs'],{cwd:root,stdio:'inherit',timeout:120000});
  const build=identity(),key=hash({config,split,sourceHash:build.sourceHash,runtimeHash:build.runtimeHash,labHash:build.labHash,node:build.node});
  const manifestPath=join(out,'manifest.json');if(existsSync(manifestPath)&&JSON.parse(readFileSync(manifestPath)).key!==key)throw Error('Resume identity mismatch: use a new output directory');
  const {rulesIdentity}=await import('./match.mjs');
  if(!existsSync(manifestPath))atomic(manifestPath,{key,config,split,build,rules:rulesIdentity(),agentSeeds:{GERMAN:101,SOVIET:202}});
  const plan=jobs(config,split),started=performance.now(),latest=[];
  const publish=()=>{
   const saved=plan.map(j=>join(out,j.id,'latest.json')).filter(existsSync).map(p=>JSON.parse(readFileSync(p)));const report=summarize(saved,plan.length);report.identity=key;report.split=split;report.limitNote='maxGames applies to this split, paired seats; batchMs bounds match execution per invocation, excluding build/export';
   atomic(join(out,'summary.json'),report);
   writeFileSync(join(out,'summary.md'),`# AI-LAB-001 ${split}\n\n${report.recorded}/${report.planned} recorded; ${report.normal} normal, ${report.abnormal} abnormal.\n\n| Candidate seat | Normal | Wins | Losses | Draws |\n| --- | --- | --- | --- | --- |\n`+Object.entries(report.candidateBySeat).map(([s,r])=>`| ${s} | ${r.normal} | ${r.wins} | ${r.losses} | ${r.draws} |`).join('\n')+`\n\nTotal recorded wall time: ${report.totalElapsedMs.toFixed(1)} ms. Abnormal games excluded from wins/losses. No 50% target; paired seats reported separately.\n\nSee summary.json, manifest.json and anomalies.json. Self-play is evaluation, not learning.\n`);
   const anomalies=[];for(const job of plan){const dir=join(out,job.id);if(!existsSync(dir))continue;for(const name of readdirSync(dir).filter(n=>/^attempt-\d+$/.test(n))){const path=join(dir,name,'record.json');if(existsSync(path)){const r=JSON.parse(readFileSync(path));if(r.status!=='GAME_OVER')anomalies.push({id:job.id,status:r.status,reason:r.reason,record:`${job.id}/${name}/record.json`,replay:`${job.id}/${name}/trace.ndjson`});}}}
   atomic(join(out,'anomalies.json'),anomalies);return report;
  };
  for(const job of plan){
   const dir=join(out,job.id);mkdirSync(dir,{recursive:true});const completed=join(dir,'latest.json');
   if(existsSync(completed)){const previous=JSON.parse(readFileSync(completed));if(!['INTERRUPTED','BATCH_TIMEOUT'].includes(previous.status)){latest.push(previous);continue;}}
   const remaining=config.limits.batchMs-(performance.now()-started);if(abort.signal.aborted||remaining<=0)break;
   const attempt=1+readdirSync(dir).filter(n=>/^attempt-\d+$/.test(n)).length,work=join(dir,`attempt-${attempt}`);mkdirSync(work);
   const journal=join(work,'trace.ndjson'),result=join(work,'result.json'),task=join(work,'task.json');
   writeFileSync(journal,'');atomic(task,{job,limits:config.limits,journal,result});
   const execution=await execute({entry:join(root,'ai/lab/match.mjs'),args:['--child',task],ms:Math.min(remaining,config.limits.matchMs),signal:abort.signal,stderr:join(work,'stderr.log')});
   const rows=records(journal);let r={};if(!execution.reason&&existsSync(result))r=JSON.parse(readFileSync(result));
   const status=execution.reason==='TIMEOUT'&&remaining<config.limits.matchMs?'BATCH_TIMEOUT':execution.reason??r.termination?.status??'ERROR';
   const record={...r,job,attempt,status,winner:status==='GAME_OVER'?r.winner:null,turn:r.turn??rows.at(-1)?.turn??null,attacks:r.attacks??rows.filter(x=>x.choice?.intent?.type==='ATTACK'&&['ACCEPTED','GAME_OVER'].includes(x.result.status)).length,rejected:rows.filter(x=>['REJECTED','REJECTION_LIMIT'].includes(x.result.status)).length,accepted:r.accepted??rows.filter(x=>['ACCEPTED','GAME_OVER'].includes(x.result.status)).length,elapsedMs:execution.elapsedMs,reason:execution.reason??r.termination?.reason??(status==='GAME_OVER'?null:status),rules:rulesIdentity(),build,traceHash:hash(rows)};
   atomic(join(work,'record.json'),record);atomic(completed,record);latest.push(record);publish();
   if(['INTERRUPTED','BATCH_TIMEOUT'].includes(status))break;
  }
  const report=publish();console.log(JSON.stringify({output:out,recorded:report.recorded,normal:report.normal,statusCounts:report.statusCounts,totalElapsedMs:report.totalElapsedMs}));return report;
 }finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);rmSync(lock,{recursive:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [config,split,out]=process.argv.slice(2);if(!config||!split||!out){console.error('node ai/lab/runner.mjs CONFIG tune|holdout OUTPUT');process.exitCode=1;}else try{await batch(config,split,out);}catch(e){console.error(e.stack);process.exitCode=1;}
}

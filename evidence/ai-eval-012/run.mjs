// Fixed eight-game holdout. Reuses ai/lab initial/rules/hash/journal parsing/replay.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,openSync,writeSync,fsyncSync,closeSync,existsSync} from 'node:fs';
import {spawnSync,execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {FairHost} from '../../.ai-dist/ai/authority/FairHost.js';
import {basicAgent as candidate,minimalAgent} from '../../.ai-dist/ai/fair/index.js';
import {basicAgent as baseline} from '../../.evaluation/baseline/.ai-dist/ai/fair/index.js';
import {basicAgent as opponent} from '../../.evaluation/ai005/.ai-dist/ai/fair/index.js';
import {defaultRules,defaultScenario} from '../../.ai-dist/vendor/eastfront-digital-core/dist/index.js';
import {initial,rulesIdentity,replay} from '../../ai/lab/match.mjs';
import {hash,atomic} from '../../ai/lab/common.mjs';
import {records} from '../../ai/lab/runner.mjs';
import {metrics} from './metrics.mjs';
const root=resolve('.'),out=join(root,'evidence/ai-eval-012'),config=JSON.parse(readFileSync(join(out,'config.json'))),build=JSON.parse(readFileSync(join(out,'build-identity.json')));
assert.equal(hash(readFileSync(join(out,'config.json'))),build.configHash);
for(const [name,dir] of [['candidate','.ai-dist'],['baseline','.evaluation/baseline/.ai-dist'],['opponent','.evaluation/ai005/.ai-dist']])for(const [path,digest] of build[name])assert.equal(hash(readFileSync(join(root,dir,path))),digest,name+path);
const jobs=config.seeds.flatMap(seed=>['baseline','candidate'].flatMap(version=>['GERMAN','SOVIET'].map(seat=>({id:`holdout-${seed}-${version}-${seat}`,seed,version,seat}))));
if(process.argv[2]==='--eval012-child'){
 const job=JSON.parse(process.argv[3]),dir=join(out,'batch',job.id);mkdirSync(dir,{recursive:true});
 const journal=join(dir,'trace.ndjson'),fd=openSync(journal,'wx'),host=new FairHost({matchId:job.id,initialState:initial(job.seed),rules:defaultRules,scenario:defaultScenario,agentSeeds:config.agentSeeds});
 let current=null,termination={status:'ACTION_LIMIT'},decisions=0;const started=performance.now();
 const tested=job.version==='baseline'?baseline:candidate;
 const agents=Object.fromEntries(['GERMAN','SOVIET'].map(side=>[side,input=>{
  const policy=input.view.pendingDecision?.kind==='RETREAT'?minimalAgent:side===job.seat?tested:opponent;
  const choice=policy(input);current={side,controllerId:input.scope.controllerId,turn:input.view.turn,phase:input.view.phase,observationKey:input.observationKey,choice};return choice;
 }]));
 try{
  for(let n=0;n<config.limits.maxDecisions;n++){
   if(performance.now()-started>=config.limits.matchMs){termination={status:'TIMEOUT'};break;}
   current=null;const result=host.step(agents);writeSync(fd,JSON.stringify({n,...current,result})+'\n');decisions++;
   if(!['ACCEPTED','REJECTED'].includes(result.status)){termination=result;break;}
  }
 }catch(e){termination={status:'ERROR',reason:e.stack};}finally{fsyncSync(fd);closeSync(fd);}
 const end=host.auditOmniscient(),rows=records(journal);assert.equal(rows.length,decisions);
 const record={job,configHash:build.configHash,buildIdentityHash:hash(build),rules:rulesIdentity(),termination,status:termination.status,winner:termination.status==='GAME_OVER'?end.victory.winner:null,turn:end.turn,decisions,elapsedMs:performance.now()-started,finalHash:hash(end),finalRandom:end.random,traceHash:hash(rows),traceFileHash:hash(readFileSync(journal)),traceBytes:readFileSync(journal).length,integrity:'PENDING'};
 atomic(join(dir,'record.json'),record);
 record.canonicalReplay=replay({seed:job.seed},rows,record.finalHash);
 record.metrics=metrics(job.seed,rows,record.finalHash,join(dir,'events.ndjson'));record.integrity='PASS';
 assert.equal(hash(readFileSync(journal)),record.traceFileHash);atomic(join(dir,'record.json'),record);
 console.log(JSON.stringify({job,status:record.status,winner:record.winner,turn:record.turn,decisions,elapsedMs:record.elapsedMs,objective:record.metrics.objectiveProgress,sides:record.metrics.sides,exposure:record.metrics.advances,integrity:record.integrity}));
}else{
 const manifest=join(out,'manifest.json');
 if(existsSync(manifest)){const prior=JSON.parse(readFileSync(manifest));assert.deepEqual(prior.config,config);assert.equal(prior.buildIdentityHash,hash(build));assert.deepEqual(prior.jobs,jobs);}
 else atomic(manifest,{config,buildIdentityHash:hash(build),preRegistrationCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),rules:rulesIdentity(),jobs,startedAt:new Date().toISOString()});
 const started=performance.now();
 for(const job of jobs){
  const remaining=config.limits.batchMs-(performance.now()-started),dir=join(out,'batch',job.id);mkdirSync(dir,{recursive:true});
  if(existsSync(join(dir,'record.json'))){const saved=JSON.parse(readFileSync(join(dir,'record.json')));assert.equal(saved.integrity,'PASS');assert.equal(saved.configHash,build.configHash);assert.equal(saved.buildIdentityHash,hash(build));assert.equal(hash(readFileSync(join(dir,'trace.ndjson'))),saved.traceFileHash);console.log('Preserved completed game '+job.id);continue;}
  if(remaining<=0){atomic(join(dir,'record.json'),{job,status:'BATCH_TIMEOUT',integrity:'NOT_RUN'});continue;}
  const r=spawnSync(process.execPath,[process.argv[1],'--eval012-child',JSON.stringify(job)],{cwd:root,encoding:'utf8',timeout:Math.min(config.limits.matchMs+30000,remaining),maxBuffer:4000000});
  writeFileSync(join(dir,'process.log'),(r.stdout??'')+(r.stderr??'')+(r.error?String(r.error):''));process.stdout.write(r.stdout??'');
  if(r.status!==0){atomic(join(dir,'process-failure.json'),{status:r.status,signal:r.signal,error:String(r.error??r.stderr)});console.error('Stopped after failed job '+job.id);process.exitCode=1;break;}
 }
}

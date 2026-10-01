// Exactly two preregistered development games. No baseline rerun or automatic retry.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,openSync,writeSync,fsyncSync,closeSync,existsSync} from 'node:fs';
import {spawnSync,execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {gzipSync} from 'node:zlib';
import {FairHost} from '../../.ai-dist/ai/authority/FairHost.js';
import {basicAgent,minimalAgent,observationCandidates} from '../../.ai-dist/ai/fair/index.js';
import {mainAttackPlan} from '../../.ai-dist/ai/fair/mainAttackPlan.js';
import {basicAgent as opponent} from '../../.evaluation/ai005/.ai-dist/ai/fair/index.js';
import {defaultRules,defaultScenario} from '../../.ai-dist/vendor/eastfront-digital-core/dist/index.js';
import {initial,rulesIdentity,replay} from '../../ai/lab/match.mjs';
import {hash,atomic} from '../../ai/lab/common.mjs';
import {records} from '../../ai/lab/runner.mjs';
import {metrics} from '../ai-eval-012/metrics.mjs';
import {analyze,comparison} from './analyze.mjs';
const root=resolve('.'),frozen=join(root,'evidence/ai-plan-023'),out=process.argv[2]==='--plan023-child'?resolve(process.argv[4]):resolve(process.argv[3]??frozen),config=JSON.parse(readFileSync(join(frozen,'config.json'))),build=JSON.parse(readFileSync(join(frozen,'build-identity.json')));
assert.equal(hash(readFileSync(join(frozen,'config.json'))),build.configHash);
for(const [name,dir] of [['candidate','.ai-dist'],['opponent','.evaluation/ai005/.ai-dist']])for(const [path,digest] of build[name])assert.equal(hash(readFileSync(join(root,dir,path))),digest,name+path);
for(const [path,digest] of build.sources)assert.equal(hash(readFileSync(join(root,path))),digest,path);
for(const b of build.baseline){assert.equal(hash(readFileSync(b.dir+'/trace.ndjson')),b.traceHash);assert.equal(hash(readFileSync(b.dir+'/record.json')),b.recordHash);}
assert.deepEqual(config.seeds,[1017,1018]);assert.equal(config.limits.maxGames,2);
const jobs=config.seeds.map(seed=>({id:`development-${seed}-candidate-GERMAN`,seed,version:'candidate',seat:'GERMAN'}));
const compress=dir=>{for(const file of ['trace.ndjson','events.ndjson'])if(existsSync(join(dir,file)))writeFileSync(join(dir,file+'.gz'),gzipSync(readFileSync(join(dir,file)),{level:9}));};
if(process.argv[2]==='--plan023-child'){
 const job=JSON.parse(process.argv[3]);assert(jobs.some(x=>JSON.stringify(x)===JSON.stringify(job)));
 const dir=join(out,'batch',job.id);mkdirSync(dir,{recursive:true});
 const journal=join(dir,'trace.ndjson'),fd=openSync(journal,'wx'),host=new FairHost({matchId:job.id,initialState:initial(job.seed),rules:defaultRules,scenario:defaultScenario,agentSeeds:config.agentSeeds,planProviders:{GERMAN:mainAttackPlan}});
 let current=null,termination={status:'ACTION_LIMIT'},decisions=0;const started=performance.now();
 const agents=Object.fromEntries(['GERMAN','SOVIET'].map(side=>[side,input=>{
  const policy=input.view.pendingDecision?.kind==='RETREAT'?minimalAgent:side==='GERMAN'?basicAgent:opponent;
  const choice=policy(input);current={side,controllerId:input.scope.controllerId,turn:input.view.turn,phase:input.view.phase,observationKey:input.observationKey,choice};
  if(input.plan){current.plan={unitIds:input.plan.unitIds,goals:input.plan.goals};
   // Passive paired-DTO audit. This separate policy call never feeds back or modifies choice.
   const plain={...input};delete plain.plan;const unplanned=basicAgent(plain),oldMenu=observationCandidates(plain),newMenu=observationCandidates(input),group=menu=>menu.filter(a=>a.type==='MOVE'&&input.plan.unitIds.includes(a.unitId));
   current.planImpact={choiceChanged:JSON.stringify(choice)!==JSON.stringify(unplanned),chosenMoveAbsentFromOldMenu:choice.intent?.type==='MOVE'&&!oldMenu.some(a=>JSON.stringify(a)===JSON.stringify(choice.intent)),groupMenuChanged:JSON.stringify(group(oldMenu))!==JSON.stringify(group(newMenu)),unplannedChoice:unplanned};
  }return choice;
 }]));
 try{
  for(let n=0;n<config.limits.maxDecisions;n++){
   if(performance.now()-started>=config.limits.matchMs){termination={status:'TIMEOUT'};break;}
   current=null;const result=host.step(agents);writeSync(fd,JSON.stringify({n,...current,result})+'\n');fsyncSync(fd);decisions++;
   if(!['ACCEPTED','REJECTED'].includes(result.status)){termination=result;break;}
  }
 }catch(e){termination={status:'ERROR',reason:e.stack};}finally{fsyncSync(fd);closeSync(fd);}
 const end=host.auditOmniscient(),rows=records(journal);assert.equal(rows.length,decisions);
 const record={job,classification:config.classification,configHash:build.configHash,buildIdentityHash:hash(build),rules:rulesIdentity(),termination,status:termination.status,winner:termination.status==='GAME_OVER'?end.victory.winner:null,turn:end.turn,decisions,elapsedMs:performance.now()-started,finalHash:hash(end),finalRandom:end.random,traceHash:hash(rows),traceFileHash:hash(readFileSync(journal)),traceBytes:readFileSync(journal).length,integrity:'PENDING'};
 atomic(join(dir,'record.json'),record);compress(dir);
 record.canonicalReplay=replay({seed:job.seed},rows,record.finalHash);record.metrics=metrics(job.seed,rows,record.finalHash,join(dir,'events.ndjson'));record.planning=analyze(job.seed,rows,record.finalHash);record.integrity='PASS';
 assert.equal(hash(readFileSync(journal)),record.traceFileHash);atomic(join(dir,'record.json'),record);compress(dir);
 console.log(JSON.stringify({job,status:record.status,winner:record.winner,turn:record.turn,decisions,elapsedMs:record.elapsedMs,objective:record.planning.final,sides:record.metrics.sides,impact:record.planning.impact,integrity:record.integrity}));
 if(record.status!=='GAME_OVER')process.exitCode=1;
}else if(process.argv[2]==='--replay-existing'){
 console.log(JSON.stringify(comparison(out,config,false).map(g=>({seed:g.seed,delta:g.delta,status:g.status})),null,2));
}else{
 assert.equal(process.argv[2],'--run-frozen','Use --run-frozen only after Leader preregistration commit.');
 mkdirSync(out,{recursive:true});const manifest=join(out,'manifest.json');assert(!existsSync(manifest),'Batch already started: preserve records; no retry.');
 const dirty=execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim();assert(!dirty,'Tracked source must be committed before run.');
 atomic(manifest,{config,buildIdentityHash:hash(build),preRegistrationCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),registrationScope:'LOCAL_GIT_PRE_RUN; remote mirror occurs only after experiment',rules:rulesIdentity(),jobs,startedAt:new Date().toISOString()});
 const started=performance.now();let completed=true;
 for(const job of jobs){
  const remaining=config.limits.batchMs-(performance.now()-started),dir=join(out,'batch',job.id);mkdirSync(dir,{recursive:true});
  if(remaining<=0){atomic(join(dir,'record.json'),{job,status:'BATCH_TIMEOUT',integrity:'NOT_RUN'});completed=false;break;}
  const r=spawnSync(process.execPath,[process.argv[1],'--plan023-child',JSON.stringify(job),out],{cwd:root,encoding:'utf8',timeout:Math.min(config.limits.matchMs+30000,remaining),maxBuffer:4000000});
  writeFileSync(join(dir,'process.log'),(r.stdout??'')+(r.stderr??'')+(r.error?String(r.error):''));process.stdout.write(r.stdout??'');compress(dir);
  if(r.status!==0){atomic(join(dir,'process-failure.json'),{status:r.status,signal:r.signal,error:String(r.error??r.stderr)});console.error('Stopped after failed job '+job.id);completed=false;process.exitCode=1;break;}
 }
 if(completed)comparison(out,config);
}

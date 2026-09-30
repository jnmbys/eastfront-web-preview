// Bounded task-specific comparison. Reuses FairHost, initial state and canonical replay.
// The baseline is imported from a separately built, clean 695ca052 checkout, not shared fair modules.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,openSync,writeSync,fsyncSync,closeSync,existsSync,readdirSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {resolve,join,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import {FairHost} from '../../.ai-dist/ai/authority/FairHost.js';
import {basicAgent as candidate,minimalAgent} from '../../.ai-dist/ai/fair/index.js';
import {defaultRules,defaultScenario} from '../../.ai-dist/vendor/eastfront-digital-core/dist/index.js';
import {hexDistance,hexKey} from '../../.ai-dist/vendor/eastfront-digital-core/dist/core/hex.js';
import {initial,rulesIdentity} from '../../ai/lab/match.mjs';
import {hash,atomic} from '../../ai/lab/common.mjs';
import {records} from '../../ai/lab/runner.mjs';
import {replayMetrics} from '../ai-combat-009/metrics.mjs';
const root=resolve('.'),out=resolve('evidence/ai-retreat-010/batch'),fixed=resolve(process.env.AI005_ROOT??'../ai005-fixed');
const baselineSHA='695ca0524eb039808491b18c69cea1fb74da0cca';
const git=(args,cwd=root)=>execFileSync('git',args,{cwd,encoding:'utf8'}).trim();
const files=p=>readdirSync(p,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>e.isDirectory()?files(join(p,e.name)):[join(p,e.name)]);
function codeHash(dir){return hash(files(join(dir,'.ai-dist')).filter(p=>p.endsWith('.js')).map(p=>[relative(dir,p),hash(readFileSync(p))]));}
assert.equal(git(['rev-parse','HEAD'],fixed),baselineSHA);assert.equal(git(['diff','HEAD','--','ai','src','vendor'],fixed),'');
assert.equal(git(['diff',baselineSHA,'--','ai/authority','vendor','src/core-adapter']), '');
const baseline=(await import(pathToFileURL(join(fixed,'.ai-dist/ai/fair/index.js')))).basicAgent;
const limits={maxDecisions:1800,matchMs:180000,batchMs:720000};
const config={seeds:[17,18],agentSeeds:{GERMAN:101,SOVIET:202},baseline:baselineSHA,candidate:'AI-RETREAT-010',control:'d6470f331a7afd3758a6eeb0f5935e8201f98767',sharedRetreatFlow:'AI-RETREAT-010 on BOTH seats; baseline tactical AI005 unchanged',parameters:{attackRatio:1.5,penaltyWeight:0.75},limits};
const build={sourceParent:git(['rev-parse','HEAD']),sourceDiffHash:hash(git(['diff','--','ai/fair'])),runtimeHash:codeHash(root),baselineRuntimeHash:codeHash(fixed),node:process.version,...rulesIdentity()};
const jobs=config.seeds.flatMap(seed=>['GERMAN','SOVIET'].map(candidateSide=>({id:`tune-${seed}-${candidateSide}`,seed,candidateSide})));
const summarize=()=>{
 const games=jobs.filter(j=>existsSync(join(out,j.id,'record.json'))).map(j=>JSON.parse(readFileSync(join(out,j.id,'record.json'))));
 const compact=games.map(({config:ignoredConfig,build:ignoredBuild,sides,...r})=>({...r,sides:Object.fromEntries(Object.entries(sides).map(([side,{perUnit,...stats}])=>[side,stats]))}));
 atomic(join(out,'summary.json'),{config,build,games:compact});
 atomic(join(out,'anomalies.json'),games.filter(g=>g.status!=='GAME_OVER'||g.integrity!=='PASS'));
};
if(process.argv[2]==='--retreat010-child'){
 const job=JSON.parse(process.argv[3]),dir=join(out,job.id),journal=join(dir,'trace.ndjson');mkdirSync(dir,{recursive:true});
 assert(!existsSync(journal),'Do not overwrite prior work');
 const fd=openSync(journal,'wx'),host=new FairHost({matchId:job.id,initialState:initial(job.seed),rules:defaultRules,scenario:defaultScenario,agentSeeds:config.agentSeeds});
 let current=null,started=performance.now(),termination={status:'ACTION_LIMIT'},priorTurn=1,turnDistances=[];
 const sides=Object.fromEntries(['GERMAN','SOVIET'].map(side=>[side,{acceptedMoves:0,movedHexes:0,pathLengths:{},perUnit:{},attacks:0,rejections:0,firstIdentifiedTurn:null,firstAdjacentTurn:null}]));
 const observeDistance=()=>{const x=host.observe('G-HUMAN-1');return Math.min(...x.view.units.filter(u=>u.side==='GERMAN').flatMap(u=>x.rules.objectives.map(h=>hexDistance(u.hex,h))));};
 const agents=Object.fromEntries(['GERMAN','SOVIET'].map(side=>[side,input=>{
  const s=sides[side],own=input.view.units.filter(u=>u.side===side),enemy=input.view.units.filter(u=>u.side!==side);
  if(enemy.length)s.firstIdentifiedTurn??=input.view.turn;
  if(own.some(u=>enemy.some(e=>hexDistance(u.hex,e.hex)<=1)))s.firstAdjacentTurn??=input.view.turn;
  const choice=(input.view.pendingDecision?.kind==='RETREAT'?minimalAgent:side===job.candidateSide?candidate:baseline)(input);
  current={side,controllerId:input.scope.controllerId,turn:input.view.turn,phase:input.view.phase,observationKey:input.observationKey,choice};return choice;
 }]));
 let n=0,distanceBefore=null;
 try{
  for(;n<limits.maxDecisions;n++){
   if(performance.now()-started>limits.matchMs){termination={status:'TIMEOUT'};break;}
   current=null;const result=host.step(agents);
   if(current&&current.turn!==priorTurn){turnDistances.push({turn:priorTurn,nearest:distanceBefore});priorTurn=current.turn;}
   const row={n,...current,result};writeSync(fd,JSON.stringify(row)+'\n');
   if(current){const s=sides[current.side],a=current.choice?.intent;
    if(result.status==='REJECTED'||result.status==='REJECTION_LIMIT')s.rejections++;
    if(result.status==='ACCEPTED'&&a?.type==='MOVE'){
     s.acceptedMoves++;s.movedHexes+=a.path.length;s.pathLengths[a.path.length]=(s.pathLengths[a.path.length]??0)+1;
     const u=s.perUnit[a.unitId]??={acceptedMoves:0,movedHexes:0,byTurn:{}};u.acceptedMoves++;u.movedHexes+=a.path.length;u.byTurn[current.turn]=(u.byTurn[current.turn]??0)+a.path.length;
    }
    if(result.status==='ACCEPTED'&&a?.type==='ATTACK')s.attacks++;
   }
   distanceBefore=observeDistance();
   if(!['ACCEPTED','REJECTED'].includes(result.status)){termination=result;n++;break;}
  }
 }catch(e){termination={status:'ERROR',reason:e.stack};}
 finally{fsyncSync(fd);closeSync(fd);}
 const end=host.auditOmniscient(),trace=records(journal);assert.equal(trace.length,n);const finalHash=hash(end);
 turnDistances.push({turn:end.turn,nearest:observeDistance()});
 for(const s of Object.values(sides))s.meanHexesPerAcceptedMove=s.acceptedMoves?s.movedHexes/s.acceptedMoves:0;
 // Full state is read only now, after all policy decisions. It never becomes policy input.
 const record={job,config,build,status:termination.status,termination,reason:termination.reason??null,winner:termination.status==='GAME_OVER'?end.victory.winner:null,turn:end.turn,decisions:trace.length,elapsedMs:performance.now()-started,sides,turnDistances,objectiveProgress:{germanControlledCapitalHexes:defaultScenario.capitalCoreHexes.filter(h=>end.hexes[hexKey(h)]?.control==='GERMAN').length,nearestGermanToCapital:observeDistance()},traceHash:hash(trace),traceBytes:readFileSync(journal).length,finalHash,finalRandom:end.random,integrity:'PENDING'};
 atomic(join(dir,'record.json'),record);
 const verification=replayMetrics(job.seed,trace,finalHash);assert.equal(verification.finalHash,finalHash);assert.equal(hash(records(journal)),record.traceHash);record.integrity='PASS';record.replay=verification;assert.deepEqual(verification.turnDistances,record.turnDistances);atomic(join(dir,'record.json'),record);
 console.log(JSON.stringify({id:job.id,status:record.status,winner:record.winner,turn:record.turn,elapsedMs:record.elapsedMs,objective:record.objectiveProgress,sides:Object.fromEntries(Object.entries(sides).map(([k,{perUnit,...v}])=>[k,v])),integrity:record.integrity}));
}else{
 mkdirSync(out,{recursive:true});const manifest=join(out,'manifest.json');if(existsSync(manifest))assert.deepEqual(JSON.parse(readFileSync(manifest)),{config,build});else atomic(manifest,{config,build});
 const start=performance.now();
 for(const job of jobs){
  const path=join(out,job.id,'record.json');if(existsSync(path)){const r=JSON.parse(readFileSync(path));assert.equal(r.integrity,'PASS');continue;}
  if(performance.now()-start>=limits.batchMs)break;
  const result=spawnSync(process.execPath,[process.argv[1],'--retreat010-child',JSON.stringify(job)],{cwd:root,env:process.env,encoding:'utf8',timeout:Math.min(limits.matchMs+20000,limits.batchMs-(performance.now()-start)),maxBuffer:2000000});
  writeFileSync(join(out,job.id,'process.log'),(result.stdout??'')+(result.stderr??''));process.stdout.write(result.stdout??'');
  if(result.status!==0){summarize();throw Error(`Child failed: ${job.id}: ${result.error??result.stderr}`);}
  summarize();
  const r=JSON.parse(readFileSync(path));if(r.integrity!=='PASS')throw Error('Incomplete integrity: '+job.id);
 }
 summarize();
}

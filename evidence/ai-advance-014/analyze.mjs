// Offline replay of stored choices only. Authoritative diagnostics never feed policies.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {FairHost} from '../../.ai-dist/ai/authority/FairHost.js';
import {defaultRules,defaultScenario} from '../../.ai-dist/vendor/eastfront-digital-core/dist/index.js';
import {getNeighbors,hexDistance,hexKey} from '../../.ai-dist/vendor/eastfront-digital-core/dist/core/hex.js';
import {validateMoveAction} from '../../.ai-dist/vendor/eastfront-digital-core/dist/rules/movement.js';
import {toCoreAction} from '../../.ai-dist/src/multiplayer/gameplayProtocol.js';
import {createMoveScorer} from '../../.ai-dist/ai/fair/routing.js';
import {initial,replay} from '../../ai/lab/match.mjs';
import {hash,atomic} from '../../ai/lab/common.mjs';
import {records} from '../../ai/lab/runner.mjs';
import {advanceOffer} from './observe.mjs';
const out='evidence/ai-advance-014',all=[];
const dist=h=>Math.min(...defaultScenario.capitalCoreHexes.map(g=>hexDistance(h,g)));
for(const seed of [1017,1018]){
 const games=Object.fromEntries(['baseline','candidate','experiment'].map(v=>{const dir=v==='experiment'?`${out}/batch/development-${seed}-experiment-GERMAN`:`evidence/ai-eval-012/batch/holdout-${seed}-${v}-GERMAN`;return [v,{dir,record:JSON.parse(readFileSync(dir+'/record.json')),rows:records(dir+'/trace.ndjson')}];}));
 const queries=[...new Map(['candidate','experiment'].flatMap(v=>games[v].record.metrics.advances.filter(a=>a.side==='GERMAN').map(a=>[`${a.unitId}:${a.turn+1}`,{unitId:a.unitId,turn:a.turn+1}])).concat([['G-MOT-03:3',{unitId:'G-MOT-03',turn:3}]] )).values()];
 for(const [version,{dir,record,rows}] of Object.entries(games)){
  assert.equal(record.integrity,'PASS');assert.equal(record.traceFileHash,hash(readFileSync(dir+'/trace.ndjson')));assert.equal(record.traceHash,hash(rows));assert.equal(record.traceBytes,readFileSync(dir+'/trace.ndjson').length);assert(rows.every((r,i)=>r.n===i));
  replay({seed},rows,record.finalHash);
  const host=new FairHost({matchId:record.job.id,initialState:initial(seed),rules:defaultRules,scenario:defaultScenario,agentSeeds:{GERMAN:101,SOVIET:202}}),offers=[],snapshots={};
  const snapshot=(input,q,row)=>{
   const state=host.auditOmniscient(),u=input.view.units.find(u=>u.id===q.unitId),full=state.units[q.unitId];
   if(!u||!full?.alive)return {n:row.n,alive:false,authoritativeStateHash:hash(state),inputHash:hash(input)};
   const scorer=createMoveScorer(input),neighbors=getNeighbors(u.hex).filter(h=>state.hexes[hexKey(h)]).map(to=>{const action={type:'MOVE',unitId:u.id,path:[to]},check=validateMoveAction(state,defaultRules,toCoreAction(action,input.scope.controllerId));return {to,issues:check.issues.map(i=>i.code),score:String(scorer.score(action)),distance:dist(to)};});
   return {n:row.n,alive:true,hex:u.hex,distance:dist(u.hex),hasMoved:u.friendly.hasMoved,baseMP:Math.max(0,u.stats.movement-(u.supplyState==='OUT_OF_SUPPLY'?input.rules.oosMovementPenalty:0)),visibleAdjacent:input.view.units.filter(e=>e.side!=='GERMAN'&&hexDistance(u.hex,e.hex)===1).map(e=>({id:e.id,hex:e.hex,type:e.type})),neighbors,legalNeighbors:neighbors.filter(n=>!n.issues.length).length,legalForwardNeighbors:neighbors.filter(n=>!n.issues.length&&n.distance<dist(u.hex)).length,finiteScoredNeighbors:neighbors.filter(n=>Number.isFinite(Number(n.score))).length,inputHash:hash(input)};
  };
  for(const row of rows){
   const observe=input=>{
    assert.equal(input.observationKey,row.observationKey);assert.equal(input.scope.controllerId,row.controllerId);
    const offer=advanceOffer(input);if(offer){if(row.advanceOffer)assert.deepEqual(offer,row.advanceOffer);offers.push({n:row.n,turn:row.turn,choice:row.choice,status:row.result.status,...offer});}
    if(input.view.viewer==='GERMAN'&&input.view.phase==='GERMAN_MOVEMENT'&&!input.view.pendingDecision)for(const q of queries.filter(q=>q.turn===row.turn)){
     const key=q.unitId+':'+q.turn,entry=snapshots[key]??={unitId:q.unitId,turn:q.turn};
     if(!entry.first)entry.first=snapshot(input,q,row);
     if(row.choice?.intent?.type==='READY_FOR_PHASE_END')entry.last=snapshot(input,q,row);
    }
    return row.choice;
   };
   assert.deepEqual(host.step({GERMAN:observe,SOVIET:observe}),row.result);
  }
  assert.equal(hash(host.auditOmniscient()),record.finalHash);
  for(const entry of Object.values(snapshots))entry.actualMoves=rows.filter(r=>r.turn===entry.turn&&r.phase==='GERMAN_MOVEMENT'&&r.choice?.intent?.type==='MOVE'&&r.choice.intent.unitId===entry.unitId).map(r=>({n:r.n,choice:r.choice,status:r.result.status}));
  const ownWindows=record.metrics.advances.filter(a=>a.side==='GERMAN').map(a=>({advance:a,snapshot:snapshots[`${a.unitId}:${a.turn+1}`]??null}));
  const complete=ownWindows.filter(w=>w.snapshot?.first&&w.snapshot?.last),alive=complete.filter(w=>w.snapshot.first.alive);
  const mobility={advances:ownWindows.length,completeWindows:complete.length,censoredWindows:ownWindows.length-complete.length,aliveAtEntry:alive.length,zeroLegalNeighborsAtEntry:alive.filter(w=>!w.snapshot.first.hasMoved&&w.snapshot.first.legalNeighbors===0).length,zeroLegalForwardNeighborsAtEntry:alive.filter(w=>!w.snapshot.first.hasMoved&&w.snapshot.first.legalForwardNeighbors===0).length,zeroFiniteScoredNeighborsAtEntry:alive.filter(w=>w.snapshot.first.finiteScoredNeighbors===0).length,movedDuringNextOwnMovement:complete.filter(w=>w.snapshot.actualMoves.some(m=>m.status==='ACCEPTED')).length,closerAtEndOfNextOwnMovement:alive.filter(w=>w.snapshot.last.alive&&w.snapshot.last.distance<w.snapshot.first.distance).length};
  const protection={offeredWindows:offers.length,legacyEligibleCandidates:offers.flatMap(o=>o.options).filter(o=>o.oldEligible).length,excludedCandidates:offers.flatMap(o=>o.options).filter(o=>o.guardExcluded).length,windowsWithExclusions:offers.filter(o=>o.options.some(c=>c.guardExcluded)).length,retainedCandidates:offers.flatMap(o=>o.options).filter(o=>o.retained).length,retainedWindows:offers.filter(o=>o.options.some(c=>c.retained)).length,retainedWindowsPassed:offers.filter(o=>o.options.some(c=>c.retained)&&o.choice.intent.type==='PASS_ADVANCE').length};
  if(record.protection)for(const k of Object.keys(protection))assert.equal(protection[k],record.protection[k]);
  const result={seed,version,source:dir,status:record.status,winner:record.winner,turn:record.turn,traceFileHash:record.traceFileHash,finalHash:record.finalHash,finalRandom:record.finalRandom,objective:record.metrics.objectiveProgress,sides:record.metrics.sides,turnProgress:record.metrics.turnProgress,protection,mobility,offers,snapshots,ownWindows,advancedUnitNextEnemyLoss:{complete:record.metrics.advances.filter(a=>a.side==='GERMAN'&&!a.censored).length,lossSteps:record.metrics.advances.filter(a=>a.side==='GERMAN').reduce((n,a)=>n+a.lossSteps,0),destroyed:record.metrics.advances.filter(a=>a.side==='GERMAN').reduce((n,a)=>n+a.destroyedUnits,0)}};
  atomic(`${out}/${seed}-${version}-audit.json`,result);all.push(result);console.log(JSON.stringify({seed,version,integrity:'PASS',objective:result.objective.nearestGermanToCapital,mobility,protection}));
 }
}
const compact=all.map(({offers,snapshots,ownWindows,...x})=>x);
atomic(out+'/summary.json',{task:'AI-ADVANCE-014',classification:'DEVELOPMENT_REUSE_NOT_HOLDOUT',newGames:2,games:compact,limits:['Mobility window starts at next own movement, distinct from next enemy turn casualty window.','Cohorts and denominators differ after divergence; own-window counts are descriptive, not paired treatment effects.','Neighbor legality is offline audit only; policies never receive authoritative state.','Same initial seed does not align battles after action/RNG-consumption divergence.']});
let table='# AI-ADVANCE-014：开发种子对照\n\n1017/1018 已用于开发，不是留出验证。仅实验版德军新跑2局；B=既有基线，C=既有原候选，E=新增敌邻接保护。损失为损步/消灭数。\n\n| 种子/版 | 推进/PASS | 最近距离 | 首都德控 | 德损失 | 苏损失 | 拒绝 | 终局 |\n|---|---|---|---|---|---|---|---|\n';
for(const x of all){const g=x.sides.GERMAN,s=x.sides.SOVIET;table+=`| ${x.seed}/${{baseline:'B',candidate:'C',experiment:'E'}[x.version]} | ${g.advances}/${g.passAdvances} | ${x.objective.nearestGermanToCapital} | ${x.objective.germanControlledCapitalHexes}/2 | ${g.lossSteps}/${g.destroyedUnits} | ${s.lossSteps}/${s.destroyedUnits} | ${g.rejections+s.rejections} | ${x.status} T${x.turn} ${x.winner} |\n`;}
table+='\n| 种子/实验 | 排除候选数/旧合格数 | 有排除的决策窗/全部窗 | 保留机会窗/实际推进 | 保留却PASS |\n|---|---|---|---|---|\n';
for(const x of all.filter(x=>x.version==='experiment')){const p=x.protection;table+=`| ${x.seed} | ${p.excludedCandidates}/${p.legacyEligibleCandidates} | ${p.windowsWithExclusions}/${p.offeredWindows} | ${p.retainedWindows}/${x.sides.GERMAN.advances} | ${p.retainedWindowsPassed} |\n`;}
table+='\n| 种子/版 | 完整随后己方移动窗 | 入口无合法邻步 | 入口无合法前进一步 | 实际移动 | 阶段末更近 |\n|---|---|---|---|---|---|\n';
for(const x of all.filter(x=>x.version!=='baseline')){const m=x.mobility;table+=`| ${x.seed}/${x.version} | ${m.completeWindows}/${m.advances} | ${m.zeroLegalNeighborsAtEntry}/${m.aliveAtEntry} | ${m.zeroLegalForwardNeighborsAtEntry}/${m.aliveAtEntry} | ${m.movedDuringNextOwnMovement} | ${m.closerAtEndOfNextOwnMovement} |\n`;}
table+='\n逐回合最近距离（回合结束；T16自然终局）：\n\n| 回合 | 1017 B/C/E | 1018 B/C/E |\n|---|---|---|\n';
for(let t=1;t<=16;t++)table+=`| T${t} | ${[1017,1018].map(seed=>all.filter(x=>x.seed===seed).map(x=>x.turnProgress.find(p=>p.turn===t)?.nearestGermanToCapital??'—').join('/')).join(' | ')} |\n`;
table+='\n注意：基线/原候选的保护计数只是按冻结授权视图离线分类，不是当时执行了保护。可机动性与损失不能仅凭推进减少或零即时损失判定增强。完整事件、逐候选邻接身份集合、同单位/回合机动快照见同目录各 audit.json 及 batch 日志；结论见 README.md。\n';
writeFileSync(out+'/comparison.md',table);

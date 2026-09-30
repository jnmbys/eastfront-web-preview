import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {hash,atomic} from '../../ai/lab/common.mjs';
import {records} from '../../ai/lab/runner.mjs';
const out='evidence/ai-eval-012',manifest=JSON.parse(readFileSync(join(out,'manifest.json'))),games=[];
for(const job of manifest.jobs){
 const dir=join(out,'batch',job.id),r=JSON.parse(readFileSync(join(dir,'record.json'))),bytes=readFileSync(join(dir,'trace.ndjson')),rows=records(join(dir,'trace.ndjson'));
 assert.equal(r.integrity,'PASS');assert.equal(bytes.length,r.traceBytes);assert.equal(hash(bytes),r.traceFileHash);assert.equal(rows.length,r.decisions);assert.equal(hash(rows),r.traceHash);assert.equal(r.metrics.finalHash,r.finalHash);assert.equal(r.canonicalReplay.finalHash,r.finalHash);assert.equal(r.configHash,hash(readFileSync(join(out,'config.json'))));
 const ev=readFileSync(join(dir,'events.ndjson'),'utf8').trim().split('\n').map(x=>JSON.parse(x));assert.equal(hash(ev),r.metrics.eventsHash);
 games.push({...r,processAnomaly:existsSync(join(dir,'process-failure.json'))?JSON.parse(readFileSync(join(dir,'process-failure.json'))):null});
}
const pairs=[];
for(const seed of manifest.config.seeds)for(const seat of ['GERMAN','SOVIET']){
 const b=games.find(x=>x.job.seed===seed&&x.job.seat===seat&&x.job.version==='baseline'),c=games.find(x=>x.job.seed===seed&&x.job.seat===seat&&x.job.version==='candidate');
 assert.deepEqual(b.rules,c.rules);assert.equal(b.metrics.initialHash,c.metrics.initialHash);
 const exposure=c.metrics.advances.map(x=>{const matches=b.metrics.losses.filter(y=>y.turn===x.nextEnemyTurn&&y.activeSide===x.enemySide&&y.event.unitId===x.unitId);return {...x,matchedBaseline:{lossSteps:matches.filter(y=>y.event.type==='UnitStepLost').length,destroyedUnits:matches.filter(y=>y.event.type==='UnitDestroyed').length,losses:matches}};});
 const bt=records(join(out,'batch',b.job.id,'trace.ndjson')),ct=records(join(out,'batch',c.job.id,'trace.ndjson'));
 const n=Array.from({length:Math.max(bt.length,ct.length)},(_,i)=>i).find(i=>JSON.stringify(bt[i])!==JSON.stringify(ct[i]));
 pairs.push({seed,seat,baseline:b.job.id,candidate:c.job.id,capitalDelta:c.metrics.objectiveProgress.germanControlledCapitalHexes-b.metrics.objectiveProgress.germanControlledCapitalHexes,distanceDelta:c.metrics.objectiveProgress.nearestGermanToCapital-b.metrics.objectiveProgress.nearestGermanToCapital,lossDelta:Object.fromEntries(['GERMAN','SOVIET'].map(s=>[s,{steps:c.metrics.sides[s].lossSteps-b.metrics.sides[s].lossSteps,destroyed:c.metrics.sides[s].destroyedUnits-b.metrics.sides[s].destroyedUnits}])),identicalFinalState:b.finalHash===c.finalHash,identicalTrace:b.traceHash===c.traceHash,firstTraceDifference:n===undefined?null:{n,baseline:bt[n],candidate:ct[n]},finalRandom:{baseline:b.finalRandom,candidate:c.finalRandom},exposure});
}
atomic(join(out,'summary.json'),{config:manifest.config,games,pairs,integrity:'All 8 trace byte counts/hashes, canonical replays, metrics replays and initial-state pair identities verified'});
atomic(join(out,'anomalies.json'),{game:games.filter(x=>x.status!=='GAME_OVER').map(x=>({job:x.job,status:x.status,termination:x.termination})),process:games.filter(x=>x.processAnomaly).map(x=>({job:x.job,anomaly:x.processAnomaly,resolution:'Completed GAME_OVER record and both replay hashes verified; unique child flag fixed; preserved original process log; not rerun'}))});
const fmt=s=>s.lossSteps+'/'+s.destroyedUnits;
let md='# AI-EVAL-012 留出对照表\n\n基线 ecb15ce201a4ca096bab2cb918f7c295dd474eda；候选 3f9c1441c50a4cb44638c816070df58d6bc96db6。种子1017为既定留出，1018在首局前补定。双方共享010撤退；固定对手AI005；参数1.5/0.75、agent seeds101/202。每行是一场完整新局。\n\n|种子|受测席位|版本|终局/胜方|首都德控/2|德军最近距离|推进德/苏|德损步/灭|苏损步/灭|拒绝德/苏|推进者下一敌回合损步/灭|\n|---|---|---|---|---|---|---|---|---|---|---|\n';
for(const g of games){const m=g.metrics,a=m.advances,ex=a.length?a.reduce((n,x)=>n+x.lossSteps,0)+'/'+a.reduce((n,x)=>n+x.destroyedUnits,0)+(a.some(x=>x.censored)?'（含截尾）':''):'—（无推进）';md+=`|${g.job.seed}|${g.job.seat==='GERMAN'?'德':'苏'}|${g.job.version==='baseline'?'基线':'候选'}|${g.status}/${g.winner} T${g.turn}|${m.objectiveProgress.germanControlledCapitalHexes}|${m.objectiveProgress.nearestGermanToCapital}|${m.sides.GERMAN.advances}/${m.sides.SOVIET.advances}|${fmt(m.sides.GERMAN)}|${fmt(m.sides.SOVIET)}|${m.sides.GERMAN.rejections}/${m.sides.SOVIET.rejections}|${ex}|\n`;}
md+='\n## 配对效果\n\n|种子/席位|首都控制变化|终局距离变化（负为更近）|德损步/灭变化|苏损步/灭变化|终态相同|\n|---|---|---|---|---|---|\n';
for(const p of pairs)md+=`|${p.seed}/${p.seat}|${p.capitalDelta}|${p.distanceDelta}|${p.lossDelta.GERMAN.steps}/${p.lossDelta.GERMAN.destroyed}|${p.lossDelta.SOVIET.steps}/${p.lossDelta.SOVIET.destroyed}|${p.identicalFinalState}|\n`;
md+='\n## 推进暴露窗口（逐次）\n\n|种子/席位|单位|推进回合|自身首都距离|下一敌回合|窗口完整|候选损步/灭|相同单位基线同窗损步/灭|\n|---|---|---|---|---|---|---|---|\n';
for(const p of pairs)for(const a of p.exposure)md+=`|${p.seed}/${p.seat}|${a.unitId}|T${a.turn}|${a.distanceBefore}→${a.distanceAfter}|${a.enemySide} T${a.nextEnemyTurn}|${!a.censored}|${a.lossSteps}/${a.destroyedUnits}|${a.matchedBaseline.lossSteps}/${a.matchedBaseline.destroyedUnits}|\n`;
md+='\n损步是UnitStepLost事件数，消灭另列，不能直接相加为总伤亡。最近距离按所有存活德军到两首都格的最小六角距离计算，不表示同一单位连续推进。首都control=null按原Core原值保留，不误记为苏控。推进者暴露按权威phase的activeSide划窗，包含由防方提交的损失选择；不按提交方推断回合。相同单位基线对照是同回合窗口描述，不是独立因果估计。逐回合曲线、全部损失及推进事件见summary.json。\n\n同种子只固定初始RNG；行动改变可能改变后续抽样消耗顺序，不保证逐场战斗骰点相同。8局全保留，未换种子、未调参、未扩样。首局驱动参数误触发旧lab入口而退出1，游戏已完整结束且日志/回放校验通过，故保留为自然终局并单列进程异常，不隐藏或重跑。\n';
writeFileSync(join(out,'comparison.md'),md);
console.log(JSON.stringify({games:games.map(g=>({job:g.job,status:g.status,progress:g.metrics.objectiveProgress,sides:g.metrics.sides,exposure:g.metrics.advances})),pairs},null,2));

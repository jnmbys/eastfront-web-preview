// Read-only aggregation of completed records; never runs a policy or match.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {hash,atomic} from '../../ai/lab/common.mjs';
import {getNeighbors,hexKey} from '../../.ai-dist/vendor/eastfront-digital-core/dist/core/hex.js';
import {defaultRules} from '../../.ai-dist/vendor/eastfront-digital-core/dist/index.js';
const dir='evidence/ai-retreat-010',read=p=>JSON.parse(readFileSync(p));
const rows=p=>readFileSync(p,'utf8').trim().split('\n').map(JSON.parse);
const ids=[17,18].flatMap(seed=>['GERMAN','SOVIET'].map(side=>`tune-${seed}-${side}`));
const compact=r=>({status:r.status,turn:r.turn,winner:r.winner,sides:r.replay.sides,objective:r.objectiveProgress,turnDistances:r.turnDistances,elapsedMs:r.elapsedMs,traceHash:r.traceHash,finalHash:r.finalHash,decisions:r.decisions});
const games=ids.map(id=>{
 const path=`${dir}/batch/${id}`,r=read(`${path}/record.json`),oldPath=`evidence/ai-combat-009/batch/${id}`,old=read(`${oldPath}/record.json`);
 const trace=rows(`${path}/trace.ndjson`),prior=rows(`${oldPath}/trace.ndjson`);
 assert.equal(r.integrity,'PASS');assert.equal(hash(trace),r.traceHash);assert.equal(readFileSync(`${path}/trace.ndjson`).length,r.traceBytes);assert.equal(trace.length,r.decisions);assert.equal(r.finalHash,r.replay.finalHash);
 assert.equal(hash(prior),old.traceHash);assert.equal(readFileSync(`${oldPath}/trace.ndjson`).length,old.traceBytes);
 for(const k of ['baselineRuntimeHash','rulesHash','scenarioHash','mapHash'])assert.equal(r.build[k],old.build[k]);
 assert.deepEqual(r.config.agentSeeds,old.config.agentSeeds);assert.deepEqual(r.config.parameters,old.config.parameters);assert.deepEqual(r.config.limits,old.config.limits);
 for(const side of ['GERMAN','SOVIET'])assert.equal(r.sides[side].rejections,r.replay.sides[side].rejections);
 let same=0;while(same<Math.min(trace.length,prior.length)&&JSON.stringify(trace[same])===JSON.stringify(prior[same]))same++;
 return {id,candidateSide:r.job.candidateSide,old:compact(old),current:compact(r),firstChangedDecision:same,previous:prior[same]??null,next:trace[same]??null,rejected:r.replay.rejected,integrity:'PASS'};
});
const checkpoints=['tune-17-SOVIET','tune-18-GERMAN'].map(id=>{
 const d=read(`${dir}/checkpoints/${id}-diagnosis.json`),recovery=read(`${dir}/${id}-recovery.json`);
 const state=JSON.parse(gunzipSync(readFileSync(`${dir}/checkpoints/${id}-state.json.gz`))),packet=JSON.parse(gunzipSync(readFileSync(`${dir}/checkpoints/${id}-input.json.gz`)));
 assert.equal(hash(state),d.stateHash);assert.equal(hash(packet),d.inputHash);assert.equal(recovery.originalInputHash,d.inputHash);
 const blocked=d.attempts[0].issues[0].hex,visible=new Set(d.visibleEnemies.map(u=>u.id));
 const blockers=Object.values(state.units).filter(u=>u.alive&&u.side!==packet.scope.side&&defaultRules.unitTemplates[u.templateId].exertsZoc&&getNeighbors(u.hex).some(h=>hexKey(h)===hexKey(blocked))).map(u=>({id:u.id,hex:u.hex,identified:visible.has(u.id)}));
 return {id,decision:d.start,pending:d.pending,originalFirstAcceptedCandidate:d.candidates.findIndex(a=>a.accepted)+1,originalUniqueAttempts:new Set(d.attempts.map(a=>JSON.stringify(a.choice.intent))).size,originalObservationKeys:[...new Set(d.attempts.map(a=>a.observationKey))],originalReasons:d.attempts.map(a=>({n:a.n,issues:a.issues})),offlineOnlyBlockers:blockers,recoveryAttempts:recovery.attempts,accepted:recovery.trace.find(x=>x.result.status==='ACCEPTED').choice.intent,postFlowPending:recovery.pending};
});
const frozen=execFileSync('git',['diff','d6470f331a7afd3758a6eeb0f5935e8201f98767','--','vendor','src','ai/authority','ai/fair/basicAgent.ts','ai/fair/parameters.ts','ai/fair/routing.ts','ai/fair/minimalAgent.ts'],{encoding:'utf8'});assert.equal(frozen,'');
const summary={task:'AI-RETREAT-010',sourceParent:'d6470f331a7afd3758a6eeb0f5935e8201f98767',scope:'Retreat enumeration order only; shared new retreat handling on BOTH seats. Fixed AI005 movement/attack unchanged.',checkpoints,games,natural:games.filter(g=>g.current.status==='GAME_OVER').length,anomalies:games.filter(g=>g.current.status!=='GAME_OVER').map(g=>({id:g.id,status:g.current.status,turn:g.current.turn})),validation:{directedTests:5,build:'PASS',traceIntegrity:'PASS',replay:'PASS',frozenFiles:'PASS'}};
atomic(`${dir}/summary.json`,summary);
const pair=(r,k)=>`${r.sides.GERMAN[k]}/${r.sides.SOVIET[k]}`;
const lines=games.map(g=>`|${g.id.replace('tune-','')}|${g.old.sides[g.candidateSide].jointAttacks}→${g.current.sides[g.candidateSide].jointAttacks}|${pair(g.old,'lossSteps')}→${pair(g.current,'lossSteps')}|${pair(g.old,'destroyedUnits')}→${pair(g.current,'destroyedUnits')}|${g.old.objective.nearestGermanToCapital}→${g.current.objective.nearestGermanToCapital}|${pair(g.old,'rejections')}→${pair(g.current,'rejections')}|${g.current.status==='GAME_OVER'?`T${g.current.turn} ${g.current.winner}`:`异常 T${g.current.turn} ${g.current.status}`}|`);
writeFileSync(`${dir}/summary.md`,`# AI-RETREAT-010 研究交接\n\n基线d6470f331a7afd3758a6eeb0f5935e8201f98767，当前源码和证据由本文件所在Git提交固定。仅调整撤退候选排序；联攻评分、attackRatio=1.5、penaltyWeight=0.75、Core、RNG、补给、128候选/4096分配搜索/8连续拒绝上限不变。\n\n**根因**：旧DFS优先穷举同一首步的后缀、同一早序单位路径下的后序单位组合，合法候选排第10/14，8次额度已耗尽。原两段动作各8个，完全重复动作0；拒绝时状态不变、同一观察key正常，未发生旧状态污染；空路径在存在更长合法撤退时被Core拒绝。首步阻挡属于未识别敌军ZOC，策略没有得到其身份/位置或拒绝细节；只改善静态候选覆盖，未将失败路径判成已知障碍。\n\n检查点恢复：17苏T14 n739由固定对手德军G-J-02撤退；18德T12 n632由候选德军G-ENG-01/G-I-07/G-J-02撤退。两处都在第6次尝试成功并完成强制流程，仍有5次实际拒绝。保留短/空路径，只由Core裁决无路可退和额外损失。详细逐次输入、候选、拒绝原因见checkpoints/*-diagnosis.json及*-recovery.json。\n\n**实验口径**：定向5项通过后，仅新增原17/18×德/苏4局。双方统一使用010撤退处理；候选其余策略为009，固定对手其余策略仍是完整AI005。因此不称固定对手全版本字节未变，不能把差异单独归因为候选攻击变强。种子、agent seeds、规则、地图、参数、1800行动/180秒单局/720秒批次与009相同；holdout未动。\n\n下表009→010。损失/消灭/拒绝为德/苏；距离是终态存活德军到公开首都最近距离，并非同一个单位的位移。\n\n|种子/候选阵营|候选联攻|损失步德/苏|消灭单位德/苏|最近距离|拒绝德/苏|010终局|\n|---|---|---|---|---|---|---|\n${lines.join('\n')}\n\n009的17苏/T14、18德/T12原为中断累计量，不能与010终局当作等长战绩比较。新局自然终局${summary.natural}/4，异常${summary.anomalies.length}/4；各回合距离、双方攻击/联攻/损失/移动及逐次拒绝见summary.json和batch/*/record.json。完整回放哈希和Core终态重放均通过；这不等同策略强度或平衡验收。\n\n范围限制：有界排序仍非穷尽合法性搜索，隐藏占位/ZOC仍可能拒绝，未保证所有战局均可在8次内恢复。未部署，浏览器/华为未测；不增加攻击、移动、集结策略。\n`);
console.log(JSON.stringify({natural:summary.natural,anomalies:summary.anomalies,games:games.map(g=>({id:g.id,...g.current}))}));

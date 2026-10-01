// Offline replay and passive opportunity audit. No result flows back into policies.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {FairHost} from '../../.ai-dist/ai/authority/FairHost.js';
import {defaultRules,defaultScenario} from '../../.ai-dist/vendor/eastfront-digital-core/dist/index.js';
import {hexDistance,hexKey} from '../../.ai-dist/vendor/eastfront-digital-core/dist/core/hex.js';
import {scoreIntent} from '../../.ai-dist/ai/fair/basicAgent.js';
import {observationCandidates} from '../../.ai-dist/ai/fair/candidates.js';
import {initial} from '../../ai/lab/match.mjs';
import {hash,atomic} from '../../ai/lab/common.mjs';
import {records} from '../../ai/lab/runner.mjs';
const out='evidence/ai-attack-reserve-019',config=JSON.parse(readFileSync(out+'/config.json')),results=[],distance=h=>Math.min(...defaultScenario.capitalCoreHexes.map(g=>hexDistance(h,g)));
const stats=values=>{const a=[...values].sort((a,b)=>a-b);return {n:a.length,min:a[0]??null,median:a.length?(a[Math.floor((a.length-1)/2)]+a[Math.floor(a.length/2)])/2:null,mean:a.length?a.reduce((s,n)=>s+n,0)/a.length:null,max:a.at(-1)??null,p95:a.length?a[Math.ceil(a.length*.95)-1]:null};};
function snapshot(state){
 const units=Object.values(state.units).filter(u=>u.side==='GERMAN').map(u=>({id:u.id,alive:u.alive,hex:u.hex,distance:distance(u.hex),step:u.step})).sort((a,b)=>a.id.localeCompare(b.id)),alive=units.filter(u=>u.alive),distribution=alive.map(u=>u.distance).sort((a,b)=>a-b);
 const cities=Object.values(state.hexes).filter(h=>h.cityId||['CITY','MAIN_CITY','OUTER_CITY'].includes(h.terrain)).map(h=>({hex:h.coord,control:h.control,terrain:h.terrain,occupants:Object.values(state.units).filter(u=>u.alive&&hexKey(u.hex)===hexKey(h.coord)).map(u=>({id:u.id,side:u.side}))}));
 return {turn:state.turn,phase:state.phase,units,dead:units.filter(u=>!u.alive).map(u=>u.id),distribution,statistics:stats(distribution),distanceHistogram:Object.fromEntries([...new Set(distribution)].map(d=>[d,distribution.filter(x=>x===d).length])),fixed:config.fixedUnits.map(id=>units.find(u=>u.id===id)??{id,unknown:true}),cities,cityCounts:{germanOccupied:cities.filter(c=>c.occupants.some(u=>u.side==='GERMAN')).length,germanControlled:cities.filter(c=>c.control==='GERMAN').length,sovietOccupied:cities.filter(c=>c.occupants.some(u=>u.side==='SOVIET')).length,total:cities.length},capitalControlled:defaultScenario.capitalCoreHexes.filter(h=>state.hexes[hexKey(h)]?.control==='GERMAN').length};
}
function attacks(input,unitId){
 const v=structuredClone(input);v.view.phase='GERMAN_COMBAT';v.view.pendingDecision=null;
 return observationCandidates(v).filter(a=>a.type==='ATTACK'&&a.attackerUnitIds.includes(unitId)).map(intent=>({intent,score:scoreIntent(v,intent)})).filter(a=>Number.isFinite(a.score));
}
for(const seed of config.seeds)for(const version of ['019']){
 const dir=version==='014'?`evidence/ai-advance-014/batch/development-${seed}-experiment-GERMAN`:`${out}/batch/development-${seed}-experiment-GERMAN`,record=JSON.parse(readFileSync(dir+'/record.json')),rows=records(dir+'/trace.ndjson');assert.equal(record.integrity,'PASS');assert.equal(hash(readFileSync(dir+'/trace.ndjson')),record.traceFileHash);assert.equal(hash(rows),record.traceHash);assert(rows.every((r,i)=>r.n===i));
 const host=new FairHost({matchId:record.job.id,initialState:initial(seed),rules:defaultRules,scenario:defaultScenario,agentSeeds:config.agentSeeds}),turns=[],adjacentMoves=[],movementEnds=[];let previousTurn=1;
 for(const row of rows){
  let inputAt=null,moveAudit=null;
  const agent=input=>{
   inputAt=input;assert.equal(input.observationKey,row.observationKey);if(row.inputHash)assert.equal(hash(input),row.inputHash);
   const a=row.choice?.intent;
   if(row.side==='GERMAN'&&row.phase==='GERMAN_MOVEMENT'&&a?.type==='MOVE'){
    const u=input.view.units.find(u=>u.id===a.unitId),enemies=input.view.units.filter(e=>e.side!=='GERMAN'),adj=enemies.filter(e=>hexDistance(u.hex,e.hex)===1);
    if(adj.length)moveAudit={n:row.n,turn:row.turn,unitId:u.id,from:u.hex,to:a.path.at(-1),path:a.path,distanceBefore:distance(u.hex),proposedDistanceAfter:distance(a.path.at(-1)),adjacentBefore:adj.map(e=>({id:e.id,hex:e.hex})),inputHash:hash(input),qualifyingAttacksBefore:attacks(input,u.id),status:row.result.status};
   }
   return row.choice;
  };
  assert.deepEqual(host.step({GERMAN:agent,SOVIET:agent}),row.result);
  if(moveAudit){
   const after=host.observe(inputAt.scope.controllerId),u=after.view.units.find(u=>u.id===moveAudit.unitId),beforeTargets=new Set(moveAudit.qualifyingAttacksBefore.map(a=>hexKey(a.intent.target)));
   moveAudit.qualifyingAttacksAfter=attacks(after,u.id);moveAudit.adjacentAfter=after.view.units.filter(e=>e.side!=='GERMAN'&&hexDistance(u.hex,e.hex)===1).map(e=>({id:e.id,hex:e.hex}));moveAudit.actualHex=u.hex;moveAudit.actualDistanceAfter=distance(u.hex);const afterTargets=new Set(moveAudit.qualifyingAttacksAfter.map(a=>hexKey(a.intent.target)));moveAudit.lostQualifyingTargets=[...beforeTargets].filter(k=>!afterTargets.has(k));moveAudit.gainedQualifyingTargets=[...afterTargets].filter(k=>!beforeTargets.has(k));adjacentMoves.push(moveAudit);
  }
  if(row.side==='GERMAN'&&row.phase==='GERMAN_MOVEMENT'&&row.choice?.intent?.type==='READY_FOR_PHASE_END'&&row.result.status==='ACCEPTED')movementEnds.push({n:row.n,turn:row.turn,...snapshot(host.auditOmniscient())});
  const end=host.auditOmniscient();if(end.turn!==previousTurn||end.phase==='GAME_OVER'&&row.choice){turns.push({completedTurn:previousTurn,n:row.n,...snapshot(end)});previousTurn=end.turn;}
 }
 const state=host.auditOmniscient();assert.equal(hash(state),record.finalHash);
 for(const m of adjacentMoves){m.actualLaterAttacks=rows.filter(r=>r.turn===m.turn&&r.n>m.n&&r.side==='GERMAN'&&r.choice?.intent?.type==='ATTACK'&&r.choice.intent.attackerUnitIds.includes(m.unitId)).map(r=>({n:r.n,intent:r.choice.intent,status:r.result.status}));m.lostTargetAttackedByOthers=rows.filter(r=>r.turn===m.turn&&r.n>m.n&&r.choice?.intent?.type==='ATTACK'&&m.lostQualifyingTargets.includes(hexKey(r.choice.intent.target))).map(r=>({n:r.n,intent:r.choice.intent,status:r.result.status}));}
 const movementRows=rows.filter(r=>r.movementProbe),offers=movementRows.flatMap(r=>r.movementProbe.newAdjacent.map(a=>({n:r.n,turn:r.turn,...a}))),uniqueOffers=new Set(offers.map(a=>`${a.turn}:${a.prefix.unitId}:${JSON.stringify(a.prefix.path)}`)),accepted=adjacentMoves.filter(m=>m.status==='ACCEPTED');
 const result={seed,version,source:dir,finalHash:record.finalHash,traceFileHash:record.traceFileHash,status:record.status,winner:record.winner,turn:record.turn,elapsedMs:record.elapsedMs,sides:record.metrics.sides,rejected:record.metrics.rejected,adjacentMoves,turns,movementEnds,final:snapshot(state),mobility:{offeredDecisionWindows:movementRows.filter(r=>r.movementProbe.newAdjacent.length).length,finiteFirstHopOffers:offers.length,uniqueUnitTurnPathOffers:uniqueOffers.size,acceptedMoves:accepted.length,rejectedMoves:adjacentMoves.length-accepted.length,closer:accepted.filter(m=>m.actualDistanceAfter<m.distanceBefore).length,equal:accepted.filter(m=>m.actualDistanceAfter===m.distanceBefore).length,farther:accepted.filter(m=>m.actualDistanceAfter>m.distanceBefore).length,lostAttackTargetMoves:accepted.filter(m=>m.lostQualifyingTargets.length).length,lostAttackTargetIncidences:accepted.reduce((n,m)=>n+m.lostQualifyingTargets.length,0),laterAttackedMoves:accepted.filter(m=>m.actualLaterAttacks.some(a=>a.status==='ACCEPTED')).length},cost:version==='019'?{movementDecisions:movementRows.length,policyMs:stats(movementRows.map(r=>r.policyMs)),expanded:stats(movementRows.map(r=>r.movementProbe.newMetrics.expanded)),expandedTotal:movementRows.reduce((n,r)=>n+r.movementProbe.newMetrics.expanded,0),oldExpandedOnSameViewsTotal:movementRows.reduce((n,r)=>n+r.movementProbe.oldMetrics.expanded,0),exhaustedDecisions:movementRows.filter(r=>r.movementProbe.newMetrics.exhausted).length,diagnosticMs:stats(movementRows.map(r=>r.movementProbe.diagnosticMs))}:null};
 atomic(`${out}/${seed}-${version}-audit.json`,result);results.push(result);console.log(JSON.stringify({seed,version,status:result.status,mobility:result.mobility,final:result.final.statistics,cities:result.final.cityCounts,sides:result.sides,cost:result.cost}));
}
atomic(out+'/summary.json',{task:'AI-ATTACK-RESERVE-019',classification:config.classification,newGames:2,games:results.map(({adjacentMoves,turns,movementEnds,final,...x})=>({...x,final:{statistics:final.statistics,distribution:final.distribution,fixed:final.fixed,cityCounts:final.cityCounts,capitalControlled:final.capitalControlled}})),limitations:['Historical014 timing includes different instrumentation; not a speed benchmark.','Positive attack-score target losses are a visibility/heuristic proxy, not proof of foregone favorable legal combat. No counterfactual dice rolled.','Matched seeds cease to be matched battle dice after diverging action consumption.','All German alive units form each distribution; dead IDs are listed separately; fixed units are tracked even if destroyed.']});
let md='# AI-ATTACK-RESERVE-019 开发对照\n\n014为既有记录，017各新跑一局；均非留出验证。损失为损步/消灭数。距离为活着德军单位到首都核心的最近六角距离；分布和全单位轨迹见各audit.json。\n\n| 种子/版 | 邻敌MOVE接受/拒绝 | 距离 最近/中位/均值 | 城格占领/控制；首都控制 | 德损失 | 苏损失 | 全局拒绝 | 自然终局 |\n|---|---|---|---|---|---|---|---|\n';
for(const r of results){const s=r.final.statistics,g=r.sides.GERMAN,v=r.sides.SOVIET;md+=`| ${r.seed}/${r.version} | ${r.mobility.acceptedMoves}/${r.mobility.rejectedMoves} | ${s.min}/${s.median}/${s.mean.toFixed(2)} | ${r.final.cityCounts.germanOccupied}/${r.final.cityCounts.germanControlled}；${r.final.capitalControlled} | ${g.lossSteps}/${g.destroyedUnits} | ${v.lossSteps}/${v.destroyedUnits} | ${g.rejections+v.rejections} | ${r.status} T${r.turn} ${r.winner} |\n`;}
md+='\n| 种子/版 | PZ04终距 | PZ01终距 | MOT03终距 | J02终距 | 活单位距离排序 |\n|---|---|---|---|---|---|\n';for(const r of results)md+=`| ${r.seed}/${r.version} | ${r.final.fixed.map(u=>u.alive?u.distance:'死亡').join(' | ')} | ${r.final.distribution.join(',')} |\n`;
md+='\n| 种子017 | 邻敌可选窗口/独立单位回合路径 | 已接受近/平/远 | 丢失正评分攻击目标的移动/目标次数 | 搜索展开总数/同视图014 | 每决策策略ms均值/P95/最大 |\n|---|---|---|---|---|---|\n';for(const r of results.filter(r=>r.version==='019')){const m=r.mobility,c=r.cost;md+=`| ${r.seed} | ${m.offeredDecisionWindows}/${m.uniqueUnitTurnPathOffers} | ${m.closer}/${m.equal}/${m.farther} | ${m.lostAttackTargetMoves}/${m.lostAttackTargetIncidences} | ${c.expandedTotal}/${c.oldExpandedOnSameViewsTotal} | ${c.policyMs.mean.toFixed(3)}/${c.policyMs.p95.toFixed(3)}/${c.policyMs.max.toFixed(3)} |\n`;}
md+='\n逐回合距离（最近/中位/均值；每回合结束）：\n\n| T | 1017/014 | 1017/017 | 1018/014 | 1018/017 |\n|---|---|---|---|---|\n';for(let t=1;t<=16;t++)md+=`| ${t} | ${results.map(r=>{const s=r.turns.find(x=>x.completedTurn===t)?.statistics;return s?`${s.min}/${s.median}/${s.mean.toFixed(2)}`:'—';}).join(' | ')} |\n`;
writeFileSync(out+'/comparison.md',md);

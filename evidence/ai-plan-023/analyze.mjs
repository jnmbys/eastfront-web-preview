// Privileged offline replay only. Never imported by the planner or supplied to a policy.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initial} from '../../ai/lab/match.mjs';
import {hash,atomic} from '../../ai/lab/common.mjs';
import {records} from '../../ai/lab/runner.mjs';
import {RulesEngine,defaultRules,defaultScenario} from '../../.ai-dist/vendor/eastfront-digital-core/dist/index.js';
import {hexDistance,hexKey,getNeighbors} from '../../.ai-dist/vendor/eastfront-digital-core/dist/core/hex.js';
import {toCoreAction} from '../../.ai-dist/src/multiplayer/gameplayProtocol.js';
import {getUnitStats} from '../../.ai-dist/vendor/eastfront-digital-core/dist/rules/unit.js';
const distance=h=>Math.min(...defaultScenario.capitalCoreHexes.map(g=>hexDistance(h,g)));
const mean=a=>a.length?a.reduce((n,x)=>n+x,0)/a.length:null;
export function analyze(seed,rows,expected,referenceGroups=[]){
 let state=initial(seed);const engine=new RulesEngine(defaultRules,defaultScenario),army=[],groups=[],changes=[],waiting=[],moves={GERMAN:0,SOVIET:0};let current=null,lastPlan=null;
 const snapshot=(ids=Object.values(state.units).filter(u=>u.side==='GERMAN').map(u=>u.id))=>ids.map(id=>{const u=state.units[id];return {id,alive:!!u?.alive,hex:u?.hex??null,distance:u?.alive?distance(u.hex):null,hasMoved:u?.hasMoved??null};});
 const summary=()=>{const units=snapshot().filter(u=>u.alive),d=units.map(u=>u.distance);return {alive:units.length,mean:mean(d),nearest:d.length?Math.min(...d):null};};
 const wait=()=>{const units=Object.values(state.units).filter(u=>u.alive&&u.side==='GERMAN'),count=new Map();for(const u of units)count.set(hexKey(u.hex),(count.get(hexKey(u.hex))??0)+1);
  const eligible=units.filter(u=>!u.hasMoved&&!u.dedicatedRailRepair&&u.type!=='ARTILLERY'&&getUnitStats(u,defaultRules).movement-(u.supplyState==='OUT_OF_SUPPLY'?defaultRules.supply.oosMovementPenalty:0)>=3);
  return {turn:state.turn,unmovedEligible:eligible.length,unmovedIds:eligible.map(u=>u.id),friendlyCongestedIds:eligible.filter(u=>{const cells=getNeighbors(u.hex).filter(h=>{const c=state.hexes[hexKey(h)];return c&&defaultRules.terrain[c.terrain].movementCost!=='IMPASSABLE';});return cells.length>0&&cells.every(h=>(count.get(hexKey(h))??0)>=defaultRules.stackingLimit);}).map(u=>u.id)};};
 const finishGroup=n=>{if(current){current.endN=n;current.end=snapshot(current.unitIds);current.endArmy=summary();current=null;}lastPlan=null;};
 for(const row of rows){
  if(state.phase==='GERMAN_MOVEMENT'){
   if(!army.some(x=>x.turn===state.turn&&x.when==='movementStart'))army.push({turn:state.turn,when:'movementStart',...summary()});
   const p=row.plan??null;
   if(p&&!current){current={turn:state.turn,startN:row.n,unitIds:[...p.unitIds],goals:p.goals,start:snapshot(p.unitIds),startArmy:summary()};groups.push(current);}
   if(JSON.stringify(p)!==JSON.stringify(lastPlan)){changes.push({n:row.n,turn:state.turn,from:lastPlan,to:p});lastPlan=p;}
   if(row.choice?.intent?.type==='READY_FOR_PHASE_END'){waiting.push(wait());army.push({turn:state.turn,when:'movementEnd',...summary()});finishGroup(row.n);}
  }
  for(const ref of referenceGroups)if(ref.turn===row.turn&&row.phase==='GERMAN_MOVEMENT'){
   let g=groups.find(x=>x.referenceStartN===ref.startN);if(!g){g={turn:ref.turn,referenceStartN:ref.startN,unitIds:ref.unitIds,start:snapshot(ref.unitIds),end:null};groups.push(g);}g.end=snapshot(ref.unitIds);
  }
  if(row.choice?.kind!=='INTENT'||!['ACCEPTED','GAME_OVER','INTEGRITY_FAILURE'].includes(row.result.status))continue;
  const r=engine.apply(state,toCoreAction(row.choice.intent,row.controllerId));assert(r.accepted,'offline replay '+row.n);state=r.state;
  if(row.choice.intent.type==='MOVE')moves[row.side]++;
  if(current){current.samples??=[];current.samples.push({n:row.n,members:snapshot(current.unitIds)});}
 }
 finishGroup(rows.at(-1)?.n??null);assert.equal(hash(state),expected);
 const impactRows=rows.filter(r=>r.planImpact);
 return {final:summary(),army,groups,changes,waiting,moves,impact:{plannedDecisions:impactRows.length,changedChoices:impactRows.filter(r=>r.planImpact.choiceChanged).length,chosenMoveAbsentFromOldMenu:impactRows.filter(r=>r.planImpact.chosenMoveAbsentFromOldMenu).length,groupMenuChanged:impactRows.filter(r=>r.planImpact.groupMenuChanged).length},turnLimitReached:state.turn>=defaultScenario.turnLimit,turn:state.turn,finalHash:hash(state)};
}
export function comparison(out,config,persist=true){
 const games=config.seeds.map((seed,i)=>{const candidateDir=`${out}/batch/development-${seed}-candidate-GERMAN`,candidateRecord=JSON.parse(readFileSync(candidateDir+'/record.json')),baseDir=config.baselineLogs[i],baseRecord=JSON.parse(readFileSync(baseDir+'/record.json'));
  const candidate=analyze(seed,records(candidateDir+'/trace.ndjson'),candidateRecord.finalHash),baseline=analyze(seed,records(baseDir+'/trace.ndjson'),baseRecord.finalHash,candidate.groups);
  return {seed,candidate,baseline,candidateSides:candidateRecord.metrics.sides,baselineSides:baseRecord.metrics.sides,capitalControl:{candidate:candidateRecord.metrics.objectiveProgress,baseline:baseRecord.metrics.objectiveProgress},status:{candidate:candidateRecord.status,baseline:baseRecord.status},delta:{mean:candidate.final.mean-baseline.final.mean,nearest:candidate.final.nearest-baseline.final.nearest},warning:'After divergence the combat dice are not paired. Reference cohort IDs compared at corresponding movement phase ends; no individual battle causal claim.'};});
 if(persist)atomic(out+'/comparison.json',{games,researchOnly:true,retain014:games.some(g=>g.delta.mean>0||g.delta.nearest>0)||!games.every(g=>g.delta.mean<0||g.delta.nearest<0)});return games;
}

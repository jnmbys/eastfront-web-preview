import type {ActionResult} from '../src/core-adapter/core.js';
import {SUMMARY_LIMIT,CONSEQUENCE_LIMIT,type BattleSummary,type BattleSummaries} from '../src/multiplayer/battleSummary.js';
import type {MatchSession} from './match.js';
/** Record at acceptance time, never re-project old consequences using present visibility.
 * Conservative permanent ledger: own units only. Opponent routes/identity/strength and
 * support breakdown are deliberately omitted even if momentarily visible on the map. */
export function recordBattleSummaries(match:MatchSession,result:ActionResult):void {
 const affected=new Set(result.events.flatMap(e=>'battleId' in e?[e.battleId,...('sourceBattleId' in e&&e.sourceBattleId?[e.sourceBattleId]:[])]:[]));
 for(const a of match.controllerAssignments){
  const archive=match.battleSummaries[a.controllerId]!;
  for(const battleId of affected){
   const tx=result.state.combatTransactions[battleId];
   if(!tx?.resolution||!match.disclosedBattles[a.controllerId]?.has(battleId)||![tx.attackerSide,tx.defenderSide].includes(a.viewer))continue;
   const old=archive.entries.get(battleId),consequences=structuredClone(old?.consequences??[]);
   let truncated=old?.truncated??false;
   for(const e of result.events){
    if(!('battleId' in e)||e.battleId!==battleId||!('unitId' in e)||result.state.units[e.unitId]?.side!==a.viewer)continue;
    let fact:BattleSummary['consequences'][number]|undefined;
    if(e.type==='UnitStepLost')fact={kind:'loss',unitId:e.unitId,steps:1};
    if(e.type==='UnitRetreated'||e.type==='UnitAdvanced'||e.type==='UnitBrokeThrough')fact={kind:e.type==='UnitRetreated'?'retreat':e.type==='UnitAdvanced'?'advance':'breakthrough',unitId:e.unitId,from:{...e.from},to:{...e.to}};
    if(fact){if(consequences.length<CONSEQUENCE_LIMIT)consequences.push(fact);else truncated=true;}
   }
   const context=tx.context;
   archive.entries.set(battleId,{battleId,revision:match.matchRevision,stage:tx.stage,targetHex:{...tx.targetHex},resolution:structuredClone(tx.resolution),
    context:context?{baseOdds:context.baseOdds,finalShift:context.finalShift,finalCRTColumnLabel:context.finalCRTColumnLabel}:null,
    pending:result.state.pendingDecision?.battleId===battleId?result.state.pendingDecision.kind:null,consequences,truncated});
   while(archive.entries.size>SUMMARY_LIMIT){archive.entries.delete(archive.entries.keys().next().value!);archive.olderOmitted=true;}
  }
 }
}
export function battleSummaries(match:MatchSession,controllerId:string):BattleSummaries {
 const a=match.controllerAssignments.find(a=>a.controllerId===controllerId);
 if(!a)throw new Error('No assignment');
 const archive=match.battleSummaries[controllerId]!;
 return {matchId:match.matchId,viewerControllerId:a.coreControllerId,entries:structuredClone([...archive.entries.values()]),olderOmitted:archive.olderOmitted};
}

// Replay only archived choices. Policies are called solely for named, frozen-node checks.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {hash,atomic} from '../../ai/lab/common.mjs';
import {initial} from '../../ai/lab/match.mjs';
import {records} from '../../ai/lab/runner.mjs';
import {FairHost} from '../../.ai-dist/ai/authority/FairHost.js';
import {basicAgent as candidate,scoreIntent as candidateScore} from '../../.ai-dist/ai/fair/basicAgent.js';
import {basicAgent as baseline,scoreIntent as baselineScore} from '../../.evaluation/baseline/.ai-dist/ai/fair/basicAgent.js';
import {basicAgent as opponent,scoreIntent as opponentScore} from '../../.evaluation/ai005/.ai-dist/ai/fair/basicAgent.js';
import {createMoveScorer} from '../../.ai-dist/ai/fair/routing.js';
import {observationCandidates} from '../../.ai-dist/ai/fair/candidates.js';
import {observationCandidates as oldCandidates} from '../../.evaluation/ai005/.ai-dist/ai/fair/candidates.js';
import {defaultRules,defaultScenario,RulesEngine} from '../../.ai-dist/vendor/eastfront-digital-core/dist/index.js';
import {hexDistance,hexKey,getNeighbors} from '../../.ai-dist/vendor/eastfront-digital-core/dist/core/hex.js';
import {validateMoveAction} from '../../.ai-dist/vendor/eastfront-digital-core/dist/rules/movement.js';
import {toCoreAction} from '../../.ai-dist/src/multiplayer/gameplayProtocol.js';
const out='evidence/ai-advance-audit-013';mkdirSync(out+'/nodes',{recursive:true});
const selected={baseline:[156,161,181,189,198,200,224,225],candidate:[156,161,190,199,219,220]};
const focus=['G-MOT-03','G-PZ-04','G-REC-02'];
const distance=h=>Math.min(...defaultScenario.capitalCoreHexes.map(g=>hexDistance(h,g)));
const finite=x=>Number.isFinite(x)?x:String(x);
const reports={};
for(const version of ['baseline','candidate']){
 const id='holdout-1017-'+version+'-GERMAN',rows=records('evidence/ai-eval-012/batch/'+id+'/trace.ndjson'),rec=JSON.parse(readFileSync('evidence/ai-eval-012/batch/'+id+'/record.json'));
 const host=new FairHost({matchId:id,initialState:initial(1017),rules:defaultRules,scenario:defaultScenario,agentSeeds:{GERMAN:101,SOVIET:202}}),checks=[];let callbacks=0;
 for(const row of rows){
  const checkInput=input=>{
   callbacks++;assert.equal(input.observationKey,row.observationKey,version+' n'+row.n);assert.equal(input.scope.controllerId,row.controllerId);assert.equal(input.view.turn,row.turn);assert.equal(input.view.phase,row.phase);
   if(selected[version].includes(row.n)){
    // Host's full audit is a separate offline object; policy only receives its original DTO.
    const state=host.auditOmniscient(),before=hash(input),policy=row.side==='SOVIET'?opponent:version==='baseline'?baseline:candidate;
    const actualPolicy=policy(input);assert.deepEqual(actualPolicy,row.choice,version+' policy n'+row.n);assert.equal(hash(input),before);
    const enemies=input.view.units.filter(u=>u.side!==row.side),isOpponent=row.side==='SOVIET',candidates=isOpponent?oldCandidates(input):observationCandidates(input,false);
    const own=input.view.units.filter(u=>u.side===row.side&&'friendly' in u);
    const key=version+'-n'+row.n,details={key,n:row.n,traceLine:row.n+1,turn:row.turn,phase:row.phase,side:row.side,observationKey:input.observationKey,inputHash:hash(input),stateHash:hash(state),choice:row.choice,policyReproduced:true,random:state.random,visibleEnemies:enemies.map(u=>({id:u.id,hex:u.hex,type:u.type,stats:u.stats,step:u.step,supplyState:u.supplyState})),contacts:input.view.contacts,objectives:input.rules.objectives,visibleEnemyCount:enemies.length,routeGoalMode:enemies.length?'safe cells adjacent to any identified enemy':'public objectives',candidateCount:candidates.length,focusedUnits:[]};
    if(row.side==='GERMAN'){
     for(const id of focus){const u=own.find(u=>u.id===id);if(!u)continue;
      const moves=createMoveScorer(input),neighbors=getNeighbors(u.hex).filter(h=>state.hexes[hexKey(h)]).map(h=>{const a={type:'MOVE',unitId:id,path:[h]},core=toCoreAction(a,input.scope.controllerId),validator=validateMoveAction(state,defaultRules,core);const admissible=observationCandidates(input).some(x=>JSON.stringify(x)===JSON.stringify(a));return {action:a,distance:distance(h),inPolicyCandidates:candidates.some(x=>JSON.stringify(x)===JSON.stringify(a)),hostCandidate:admissible,policyScore:finite(moves.score(a)),offlineCore:validator};});
      const attacks=candidates.filter(a=>a.type==='ATTACK'&&a.attackerUnitIds.includes(id)).map(a=>({action:a,score:finite((version==='baseline'?baselineScore:candidateScore)(input,a))}));
      details.focusedUnits.push({unit:u,capitalDistance:distance(u.hex),normalMovePhase:row.phase==='GERMAN_MOVEMENT'&&!input.view.pendingDecision,baseMP:Math.max(0,u.stats.movement-(u.supplyState==='OUT_OF_SUPPLY'?input.rules.oosMovementPenalty:0)),baseMPIsNotReusablePool:true,adjacentVisibleEnemies:enemies.filter(e=>hexDistance(u.hex,e.hex)<=1).map(e=>({id:e.id,hex:e.hex,type:e.type,stats:e.stats})),neighbors,attacks});
     }
     if(input.view.pendingDecision?.kind==='ADVANCE_AFTER_COMBAT'){
      const attack=input.history.findLast(h=>h.outcome==='ACCEPTED'&&h.intent?.type==='ATTACK')?.intent,target=attack?.target;
      details.advance={pending:input.view.pendingDecision,target,baselineChoice:baseline(input),candidateChoice:candidate(input),visibleEnemiesAdjacentToDestination:target?enemies.filter(e=>hexDistance(target,e.hex)<=1).map(e=>({id:e.id,hex:e.hex,type:e.type})):[],options:input.view.pendingDecision.eligibleUnitIds.map(id=>{const u=own.find(u=>u.id===id);return {id,from:u?.hex,progress:u&&target?distance(u.hex)-distance(target):null,safeDestination:!!target&&createMoveScorer(input).safeDestination(id,target)};})};
     }
    }else{
     const ids=['S-ART-01','S-I-07','S-I-12','S-TK-03'];
     details.opponentChoices=ids.map(id=>{const u=own.find(u=>u.id===id);return {id,unit:u,adjacentVisibleEnemies:u?enemies.filter(e=>hexDistance(e.hex,u.hex)<=1).map(e=>({id:e.id,hex:e.hex})):[],proposals:candidates.filter(a=>a.unitId===id).map(a=>({action:a,score:finite(opponentScore(input,a))}))};});
    }
    atomic(out+'/nodes/'+key+'-input.json',input);atomic(out+'/nodes/'+key+'-state.json',state);atomic(out+'/nodes/'+key+'-check.json',details);checks.push(details);
   }
   return row.choice;
  };
  const result=host.step({GERMAN:checkInput,SOVIET:checkInput});assert.deepEqual(result,row.result,version+' host n'+row.n);
 }
 assert.equal(hash(host.auditOmniscient()),rec.finalHash);assert.equal(callbacks,rows.filter(r=>r.choice).length);
 reports[version]={replayedRows:rows.length,allObservationKeysAndResultsMatched:true,finalHash:rec.finalHash,checks:checks.map(x=>({key:x.key,n:x.n,turn:x.turn,phase:x.phase,visibleEnemyCount:x.visibleEnemyCount,routeGoalMode:x.routeGoalMode,choice:x.choice,focusedUnits:x.focusedUnits.map(u=>({id:u.unit.id,hex:u.unit.hex,hasMoved:u.unit.friendly.hasMoved,baseMP:u.baseMP,adjacent:u.adjacentVisibleEnemies.map(e=>e.id),finiteMoves:u.neighbors.filter(n=>Number.isFinite(Number(n.policyScore))).length,legalNeighborMoves:u.neighbors.filter(n=>!n.offlineCore.issues.length).map(n=>n.action.path[0])})),advance:x.advance}))};
 console.log(version+': all saved choices, observations and Host outcomes replayed; only '+checks.length+' frozen nodes evaluated');
}
atomic(out+'/decision-checks.json',reports);

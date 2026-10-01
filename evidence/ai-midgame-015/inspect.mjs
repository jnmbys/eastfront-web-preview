// Representative frozen-state route checks. No search result enters any policy.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {RulesEngine,defaultRules,defaultScenario} from '../../.ai-dist/vendor/eastfront-digital-core/dist/index.js';
import {validateMoveAction,movementStepCost} from '../../.ai-dist/vendor/eastfront-digital-core/dist/rules/movement.js';
import {getUnitStats} from '../../.ai-dist/vendor/eastfront-digital-core/dist/rules/unit.js';
import {hexDistance,hexKey,getNeighbors} from '../../.ai-dist/vendor/eastfront-digital-core/dist/core/hex.js';
import {toCoreAction} from '../../.ai-dist/src/multiplayer/gameplayProtocol.js';
import {hash,atomic} from '../../ai/lab/common.mjs';
const out='evidence/ai-midgame-015',index=JSON.parse(readFileSync(out+'/checkpoint-index.json')),buffer=readFileSync(out+'/checkpoints.json.gz');assert.equal(hash(buffer),index.archive.sha256);
const {checkpoints}=JSON.parse(gunzipSync(buffer)),decisions=JSON.parse(readFileSync(out+'/decisions.json'));
const dist=h=>Math.min(...defaultScenario.capitalCoreHexes.map(g=>hexDistance(h,g))),engine=new RulesEngine(defaultRules,defaultScenario);
const coreCheck=(cp,intent)=>{const before=hash(cp.state),result=engine.apply(cp.state,toCoreAction(intent,cp.input.scope.controllerId));assert.equal(hash(cp.state),before);assert.deepEqual(result.state.random,cp.state.random);return {intent,accepted:result.accepted,issues:result.issues,events:result.events,finalUnit:result.state.units[intent.unitId]?.hex,move:validateMoveAction(cp.state,defaultRules,toCoreAction(intent,cp.input.scope.controllerId))};};
const examples=[];
for(const [n,id,path] of [
 [383,'G-I-08',[{q:11,r:5},{q:11,r:6}]],
 [384,'G-I-06',[{q:8,r:-2},{q:9,r:-2}]],
 [388,'G-ENG-02',[{q:6,r:13}]],
 [389,'G-MOT-03',[{q:14,r:0}]],
 [389,'G-ART-01',[{q:1,r:16}]],
 [389,'G-REC-02',[{q:14,r:-1}]],
 [373,'G-I-04',[{q:10,r:1}]],
 [381,'G-I-04',[{q:10,r:1}]],
 ]){
 const cp=checkpoints.find(c=>c.n===n),d=decisions.find(d=>d.n===n),intent={type:'MOVE',unitId:id,path};
 examples.push({n,unitId:id,inputHash:hash(cp.input),stateHash:hash(cp.state),actualChoice:d.choice,targetField:'UNKNOWN: original trace records MOVE path, no strategic target',inHostCandidates:d.offlineCoreCandidates.some(c=>JSON.stringify(c.intent)===JSON.stringify(intent)),firstStepScore:d.candidateScores.find(c=>JSON.stringify(c.intent)===JSON.stringify({...intent,path:path.slice(0,1)}))??null,from:cp.state.units[id].hex,distanceBefore:dist(cp.state.units[id].hex),distanceAfter:dist(path.at(-1)),offlineEngine:coreCheck(cp,intent)});
}
const searches=[];
for(const [n,id] of [[373,'G-J-02'],[389,'G-J-02'],[389,'G-MOT-02'],[389,'G-PZ-01'],[389,'G-PZ-04']]){
 const cp=checkpoints.find(c=>c.n===n),state=cp.state,u=state.units[id],stats=getUnitStats(u,defaultRules),base=Math.max(0,stats.movement-(u.supplyState==='OUT_OF_SUPPLY'?defaultRules.supply.oosMovementPenalty:0));
 assert.equal(defaultRules.road.wholeMoveBonusEnabled,false); // fixed audited configuration
 const maxDepth=Math.min(7,base),cap=10000;let tested=0,hitCap=false,found=null;const issues={};
 // Full path validation, never one MOVE per step. Stacking is destination-only
 // in this Core: a full intermediate friendly hex MUST NOT prune continuation.
 const queue=[[]];let cursor=0;
 while(cursor<queue.length&&!found){const path=queue[cursor++],from=path.at(-1)??u.hex;if(path.length>=maxDepth)continue;
  for(const to of getNeighbors(from)){
   if(!state.hexes[hexKey(to)]||hexKey(to)===hexKey(u.hex)||path.some(h=>hexKey(h)===hexKey(to)))continue;
   if(tested>=cap){hitCap=true;break;}
   const step=movementStepCost(state,defaultRules,u,from,to);assert(!Number.isFinite(step.total)||step.total>=1);
   const next=[...path,to],intent={type:'MOVE',unitId:id,path:next},v=validateMoveAction(state,defaultRules,toCoreAction(intent,cp.input.scope.controllerId));tested++;
   for(const i of v.issues)issues[i.code]=(issues[i.code]??0)+1;
   if(!v.issues.length&&dist(to)<dist(u.hex)){const full=coreCheck(cp,intent);assert(full.accepted);found=full;break;}
   if(!v.issues.some(i=>i.code!=='STACKING_LIMIT')&&next.length<maxDepth)queue.push(next);
  }
  if(hitCap)break;
 }
 const six=getNeighbors(u.hex).filter(h=>state.hexes[hexKey(h)]).map(h=>({to:h,issues:validateMoveAction(state,defaultRules,toCoreAction({type:'MOVE',unitId:id,path:[h]},cp.input.scope.controllerId)).issues.map(i=>i.code)}));
 const immobileFirstStepProof=six.length===6&&six.every(x=>x.issues.some(c=>['ENEMY_OCCUPIED_HEX','ENEMY_ZOC_TO_ZOC','IMPASSABLE_TERRAIN'].includes(c)));
 searches.push({n,unitId:id,stateHash:hash(state),inputHash:hash(cp.input),from:u.hex,distance:dist(u.hex),baseMP:base,scope:{maxDepth,maxPathChecks:cap,noRepeatedHexes:true,allBoardNeighbors:true,staticOtherUnits:true,forwardDefinition:'endpoint distance strictly below start; intermediate steps may stay level or retreat',notCovered:['simultaneous/reordered other-unit moves','other phases/turns','non-MOVE actions','cycles','routes over depth or node cap'],prefixPruning:'Only discard irreversible Core movement issues; STACKING_LIMIT alone is not pruned. Road bonus disabled, step cost >=1.'},tested,hitCap,stoppedAtFirstForwardWitness:!!found,exhaustedWithinScope:!found&&!hitCap,prunedIssueCounts:issues,firstSteps:six,immobileFirstStepProof,witness:found,witnessInPlayerViewCandidates:found?decisions.find(d=>d.n===n).offlineCoreCandidates.some(c=>JSON.stringify(c.intent)===JSON.stringify(found.intent)):null});
}
atomic(out+'/representatives.json',{examples,searches});
console.log(JSON.stringify({examples:examples.map(e=>({n:e.n,id:e.unitId,accepted:e.offlineEngine.accepted,d:[e.distanceBefore,e.distanceAfter],hostCandidate:e.inHostCandidates})),searches:searches.map(s=>({n:s.n,id:s.unitId,tested:s.tested,cap:s.hitCap,proof:s.immobileFirstStepProof,witness:s.witness?.intent,accepted:s.witness?.accepted,hostCandidate:s.witnessInPlayerViewCandidates}))}));

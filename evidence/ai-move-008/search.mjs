// Offline diagnostic, PlayerView-only search. No authority imports or callbacks.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,unlinkSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {getNeighbors,hexDistance,hexKey} from '../../.ai-dist/vendor/eastfront-digital-core/dist/core/hex.js';
import {basicAgent} from '../../.ai-dist/ai/fair/basicAgent.js';
// Expose existing pure planner helpers in an ignored temporary copy, without changing them.
const tmp='.ai-dist/ai/fair/move008-routing.js';
let source=readFileSync('.ai-dist/ai/fair/routing.js','utf8');
const marker='return { score, prefix, metrics };';assert(source.includes(marker));
source=source.replace(marker,'return { score, prefix, metrics, safeCell, stepCost, plan, zoc };');
writeFileSync(tmp,source);
const {createMoveScorer,ROUTE_UNIT_LIMIT,ROUTE_DECISION_LIMIT,ROUTE_PATH_LIMIT}=await import('../../.ai-dist/ai/fair/move008-routing.js');
const out='evidence/ai-move-008';mkdirSync(out,{recursive:true});
export function search(input){
 const {view,rules}=input,original=structuredClone(input),goals=rules.objectives;
 assert(!rules.road.wholeMoveBonusEnabled,'This checkpoint search requires the recorded no-road-bonus rules.');
 const distance=h=>Math.min(...goals.map(g=>hexDistance(h,g)));
 const own=view.units.filter(u=>u.side===view.viewer&&u.friendly?.controllerId===input.scope.controllerId);
 const minimum=Math.min(...own.map(u=>distance(u.hex))),front=own.filter(u=>distance(u.hex)===minimum);
 let decisionExpanded=0;
 const results=[];
 for(const u of front){
  assert(!u.friendly.hasMoved&&!u.friendly.dedicatedRailRepair&&u.type!=='RECON');
  const planner=createMoveScorer(input),mp=Math.max(0,u.stats.movement-(u.supplyState==='OUT_OF_SUPPLY'?rules.oosMovementPenalty:0));
  const prefixes=[],improving=[],prunes={visited:0,safety:0,zocToZoc:0,budget:0,notRetreatFirst:0},metrics={expanded:0,exhausted:false,pathLimitHit:false,knownZocStops:0};
  const walk=(from,path,spent,visited)=>{
   if(metrics.expanded>=ROUTE_UNIT_LIMIT||decisionExpanded>=ROUTE_DECISION_LIMIT){metrics.exhausted=true;return;}
   metrics.expanded++;decisionExpanded++;
   if(path.length){
    const p={path,spentMP:spent,endDistance:distance(from),netProgress:distance(u.hex)-distance(from)};
    prefixes.push(p);if(p.netProgress>0)improving.push(p);
    if(planner.zoc.has(hexKey(from))){metrics.knownZocStops++;return;}
   }
   if(path.length>=ROUTE_PATH_LIMIT){metrics.pathLimitHit=true;return;}
   for(const next of getNeighbors(from).sort((a,b)=>hexKey(a).localeCompare(hexKey(b)))){
    const k=hexKey(next);
    if(visited.has(k)){prunes.visited++;continue;}
    // Counterfactual being tested: first step temporarily increases public capital distance.
    // No authoritative "unique exit" is provided to the search.
    if(!path.length&&distance(next)<=distance(u.hex)){prunes.notRetreatFirst++;continue;}
    if(!planner.safeCell(u,k)){prunes.safety++;continue;}
    if(planner.zoc.has(hexKey(from))&&planner.zoc.has(k)){prunes.zocToZoc++;continue;}
    const cost=planner.stepCost(u,from,next);assert(cost>0);
    if(spent+cost>mp){prunes.budget++;continue;}
    walk(next,[...path,next],spent+cost,new Set([...visited,k]));
   }
  };
  walk(u.hex,[],0,new Set([hexKey(u.hex)]));
  const oldPlan=planner.plan(u);
  const firstSteps=[...new Map(prefixes.map(p=>[hexKey(p.path[0]),p.path[0]])).values()].map(h=>({hex:h,capitalDistance:distance(h),oldScore:Number.isFinite(planner.score({type:'MOVE',unitId:u.id,path:[h]}))?planner.score({type:'MOVE',unitId:u.id,path:[h]}):'-Infinity',oldRoutePotential:oldPlan.distance.get(hexKey(h))??null}));
  results.push({unitId:u.id,from:u.hex,mp,startDistance:distance(u.hex),oldStartRoutePotential:oldPlan.distance.get(hexKey(u.hex))??null,oldGoalMode:'identified-enemy adjacency',firstSteps,metrics,prunes,prefixes,improving});
 }
 assert.deepEqual(input,original);
 return {limits:{unitExpanded:ROUTE_UNIT_LIMIT,decisionExpanded:ROUTE_DECISION_LIMIT,pathEdges:ROUTE_PATH_LIMIT},decisionExpanded,goalMetric:'minimum hex distance to public capital objectives',results};
}
export const cleanup=()=>unlinkSync(tmp);
if(resolve(process.argv[1])===fileURLToPath(import.meta.url)){
for(const seed of [17,18]){
 const input=JSON.parse(gunzipSync(readFileSync(`evidence/ai-move-007/seed-${seed}-input.json.gz`)));
 const before=JSON.parse(readFileSync(`evidence/ai-move-007/seed-${seed}-before.json`));
 assert.deepEqual(basicAgent(input),before.recordedChoice);
 const report=search(input);assert.deepEqual(search(structuredClone(input)),report);
 writeFileSync(`${out}/seed-${seed}-search.json`,JSON.stringify({seed,turn:before.turn,n:before.n,observationKey:input.observationKey,...report},null,2)+'\n');
 console.log(JSON.stringify({seed,units:report.results.map(({unitId,mp,metrics,prefixes,improving,firstSteps})=>({unitId,mp,metrics,prefixes:prefixes.length,improving:improving.length,firstSteps}))}));
}
cleanup();
}

// Replay recorded actions only. No policy execution, new match search or hidden-state metrics.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {FairHost} from '../../.ai-dist/ai/authority/FairHost.js';
import {defaultRules,defaultScenario} from '../../.ai-dist/vendor/eastfront-digital-core/dist/index.js';
import {hexDistance} from '../../.ai-dist/vendor/eastfront-digital-core/dist/core/hex.js';
import {observationCandidates} from '../../.ai-dist/ai/fair/index.js';
import {scoreIntent} from '../../.ai-dist/ai/fair/basicAgent.js';
import {parseParameters} from '../../.ai-dist/ai/fair/parameters.js';
import {initial} from '../../ai/lab/match.mjs';
import {hash,identity} from '../../ai/lab/common.mjs';
import {records} from '../../ai/lab/runner.mjs';
const results=[],build=identity();
const own=i=>i.view.units.filter(u=>u.side==='GERMAN');
const dist=(i,u)=>Math.min(...i.rules.objectives.map(h=>hexDistance(u.hex,h)));
function distance(i){const ds=own(i).map(u=>dist(i,u)).sort((a,b)=>a-b);return {units:ds.length,nearest:ds[0]??null,median:ds.length?(ds[Math.floor((ds.length-1)/2)]+ds[Math.floor(ds.length/2)])/2:null};}
function force(i){
 const g=own(i),e=i.view.units.filter(u=>u.side!=='GERMAN');
 const frontline=g.filter(u=>e.some(v=>hexDistance(u.hex,v.hex)<=1));
 const enemy=e.filter(u=>frontline.some(v=>hexDistance(u.hex,v.hex)<=1));
 const nearby=g.filter(u=>enemy.some(v=>hexDistance(u.hex,v.hex)<=2));
 return {adjacentGerman:frontline.length,nearbyGerman:nearby.length,visibleEnemy:enemy.length,germanAttack:nearby.reduce((s,u)=>s+u.stats.attack,0),enemyDefense:enemy.reduce((s,u)=>s+u.stats.defense,0),germanUnits:nearby.map(unit),enemyUnits:enemy.map(unit)};
}
function unit(u){return {id:u.id,type:u.type,hex:u.hex,step:u.step,attack:u.stats.attack,defense:u.stats.defense,supply:u.supplyState,hasMoved:u.friendly?.hasMoved,hasAttacked:u.friendly?.hasAttacked};}
for(const [seed,seat] of [[17,'GERMAN'],[18,'SOVIET']]){
 const source=`evidence/ai-lab-002/batch/tune-${seed}-${seat}/attempt-1/`,record=JSON.parse(readFileSync(source+'record.json')),trace=records(source+'trace.ndjson');
 assert.equal(hash(trace),record.traceHash);assert.equal(trace.length,record.decisions);assert.equal(build.runtimeHash,record.build.runtimeHash);
 const host=new FairHost({matchId:record.job.id,initialState:initial(seed),rules:defaultRules,scenario:defaultScenario,agentSeeds:{GERMAN:101,SOVIET:202}});
 const germanController=trace.find(r=>r.side==='GERMAN').controllerId;
 const turns=new Map(),opportunities=[];let previousEnd=null,lastTurn=null;
 const params=parseParameters(record.job.seats.GERMAN.params);
 for(const row of trace){
  const input=host.observe(row.controllerId);assert.equal(input.observationKey,row.observationKey);
  if(row.turn!==lastTurn){
   if(lastTurn!==null){const t=turns.get(lastTurn);t.end=distance(host.observe(germanController));t.delta=previousEnd?{nearest:t.end.nearest-previousEnd.nearest,median:t.end.median-previousEnd.median}:null;previousEnd=t.end;}
   lastTurn=row.turn;turns.set(row.turn,{turn:row.turn,moves:0,attacks:0,attackSelected:0,candidates:0,unique:new Set(),combatDecisions:0,opportunityDecisions:0,thresholdExcluded:0,peak:null,lastMove:null});
  }
  const t=turns.get(row.turn),a=row.choice.intent;
  if(row.side==='GERMAN'){
   const f=force(input);if(!t.peak||f.adjacentGerman>t.peak.adjacentGerman)t.peak={...f,n:row.n,phase:row.phase};
   if(!input.deployment&&!input.view.pendingDecision&&input.view.phase.endsWith('_COMBAT')){
    t.combatDecisions++;const attacks=observationCandidates(input).filter(a=>a.type==='ATTACK');t.candidates+=attacks.length;
    if(attacks.length)t.opportunityDecisions++;
    for(const a of attacks){t.unique.add(JSON.stringify(a));if(!Number.isFinite(scoreIntent(input,a,params)))t.thresholdExcluded++;}
    if(attacks.length&&row.turn>=9)opportunities.push({n:row.n,turn:row.turn,candidates:attacks,choice:row.choice,force:f});
   }
   if(a?.type==='ATTACK')t.attackSelected++;
   if(row.result.status==='ACCEPTED'){
    if(a?.type==='ATTACK')t.attacks++;
    if(a?.type==='MOVE'){t.moves++;t.lastMove={n:row.n,from:own(input).find(u=>u.id===a.unitId)?.hex,action:a};}
   }
  }
  assert.deepEqual(host.step({GERMAN:()=>row.choice,SOVIET:()=>row.choice}),row.result);
 }
 const last=turns.get(lastTurn);last.end=distance(host.observe(germanController));last.delta={nearest:last.end.nearest-previousEnd.nearest,median:last.end.median-previousEnd.median};
 assert.equal(hash(host.auditOmniscient()),record.finalHash);
 const rows=[...turns.values()].filter(t=>t.turn>=9&&t.turn<=16).map(t=>({...t,unique:t.unique.size}));
 results.push({seed,source,traceHash:record.traceHash,finalHash:record.finalHash,integrity:'PASS',germanPolicy:record.job.seats.GERMAN,rows,opportunities});
 console.log(`seed ${seed}: ${trace.length} recorded decisions; observation/result/final hashes PASS`);
}
writeFileSync('evidence/ai-research-002/statistics.json',JSON.stringify({baseline:'fae794de84d885e0d498c1dea6dfdcd5865d74d3',build,results},null,2)+'\n');
console.log(results.map(r=>({seed:r.seed,rows:r.rows.map(({peak,lastMove,...t})=>({...t,force:[peak.adjacentGerman,peak.nearbyGerman,peak.visibleEnemy,peak.germanAttack,peak.enemyDefense]}))})));

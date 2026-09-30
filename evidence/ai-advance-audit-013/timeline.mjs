import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {initial} from '../../ai/lab/match.mjs';
import {hash,atomic} from '../../ai/lab/common.mjs';
import {records} from '../../ai/lab/runner.mjs';
import {RulesEngine,defaultRules,defaultScenario} from '../../.ai-dist/vendor/eastfront-digital-core/dist/index.js';
import {hexDistance} from '../../.ai-dist/vendor/eastfront-digital-core/dist/core/hex.js';
import {validateMoveAction} from '../../.ai-dist/vendor/eastfront-digital-core/dist/rules/movement.js';
import {getUnitStats} from '../../.ai-dist/vendor/eastfront-digital-core/dist/rules/unit.js';
import {toCoreAction} from '../../.ai-dist/src/multiplayer/gameplayProtocol.js';
const out='evidence/ai-advance-audit-013';
const dist=h=>Math.min(...defaultScenario.capitalCoreHexes.map(g=>hexDistance(h,g)));
const unit=u=>({id:u.id,hex:u.hex,alive:u.alive,step:u.step,distance:dist(u.hex),type:u.type,hasMoved:u.hasMoved,hasAttacked:u.hasAttacked,dedicatedRailRepair:u.dedicatedRailRepair,supplyState:u.supplyState,baseMP:Math.max(0,getUnitStats(u,defaultRules).movement-(u.supplyState==='OUT_OF_SUPPLY'?defaultRules.supply.oosMovementPenalty:0))});
const german=s=>Object.values(s.units).filter(u=>u.side==='GERMAN').map(unit);
const front=s=>{const units=german(s).filter(u=>u.alive),nearest=Math.min(...units.map(u=>u.distance));return {nearest:Number.isFinite(nearest)?nearest:null,leaders:units.filter(u=>u.distance===nearest)};};
const outcomes={};
for(const version of ['baseline','candidate']){
 const dir='evidence/ai-eval-012/batch/holdout-1017-'+version+'-GERMAN',rows=records(dir+'/trace.ndjson'),rec=JSON.parse(readFileSync(dir+'/record.json'));
 let state=initial(1017);const engine=new RulesEngine(defaultRules,defaultScenario),timeline=[],phaseEnds=[],battles=[];
 for(const row of rows){
  if(row.choice?.kind!=='INTENT')continue;
  const before=state,action=toCoreAction(row.choice.intent,row.controllerId),r=engine.apply(before,action);assert.equal(r.accepted,row.result.status!=='REJECTED');if(r.accepted)state=r.state;
  const changed=german(state).filter(u=>{const prev=before.units[u.id];return !prev||JSON.stringify(unit(prev))!==JSON.stringify(u);}).map(after=>({before:before.units[after.id]?unit(before.units[after.id]):null,after}));
  const compact={n:row.n,line:row.n+1,turn:before.turn,phase:before.phase,side:row.side,choice:row.choice.intent,status:row.result.status,frontBefore:front(before),frontAfter:front(state),changedGerman:changed,issues:r.issues,events:r.events,randomBefore:before.random,randomAfter:state.random,...(action.type==='MOVE'?{move:validateMoveAction(before,defaultRules,action)}:{})};
  timeline.push(compact);
  if(before.phase!==state.phase){phaseEnds.push({turn:before.turn,phase:before.phase,n:row.n,line:row.n+1,front:front(state),german:german(state),next:{turn:state.turn,phase:state.phase}});}
  for(const e of r.events)if(e.type==='CRTResolved')battles.push({n:row.n,turn:before.turn,phase:before.phase,event:e,dice:r.events.find(d=>d.type==='DiceRolled'&&d.battleId===e.battleId),randomBefore:before.random,randomAfter:state.random});
 }
 assert.equal(hash(state),rec.finalHash);
 writeFileSync(out+'/'+version+'-timeline.ndjson',timeline.map(x=>JSON.stringify(x)).join('\n')+'\n');
 atomic(out+'/'+version+'-phase-ends.json',phaseEnds);
 outcomes[version]={rows:timeline.length,finalHash:hash(state),finalFront:front(state),phaseEnds:phaseEnds.map(({german,...x})=>x),battles};
}
const phases=outcomes.baseline.phaseEnds.map(b=>{const c=outcomes.candidate.phaseEnds.find(c=>c.turn===b.turn&&c.phase===b.phase);return c?{turn:b.turn,phase:b.phase,baseline:{n:b.n,front:b.front},candidate:{n:c.n,front:c.front},delta:c.front.nearest-b.front.nearest}:null;}).filter(Boolean);
const firstLag=phases.find(p=>p.delta>0),sustained=phases.find((p,i)=>p.delta>0&&phases.slice(i).every(x=>x.delta>0));
atomic(out+'/timeline-summary.json',{alignment:'Same completed turn/phase, not same decision index after divergence. Sustained means all subsequent comparable phase-end snapshots through terminal.',firstLag,firstSustainedLag:sustained,final:{baseline:outcomes.baseline.finalFront,candidate:outcomes.candidate.finalFront},phases,battles:{baseline:outcomes.baseline.battles,candidate:outcomes.candidate.battles}});
console.log(JSON.stringify({firstLag,sustained,final:{baseline:outcomes.baseline.finalFront,candidate:outcomes.candidate.finalFront},phaseMovement:phases.filter(p=>p.phase==='GERMAN_MOVEMENT').slice(0,6)},null,2));

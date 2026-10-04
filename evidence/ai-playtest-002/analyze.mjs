import {readFileSync,writeFileSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {RulesEngine,defaultRules,defaultScenario,hexDistance,validateGameStateIntegrity} from '../../.ai-dist/vendor/eastfront-digital-core/dist/index.js';
const dir='evidence/ai-playtest-002',rows=[];
const sha=b=>createHash('sha256').update(b).digest('hex');
const frozen=JSON.parse(readFileSync(dir+'/freeze.json'));for(const f of frozen.runtime)assert.equal(sha(readFileSync(f.path)),f.sha256);
for(const humanSide of ['GERMAN','SOVIET']){
 const base=JSON.parse(readFileSync(`evidence/ai-playtest-001/${humanSide}.record.json`)),run=JSON.parse(readFileSync(`${dir}/${humanSide}.record.json`)),replay=JSON.parse(gunzipSync(readFileSync(`${dir}/${humanSide}.replay.json.gz`)));
 assert.equal(run.initialHash,base.initialHash);assert.equal(run.status,'GAME_OVER');assert.equal(run.turn,defaultScenario.turnLimit);
 const engine=new RulesEngine(defaultRules,defaultScenario),maintenance=[];let state=replay.initial;
 for(const e of replay.attempts){const action=e.choice.intent,controllerId=Object.values(state.controllers).find(c=>c.side===e.owner).id,result=engine.apply(state,{...action,controllerId});assert.equal(result.accepted,e.accepted);
  if(result.accepted&&['ENTRENCH','REPAIR_UNIT'].includes(action.type)){
   const before=state.units[action.unitId],after=result.state.units[action.unitId],rp=state.rp[e.owner]-result.state.rp[e.owner];
   if(action.type==='ENTRENCH'){assert.equal(before.entrenched,false);assert.equal(after.entrenched,true);assert.equal(rp,0);}
   else{assert.equal(before.step-after.step,1);assert.equal(rp,defaultRules.unitTemplates[before.templateId].recoveryCostPerStep);}
   maintenance.push({n:e.n,turn:e.turn,side:e.owner,intent:action,before:{step:before.step,entrenched:before.entrenched,rp:state.rp[e.owner],hasMoved:before.hasMoved},after:{step:after.step,entrenched:after.entrenched,rp:result.state.rp[e.owner]},reason:e.choice.refitOptions?.[0]??null});
  }
  if(result.accepted)state=result.state;
 }
 assert.deepEqual(state,replay.end);assert.deepEqual(validateGameStateIntegrity(state,defaultRules,defaultScenario),[]);
 const metrics=end=>Object.fromEntries(['GERMAN','SOVIET'].map(side=>{const all=Object.values(end.units).filter(u=>u.side===side),alive=all.filter(u=>u.alive),dist=alive.map(u=>Math.min(...defaultScenario.capitalCoreHexes.map(h=>hexDistance(u.hex,h))));return [side,{alive:alive.length,destroyed:all.filter(u=>!u.alive).length,currentDamageSteps:all.reduce((n,u)=>n+u.step,0),rp:end.rp[side],entrenched:alive.filter(u=>u.entrenched).length,capitalDistanceMean:dist.reduce((a,b)=>a+b,0)/dist.length,capitalDistanceMin:Math.min(...dist)}];}));
 const old=JSON.parse(gunzipSync(readFileSync(`evidence/ai-playtest-001/${humanSide}.replay.json.gz`)));
 rows.push({humanSide,seed:run.seed,baseline:{accepted:base.accepted,rejected:base.rejected,status:base.status,turn:base.turn,actions:base.actions,metrics:metrics(old.end)},candidate:{accepted:run.accepted,rejected:run.rejected,status:run.status,turn:run.turn,actions:run.actions,metrics:metrics(state),maxPhaseMs:Math.max(...run.phases.map(p=>p.ms)),maxActionMs:Math.max(...run.phases.map(p=>p.maxActionMs)),elapsedMs:run.elapsedMs},maintenance,initialStateEqual:true,replayVerified:true});
}
writeFileSync(dir+'/comparison.json',JSON.stringify({rows,interpretation:'Two development flow checks; frozen 001 proxy; no general strength or same-dice claim. No natural repair actions occurred; directed fixtures verify repairs separately.'},null,2)+'\n');
const artifacts=[];
for(const name of ['targeted.json','takeover-core.json','takeover-worker.json']){const b=readFileSync(dir+'/'+name),z=gzipSync(b);assert.deepEqual(gunzipSync(z),b);writeFileSync(dir+'/'+name+'.gz',z);artifacts.push({path:name+'.gz',bytes:z.length,sha256:sha(z),rawSha256:sha(b)});}
writeFileSync(dir+'/validation.json',JSON.stringify({frozenRuntimeMatched:true,initialStatesMatched001:true,naturalGames:rows.length,offlineCoreReplay:true,actualMaintenanceChanges:true,targetedArchives:artifacts},null,2)+'\n');
console.log(JSON.stringify(rows.map(r=>({humanSide:r.humanSide,baseline:r.baseline.accepted,candidate:r.candidate.accepted,reject:r.candidate.rejected,terminal:r.candidate.status,entrench:r.maintenance.filter(m=>m.intent.type==='ENTRENCH').length,repairs:r.maintenance.filter(m=>m.intent.type==='REPAIR_UNIT').length,RP:r.candidate.metrics})),null,2));

import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as f from '../../.ai003-preview/src/playable/flow.js';
import * as plan from '../../.ai003-preview/src/playable/command.js';
import {RulesEngine,defaultRules,defaultScenario} from '../../.ai003-preview/vendor/eastfront-digital-core/dist/index.js';
import {derivePlayerView} from '../../.ai003-preview/src/player-view/playerView.js';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const rows=[];let probe;
for(const side of ['GERMAN','SOVIET']){
 const replay=JSON.parse(gunzipSync(readFileSync(`evidence/ai-playtest-002/${side}.replay.json.gz`))),engine=new RulesEngine(defaultRules,defaultScenario);let state=replay.initial,count=0;
 for(const e of replay.attempts){
  const controllerId=Object.values(state.controllers).find(c=>c.side===e.owner).id;
  if(!probe&&state.phase.endsWith('_RECOVERY')&&Object.values(state.units).filter(u=>u.alive&&u.side===state.activeSide).every(u=>u.step===0))probe=structuredClone(state);
  const r=engine.apply(state,{...e.choice.intent,controllerId});assert.equal(r.accepted,e.accepted);if(r.accepted)state=r.state;count++;
 }
 assert.deepEqual(state,replay.end);rows.push({humanSide:side,actions:count,completeStateMatches002:true,endHash:hash(state),turn:state.turn,winner:state.victory.winner});
}
assert(probe);const view=derivePlayerView(probe,probe.activeSide,defaultRules),seat=Object.values(probe.controllers).find(c=>c.side===probe.activeSide).id;
const model={playerView:view,viewerSide:probe.activeSide,viewerControllerId:seat,turn:probe.turn,phase:probe.phase,readOnly:false,hexes:view.hexes,combat:null,deployment:null};
const ctx={model,revision:11,ready:true,privacy:false,local:true,rejected:false},s={};
assert.equal(f.autoTicket(s,ctx),null);f.setEnabled(s,seat,true);assert(f.eligible(ctx));
let t=f.autoTicket(s,ctx),actual;assert(f.runAuto(s,ctx,t,()=>{actual=new RulesEngine(defaultRules,defaultScenario).apply(probe,{type:'READY_FOR_PHASE_END',controllerId:seat});}));
const manual=new RulesEngine(defaultRules,defaultScenario).apply(probe,{type:'READY_FOR_PHASE_END',controllerId:seat});assert.deepEqual(actual,manual);assert.equal(f.runAuto(s,ctx,t,()=>assert.fail('duplicate')),false);
for(const change of [{privacy:true},{local:false},{ready:false},{rejected:true},{model:{...model,readOnly:true}},{model:{...model,phase:'GERMAN_ENTRENCHMENT'}},{model:{...model,playerView:{...view,pendingDecision:{kind:'RETREAT'}}}},{model:{...model,playerView:{...view,units:view.units.map((u,i)=>i===0?{...u,step:1}:u)}}}])assert(!f.eligible({...ctx,...change}));
const fresh={};f.setEnabled(fresh,seat,true);t=f.autoTicket(fresh,ctx);assert(!f.runAuto(fresh,{...ctx,revision:12},t,()=>assert.fail()));f.setEnabled(fresh,seat,false);assert(!f.runAuto(fresh,ctx,t,()=>assert.fail()));assert(!f.controls(fresh,'other-seat').enabled);assert(!f.controls({},seat).enabled);
f.setEnabled(fresh,seat,true);f.stopOnRejection(fresh,seat);assert(!f.controls(fresh,seat).enabled);
const own=view.units.find(u=>u.side===view.viewer&&u.friendly),p=plan.scope(s,seat),before=hash(probe);assert(plan.toggleMember(p,model,own.id));p.picking='target';assert(plan.mark(p,model,view.hexes[0].coord));assert(plan.overlay(s,model).includes('command-plan-arrow'));assert.equal(hash(probe),before);assert.equal(plan.scope(s,'other-seat').target,null);assert.equal(plan.scope({},seat).target,null);assert(!plan.mark({...p,picking:'target'},{...model,readOnly:true},view.hexes[1].coord));
const result={replayedExistingGamesOnly:true,rows,flow:{defaultOff:true,independentSeatAndSession:true,emptyRecoveryOnly:true,staleAndPrivacyBlocked:true,oneAttempt:true,rejectedStops:true,manualEqualsAutoCompleteResult:true,hash:hash(manual.state)},command:{authorizedModelOnly:true,sessionSeatIsolation:true,markDoesNotMutateCore:true,readOnlyStopsMarking:true},limitations:'No new natural campaigns; browser operations are separate evidence. No strength/efficiency claim.'};
writeFileSync('evidence/playable-001/validation.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));

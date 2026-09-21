import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {wireGame,production,checkSnapshot} from './helpers/mp002.mjs';
import {fixture,unit} from './helpers/combat-fixture.mjs';
import {createPresentationState} from '../dist/app/state/presentation.js';
import {deploymentHexKeysForSide,getAvailableSovietReinforcements,computeLegalSovietReinforcementEntryHexKeys,getNeighbors,validateMoveAction} from '../.server-dist/src/core-adapter/core.js';
const evidence=[];
const coord=k=>{const [q,r]=k.split(',').map(Number);return {q,r};};
async function finishDecision(g,{breakthrough=false}={}){
 let guard=50;while(g.match.authoritative.state.pendingDecision&&guard--){
   const d=g.match.authoritative.state.pendingDecision,p=d.side==='GERMAN'?g.a:g.b,other=p===g.a?g.b:g.a,draft=createPresentationState();
   const wrong=await other.request('SUBMIT_ACTION',{matchId:g.match.matchId,expectedRevision:g.match.matchRevision,action:{type:'PASS_REACTION',battleId:d.battleId}});assert.equal(wrong.payload.code,'NOT_ACTION_OWNER');
   let q=await g.query(p,draft),c=q.model.combat;
   if(q.forcedAction){await g.submit(p,q.forcedAction);continue;}
   if(d.kind==='DEFENDER_REACTION')await g.submit(p,{type:'PASS_REACTION',battleId:d.battleId});
   else if(d.kind==='LOSS_ALLOCATION'){
     const picks=[];for(const id of c.loss.eligibleUnitIds)for(let i=0;i<c.loss.capacityByUnitId[id]&&picks.length<d.lossSteps;i++)picks.push(id);
     await g.submit(p,{type:'ALLOCATE_LOSSES',battleId:d.battleId,unitIdsByStep:picks});
   }else if(d.kind==='RETREAT'){
     for(let steps=0;steps<24&&!q.forcedAction;steps++){
       const plan=q.model.combat.retreat,id=plan.activeUnitId,h=plan.options.find(h=>!breakthrough||h.q!==1||h.r!==0)??plan.options[0];assert(h,'legal retreat');
       if(!draft.retreatOrder.includes(id))draft.retreatOrder.push(id);draft.retreatDrafts[id]=[...(draft.retreatDrafts[id]??[]),h];q=await g.query(p,draft);
     }
     assert.equal(q.forcedAction?.type,'RETREAT');await g.submit(p,q.forcedAction);
   }else if(d.kind==='ADVANCE_AFTER_COMBAT')await g.submit(p,{type:'ADVANCE_AFTER_COMBAT',battleId:d.battleId,unitId:c.advance.unitIds[0]});
   else if(d.kind==='BREAKTHROUGH_OPTION'){
     const option=c.breakthrough.options.find(o=>o.legal&&o.hex.q===1&&o.hex.r===0);
     await g.submit(p,breakthrough&&option?{type:'BREAKTHROUGH',battleId:d.battleId,unitId:c.breakthrough.selectedUnitId,path:[option.hex]}:{type:'PASS_BREAKTHROUGH',battleId:d.battleId});
   }else if(d.kind==='SCHWERPUNKT_OPTION'){
     const choice=c.schwerpunkt.choices[0];await g.submit(p,breakthrough&&choice?{type:'SCHWERPUNKT_ATTACK',sourceBattleId:d.battleId,unitId:choice.unitId,target:choice.target}:{type:'PASS_SCHWERPUNKT',battleId:d.battleId});breakthrough=false;
   }
 }
 assert(guard>0);
}

test('MP002 real two WebSockets: entire production Scenario from hidden deployments through move/combat/reconnect to official victory',async t=>{
 const g=await wireGame(t,()=>production(17)),s=()=>g.match.authoritative;
 for(const [side,p,special]of [['SOVIET',g.b,{'S-I-01':'3,-1'}],['GERMAN',g.a,{'G-PZ-01':'2,-1','G-I-01':'2,-1','G-J-01':'2,0'}]]){
   const counts={},zone=deploymentHexKeysForSide(s().state,s().scenario,side),ids=s().scenario.deployment.units.filter(u=>u.side===side).map(u=>u.id).sort();
   for(const [id,k]of Object.entries(special)){await g.submit(p,{type:'DEPLOY_INITIAL_UNIT',deploymentUnitId:id,hex:coord(k)});counts[k]=(counts[k]??0)+1;}
   for(const id of ids){if(id in special)continue;const k=zone.find(k=>(counts[k]??0)<2&&!Object.values(special).includes(k));await g.submit(p,{type:'DEPLOY_INITIAL_UNIT',deploymentUnitId:id,hex:coord(k)});counts[k]=(counts[k]??0)+1;}
   await g.submit(p,{type:'READY_FOR_PHASE_END'});
 }
 assert.equal(s().state.phase,'GERMAN_SUPPLY_RAIL');await g.submit(g.a,{type:'READY_FOR_PHASE_END'});assert.equal(s().state.phase,'GERMAN_MOVEMENT');
 const candidates=Object.values(s().state.units).filter(u=>u.side==='GERMAN'&&!['G-PZ-01','G-I-01','G-J-01'].includes(u.id));let move;
 for(const u of candidates){for(const h of getNeighbors(u.hex))if(!validateMoveAction(s().state,s().rules,{type:'MOVE',controllerId:u.controllerId,unitId:u.id,path:[h]}).issues.length){move={type:'MOVE',unitId:u.id,path:[h]};break;}if(move)break;}
 assert(move);await g.submit(g.a,move);
 // Reconnect at the current revision, then continue. No historical animation replay.
 const old=g.a,identity=old.welcome;old.ws.terminate();await g.b.wait(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT'&&m.payload.status==='WAITING_FOR_RECONNECT');
 const restored=await g.peer(null,identity.reconnectToken);await restored.wait(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT'&&m.payload.resync);assert.equal(restored.welcome.controllerId,identity.controllerId);g.replace(old,restored);
 await g.submit(g.a,{type:'READY_FOR_PHASE_END'});assert.equal(s().state.phase,'GERMAN_COMBAT');
 await g.submit(g.a,{type:'ATTACK',attackerUnitIds:['G-PZ-01','G-I-01','G-J-01'],target:{q:3,r:-1}});
 await finishDecision(g);await g.submit(g.a,{type:'READY_FOR_PHASE_END'});
 // Deterministic test driver: optional phases pass, mandatory reinforcements use Core options.
 let guard=500;while(s().state.phase!=='GAME_OVER'&&guard--){
   const p=s().state.activeSide==='GERMAN'?g.a:g.b;
   if(s().state.phase==='SOVIET_REINFORCEMENT_SUPPLY'){
     const available=getAvailableSovietReinforcements(s().state,s().scenario),entries=computeLegalSovietReinforcementEntryHexKeys(s().state,s().rules,s().scenario);
     if(available.length&&entries.length){await g.submit(p,{type:'DEPLOY_REINFORCEMENT',reinforcementId:available[0].id,entryHex:coord(entries[0])});continue;}
   }
   await g.submit(p,{type:'READY_FOR_PHASE_END'});
 }
 assert(guard>0);assert.equal(g.match.status,'FINISHED');assert.equal(s().state.turn,16);assert.equal(s().state.victory.reason,'SOVIET_CAPITAL_DEFENDED_TO_TURN_LIMIT');
 for(const p of [g.a,g.b]){const snapshot=p.messages.findLast(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT').payload;assert.equal(snapshot.status,'FINISHED');checkSnapshot(g.match,p,snapshot);}
 const sorted=[...g.samples].sort((a,b)=>a-b);
 evidence.push({flow:'full-production-scenario',seed:17,transport:'two real WebSocket clients',actions:g.submitted.length,types:[...new Set(g.submitted)],matchRevision:g.match.matchRevision,turn:s().state.turn,status:g.match.status,victory:s().state.victory,idempotentReplayEveryAction:true,localEquivalentEveryAction:true,identicalRng:true,privateSnapshotsEveryAction:true,reconnectContinued:true,roundTripMs:{median:sorted[Math.floor(sorted.length/2)],p95:sorted[Math.floor(sorted.length*.95)],max:sorted.at(-1)},result:'PASS'});
});

test('MP002 real two WebSockets: combat fixture loss/retreat/advance/breakthrough/Schwerpunkt and decision reconnect',async t=>{
 const g=await wireGame(t,()=>fixture(8246,[unit('p','G-PANZER','GERMAN','PANZER',{q:-1,r:0}),unit('d','S-TANK','SOVIET','TANK',{q:0,r:0}),unit('d2','S-INF','SOVIET','INFANTRY',{q:2,r:0})]).s);
 await g.submit(g.a,{type:'ATTACK',attackerUnitIds:['p'],target:{q:0,r:0}});
 const before=structuredClone(g.match.authoritative.state),old=g.b;old.ws.terminate();await g.a.wait(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT'&&m.payload.status==='WAITING_FOR_RECONNECT');
 assert.deepEqual(g.match.authoritative.state,before);const restored=await g.peer(null,old.welcome.reconnectToken);await restored.wait(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT'&&m.payload.resync);g.replace(old,restored);
 assert.equal(restored.messages.findLast(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT').payload.view.pendingDecision.kind,'DEFENDER_REACTION');
 await finishDecision(g,{breakthrough:true});await g.submit(g.a,{type:'READY_FOR_PHASE_END'});
 for(const type of ['ATTACK','PASS_REACTION','RETREAT','ADVANCE_AFTER_COMBAT','BREAKTHROUGH','SCHWERPUNKT_ATTACK','READY_FOR_PHASE_END'])assert(g.submitted.includes(type),type);
 evidence.push({flow:'combat-branch-fixture',seed:8246,fixture:'trusted server factory, frozen Core and rules',transport:'two real WebSocket clients',types:g.submitted,decisionReconnect:true,stateFrozenDuringDisconnect:true,privateSnapshotsEveryAction:true,idempotentReplayEveryAction:true,localEquivalentEveryAction:true,identicalRng:true,result:'PASS'});
});

test.after(()=>{mkdirSync('evidence/mp-002',{recursive:true});writeFileSync('evidence/mp-002/network-e2e.json',JSON.stringify({protocolVersion:2,evidence},null,2)+'\n');});

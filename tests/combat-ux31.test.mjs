import test from 'node:test';
import assert from 'node:assert/strict';
import {gameHarness,wireGame} from './helpers/mp002.mjs';
import {fixture,ordinary,unit} from './helpers/combat-fixture.mjs';
import {decodeSnapshot,FULL_SNAPSHOT,COMPACT_SNAPSHOT,MAP_SNAPSHOT,MAX_SERVER_MESSAGE_BYTES} from '../dist/app/multiplayer/snapshotCodec.js';
import {validBattleSummaries,SUMMARY_LIMIT,CONSEQUENCE_LIMIT} from '../dist/app/multiplayer/battleSummary.js';
import {CombatResults} from '../dist/app/ui/combatResult.js';
import {publishAuthorizedEvents} from '../dist/app/presentation/transitionBus.js';
import {createPresentationState} from '../dist/app/state/presentation.js';
import {battleSummaries} from '../.server-dist/server/battleSummary.js';
const last=p=>p.last?p.last('PLAYER_VIEW_SNAPSHOT').payload:p.messages.findLast(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT').payload;
const accepted=r=>assert.equal(r.messageType,'ACTION_ACCEPTED',JSON.stringify(r));
const opt=(p,format=FULL_SNAPSHOT)=>p.send('SET_SNAPSHOT_FORMAT',{format,battleSummary:1});
const summary=p=>decodeSnapshot(last(p),true,true).model.battleSummaries;
function combat(seed=8246,format=FULL_SNAPSHOT){const h=gameHarness(()=>fixture(seed,[unit('g','G-PANZER','GERMAN','PANZER',{q:-1,r:0}),...ordinary().slice(1),unit('d2','S-INF','SOVIET','INFANTRY',{q:0,r:0})]).s);opt(h.a,format);opt(h.b,format);accepted(h.submit(h.a,{type:'ATTACK',attackerUnitIds:['g'],target:{q:0,r:0}}));accepted(h.submit(h.b,{type:'PASS_REACTION',battleId:h.match.authoritative.state.pendingDecision.battleId}));return h;}
for(const format of [FULL_SNAPSHOT,COMPACT_SNAPSHOT,MAP_SNAPSHOT])test(`UX31 both decision and nondecision recipients get exact authorized dice on ${format}`,()=>{
 const h=combat(8246,format);for(const p of [h.a,h.b]){assert.equal(last(p).format,format);assert(validBattleSummaries(summary(p)));}const state=JSON.stringify(h.match.authoritative.state);
 for(const p of [h.a,h.b]){h.query(p);p.send('RESYNC_MATCH',{matchId:h.match.matchId});const s=summary(p);assert(validBattleSummaries(s));assert.equal(s.entries.length,1);const row=s.entries[0],tx=h.match.authoritative.state.combatTransactions[row.battleId];assert.deepEqual(row.resolution,tx.resolution);assert.equal(row.context.finalShift,tx.context.finalShift);assert.equal(row.pending,'LOSS_ALLOCATION');assert(Buffer.byteLength(JSON.stringify(last(p)))<MAX_SERVER_MESSAGE_BYTES);}
 assert.equal(last(h.a).model.combat,null);assert.equal(JSON.stringify(h.match.authoritative.state),state);
});
test('UX31 unnegotiated clients get exact old model shape; nonmembers cannot query a summary',()=>{
 const h=combat();opt(h.a);h.a.send('SET_SNAPSHOT_FORMAT',{format:FULL_SNAPSHOT});h.a.send('RESYNC_MATCH',{matchId:h.match.matchId});assert(!('battleSummaries' in last(h.a).model));
 const stranger=h.peer('outsider');opt(stranger);assert.equal(stranger.send('RESYNC_MATCH',{matchId:h.match.matchId}).payload.code,'NOT_IN_ROOM');assert.equal(stranger.last('PLAYER_VIEW_SNAPSHOT'),undefined);assert.throws(()=>battleSummaries(h.match,stranger.welcome.controllerId),/No assignment/);
});
test('UX31 actual losses are recorded once from accepted events, no remaining steps, enemy IDs or hidden support details',()=>{
 const h=combat(),id=h.match.authoritative.state.pendingDecision.battleId;assert.equal(summary(h.b).entries[0].consequences.length,0);
 accepted(h.submit(h.b,{type:'ALLOCATE_LOSSES',battleId:id,unitIdsByStep:['d']}));
 assert.deepEqual(summary(h.b).entries[0].consequences,[{kind:'loss',unitId:'d',steps:1}]);assert.deepEqual(summary(h.a).entries[0].consequences,[]);
 const captured=JSON.stringify(summary(h.b));h.query(h.b);h.b.send('RESYNC_MATCH',{matchId:h.match.matchId});assert.equal(JSON.stringify(summary(h.b)),captured);
 for(const p of [h.a,h.b]){const text=JSON.stringify(summary(p));for(const forbidden of ['fromStep','toStep','controllerId','attackerUnitIds','defenderUnitIds','Artillery','HQ','modifiers','strength','path','random','actionLog','combatTransactions'])assert(!text.includes(forbidden),forbidden);}
});
test('UX31 hidden support has no identity, source modifier or coordinates in opponent result archive',()=>{
 const h=gameHarness(()=>fixture(2722,[...ordinary(),unit('g2','G-INF','GERMAN','INFANTRY',{q:0,r:-1}),unit('hidden-art','S-ARTY','SOVIET','ARTILLERY',{q:0,r:2})]).s);opt(h.a);opt(h.b);
 accepted(h.submit(h.a,{type:'ATTACK',attackerUnitIds:['g','g2'],target:{q:0,r:0}}));accepted(h.submit(h.b,{type:'COMBAT_REACTION',battleId:h.match.authoritative.state.pendingDecision.battleId,reaction:{kind:'DEFENDER_ARTILLERY',artilleryUnitId:'hidden-art'}}));
 if(h.match.authoritative.state.pendingDecision?.kind==='DEFENDER_REACTION')accepted(h.submit(h.b,{type:'PASS_REACTION',battleId:h.match.authoritative.state.pendingDecision.battleId}));
 const s=summary(h.a);assert(s.entries.length);const text=JSON.stringify(s);for(const hidden of ['hidden-art','S-ARTY','attackerArtillery','defenderArtillery','"q":0,"r":2','g2','"d"'])assert(!text.includes(hidden),hidden);
 assert.deepEqual(s.entries[0].resolution,Object.values(h.match.authoritative.state.combatTransactions)[0].resolution);
 const saved=structuredClone(s);h.match.authoritative.state.units['hidden-art'].hex={q:0,r:1};h.query(h.a);assert.deepEqual(battleSummaries(h.match,h.a.welcome.controllerId),saved,'later visibility cannot backfill archive');
});
test('UX31 decoder rejects malformed summary atomically and does not mutate input',()=>{
 const h=combat(),valid=last(h.a),original=structuredClone(valid);for(const mutate of [s=>s.matchId='other',s=>s.viewerControllerId='other',s=>s.entries[0].revision=999,s=>s.entries[0].resolution.dice.total=99,s=>s.entries[0].context.attackerArtilleryUnitId='secret',s=>s.entries[0].consequences=[{kind:'loss',unitId:'x',steps:1,remainingSteps:2}],s=>s.entries.push(structuredClone(s.entries[0])),s=>s.entries[0].stage='fake']){const bad=structuredClone(valid);mutate(bad.model.battleSummaries);assert.throws(()=>decodeSnapshot(bad,true,true));}assert.deepEqual(valid,original);
});
test('UX31 summary updates, old revisions, duplicate events and history never replay; viewer/match data isolated',()=>{
 const h=combat(),m=last(h.a).model,key={},r=new CombatResults(key);r.html({...m,battleSummaries:{...m.battleSummaries,entries:[]}});publishAuthorizedEvents(key,last(h.a).events);assert.match(r.html(m),/dice-reveal/);assert.doesNotMatch(r.html(m),/dice-reveal/);
 const id=m.battleSummaries.entries[0].battleId,next=structuredClone(m);next.battleSummaries.entries[0].revision++;next.battleSummaries.entries[0].stage='CLOSED';next.battleSummaries.entries[0].pending=null;assert.match(r.html(next),/后续流程已结束/);assert.match(r.html(m),/后续流程已结束/);assert.doesNotMatch(r.html(next),/dice-reveal/);
 r.close();r.open(id);assert.doesNotMatch(r.html(next),/dice-reveal/);r.recover();assert.doesNotMatch(r.html(next),/dice-reveal/);assert.doesNotMatch(new CombatResults({}).html(next),/dice-reveal/);
 const other=structuredClone(next);other.viewerControllerId='other';other.battleSummaries.viewerControllerId='other';other.battleSummaries.entries=[];assert.doesNotMatch(r.html(other),/data-result-battle/);
 const room=structuredClone(next);room.battleSummaries.matchId='new-match';room.battleSummaries.entries=[];assert.doesNotMatch(r.html(room),/data-result-battle/);
});
test('UX31 bounded DTO size and consequences are explicit; oversized/duplicate entries rejected',()=>{
 const h=combat(),s=summary(h.a),one=s.entries[0];s.entries=Array.from({length:SUMMARY_LIMIT},(_,i)=>({...structuredClone(one),battleId:'B-'+i,consequences:Array.from({length:CONSEQUENCE_LIMIT},()=>({kind:'retreat',unitId:'u'.repeat(96),from:{q:-10000,r:10000},to:{q:10000,r:-10000}}))}));assert(validBattleSummaries(s));assert(Buffer.byteLength(JSON.stringify(s))<500000);s.entries.push({...one,battleId:'excess'});assert(!validBattleSummaries(s));
});

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

test('UX31 two real WebSockets deliver each stage, executed retreat/advance/breakthrough, reconnect and preserved Core state/RNG',async t=>{
 const g=await wireGame(t,()=>fixture(8246,[unit('p','G-PANZER','GERMAN','PANZER',{q:-1,r:0}),unit('d','S-TANK','SOVIET','TANK',{q:0,r:0}),unit('d2','S-INF','SOVIET','INFANTRY',{q:2,r:0})]).s);
 for(const p of [g.a,g.b])await p.request('SET_SNAPSHOT_FORMAT',{format:FULL_SNAPSHOT,battleSummary:1});
 await g.submit(g.a,{type:'ATTACK',attackerUnitIds:['p'],target:{q:0,r:0}});await finishDecision(g,{breakthrough:true});
 const kinds=new Set();for(const p of [g.a,g.b]){const s=summary(p);assert(s.entries.length>=2);for(const e of s.entries){assert.deepEqual(e.resolution,g.match.authoritative.state.combatTransactions[e.battleId].resolution);for(const c of e.consequences){kinds.add(c.kind);assert.equal(g.match.authoritative.state.units[c.unitId].side,last(p).view.viewer);}}}
 for(const kind of ['retreat','advance','breakthrough'])assert(kinds.has(kind),kind);
 for(const p of [g.a,g.b])for(const msg of p.messages.filter(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT'&&m.payload.model.battleSummaries)){decodeSnapshot(msg.payload,true,true);const dto=msg.payload.model.battleSummaries;for(const e of dto.entries){for(const c of e.consequences)assert.equal(g.match.authoritative.state.units[c.unitId].side,msg.payload.view.viewer);}assert(Buffer.byteLength(JSON.stringify(msg))<MAX_SERVER_MESSAGE_BYTES);}
 const old=g.b,saved=summary(old);old.ws.terminate();await g.a.wait(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT'&&m.payload.status==='WAITING_FOR_RECONNECT');const restored=await g.peer(null,old.welcome.reconnectToken);await restored.request('SET_SNAPSHOT_FORMAT',{format:FULL_SNAPSHOT,battleSummary:1});await restored.wait(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT'&&!!m.payload.model.battleSummaries);assert.deepEqual(summary(restored),saved);assert.deepEqual(last(restored).events,[]);assert.doesNotMatch(new CombatResults({}).html(last(restored).model),/dice-reveal/);g.replace(old,restored);
});

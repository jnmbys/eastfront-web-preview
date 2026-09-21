import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {gameHarness,production,checkSnapshot} from './helpers/mp002.mjs';
import {fixture,unit,ordinary,G,S} from './helpers/combat-fixture.mjs';
import {clientMessage,parseClientMessage} from '../dist/app/multiplayer/protocol.js';
import {createPresentationState} from '../dist/app/state/presentation.js';
import {generateRoomCode} from '../.server-dist/server/authority.js';
import {playerSnapshot} from '../.server-dist/server/match.js';
const deploy={type:'DEPLOY_INITIAL_UNIT',deploymentUnitId:'S-I-01',hex:{q:3,r:-1}};
const accepted=r=>assert.equal(r.messageType,'ACTION_ACCEPTED',JSON.stringify(r));
const rejected=(r,code)=>{assert.equal(r.messageType,'ACTION_REJECTED',JSON.stringify(r));if(code)assert.equal(r.payload.code,code);};

test('MP002 Soviet deployment authoritative; wrong Germany controller cannot deploy Soviet; hidden DTOs',()=>{
 const h=gameHarness(()=>production());rejected(h.submit(h.a,deploy),'NOT_ACTION_OWNER');accepted(h.submit(h.b,deploy));
 assert.equal(h.match.matchRevision,1);assert.deepEqual(h.match.authoritative.state.units['S-I-01'].hex,deploy.hex);
 for(const p of [h.a,h.b])checkSnapshot(h.match,p,p.last('PLAYER_VIEW_SNAPSHOT').payload);
 assert(!JSON.stringify(h.a.last('PLAYER_VIEW_SNAPSHOT')).includes('S-I-01'));
});
test('MP002 same requestId executes once, changed payload rejected; stale revision has no state/RNG effect',()=>{
 const h=gameHarness(()=>production()),id=randomUUID();accepted(h.submit(h.b,deploy,0,id));const state=JSON.stringify(h.match.authoritative.state);
 const reply=h.submit(h.b,deploy,0,id);accepted(reply);assert.equal(reply.payload.acceptedRevision,1);assert.equal(h.match.matchRevision,1);
 rejected(h.submit(h.b,{...deploy,hex:{q:3,r:0}},0,id),'REQUEST_REUSED');rejected(h.submit(h.b,deploy,0),'STALE_REVISION');
 assert.equal(JSON.stringify(h.match.authoritative.state),state);
});
test('MP002 all authority/state/random/Observer smuggling, unknown actions and malformed drafts rejected before engine',()=>{
 const h=gameHarness(()=>production()),before=JSON.stringify(h.match.authoritative.state);
 for(const extra of [{controllerId:S},{actionId:'forced'},{dice:6},{state:{}},{viewer:'OBSERVER'},{combatSeed:1}]){
  const r=h.submit(h.b,{...deploy,...extra});assert.equal(r.messageType,'ROOM_ERROR');assert.equal(r.payload.code,'BAD_MESSAGE');
 }
 for(const type of ['SET_GAME_STATE','FORCE_VICTORY','TRANSFER_CONTROL','FORCE_START_MATCH'])assert.equal(h.submit(h.b,{type}).messageType,'ROOM_ERROR');
 for(const action of [{type:'MOVE',unitId:'g',path:[{q:NaN,r:0}]},{type:'RETREAT',battleId:'battle',retreats:[{unitId:'g',path:[],step:0}]}])assert.equal(h.submit(h.a,action).messageType,'ROOM_ERROR');
 assert.equal(JSON.stringify(h.match.authoritative.state),before);accepted(h.submit(h.b,deploy));
});
test('MP002 move accepts own intent; wrong controller and illegal phase safely reject',()=>{
 const h=gameHarness(()=>{const s=fixture().s;s.state.phase='GERMAN_MOVEMENT';return s;});
 const action={type:'MOVE',unitId:'g',path:[{q:-2,r:0}]};rejected(h.submit(h.b,action),'NOT_ACTION_OWNER');accepted(h.submit(h.a,action));
 assert.deepEqual(h.match.authoritative.state.units.g.hex,{q:-2,r:0});
 rejected(h.submit(h.a,{type:'ATTACK',attackerUnitIds:['g'],target:{q:0,r:0}}),'INVALID_ACTION');
});
test('MP002 combat declaration/multi-attacker locks reaction to defender and hides private choices',()=>{
 const h=gameHarness(()=>fixture(2722,[...ordinary(),unit('g2','G-INF','GERMAN','INFANTRY',{q:0,r:-1}),unit('hidden-art','S-ARTY','SOVIET','ARTILLERY',{q:0,r:2})]).s);
 accepted(h.submit(h.a,{type:'ATTACK',attackerUnitIds:['g','g2'],target:{q:0,r:0}}));
 const p=h.match.authoritative.state.pendingDecision;assert.equal(p.kind,'DEFENDER_REACTION');
 assert.equal(h.a.last('PLAYER_VIEW_SNAPSHOT').payload.view.pendingDecision,null);
 assert(h.b.last('PLAYER_VIEW_SNAPSHOT').payload.model.combat.reaction.artillery.includes('hidden-art'));
 assert(!JSON.stringify(h.a.last('PLAYER_VIEW_SNAPSHOT')).includes('hidden-art'));
 rejected(h.submit(h.a,{type:'PASS_REACTION',battleId:p.battleId}),'NOT_ACTION_OWNER');
 accepted(h.submit(h.b,{type:'COMBAT_REACTION',battleId:p.battleId,reaction:{kind:'DEFENDER_ARTILLERY',artilleryUnitId:'hidden-art'}}));
 assert(!JSON.stringify(h.a.last('PLAYER_VIEW_SNAPSHOT')).includes('hidden-art'));
 for(const p of [h.a,h.b])checkSnapshot(h.match,p,p.last('PLAYER_VIEW_SNAPSHOT').payload);
});
test('MP002 loss allocation belongs to defender; query options do not accept hidden IDs or mutate RNG',()=>{
 const h=gameHarness(()=>fixture(8246,[unit('g','G-PANZER','GERMAN','PANZER',{q:-1,r:0}),...ordinary().slice(1),unit('d2','S-INF','SOVIET','INFANTRY',{q:0,r:0})]).s);
 accepted(h.submit(h.a,{type:'ATTACK',attackerUnitIds:['g'],target:{q:0,r:0}}));let p=h.match.authoritative.state.pendingDecision;
 accepted(h.submit(h.b,{type:'PASS_REACTION',battleId:p.battleId}));p=h.match.authoritative.state.pendingDecision;assert.equal(p.kind,'LOSS_ALLOCATION');
 rejected(h.submit(h.a,{type:'ALLOCATE_LOSSES',battleId:p.battleId,unitIdsByStep:['d']}),'NOT_ACTION_OWNER');
 const before=JSON.stringify(h.match.authoritative.state),draft=createPresentationState();draft.selectedUnitId='not-visible';h.query(h.a,draft);assert.equal(JSON.stringify(h.match.authoritative.state),before);
 accepted(h.submit(h.b,{type:'ALLOCATE_LOSSES',battleId:p.battleId,unitIdsByStep:['d']}));assert.equal(h.match.authoritative.state.pendingDecision.kind,'RETREAT');
});
test('MP002 hidden MOVE emits no route/cue or enemy identifier',()=>{
 const h=gameHarness(()=>{const s=fixture(17,[unit('g-secret','G-INF','GERMAN','INFANTRY',{q:-4,r:0}),unit('d','S-INF','SOVIET','INFANTRY',{q:4,r:0})]).s;s.state.phase='GERMAN_MOVEMENT';return s;});
 accepted(h.submit(h.a,{type:'MOVE',unitId:'g-secret',path:[{q:-3,r:0}]}));
 assert.deepEqual(h.b.last('PLAYER_VIEW_SNAPSHOT').payload.events,[]);assert(!JSON.stringify(h.b.last('PLAYER_VIEW_SNAPSHOT')).includes('g-secret'));
 assert(h.a.last('PLAYER_VIEW_SNAPSHOT').payload.events.some(e=>e.kind==='move'));
});
test('MP002 CONTACT becomes Last Known through server-owned knowledge, no client upload',()=>{
 const h=gameHarness(()=>{const s=fixture(17,[unit('g','G-RECON','GERMAN','RECON',{q:0,r:0}),unit('d','S-INF','SOVIET','INFANTRY',{q:3,r:0})]).s;s.state.phase='GERMAN_MOVEMENT';return s;});
 assert(h.a.last('PLAYER_VIEW_SNAPSHOT').payload.view.contacts.length);
 accepted(h.submit(h.a,{type:'MOVE',unitId:'g',path:[{q:-1,r:0}]}));
 assert(h.a.last('PLAYER_VIEW_SNAPSHOT').payload.view.lastKnown.length);assert(h.match.authoritative.knowledge.GERMAN);
 const reply=h.a.send('RESYNC_MATCH',{matchId:h.match.matchId,knowledge:{}});assert.equal(reply.payload.code,'BAD_MESSAGE');
});
for(const decision of [false,true])test(`MP002 active reconnect ${decision?'during reaction':'normal turn'} restores view/revision; disconnect cannot decide; grace ABORTED has no victory`,()=>{
 const h=gameHarness(()=>fixture(2722,[...ordinary(),unit('art','S-ARTY','SOVIET','ARTILLERY',{q:0,r:2})]).s);
 if(decision)accepted(h.submit(h.a,{type:'ATTACK',attackerUnitIds:['g'],target:{q:0,r:0}}));
 const old=decision?h.b:h.a,other=decision?h.a:h.b,token=old.welcome.reconnectToken,state=JSON.stringify(h.match.authoritative.state),revision=h.match.matchRevision;
 h.authority.disconnect(old.connectionId);assert.equal(h.match.status,'WAITING_FOR_RECONNECT');assert.equal(other.last('PLAYER_VIEW_SNAPSHOT').payload.canAct,false);
 rejected(h.submit(other,{type:'READY_FOR_PHASE_END'}),'MATCH_UNAVAILABLE');h.advance(10000);assert.equal(JSON.stringify(h.match.authoritative.state),state);
 const restored=h.peer(null);restored.send('RECONNECT',{reconnectToken:token});assert.equal(restored.welcome.controllerId,old.welcome.controllerId);assert.equal(h.match.status,'ACTIVE');
 const snapshot=restored.last('PLAYER_VIEW_SNAPSHOT').payload;assert.equal(snapshot.matchRevision,revision);assert(snapshot.resync);assert.deepEqual(snapshot.events,[]);checkSnapshot(h.match,restored,snapshot);
 if(decision)assert.equal(snapshot.view.pendingDecision.kind,'DEFENDER_REACTION');
 h.authority.disconnect(restored.connectionId);h.advance(60001);assert.equal(h.match.status,'ABORTED');assert.equal(JSON.stringify(h.match.authoritative.state),state);assert.equal(h.match.authoritative.state.victory.winner,null);
 assert.equal(other.last('PLAYER_VIEW_SNAPSHOT').payload.status,'ABORTED');
});
test('MP002 receipts survive token reconnect and resync is private; stream sequences strictly increase per recipient',()=>{
 const h=gameHarness(()=>production()),id=randomUUID();accepted(h.submit(h.b,deploy,0,id));h.authority.disconnect(h.b.connectionId);
 const b=h.peer(null);b.send('RECONNECT',{reconnectToken:h.b.welcome.reconnectToken});accepted(h.submit(b,deploy,0,id));assert.equal(h.match.matchRevision,1);
 const reply=h.a.send('RESYNC_MATCH',{matchId:h.match.matchId});assert(reply.payload.resync);checkSnapshot(h.match,h.a,reply.payload);
 const seq=h.a.messages.filter(m=>'serverSequence' in m.payload).map(m=>m.payload.serverSequence);for(let i=1;i<seq.length;i++)assert.equal(seq[i],seq[i-1]+1);
});
test('MP002 room/token entropy and authorized queries never alter gameplay RNG',()=>{
 const h=gameHarness(()=>production()),random=structuredClone(h.match.authoritative.state.random);
 for(let i=0;i<100;i++)generateRoomCode();h.peer('third');h.query(h.b);assert.deepEqual(h.match.authoritative.state.random,random);
});

test('MP002 trusted debug inspection cannot alter a remote viewer assignment or query projection',()=>{
 const h=gameHarness(()=>{const s=production();s.viewOverride='OBSERVER';return s;});accepted(h.submit(h.b,deploy));
 const response=h.query(h.a);assert.equal(response.payload.model.playerView.viewer,'GERMAN');assert.equal(response.payload.model.counters.length,0);assert(!JSON.stringify(response).includes('S-I-01'));
});
test('MP002 semantically identical payload key ordering replays accepted request reference',()=>{
 const h=gameHarness(()=>production()),requestId=randomUUID();accepted(h.submit(h.b,deploy,0,requestId));
 accepted(h.submit(h.b,{hex:{r:-1,q:3},deploymentUnitId:'S-I-01',type:'DEPLOY_INITIAL_UNIT'},0,requestId));assert.equal(h.match.matchRevision,1);
});

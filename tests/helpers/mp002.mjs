import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {harness,pair,start,network} from './mp001.mjs';
import {createMatchSession,playerSnapshot} from '../../.server-dist/server/match.js';
import {createLocalGameSession,dispatchGameAction} from '../../.server-dist/src/core-adapter/session.js';
import {queryDraft} from '../../dist/app/multiplayer/gameplayProtocol.js';
import {createPresentationState} from '../../dist/app/state/presentation.js';
import {clientMessage} from '../../dist/app/multiplayer/protocol.js';
export const raw=JSON.parse(readFileSync('vendor/eastfront-digital-core/reference/strategic-reset-f-map.json'));
export function gameHarness(setup){
 let match;const h=harness({config:{messagesPerWindow:10000},factory:(...args)=>{match=createMatchSession(...args);if(setup)match.authoritative=setup();return match;}}),{a,b}=pair(h);start(a,b);
 const submit=(p,action,revision=match.matchRevision,requestId=randomUUID())=>{h.authority.receive(p.connectionId,JSON.stringify(clientMessage('SUBMIT_ACTION',{matchId:match.matchId,expectedRevision:revision,action},requestId)));return p.messages.findLast(m=>m.requestId===requestId);};
 const query=(p,presentation=createPresentationState())=>p.send('QUERY_MATCH',{matchId:match.matchId,expectedRevision:match.matchRevision,draft:queryDraft(presentation)});
 return {...h,a,b,match,submit,query};
}
export async function wireGame(t,setup){
 let match;const h=await network(t,{config:{messagesPerWindow:10000},factory:(...args)=>{match=createMatchSession(...args);if(setup)match.authoritative=setup();return match;}});
 let a=await h.peer('Germany'),b=await h.peer('Soviet');await a.request('CREATE_ROOM');await b.request('JOIN_ROOM',{roomCode:a.room.roomCode});
 await a.request('SELECT_SEAT',{seat:'GERMANY'});await b.request('SELECT_SEAT',{seat:'SOVIET'});await a.request('SET_READY',{ready:true});await b.request('SET_READY',{ready:true});
 await Promise.all([a,b].map(p=>p.wait(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT')));
 const submitted=[],samples=[];
 // A local equivalence oracle starts from the very same server-created scenario seed/state.
 const local={...match.authoritative,state:structuredClone(match.authoritative.state),knowledge:structuredClone(match.authoritative.knowledge)};
 const submit=async(p,action)=>{
   const before=match.matchRevision,start=performance.now(),requestId=randomUUID(),payload={matchId:match.matchId,expectedRevision:before,action},reply=await p.request('SUBMIT_ACTION',payload,requestId);
   assert.equal(reply.messageType,'ACTION_ACCEPTED',JSON.stringify({action,reply,phase:match.authoritative.state.phase}));
   await Promise.all([a,b].map(c=>c.wait(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT'&&m.payload.matchRevision===before+1)));
   const assignment=match.controllerAssignments.find(c=>c.controllerId===p.welcome.controllerId);
   const result=dispatchGameAction(local,{...action,controllerId:assignment.coreControllerId}).result;assert(result.accepted,JSON.stringify(result.issues));
   assert.deepEqual(match.authoritative.state,local.state);assert.deepEqual(match.authoritative.knowledge,local.knowledge);
   for(const c of [a,b])checkSnapshot(match,c,c.messages.findLast(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT').payload);
   p.ws.send(JSON.stringify(clientMessage('SUBMIT_ACTION',payload,requestId)));
   const replay=await p.wait(m=>m.messageType==='ACTION_ACCEPTED'&&m.requestId===requestId&&m.payload.serverSequence>reply.payload.serverSequence);
   assert.equal(replay.payload.acceptedRevision,before+1);assert.equal(match.matchRevision,before+1);assert.deepEqual(match.authoritative.state,local.state);
   submitted.push(action.type);samples.push(performance.now()-start);return reply;
 };
 const query=async(p,presentation=createPresentationState())=>(await p.request('QUERY_MATCH',{matchId:match.matchId,expectedRevision:match.matchRevision,draft:queryDraft(presentation)})).payload;
 return {...h,get a(){return a;},get b(){return b;},replace(old,p){if(old===a)a=p;else b=p;},match,local,submit,query,submitted,samples};
}
export function checkSnapshot(match,peer,snapshot){
 assert.deepEqual(snapshot.view,playerSnapshot(match,peer.welcome.controllerId));
 assert.deepEqual(snapshot.model.playerView,snapshot.view);
 const visible=new Set([...snapshot.view.units.map(u=>u.id),...snapshot.view.lastKnown.map(u=>u.publicId)]);
 const hidden=Object.values(match.authoritative.state.units).filter(u=>u.side!==snapshot.view.viewer&&!visible.has(u.id));
 const text=JSON.stringify(snapshot);for(const u of hidden)assert(!text.includes(`"${u.id}"`),`hidden ${u.id}`);
 for(const field of ['"authoritativeState":','"random":','"actionLog":','"combatTransactions":','"engine":'])assert(!text.includes(field),field);
 if(snapshot.view.pendingDecision)assert.equal(snapshot.view.pendingDecision.side,snapshot.view.viewer);
}
export const production=(seed=17)=>createLocalGameSession(raw,seed);

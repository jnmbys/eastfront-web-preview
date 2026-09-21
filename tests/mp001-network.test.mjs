import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {WebSocket} from 'ws';
import {network,assertPrivate} from './helpers/mp001.mjs';
import {createMatchSession} from '../.server-dist/server/match.js';
import {dispatchGameAction,controllerIdForSide} from '../.server-dist/src/core-adapter/session.js';
import {deploymentHexKeysForSide} from '../.server-dist/src/core-adapter/core.js';
const evidence=[];
async function roomPair(h){const a=await h.peer('Client A'),b=await h.peer('Client B');await a.request('CREATE_ROOM');const code=a.room.roomCode;await b.request('JOIN_ROOM',{roomCode:code.toLowerCase()});return {a,b,code};}
async function ready(a,b){await a.request('SELECT_SEAT',{seat:'GERMANY'});await b.request('SELECT_SEAT',{seat:'SOVIET'});await a.request('SET_READY',{ready:true});await b.request('SET_READY',{ready:true});return Promise.all([a.wait(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT'),b.wait(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT')]);}

test('MP001 wire: two clients create/join/seat/ready -> server match and private snapshots',async t=>{
  let match;const h=await network(t,{factory:(...args)=>match=createMatchSession(...args)}),{a,b,code}=await roomPair(h);
  const [ga,sb]=await ready(a,b);assertPrivate(ga.payload.view,'GERMAN');assertPrivate(sb.payload.view,'SOVIET');
  assert.equal(ga.payload.matchId,sb.payload.matchId);assert.equal(ga.payload.matchId,match.matchId);
  assert.equal(a.room.status,'IN_GAME');assert.equal(b.room.status,'IN_GAME');
  for(const p of [a,b]){const types=p.messages.map(m=>m.messageType);assert(types.indexOf('MATCH_STARTING')<types.indexOf('MATCH_CREATED'));assert(types.indexOf('MATCH_CREATED')<types.indexOf('PLAYER_VIEW_SNAPSHOT'));}
  evidence.push({flow:'two-client-production-start',roomCode:code,steps:['A CREATE_ROOM','B JOIN_ROOM (lowercase)','A Germany','B Soviet','A READY','B READY','server STARTING','server MATCH_CREATED','separate PLAYER_VIEW_SNAPSHOT'],matchId:match.matchId,scenarioId:match.scenarioId,
    germany:{viewer:ga.payload.view.viewer,enemyUnits:0,authoritativeState:false},soviet:{viewer:sb.payload.view.viewer,enemyUnits:0,authoritativeState:false},result:'PASS'});
});

test('MP001 wire: nonempty hidden deployment DTO contains own units and no enemy IDs',async t=>{
  let secretIds;
  const h=await network(t,{factory:(...args)=>{
    const m=createMatchSession(...args),s=m.authoritative;
    // Trusted test-only setup uses official deploy/ready actions; fixture bypasses network gameplay for the retained MP-001 initial privacy test.
    for(const side of ['SOVIET','GERMAN']){
      const controllerId=controllerIdForSide(s,side),zone=deploymentHexKeysForSide(s.state,s.scenario,side);
      const units=s.scenario.deployment.units.filter(u=>u.side===side);
      for(const [index,unit]of units.entries()){
        const result=dispatchGameAction(s,{type:'DEPLOY_INITIAL_UNIT',controllerId,deploymentUnitId:unit.id,hex:s.state.hexes[zone[Math.floor(index/s.rules.stackingLimit)]].coord}).result;
        assert(result.accepted,JSON.stringify(result.issues));
      }
      if(side==='SOVIET'){const result=dispatchGameAction(s,{type:'READY_FOR_PHASE_END',controllerId}).result;assert(result.accepted,JSON.stringify(result.issues));}
    }
    secretIds={GERMAN:Object.values(s.state.units).filter(u=>u.side==='GERMAN').map(u=>u.id),SOVIET:Object.values(s.state.units).filter(u=>u.side==='SOVIET').map(u=>u.id)};
    return m;
  }}),{a,b}=await roomPair(h),[ga,sb]=await ready(a,b);
  assert(ga.payload.view.units.length>0);assert(sb.payload.view.units.length>0);
  assertPrivate(ga.payload.view,'GERMAN',secretIds.SOVIET);assertPrivate(sb.payload.view,'SOVIET',secretIds.GERMAN);
  evidence.push({flow:'nonempty-hidden-deployment-challenge',setup:'trusted test factory via official Core deployment actions',germanFriendlyUnits:ga.payload.view.units.length,sovietFriendlyUnits:sb.payload.view.units.length,enemyIdsLeaked:0,result:'PASS'});
});

test('MP001 wire: simultaneous Germany claim resolves to one owner',async t=>{
  const h=await network(t),{a,b}=await roomPair(h);
  const replies=await Promise.all([a.request('SELECT_SEAT',{seat:'GERMANY'}),b.request('SELECT_SEAT',{seat:'GERMANY'})]);
  assert.equal(replies.filter(r=>r.messageType==='ROOM_ERROR'&&r.payload.code==='SEAT_TAKEN').length,1);
  const owner=a.room.seats.GERMANY.controllerId;assert([a.welcome.controllerId,b.welcome.controllerId].includes(owner));
  evidence.push({flow:'simultaneous-seat-claim',successfulClaims:1,rejectedClaims:1,result:'PASS'});
});

test('MP001 wire: disconnect broadcasts reserved seat and token reconnect restores identity',async t=>{
  const h=await network(t),{a,b}=await roomPair(h);await a.request('SELECT_SEAT',{seat:'GERMANY'});
  const original=a.welcome;a.ws.terminate();
  const disconnected=await b.wait(m=>m.messageType==='ROOM_STATE'&&m.payload.room?.clients.some(c=>c.controllerId===original.controllerId&&!c.connected));
  assert.equal(disconnected.payload.room.seats.GERMANY.controllerId,original.controllerId);
  const c=await h.peer(null,original.reconnectToken);
  await c.wait(m=>m.messageType==='ROOM_STATE'&&!!m.payload.room);
  assert.equal(c.welcome.controllerId,original.controllerId);assert.notEqual(c.welcome.connectionId,original.connectionId);
  assert.equal(c.room.seats.GERMANY.controllerId,original.controllerId);
  evidence.push({flow:'disconnect-reconnect',controllerPreserved:true,connectionChanged:true,seatReserved:true,token:'REDACTED',result:'PASS'});
});

test('MP001 wire: malformed JSON, wrong protocol, Observer and force-start rejected safely',async t=>{
  const h=await network(t),a=await h.peer();
  a.ws.send('{');await a.wait(m=>m.messageType==='ROOM_ERROR'&&m.payload.code==='BAD_MESSAGE');
  for(const [type,payload] of [['FORCE_START_MATCH',{}],['SET_READY',{ready:true,viewer:'OBSERVER'}],['SET_GAME_STATE',{state:{}}]]){
    const response=await a.request(type,payload);assert.equal(response.messageType,'ROOM_ERROR');
  }
  a.ws.send(JSON.stringify({protocolVersion:99,messageType:'CREATE_ROOM',requestId:'wrong-version',payload:{}}));
  await a.wait(m=>m.requestId==='wrong-version'&&m.payload.code==='VERSION_MISMATCH');
  await a.request('CREATE_ROOM');assert(a.room);assert.equal(h.authority.counts().matches,0);
  evidence.push({flow:'invalid-protocol-attempts',attempts:['malformed JSON','protocolVersion 99','FORCE_START_MATCH','viewer OBSERVER','SET_GAME_STATE'],allRejected:true,serverStillOperational:true,result:'PASS'});
});

test('MP001 wire: origin enforcement and oversized frames cannot crash runtime',async t=>{
  const h=await network(t);
  const bad=new WebSocket(`ws://127.0.0.1:${h.port}/ws`,{origin:'https://untrusted.invalid'});
  await new Promise(resolve=>bad.once('error',resolve));
  const a=await h.peer();const closed=new Promise(resolve=>a.ws.once('close',resolve));a.ws.send('a'.repeat(32769));await closed;
  const b=await h.peer();await b.request('CREATE_ROOM');assert(b.room);
});

test.after(()=>{mkdirSync('evidence/mp-002',{recursive:true});writeFileSync('evidence/mp-002/mp001-retained-network-evidence.json',JSON.stringify({protocolVersion:2,transport:'real loopback WebSockets',evidence},null,2)+'\n');});

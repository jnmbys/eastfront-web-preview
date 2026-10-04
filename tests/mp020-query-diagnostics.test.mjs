import test from 'node:test';
import assert from 'node:assert/strict';
import {queryMetrics} from '../scripts/mp020/analyze.mjs';
import {gameHarness} from './helpers/mp002.mjs';
import {movementFixture} from './helpers/move001.mjs';
import {createPresentationState} from '../dist/app/state/presentation.js';
import {queryDraft} from '../dist/app/multiplayer/gameplayProtocol.js';

test('MP020 duration decomposition never aligns server/client epochs; missing remains null',()=>{
 const client=[{stage:'send',type:'QUERY_MATCH',requestId:'q',at:10},{event:'transport',type:'MATCH_QUERY',requestId:'q',callbackAt:810,parsedAt:812},{type:'query-applied',requestId:'q',at:814,canSubmit:true}];
 const server=[{stage:'query-dispatch',requestId:'q',startAt:90000,endAt:90001},{stage:'query-send',requestId:'q',startAt:90005,endAt:90005}];
 const result=queryMetrics('q',client,server);assert.equal(result.unknownResidualMs,795);assert.equal(result.client.receiveToCanSubmitMs,4);assert.equal(result.server.queuedAt,null);
 const missing=queryMetrics('q',client,[]);assert.equal(missing.unknownResidualMs,null);assert.equal(missing.server.queryModelMs,null);
 assert.equal(queryMetrics('other',client,server).client.sendToReceiveMs,null);
 const shifted=server.map(r=>({...r,startAt:r.startAt+1e8,endAt:r.endAt+1e8}));assert.equal(queryMetrics('q',client,shifted).unknownResidualMs,795);
});
test('MP020 diagnostics are inert when disabled or broken; query result and authorized gates unchanged',()=>{
 const h=gameHarness(()=>movementFixture()),p=createPresentationState();p.selectedUnitId='mover';
 const baseline=h.query(h.a,p).payload.model,rows=[];
 h.authority.setDiagnostics({active:()=>false,latency(){throw Error('disabled observer called');}});
 assert.deepEqual(h.query(h.a,p).payload.model,baseline);
 h.authority.setDiagnostics({active(){throw Error('observer');},latency(){throw Error('observer');}});
 assert.deepEqual(h.query(h.a,p).payload.model,baseline);
 h.authority.setDiagnostics({active:()=>true,latency(_id,row){rows.push(row);}});
 assert.deepEqual(h.query(h.a,p).payload.model,baseline);
 assert(rows.some(r=>r.stage==='query-dispatch'));assert(rows.some(r=>r.stage==='query-model'));assert(rows.every(r=>r.endAt>=r.startAt));
 const allowed=new Set(['stage','startAt','endAt','serverTimestamp','requestId','revision','sequence','type']);for(const row of rows)for(const key of Object.keys(row))assert(allowed.has(key));
 assert(!JSON.stringify(rows).includes('mover'));
 const other=h.query(h.b,p).payload.model;assert(other.readOnly);assert.equal(other.movement,null);assert.equal(other.playerView.viewer,'SOVIET');
 // Stale revision uses existing resync snapshot, never a current legal query reply.
 const old=h.a.send('QUERY_MATCH',{matchId:h.match.matchId,expectedRevision:99,draft:queryDraft(p)});
 assert.equal(old.messageType,'PLAYER_VIEW_SNAPSHOT');assert(old.payload.resync);
 assert.equal(h.match.matchRevision,0);
});

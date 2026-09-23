import test from 'node:test';
import assert from 'node:assert/strict';
import {cpSync,mkdtempSync,writeFileSync,readFileSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {WebSocket as Wire} from 'ws';
import {collectSamples} from '../scripts/mp005a/samples.mjs';
import {encodeSnapshot,decodeSnapshot,MAP_SNAPSHOT as mapFormat,COMPACT_SNAPSHOT as compact,FULL_SNAPSHOT as full} from '../dist/app/multiplayer/snapshotCodec.js';
import {LobbyClient} from '../dist/app/multiplayer/client.js';
import {NetworkPlayerSession} from '../dist/app/multiplayer/networkSession.js';
import {createPresentationState} from '../dist/app/state/presentation.js';
import {createMultiplayerServer} from '../.server-dist/server/runtime.js';
import {RoomAuthority} from '../.server-dist/server/authority.js';
import {DEFAULTS} from '../.server-dist/server/config.js';
import {createMatchSession} from '../.server-dist/server/match.js';
import {fixture} from './helpers/combat-fixture.mjs';
import {gameHarness,production,checkSnapshot} from './helpers/mp002.mjs';
let cachedSamples;const auditSamples=()=>cachedSamples??=collectSamples().samples;
const wait=async(fn)=>{const start=performance.now();while(!fn()){if(performance.now()-start>6000)throw Error('MP005B bounded wait');await new Promise(r=>setTimeout(r,3));}};
async function legacy(t,v2=false){
 const dir=mkdtempSync(resolve(tmpdir(),'mp005b-legacy-'));cpSync('.server-dist',dir,{recursive:true});
 cpSync('dist/app/multiplayer/config.js',dir+'/src/multiplayer/config.js');
 cpSync('dist/app/multiplayer/diagnosticTiming.js',dir+'/src/multiplayer/diagnosticTiming.js');
 writeFileSync(dir+'/package.json','{"type":"module"}');symlinkSync(resolve('node_modules'),dir+'/node_modules');
 for(const [name,path] of [['client','src/multiplayer/client'],['protocol','src/multiplayer/protocol'],['authority','server/authority'],['runtime','server/runtime']]){
  const source=readFileSync(v2?(['client','protocol'].includes(name)?`tests/fixtures/mp006-v2/${name}.ts`:`${path}.ts`):`tests/fixtures/mp005b-legacy/${name}.ts`,'utf8');
  writeFileSync(`${dir}/${path}.js`,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
 }
 if(v2)writeFileSync(dir+'/src/multiplayer/snapshotCodec.js',ts.transpileModule(readFileSync('tests/fixtures/mp006-v2/snapshotCodec.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
 t.after(()=>rmSync(dir,{recursive:true,force:true}));
 return {client:(await import(pathToFileURL(dir+'/src/multiplayer/client.js'))).LobbyClient,
   authority:(await import(pathToFileURL(dir+'/server/authority.js'))).RoomAuthority,
   runtime:(await import(pathToFileURL(dir+'/server/runtime.js'))).createMultiplayerServer};
}
async function pair(t,{oldServer=false,oldClient=false,v2=false,format=compact}={}){
 const old=(oldServer||oldClient)?await legacy(t,v2):null;
 const config={...DEFAULTS,port:0,allowedOrigins:['http://127.0.0.1:4173'],messagesPerWindow:10000};let match;
 const Authority=oldServer?old.authority:RoomAuthority;
 const authority=new Authority(config,Date.now,(...args)=>{match=createMatchSession(...args);match.authoritative=production(17);return match;});
 const server=(oldServer?old.runtime:createMultiplayerServer)(config,authority),port=await server.listen();
 const previous={window:globalThis.window,sessionStorage:globalThis.sessionStorage,WebSocket:globalThis.WebSocket},sockets=[],sent=[],delivered=[];
 globalThis.window=new EventTarget();globalThis.sessionStorage={getItem(){return null;},setItem(){},removeItem(){}};
 class BrowserSocket extends Wire {
  constructor(url){super(url,{origin:config.allowedOrigins[0]});sockets.push(this);}
  send(raw){sent.push({socket:this,...JSON.parse(raw)});super.send(raw);}
  set onmessage(fn){super.onmessage=event=>{const m=JSON.parse(String(event.data));delivered.push({socket:this,message:m});if(this.drop?.(m))return;
    const changed=this.mutate?.(m);if(changed)return fn({data:JSON.stringify(changed)});
    if(this.delay?.(m))return setTimeout(()=>fn(event),25);fn(event);};}
 }
 globalThis.WebSocket=BrowserSocket;
 const peer=(Client=LobbyClient)=>{let session;const p=createPresentationState(),client=new Client(`ws://127.0.0.1:${port}/ws`,()=>{if(!session&&client.state.snapshot)session=new NetworkPlayerSession(client,p,()=>{});},Client===LobbyClient?format:compact);client.connect('compatibility test');
  return {client,p,get session(){return session;},socket:sockets.at(-1)};};
 const a=peer(oldClient?old.client:LobbyClient),b=peer();
 t.after(async()=>{a.session?.dispose();b.session?.dispose();a.client.dispose();b.client.dispose();for(const s of sockets)s.terminate();await server.close();Object.assign(globalThis,previous);});
 await wait(()=>a.client.canMutate&&b.client.canMutate);
 a.client.send('CREATE_ROOM',{});await wait(()=>a.client.state.room&&a.client.canMutate);
 b.client.send('JOIN_ROOM',{roomCode:a.client.state.room.roomCode});await wait(()=>b.client.state.room&&b.client.canMutate);
 for(const [p,seat] of [[a,'GERMANY'],[b,'SOVIET']]){p.client.send('SELECT_SEAT',{seat});await wait(()=>p.client.canMutate);}
 a.client.send('SET_READY',{ready:true});await wait(()=>a.client.canMutate);b.client.send('SET_READY',{ready:true});await wait(()=>a.session?.ready&&b.session?.interactive);
 const deploy=async i=>{const rev=b.session.matchRevision,row=b.session.model.deployment.roster[i],key=b.session.model.deployment.zoneKeys[i],[q,r]=key.split(',').map(Number);
  b.session.submit({type:'DEPLOY_INITIAL_UNIT',deploymentUnitId:row.id,hex:{q,r}});await wait(()=>b.session.matchRevision===rev+1&&b.session.interactive);return rev+1;};
 return {a,b,deploy,sockets,sent,delivered,get match(){return match;}};
}
test('MP005B actual codec roundtrips all 142 MP005A authorized samples including hidden deployment, artillery, knowledge loss and combat',()=>{
 const samples=auditSamples();assert.equal(samples.length,142);
 for(const {message} of samples){const p=message.payload,canonical={...p,model:{...p.model,playerView:p.view,hexes:p.view.hexes,edges:p.view.edges}};
  const wire=encodeSnapshot(canonical,compact),decoded=decodeSnapshot(JSON.parse(JSON.stringify(wire)),true);
  assert.deepEqual(decoded,p);if(!p.resync)assert.equal(wire.format,compact);
  assert.notEqual(decoded.model.playerView,decoded.view);assert.notEqual(decoded.model.hexes,decoded.view.hexes);assert.notEqual(decoded.model.playerView.hexes,decoded.model.hexes);
  assert.deepEqual(decodeSnapshot(JSON.parse(JSON.stringify(encodeSnapshot(canonical,full))),false),p);
 }
});
test('MP005B malformed full/compact structures, unknown fields, Observer, inconsistent revision and unnegotiated compact fail atomically',()=>{
 const p=auditSamples()[0].message.payload;
 const canonical={...p,resync:false,model:{...p.model,playerView:p.view,hexes:p.view.hexes,edges:p.view.edges}},wire=JSON.parse(JSON.stringify(encodeSnapshot(canonical,compact)));
 assert.throws(()=>decodeSnapshot(wire,false));
 for(const original of [p,wire])for(const corrupt of [s=>delete s.view.units,s=>s.view.viewer='OBSERVER',s=>s.view.hexes[0].coord.q='wrong',s=>s.model.counters=[{}],s=>s.revision++,s=>s.events=[{kind:'move'}],s=>s.model.authoritativeState={},s=>s.view.pendingDecision={kind:'RETREAT'}]){
  const bad=structuredClone(original);corrupt(bad);assert.throws(()=>decodeSnapshot(bad,true));assert.deepEqual(p.view.units,[]);
 }
});
test('MP005B real mixed room: baseline client gets full, new client compact; ACK alone never places; duplicate Action executes once',async t=>{
 const h=await pair(t,{oldClient:true});h.b.socket.delay=m=>m.messageType==='PLAYER_VIEW_SNAPSHOT'&&m.payload.matchRevision===1;
 const promise=h.deploy(0);await wait(()=>h.delivered.some(d=>d.message.messageType==='ACTION_ACCEPTED'));
 assert.equal(h.b.session.matchRevision,0);assert.equal(h.b.session.playerView.units.length,0);await promise;
 assert.equal(h.a.session.playerView.units.length,0);assert.equal(h.b.session.playerView.units.length,1);
 const fa=h.delivered.findLast(d=>d.socket===h.a.socket&&d.message.messageType==='PLAYER_VIEW_SNAPSHOT').message.payload;
 const fb=h.delivered.findLast(d=>d.socket===h.b.socket&&d.message.messageType==='PLAYER_VIEW_SNAPSHOT').message.payload;
 assert.equal(fa.format,full);assert.equal(fb.format,compact);
 for(const p of [h.a,h.b])checkSnapshot(h.match,{welcome:{controllerId:p.client.state.controllerId}},p.client.state.snapshot);
 const {socket,...request}=h.sent.findLast(m=>m.messageType==='SUBMIT_ACTION');socket.send(JSON.stringify(request));await wait(()=>h.delivered.filter(d=>d.message.requestId===request.requestId&&d.message.messageType==='ACTION_ACCEPTED').length===2);
 assert.equal(h.match.matchRevision,1);await h.deploy(1);assert.equal(h.match.matchRevision,2);
 assert.equal(h.sent.filter(m=>['QUERY_MATCH','RESYNC_MATCH'].includes(m.messageType)).length,0);
});
test('MP005B new clients on exact baseline server automatically fallback once on correlated UNSUPPORTED_MESSAGE without reconnect',async t=>{
 const h=await pair(t,{oldServer:true});assert.equal(h.sockets.length,2);assert.equal(h.a.client.snapshotFormat,full);assert.equal(h.b.client.snapshotFormat,full);
 await h.deploy(0);assert.equal(h.b.session.playerView.units.length,1);assert.equal(h.a.session.playerView.units.length,0);assert.equal(h.a.client.state.error,null);
 assert.equal(h.sent.filter(m=>m.messageType==='SET_SNAPSHOT_FORMAT').length,2);
});
test('MP005B malformed compact causes one full resync, no partial fake unit, then stays full and continues',async t=>{
 const h=await pair(t);let corrupted=false;
 h.b.socket.mutate=m=>{if(!corrupted&&m.messageType==='PLAYER_VIEW_SNAPSHOT'&&m.payload.matchRevision===1){corrupted=true;const bad=structuredClone(m);bad.payload.view.units.push({id:'fake'});return bad;}};
 await h.deploy(0);assert(corrupted);assert.equal(h.sent.filter(m=>m.messageType==='RESYNC_MATCH').length,1);assert.equal(h.b.client.snapshotFormat,full);assert.equal(h.b.session.playerView.units.length,1);
 await h.deploy(1);assert.equal(h.b.session.playerView.units.length,2);assert.equal(h.delivered.findLast(d=>d.socket===h.b.socket&&d.message.messageType==='PLAYER_VIEW_SNAPSHOT').message.payload.format,full);
});
test('MP005B persistent malformed recovery terminates with an error instead of a resync/reconnect loop',async t=>{
 const h=await pair(t);h.b.socket.mutate=m=>{if(m.messageType==='PLAYER_VIEW_SNAPSHOT'&&m.payload.matchRevision===1){const bad=structuredClone(m);delete bad.payload.view;return bad;}};
 const row=h.b.session.model.deployment.roster[0],key=h.b.session.model.deployment.zoneKeys[0],[q,r]=key.split(',').map(Number);
 h.b.session.submit({type:'DEPLOY_INITIAL_UNIT',deploymentUnitId:row.id,hex:{q,r}});
 await wait(()=>h.b.client.state.connection==='DISCONNECTED');assert.equal(h.b.client.state.error,'invalidServer');assert.equal(h.b.session.playerView.units.length,0);assert.equal(h.sent.filter(m=>m.messageType==='RESYNC_MATCH').length,1);
 await new Promise(r=>setTimeout(r,850));assert.equal(h.sockets.length,2);
});
test('MP005B real sequence gap uses full recovery; reconnect renegotiates independently and continues',async t=>{
 const h=await pair(t);let dropped=false;h.a.socket.drop=m=>{if(!dropped&&m.messageType==='PLAYER_VIEW_SNAPSHOT'&&m.payload.matchRevision===1){dropped=true;return true;}return false;};
 await h.deploy(0);await h.deploy(1);await wait(()=>h.a.session.matchRevision===2&&!h.a.session.syncing);assert.equal(h.a.client.snapshotFormat,full);assert.equal(h.sent.filter(m=>m.messageType==='RESYNC_MATCH').length,1);
 const controller=h.b.client.state.controllerId;h.b.socket.terminate();await wait(()=>h.sockets.length===3&&h.b.session.interactive);assert.equal(h.b.client.state.controllerId,controller);assert.equal(h.b.client.snapshotFormat,compact);
 await h.deploy(2);assert.equal(h.b.session.matchRevision,3);assert.equal(h.a.session.playerView.units.length,0);
});

test('MP005B negotiation completion resumes only the already server-authorized forced decision',async()=>{
 const h=gameHarness(()=>fixture().s);h.submit(h.a,{type:'ATTACK',attackerUnitIds:['g'],target:{q:0,r:0}});
 const snapshot=h.b.last('PLAYER_VIEW_SNAPSHOT').payload;assert.equal(snapshot.forcedAction.type,'PASS_REACTION');
 let available=false,listener;const sent=[],client={state:{snapshot,connection:'CONNECTED',synced:true,pending:false},get canMutate(){return available;},subscribe(fn){listener=fn;return ()=>{};},send(type,payload){sent.push({type,payload});return 'forced';},dispose(){}};
 const n=new NetworkPlayerSession(client,createPresentationState(),()=>{});listener(null);await new Promise(r=>setTimeout(r,5));assert.equal(sent.length,0);
 available=true;listener(null);await new Promise(r=>setTimeout(r,5));assert.equal(sent.length,1);assert.deepEqual(sent[0].payload.action,snapshot.forcedAction);listener(null);await new Promise(r=>setTimeout(r,5));assert.equal(sent.length,1);n.dispose();
});

// MP006 explicitly exercises v3; the historical v2 assertions above remain frozen.
test('MP006 mixed v2/v3 recipients, duplicate ACK semantics, gap recovery and reconnect',async t=>{
 const h=await pair(t,{oldClient:true,v2:true,format:mapFormat});
 await h.deploy(0);await wait(()=>h.a.session.matchRevision===1);
 const last=p=>h.delivered.findLast(d=>d.socket===p.socket&&d.message.messageType==='PLAYER_VIEW_SNAPSHOT').message.payload;
 assert.equal(last(h.a).format,compact);assert.equal(last(h.b).format,mapFormat);
 assert.equal(h.a.session.playerView.units.length,0);assert.equal(h.b.session.playerView.units.length,1);
 for(const p of [h.a,h.b])checkSnapshot(h.match,{welcome:{controllerId:p.client.state.controllerId}},p.client.state.snapshot);
 let dropped=false;h.b.socket.drop=m=>{if(!dropped&&m.messageType==='PLAYER_VIEW_SNAPSHOT'&&m.payload.matchRevision===2){dropped=true;return true;}return false;};
 const row=h.b.session.model.deployment.roster[1],[q,r]=h.b.session.model.deployment.zoneKeys[1].split(',').map(Number);
 h.b.session.submit({type:'DEPLOY_INITIAL_UNIT',deploymentUnitId:row.id,hex:{q,r}});
 await wait(()=>dropped);h.b.client.resyncMatch(h.b.session.matchId??h.b.client.state.match.matchId);
 await wait(()=>h.b.session.matchRevision===2&&h.b.session.interactive);assert.equal(h.b.client.snapshotFormat,full);
 h.b.socket.terminate();await wait(()=>h.sockets.length===3&&h.b.session.interactive);assert.equal(h.b.client.snapshotFormat,mapFormat);
 await h.deploy(2);assert.equal(h.b.session.matchRevision,3);
});
test('MP006 v3 preference falls back to exact v2 server without reconnect',async t=>{
 const h=await pair(t,{oldServer:true,v2:true,format:mapFormat});await h.deploy(0);
 assert.equal(h.b.client.snapshotFormat,compact);assert.equal(h.sockets.length,2);
 assert.equal(h.sent.filter(m=>m.messageType==='SET_SNAPSHOT_FORMAT').length,4);
});
test('MP006 v3 preference falls back to exact v1 server without reconnect',async t=>{
 const h=await pair(t,{oldServer:true,format:mapFormat});await h.deploy(0);
 assert.equal(h.b.client.snapshotFormat,full);assert.equal(h.sockets.length,2);
 assert.equal(h.sent.filter(m=>m.messageType==='SET_SNAPSHOT_FORMAT').length,4);
});
test('MP006 corrupt table never applies; one full recovery, persistent corruption terminates',async t=>{
 const h=await pair(t,{format:mapFormat});let corrupted=false;
 h.b.socket.mutate=m=>{if(!corrupted&&m.messageType==='PLAYER_VIEW_SNAPSHOT'&&m.payload.matchRevision===1){corrupted=true;const bad=structuredClone(m);bad.payload.view.hexes.rows[0][0]=-1;return bad;}};
 await h.deploy(0);assert(corrupted);assert.equal(h.b.client.snapshotFormat,full);assert.equal(h.sent.filter(m=>m.messageType==='RESYNC_MATCH').length,1);
 h.b.socket.mutate=m=>{if(m.messageType==='PLAYER_VIEW_SNAPSHOT'){const bad=structuredClone(m);delete bad.payload.view;return bad;}};
 const row=h.b.session.model.deployment.roster[1],[q,r]=h.b.session.model.deployment.zoneKeys[1].split(',').map(Number);
 h.b.session.submit({type:'DEPLOY_INITIAL_UNIT',deploymentUnitId:row.id,hex:{q,r}});
 await wait(()=>h.b.client.state.connection==='DISCONNECTED');assert.equal(h.b.client.state.error,'invalidServer');assert.equal(h.b.session.matchRevision,1);assert.equal(h.sent.filter(m=>m.messageType==='RESYNC_MATCH').length,1);
});

test('MP006 v3 sequence gap triggers one full recovery with no stale partial apply',async t=>{
 const h=await pair(t,{format:mapFormat});let dropped=false;
 h.a.socket.drop=m=>{if(!dropped&&m.messageType==='PLAYER_VIEW_SNAPSHOT'&&m.payload.matchRevision===1){dropped=true;return true;}return false;};
 await h.deploy(0);assert.equal(h.a.session.matchRevision,0);await h.deploy(1);
 await wait(()=>h.a.session.matchRevision===2&&!h.a.session.syncing);
 assert.equal(h.a.client.snapshotFormat,full);assert.equal(h.sent.filter(m=>m.messageType==='RESYNC_MATCH').length,1);assert.equal(h.a.session.playerView.units.length,0);
});

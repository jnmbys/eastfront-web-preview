// Protocol integration only, not browser cookie-jar/TLS/device acceptance.
import test from 'node:test';import assert from 'node:assert/strict';
import {request} from 'node:http';import {randomBytes,createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {resolve,join} from 'node:path';import {pathToFileURL} from 'node:url';
import {WebSocket} from 'ws';
import {startFixture} from '../scripts/mp021/fixture.mjs';import {ownerPreview} from '../scripts/mp011-r1/owner-preview.mjs';
import {root} from '../scripts/mp021/package.mjs';import {installObserver} from '../scripts/mp017/web/observer.mjs';import {ComparisonTimeline} from '../scripts/mp017/web/timeline.mjs';
import {safeTiming,makeRecord} from '../scripts/mp021/web/records.mjs';import {joinRecord} from '../scripts/mp021/join.mjs';
globalThis.window=new EventTarget();globalThis.location={search:'?transportDiagnostics=1'};globalThis.sessionStorage={getItem(){return null;},setItem(){},removeItem(){}};
test('MP021 original owner boundary + same-session four real moves + client/server export correlation', {timeout:60000},async()=>{
 const out=resolve(process.env.MP021_TEST_DIR??'evidence/mp-021/local');mkdirSync(out,{recursive:false});
 const origin='https://mp021-local.invalid',password=randomBytes(32).toString('hex'),boundaryRows=[];
 const fixture=await startFixture({origin,runDir:out}),boundary=ownerPreview({origin,passwordSha256:createHash('sha256').update(password).digest('hex'),upstreamPort:fixture.port,diagnostic:r=>boundaryRows.push(r)}),sockets=new Set();
 boundary.on('connection',s=>{sockets.add(s);s.once('close',()=>sockets.delete(s));});await new Promise(r=>boundary.listen(0,'127.0.0.1',r));const port=boundary.address().port;
 const req=(path,headers={},body)=>new Promise((ok,fail)=>{const r=request({host:'127.0.0.1',port,path,method:body===undefined?'GET':'POST',headers:{host:new URL(origin).host,...headers}},s=>{let text='';s.on('data',b=>text+=b);s.on('end',()=>ok({status:s.statusCode,headers:s.headers,text}));});r.on('error',fail);r.end(body);});
 let client,restore;const saved=[],anonymous=[];let rows=[];
 try{
  for(const path of ['/','/mp021/config.json','/v/candidate/move/real/mp021/entry.mjs','/v/candidate/move/real/app/main.js']){const r=await req(path);assert.equal(r.status,303);anonymous.push({path,status:r.status});}
  for(const s of ['deployment','move'])for(const mode of ['real','delay','timeout']){const path=`/ws/${s}/${mode}`,r=await req(path,{origin,connection:'Upgrade',upgrade:'websocket','sec-websocket-key':randomBytes(16).toString('base64'),'sec-websocket-version':'13'});assert.equal(r.status,403);assert.equal(r.headers['content-length'],'0');anonymous.push({path,status:r.status});}
  const login=await req('/__mp010_login',{origin,'content-type':'application/x-www-form-urlencoded'},'password='+password);assert.equal(login.status,303);const cookie=login.headers['set-cookie'][0].split(';')[0];
  const config=JSON.parse((await req('/mp021/config.json',{cookie})).text);assert.equal(config.instanceId,fixture.config.instanceId);
  for(const path of ['/','/controller.mjs','/records.mjs','/v/candidate/move/real/mp021/entry.mjs','/v/candidate/move/real/mp021/bootstrap.mjs','/v/candidate/move/real/app/main.js','/v/candidate/move/real/vendor/eastfront-digital-core/reference/strategic-reset-f-map.json'])assert.equal((await req(path,{cookie})).status,200);
  class Socket extends WebSocket{constructor(url){super(url,{origin,headers:{host:new URL(origin).host,cookie}});}}globalThis.WebSocket=Socket;
  const load=p=>import(pathToFileURL(join(root,'client/app',p)).href);
  const [{LobbyClient},{NetworkPlayerSession},{createPresentationState},{queryDraft}]=await Promise.all(['multiplayer/client.js','multiplayer/networkSession.js','state/presentation.js','multiplayer/gameplayProtocol.js'].map(load));
  const timeline=new ComparisonTimeline();let input=null;restore=installObserver({LobbyClient,NetworkPlayerSession,timeline,queryDraft,inputAt:()=>input});
  const action=e=>rows.push(safeTiming('action',e.detail)),transport=e=>rows.push(safeTiming('transport',e.detail));window.addEventListener('eastfront-action-timing',action);window.addEventListener('eastfront-transport-timing',transport);
  const until=async f=>{const end=performance.now()+15000;while(!f()){if(performance.now()>end)throw Error('Local protocol fixture timeout');await new Promise(r=>setTimeout(r,3));}};
  client=new LobbyClient(`ws://127.0.0.1:${port}/ws/move/real`,()=>{},'snapshot-v3-map-table');client.connect('MP021 local');await until(()=>client.canMutate);
  for(const[type,payload]of [['CREATE_ROOM',{}],['SELECT_SEAT',{seat:'GERMANY'}],['SET_READY',{ready:true}]]){assert(client.send(type,payload));await until(()=>client.canMutate);}
  await until(()=>client.state.snapshot);const p=createPresentationState();let n;n=new NetworkPlayerSession(client,p,kind=>{if(kind!=='status')n.requestProjection();});
  const used=new Set();for(let index=1;index<=4;index++){
   rows=[];let target,unit;
   for(const u of n.playerView.units.filter(u=>u.side===n.playerView.viewer&&!used.has(u.id))){p.selectedUnitId=u.id;p.interactionMode='MOVE_PATH';p.pathDraft=[];n.requestProjection();await until(()=>n.interactive);target=n.model.movement?.options.find(o=>o.legal)?.hex;if(target){unit=u;break;}}
   assert(unit&&target);used.add(unit.id);p.pathDraft=[target];n.requestProjection();await until(()=>n.interactive);assert(!n.model.movement.issues.length);
   const before=n.matchRevision,previous={...unit.hex};input=performance.now();n.submit({type:'MOVE',unitId:unit.id,path:[target]});input=null;assert.equal(n.matchRevision,before);assert.deepEqual(n.playerView.units.find(u=>u.id===unit.id).hex,previous);
   await until(()=>n.matchRevision===before+1&&n.interactive);assert(!n.pendingAction);
   const record=makeRecord({config,device:'Local Node protocol fixture / NOT Huawei',index,report:timeline.report(),sample:{events:rows,restored:n.interactive,flags:[],foreground:{satisfiedAtInput:true,kind:'synthetic local assertion; browser foreground NOT tested'}},exportedAt:new Date().toISOString()});
   assert.equal(record.classification,index===1?'warmup':'normal',JSON.stringify(record.reasons));writeFileSync(join(out,`client-${index}.json`),JSON.stringify(record,null,2)+'\n',{flag:'wx'});saved.push(record);
  }
  await fixture.flush();const server=readFileSync(join(out,'server-query.jsonl'),'utf8').trim().split('\n').map(s=>JSON.parse(s));
  const tables=saved.map(c=>joinRecord(c,server));for(const table of tables){const recovery=table.queries.filter(q=>q.phase==='authority-recovery');assert.equal(recovery.length,1);for(const q of recovery){assert.deepEqual(q.missingServerStages,[]);assert(!q.serverDuplicateStage);assert.equal(q.correlationStatus,'complete');assert.equal(q.timing.server.writeError,false);assert(q.timing.server.receiveToHandoffMs>=0);}}
  writeFileSync(join(out,'joined.json'),JSON.stringify(tables,null,2)+'\n',{flag:'wx'});
  const safe=JSON.stringify({saved,server,boundaryRows});assert(!safe.includes(password));assert(!safe.includes(cookie));assert(!safe.includes('reconnectToken'));
  writeFileSync(join(out,'summary.json'),JSON.stringify({kind:'Local Node integration, NOT browser/device acceptance',publicOpened:false,tlsTested:false,browserCookieJarTested:false,anonymous,authorizedAssets:true,continuousSession:true,moves:saved.length,purposes:saved.map(r=>r.purpose),recoveryQueryCounts:tables.map(t=>t.queries.filter(q=>q.phase==='authority-recovery').length),exactJoin:true,sourceSha:config.sourceSha,packageTreeSha256:config.packageTreeSha256},null,2)+'\n',{flag:'wx'});
  window.removeEventListener('eastfront-action-timing',action);window.removeEventListener('eastfront-transport-timing',transport);n.dispose();
 }finally{client?.dispose();restore?.();for(const s of sockets)s.destroy();await new Promise(r=>boundary.close(r));await fixture.close();}
});

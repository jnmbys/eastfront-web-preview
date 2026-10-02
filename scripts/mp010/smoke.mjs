// Against the local lab already started by serve.mjs; metadata-only evidence.
import {WebSocket} from 'ws';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {artifacts,verifyArtifacts} from './integrity.mjs';
import {FORMAT,VERSIONS} from './config.mjs';
const manifest=verifyArtifacts(),origin=process.argv[2]??'http://127.0.0.1:4180';
const {clientMessage}=await import(pathToFileURL(join(artifacts,'candidate/app/multiplayer/protocol.js')));
const {decodeSnapshot}=await import(pathToFileURL(join(artifacts,'candidate/app/multiplayer/snapshotCodec.js')));
for(const [label,sha] of Object.entries(VERSIONS)){
 const meta=await (await fetch(`${origin}/v/${label}/deployment/real/mp010-build.json`)).json();assert.equal(meta.sourceSha,sha);assert.equal(meta.samplerSha256,manifest.samplerSha256);
 const config=await (await fetch(`${origin}/v/${label}/deployment/real/multiplayer-config.json`)).json();assert.equal(config.serverUrl,origin.replace(/^http/,'ws')+'/ws/deployment/real');
}
const rows=[];
for(const scenario of ['deployment','move'])for(const mode of ['real','delay','timeout']){
 const ws=new WebSocket(origin.replace(/^http/,'ws')+`/ws/${scenario}/${mode}`,{origin}),messages=[],listeners=new Set(),events=[];let stage='connect';
 ws.on('message',data=>{const m=JSON.parse(data.toString());messages.push(m);if('serverSequence' in m.payload)events.push({type:m.messageType,requestId:m.requestId,revision:m.payload.matchRevision,sequence:m.payload.serverSequence,bytes:data.length,at:performance.now()});for(const f of listeners)f(m);});
 ws.on('close',code=>events.push({type:'socket-close',code,at:performance.now()}));
 ws.on('error',error=>events.push({type:'socket-error',error:error.message,at:performance.now()}));
 await new Promise((res,rej)=>{ws.once('open',res);ws.once('error',rej);});
 const wait=pred=>{const found=messages.findLast(pred);if(found)return Promise.resolve(found);return new Promise((res,rej)=>{const timer=setTimeout(()=>{listeners.delete(f);rej(Error(`Lab smoke timeout ${scenario}/${mode}/${stage}; metadata: ${JSON.stringify(events)}`));},20000),f=m=>{if(pred(m)){clearTimeout(timer);listeners.delete(f);res(m);}};listeners.add(f);});};
 const request=(type,payload={})=>{stage=type;const id=randomUUID(),reply=wait(m=>m.requestId===id);ws.send(JSON.stringify(clientMessage(type,payload,id)));return reply;};
 try{
  await request('HELLO',{displayName:'MP010 smoke'});const format=await request('SET_SNAPSHOT_FORMAT',{format:FORMAT});assert.equal(format.payload.format,FORMAT);
  await request('CREATE_ROOM');await request('SELECT_SEAT',{seat:scenario==='move'?'GERMANY':'SOVIET'});await request('SET_READY',{ready:true});
  const initial=decodeSnapshot((await wait(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT')).payload,true,true);
  const [q,r]=initial.model.deployment?.zoneKeys[0]?.split(',').map(Number)??[0,0];
  const action=scenario==='move'?{type:'MOVE',unitId:'G-I-01',path:[{q:1,r:1}]}:{type:'DEPLOY_INITIAL_UNIT',deploymentUnitId:initial.model.deployment.roster[0].id,hex:{q,r}};
  const started=performance.now(),reply=request('SUBMIT_ACTION',{matchId:initial.matchId,expectedRevision:0,action});
  let recovery,recoveryReply;
  if(mode==='timeout')recovery=setTimeout(()=>{recoveryReply=request('RESYNC_MATCH',{matchId:initial.matchId});},10000);
  const ack=await reply;assert.equal(ack.messageType,'ACTION_ACCEPTED');assert.equal(ack.payload.acceptedRevision,1);
  const result=decodeSnapshot((await wait(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT'&&m.payload.matchRevision===1)).payload,true,true);assert.equal(result.matchRevision,1);
  if(mode==='timeout'){const restored=await recoveryReply;assert.equal(restored?.messageType,'PLAYER_VIEW_SNAPSHOT');assert.equal(restored.payload.resync,true);assert.equal(restored.payload.matchRevision,1);}
  clearTimeout(recovery);for(let i=1;i<events.length;i++)assert(events[i].sequence>events[i-1].sequence,'FIFO sequence must never reverse');
  rows.push({scenario,mode,snapshotFormat:FORMAT,compression:ws.extensions,elapsedMs:performance.now()-started,ordered:true,events:events.map(e=>({...e,at:Math.round((e.at-started)*1000)/1000}))});
 }finally{ws.terminate();}
}
writeFileSync('evidence/mp-010/wire-smoke.json',JSON.stringify({origin,versions:VERSIONS,serverSha:manifest.serverSha,samplerSha256:manifest.samplerSha256,harnessSha256:manifest.harnessSha256,scope:'Local wire/fixture validation, not device measurements',rows},null,2)+'\n');
console.log('MP010 local wire smoke: six scenario/mode combinations passed; FIFO and fixed-format negotiation verified');

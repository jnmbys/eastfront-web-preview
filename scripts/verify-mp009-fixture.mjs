// Local MP-009 browser fixture only. No production code/configuration is changed.
// Run after npm run build and npm run server:build. UI is exercised manually via CUA.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createMultiplayerServer} from '../.server-dist/server/runtime.js';
import {RoomAuthority} from '../.server-dist/server/authority.js';
import {createMatchSession} from '../.server-dist/server/match.js';
import {DEFAULTS} from '../.server-dist/server/config.js';
import {production} from '../tests/helpers/mp002.mjs';
import {dispatchGameAction,controllerIdForSide} from '../.server-dist/src/core-adapter/session.js';
import {deploymentHexKeysForSide} from '../.server-dist/src/core-adapter/core.js';
import {clientMessage} from '../dist/app/multiplayer/protocol.js';
let scenario='deployment',match,ackMs=1800,snapshotMs=4500;
const records=[],config={...DEFAULTS,port:0,host:'127.0.0.1',messagesPerWindow:10000,allowedOrigins:['http://127.0.0.1:4179']};
function setup(){
 const s=production(17),apply=a=>{const r=dispatchGameAction(s,a).result;assert(r.accepted,JSON.stringify(r.issues));};
 for(const [side,special]of [['SOVIET',{'S-I-01':'3,-1'}],['GERMAN',{'G-PZ-01':'2,-1','G-I-01':'1,0','G-J-01':'2,0'}]]){
  const controllerId=controllerIdForSide(s,side),zone=deploymentHexKeysForSide(s.state,s.scenario,side),counts={},ids=s.scenario.deployment.units.filter(u=>u.side===side).map(u=>u.id).sort();
  for(const [id,k]of Object.entries(special)){apply({type:'DEPLOY_INITIAL_UNIT',controllerId,deploymentUnitId:id,hex:s.state.hexes[k].coord});counts[k]=(counts[k]??0)+1;}
  for(const id of ids){if(id in special)continue;const k=zone.find(k=>(counts[k]??0)<2&&!Object.values(special).includes(k));apply({type:'DEPLOY_INITIAL_UNIT',controllerId,deploymentUnitId:id,hex:s.state.hexes[k].coord});counts[k]=(counts[k]??0)+1;}
  apply({type:'READY_FOR_PHASE_END',controllerId});
 }
 apply({type:'READY_FOR_PHASE_END',controllerId:controllerIdForSide(s,'GERMAN')});return s;
}

const authority=new RoomAuthority(config,Date.now,(...args)=>{match=createMatchSession(...args);if(scenario==='move')match.authoritative=setup();return match;});
const originalConnect=authority.connect.bind(authority),originalReceive=authority.receive.bind(authority);
let botId=null;
const botSend=(type,payload={})=>originalReceive(botId,JSON.stringify(clientMessage(type,payload,randomUUID())));
authority.connect=send=>{
 let until=0;
 return originalConnect(message=>{
  if(message.messageType==='ACTION_ACCEPTED')until=Date.now()+snapshotMs;
  const delay=message.messageType==='ACTION_ACCEPTED'?ackMs:('serverSequence' in message.payload?Math.max(0,until-Date.now()):0);
  if(delay)setTimeout(()=>send(message),delay);else send(message);
  if(message.messageType==='ROOM_STATE'&&message.payload.room?.clients?.length===1){
   const code=message.payload.room.roomCode;
   queueMicrotask(()=>{if(botId)return;botId=originalConnect(()=>{});botSend('HELLO',{displayName:'Local verification peer'});botSend('JOIN_ROOM',{roomCode:code});botSend('SELECT_SEAT',{seat:scenario==='move'?'SOVIET':'GERMANY'});botSend('SET_READY',{ready:true});});
  }
 });
};
authority.receive=(id,raw)=>{const m=JSON.parse(raw);records.push({at:performance.now(),type:m.messageType,requestId:m.requestId,action:m.payload?.action?.type});const result=originalReceive(id,raw);if(m.messageType==='SELECT_SEAT'&&botId)botSend('SET_READY',{ready:true});return result;};
const server=createMultiplayerServer(config,authority),port=await server.listen(),root=resolve('dist');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8','.png':'image/png'};
const http=createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');const url=new URL(req.url,'http://127.0.0.1:4179');
 if(url.pathname==='/test/scenario'){scenario=url.searchParams.get('value')==='move'?'move':'deployment';if(botId){authority.disconnect(botId);botId=null;}res.end(scenario);return;}
 if(url.pathname==='/test/delay'){ackMs=Number(url.searchParams.get('ack')??1800);snapshotMs=Number(url.searchParams.get('snapshot')??4500);res.end('configured');return;}
 if(url.pathname==='/test/status'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({scenario,ackMs,snapshotMs,revision:match?.matchRevision,records}));return;}
 if(url.pathname==='/multiplayer-config.json'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({serverUrl:`ws://127.0.0.1:${port}/ws`}));return;}
 try{const p=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!p.startsWith(root+sep))throw Error('path');res.setHeader('Content-Type',types[extname(p)]??'application/octet-stream');res.end(await readFile(p));}catch{res.statusCode=404;res.end('Not found');}
});
http.listen(4179,'127.0.0.1',()=>console.log('MP-009 local fixture http://127.0.0.1:4179/?transportDiagnostics=1'));
async function stop(){http.close();await server.close();process.exit();}process.on('SIGINT',stop);process.on('SIGTERM',stop);

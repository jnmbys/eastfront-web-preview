// Isolated test gateway only. Original server modules are imported from one pinned build.
import {createServer as httpServer,request as httpRequest} from 'node:http';
import {createServer as httpsServer} from 'node:https';
import {readFileSync} from 'node:fs';
import {resolve,join,sep,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {verifyArtifacts,artifacts} from './integrity.mjs';
import {VERSIONS,SERVER_SHA,FORMAT,SEED,MODES} from './config.mjs';
const manifest=verifyArtifacts(),port=Number(process.env.MP017_PORT??4180),host=process.env.MP017_HOST??'127.0.0.1';
const tls=!!process.env.MP017_TLS_CERT;
const origin=process.env.MP017_ORIGIN??`http://127.0.0.1:${port}`;
const parsedOrigin=new URL(origin);
if(parsedOrigin.origin!==origin||!['http:','https:'].includes(parsedOrigin.protocol))throw Error('MP017_ORIGIN must be one exact HTTP(S) origin');
if(!tls&&host!=='127.0.0.1'&&process.env.MP017_BEHIND_TLS!=='1')throw Error('Tablet access requires trusted HTTPS, or an explicit isolated TLS reverse proxy');
if(!tls&&parsedOrigin.protocol==='http:'&&!['127.0.0.1','localhost'].includes(parsedOrigin.hostname))throw Error('Plain LAN HTTP is not a supported device test (secure-context APIs)');
if(tls&&parsedOrigin.protocol!=='https:')throw Error('TLS listener requires HTTPS origin');
if(manifest.serverSha!==SERVER_SHA||manifest.snapshotFormat!==FORMAT)throw Error('Unexpected build manifest');
const load=p=>import(pathToFileURL(join(artifacts,'server',p)).href);
const [{createMultiplayerServer},{RoomAuthority},{createMatchSession},{DEFAULTS},sessionApi,core,{clientMessage,PROTOCOL_VERSION}]=await Promise.all([
 load('server/runtime.js'),load('server/authority.js'),load('server/match.js'),load('server/config.js'),load('src/core-adapter/session.js'),load('src/core-adapter/core.js'),load('src/multiplayer/protocol.js')]);
const raw=JSON.parse(readFileSync(join(artifacts,'server/vendor/eastfront-digital-core/reference/strategic-reset-f-map.json')));
const {createLocalGameSession,dispatchGameAction,controllerIdForSide}=sessionApi;
function scenario(name){
 const s=createLocalGameSession(raw,SEED);if(name==='deployment')return s;
 const apply=action=>{const r=dispatchGameAction(s,action).result;assert(r.accepted,'Pinned scenario preparation must remain legal');};
 for(const [side,special] of [['SOVIET',{'S-I-01':'3,-1'}],['GERMAN',{'G-PZ-01':'2,-1','G-I-01':'1,0','G-J-01':'2,0'}]]){
  const controllerId=controllerIdForSide(s,side),zone=core.deploymentHexKeysForSide(s.state,s.scenario,side),counts={};
  for(const [deploymentUnitId,key] of Object.entries(special)){apply({type:'DEPLOY_INITIAL_UNIT',controllerId,deploymentUnitId,hex:s.state.hexes[key].coord});counts[key]=(counts[key]??0)+1;}
  for(const u of s.scenario.deployment.units.filter(u=>u.side===side).sort((a,b)=>a.id.localeCompare(b.id))){if(u.id in special)continue;const key=zone.find(k=>(counts[k]??0)<2&&!Object.values(special).includes(k));apply({type:'DEPLOY_INITIAL_UNIT',controllerId,deploymentUnitId:u.id,hex:s.state.hexes[key].coord});counts[key]=(counts[key]??0)+1;}
  apply({type:'READY_FOR_PHASE_END',controllerId});
 }
 apply({type:'READY_FOR_PHASE_END',controllerId:controllerIdForSide(s,'GERMAN')});return s;
}
const servers=new Map();
for(const name of ['deployment','move'])for(const [mode,delays] of Object.entries(MODES)){
 const config={...DEFAULTS,port:0,host:'127.0.0.1',allowedOrigins:[origin]};
 const authority=new RoomAuthority(config,Date.now,(...args)=>{const match=createMatchSession(...args);match.authoritative=scenario(name);return match;});
 const connect=authority.connect.bind(authority),receive=authority.receive.bind(authority),bots=new Map(),humanRooms=new Map();
 const botSend=(id,type,payload)=>receive(id,JSON.stringify(clientMessage(type,payload,randomUUID())));
 authority.connect=send=>{let id,until=0,timer=null;const queue=[];
  const pump=()=>{if(timer!==null)return;while(queue.length&&queue[0].due<=Date.now())send(queue.shift().message);if(queue.length)timer=setTimeout(()=>{timer=null;pump();},Math.max(0,queue[0].due-Date.now()));};
  id=connect(message=>{
   if(message.messageType==='ACTION_ACCEPTED')until=Date.now()+delays.snapshotMs;
   const delay=message.messageType==='ACTION_ACCEPTED'?delays.ackMs:('serverSequence' in message.payload?Math.max(0,until-Date.now()):0);
   queue.push({message,due:Date.now()+delay});pump(); // One FIFO queue, including recovery frames.
   if(message.messageType==='ROOM_STATE'&&message.payload.room){const room=message.payload.room;humanRooms.set(id,room.roomCode);
    if(room.clients.length===1&&!bots.has(room.roomCode)){bots.set(room.roomCode,null);queueMicrotask(()=>{const bot=connect(()=>{});bots.set(room.roomCode,bot);botSend(bot,'HELLO',{displayName:'MP017 fixture peer'});botSend(bot,'JOIN_ROOM',{roomCode:room.roomCode});botSend(bot,'SELECT_SEAT',{seat:name==='move'?'SOVIET':'GERMANY'});botSend(bot,'SET_READY',{ready:true});});}
   }
  });return id;
 };
 authority.receive=(id,raw)=>{receive(id,raw);let type;try{type=JSON.parse(raw).messageType;}catch{return;}if(type==='SELECT_SEAT'){const bot=bots.get(humanRooms.get(id));if(bot)botSend(bot,'SET_READY',{ready:true});}};
 const server=createMultiplayerServer(config,authority);
 servers.set(`/ws/${name}/${mode}`,{server,port:await server.listen()});
}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
const sendJson=(res,value)=>{res.setHeader('Content-Type',types['.json']);res.end(JSON.stringify(value));};
function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
 if(req.method!=='GET'){res.writeHead(405);res.end();return;}
 try{
  const url=new URL(req.url,origin);
  if(url.pathname==='/mp017/config.json')return sendJson(res,{versions:VERSIONS,origin,serverSha:SERVER_SHA,snapshotFormat:FORMAT,diagnosticSha256:manifest.diagnosticSha256,cachePolicy:manifest.cachePolicy});
  const diagnostic=url.pathname.match(/^\/mp017\/config\/(candidate|control)$/);
  if(diagnostic){const b=manifest.builds[diagnostic[1]];return sendJson(res,{sourceSha:b.sourceSha,paths:[...Object.keys(b.hashes),'multiplayer-config.json'],diagnosticSha256:manifest.diagnosticSha256,fault:process.env.MP017_FAULT??'none'});}
  if(process.env.MP017_FAULT==='map404'&&url.pathname.endsWith('/strategic-reset-f-map.json')){res.writeHead(404);res.end('Local synthetic resource failure');return;}
  if(url.pathname==='/lab-config.json')return sendJson(res,{versions:VERSIONS,serverSha:SERVER_SHA,protocolVersion:PROTOCOL_VERSION,format:FORMAT,seed:SEED,modes:MODES,samplerSha256:manifest.samplerSha256,harnessSha256:manifest.harnessSha256,origin});
  const match=url.pathname.match(/^\/v\/(candidate|control)\/(deployment|move)\/(real|delay|timeout)\/(.*)$/);
  let file;
  if(match){const [,label,name,mode,path]=match;
   if(path==='multiplayer-config.json')return sendJson(res,{serverUrl:origin.replace(/^http/,'ws')+`/ws/${name}/${mode}`});
   const root=join(artifacts,label);file=resolve(root,decodeURIComponent(path||'index.html'));if(!file.startsWith(root+sep))throw Error('path');
  }else{const root=resolve(import.meta.dirname,'web');file=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+sep))throw Error('path');}
  res.setHeader('Content-Type',types[extname(file)]??'application/octet-stream');res.end(readFileSync(file));
 }catch{res.writeHead(404);res.end('Not found');}
}
const gateway=tls?httpsServer({cert:readFileSync(process.env.MP017_TLS_CERT),key:readFileSync(process.env.MP017_TLS_KEY)},handler):httpServer(handler);
gateway.on('upgrade',(req,socket,head)=>{
 const target=servers.get(req.url);if(!target||req.headers.origin!==origin){socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');return;}
 const proxy=httpRequest({host:'127.0.0.1',port:target.port,path:'/ws',method:'GET',headers:req.headers});
 proxy.on('upgrade',(response,upstream,upHead)=>{socket.write(`HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n`+response.rawHeaders.reduce((s,v,i,a)=>i%2?s:s+v+': '+a[i+1]+'\r\n','')+'\r\n');if(upHead.length)socket.write(upHead);if(head.length)upstream.write(head);upstream.pipe(socket);socket.pipe(upstream);socket.on('error',()=>upstream.destroy());upstream.on('error',()=>socket.destroy());socket.on('close',()=>upstream.destroy());});
 proxy.on('response',()=>socket.destroy());proxy.on('error',()=>socket.destroy());proxy.end();
});
gateway.listen(port,host,()=>console.log(`MP017 isolated device lab ${origin}; server ${SERVER_SHA}; ${FORMAT}; no production service used`));
async function stop(){gateway.close();await Promise.all([...servers.values()].map(x=>x.server.close()));process.exit();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);

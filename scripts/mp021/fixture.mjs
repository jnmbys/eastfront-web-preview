import {createServer,request} from 'node:http';
import {readFileSync,writeFileSync} from 'node:fs';
import {appendFile} from 'node:fs/promises';
import {join,resolve,sep,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {root,verify} from './package.mjs';
import {makeScenario} from './scenario.mjs';
export async function startFixture({origin,port=0,runDir}){
 const manifest=verify(),instanceId=randomUUID(),file=join(runDir,'server-query.jsonl');writeFileSync(file,'',{flag:'wx'});
 const load=p=>import(pathToFileURL(join(root,'server',p)).href);
 const [{createMultiplayerServer},{RoomAuthority},{createMatchSession},{DEFAULTS},api,core,{clientMessage}]=await Promise.all(['server/runtime.js','server/authority.js','server/match.js','server/config.js','src/core-adapter/session.js','src/core-adapter/core.js','src/multiplayer/protocol.js'].map(load));
 const raw=JSON.parse(readFileSync(join(root,'server/vendor/eastfront-digital-core/reference/strategic-reset-f-map.json')));
 const settings={...DEFAULTS,port:0,host:'127.0.0.1',allowedOrigins:[origin]};
 const authority=new RoomAuthority(settings,Date.now,(...args)=>{const m=createMatchSession(...args);m.authoritative=makeScenario(api,core,raw,assert);return m;});
 const connect=authority.connect.bind(authority),receive=authority.receive.bind(authority),bots=new Map(),rooms=new Map();
 const botSend=(id,type,payload={})=>receive(id,JSON.stringify(clientMessage(type,payload,randomUUID())));
 authority.connect=send=>{let id;id=connect(message=>{send(message);if(message.messageType==='ROOM_STATE'&&message.payload.room){const room=message.payload.room;rooms.set(id,room.roomCode);
  if(room.clients.length===1&&!bots.has(room.roomCode)){bots.set(room.roomCode,null);queueMicrotask(()=>{const bot=connect(()=>{});bots.set(room.roomCode,bot);botSend(bot,'HELLO',{displayName:'MP021 fixture peer'});botSend(bot,'JOIN_ROOM',{roomCode:room.roomCode});botSend(bot,'SELECT_SEAT',{seat:'SOVIET'});botSend(bot,'SET_READY',{ready:true});});}
 }});return id;};
 // Preserve MP020's WS callback timestamp through this existing fixture seam.
 authority.receive=(id,raw,receivedAt)=>{receive(id,raw,receivedAt);let type;try{type=JSON.parse(raw).messageType;}catch{return;}if(type==='SELECT_SEAT'){const bot=bots.get(rooms.get(id));if(bot)botSend(bot,'SET_READY',{ready:true});}};
 let pending=[],writing=null,persistedRows=0,dropped=0,writeFailed=false;
 const sink={active:()=>true,latency(_id,row){if(!row.stage.startsWith('query-'))return;if(pending.length>=4096){dropped++;return;}pending.push({instanceId,...row});}};
 async function flush(){if(writing){await writing;return flush();}if(!pending.length)return;const rows=pending;pending=[];
  writing=appendFile(file,rows.map(r=>JSON.stringify(r)).join('\n')+'\n').then(()=>{persistedRows+=rows.length;},()=>{writeFailed=true;dropped+=rows.length;}).finally(()=>{writing=null;});await writing;
 }
 const timer=setInterval(()=>void flush(),200);timer.unref();
 const game=createMultiplayerServer(settings,authority,sink),gamePort=await game.listen(),sockets=new Set();
 const config=()=>({instanceId,origin,sourceSha:manifest.sourceSha,gameplayClientSha:manifest.gameplayClientSha,packageTreeSha256:manifest.packageTreeSha256,diagnosticSha256:manifest.diagnosticSha256,snapshotFormat:manifest.snapshotFormat});
 const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
 const gateway=createServer((req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const json=value=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));};
  if(req.method!=='GET'){res.writeHead(405);res.end();return;}
  try{
   const path=new URL(req.url,origin).pathname;
   if(path==='/mp021/config.json')return json(config());
   if(path==='/mp021/status.json')return json({instanceId,persistedRows,pendingRows:pending.length,dropped,writeFailed});
   if(path==='/mp021/config/candidate')return json({...config(),paths:Object.keys(manifest.files.client)});
   const match=path.match(/^\/v\/candidate\/move\/real\/(.*)$/),base=match?join(root,'client'):join(root,'client/mp021');
   if(match?.[1]==='multiplayer-config.json')return json({serverUrl:origin.replace(/^http/,'ws')+'/ws/move/real'});
   const file=resolve(base,decodeURIComponent(match?match[1]||'index.html':path==='/'?'index.html':path.slice(1)));
   if(!file.startsWith(base+sep))throw Error('path');res.setHeader('Content-Type',types[extname(file)]??'application/octet-stream');res.end(readFileSync(file));
  }catch{res.writeHead(404);res.end('Not found');}
 });
 gateway.on('connection',s=>{sockets.add(s);s.once('close',()=>sockets.delete(s));});
 gateway.on('upgrade',(req,socket,head)=>{
  if(req.url!=='/ws/move/real'||req.headers.origin!==origin){socket.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n');return;}
  const proxy=request({host:'127.0.0.1',port:gamePort,path:'/ws',headers:req.headers});
  proxy.on('upgrade',(r,up,upHead)=>{socket.write(`HTTP/1.1 ${r.statusCode} ${r.statusMessage}\r\n`+r.rawHeaders.reduce((s,v,i,a)=>i%2?s:s+v+': '+a[i+1]+'\r\n','')+'\r\n');if(upHead.length)socket.write(upHead);if(head.length)up.write(head);up.pipe(socket);socket.pipe(up);socket.on('close',()=>up.destroy());socket.on('error',()=>up.destroy());up.on('error',()=>socket.destroy());});
  proxy.on('response',()=>socket.destroy());proxy.on('error',()=>socket.destroy());proxy.end();
 });
 await new Promise((ok,fail)=>{gateway.once('error',fail);gateway.listen(port,'127.0.0.1',ok);});
 let closing;const close=()=>closing??=(async()=>{for(const s of sockets)s.destroy();await new Promise(r=>gateway.close(r));await game.close();clearInterval(timer);await flush();})();
 return {port:gateway.address().port,config:config(),manifest,flush,close};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){
 const fixture=await startFixture({origin:process.env.MP013_ORIGIN,port:4180,runDir:process.env.MP013_RUN_DIR});
 writeFileSync(join(process.env.MP013_RUN_DIR,'fixture-ready.json'),JSON.stringify(fixture.config));console.log('MP021 isolated fixture ready');
 const close=async()=>{await fixture.close();process.exit();};process.on('SIGTERM',close);process.on('SIGINT',close);process.on('message',m=>{if(m==='close')void close();});
}

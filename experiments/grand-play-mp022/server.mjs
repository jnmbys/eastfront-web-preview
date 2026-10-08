import http from 'node:http';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,extname} from 'node:path';
import {WebSocketServer} from 'ws';
import {CampaignAdapter,BASELINE} from './adapter.mjs';
import path from 'node:path';
import {OrderedLink,diff} from './sync.mjs';
export const profiles={clean:{rtt:0},rtt100:{rtt:100},rtt300:{rtt:300},rtt1000:{rtt:1000},constrained:{rtt:300,jitter:90,bytesPerSecond:256*1024}};
export const STATE_WINDOW=8;
export async function start({port=4220,autoTick=true,saveFile=path.join(process.env.LOCALAPPDATA??process.cwd(),'EastfrontSaves/grand-play-mp022/campaign.json'),evidenceFile=null,CampaignClass,cookiePrefix="grandplaymp_",host="127.0.0.1",publicOrigin=null,AdapterClass=CampaignAdapter,access=null,router=null,release=false,staticRoot=null,releaseProtocol='GRAND-RELEASE-1'}={}){
 const adapter=new AdapterClass({saveFile,CampaignClass}),sessions=new Map(),seats=new Map(),root=resolve(staticRoot??fileURLToPath(new URL('../../.ai003-preview/',import.meta.url)));let closing=false,ticking=false;
 if(evidenceFile){mkdirSync(path.dirname(evidenceFile),{recursive:true});adapter.evidenceFile=evidenceFile;}
 const metrics={received:0,sent:0,receivedBytes:0,sentBytes:0,resyncs:0,coalesced:0,connections:0,errors:0,peakUpMessages:0,peakUpBytes:0,peakDownMessages:0,peakDownBytes:0};
 const origin=()=>publicOrigin??`http://127.0.0.1:${server.address().port}`;
 function auth(req,seat){const cookie=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith(`${cookiePrefix}${seat}=`))?.split('=')[1];return sessions.get(cookie)?.seat===seat?sessions.get(cookie):null;}
 const server=http.createServer(async(req,res)=>{
  const reply=(code,x,headers={})=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store',...headers});res.end(JSON.stringify(x));};
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');if(release)res.setHeader('Content-Security-Policy',"frame-ancestors 'none'; object-src 'none'");
  if(req.url==='/healthz'&&access){await access.gate(req,res);return;}
  if(req.headers.host!==new URL(origin()).host){reply(403,{error:'HOST_DENIED'});return;}
  if(access&&await access.gate(req,res))return;
  if(router&&await router(req,res,adapter,()=>{for(const s of seats.values())s.connection?.close('SAVE_LOADED_RECONNECT');}))return;
  const url=new URL(req.url,origin()),match=url.pathname.match(/^\/(a|b)(?:\/(.*))?$/),seat=match?.[1];
  if(req.method==='POST'){
   if(req.headers.origin!==origin())return reply(403,{error:'ORIGIN_DENIED'});
   if(match?.[2]!=='session')return reply(404,{error:'NOT_FOUND'});if(release&&req.headers['x-grand-protocol']!==releaseProtocol)return reply(409,{error:'界面版本已更新，请刷新页面。'});
   let s=auth(req,seat);if(!s){if(seats.has(seat)){if(!release)return reply(409,{error:'SEAT_ALREADY_CLAIMED'});const old=seats.get(seat);old.connection?.close('REPLACED');sessions.delete(old.token);}const token=randomBytes(32).toString('hex');s={seat,side:seat,token,epoch:0,connection:null};sessions.set(token,s);seats.set(seat,s);}
   return reply(200,{instanceId:adapter.id,side:'GERMAN',seat:s.side,era:adapter.era,baseline:BASELINE,mode:'GRAND_PLAY_SHARED_CLOCK'}, {'Set-Cookie':`${cookiePrefix}${seat}=${s.token}; HttpOnly; SameSite=Strict; Path=/${seat}${origin().startsWith('https:')?'; Secure':''}`});
  }
  if(url.pathname==='/sync.mjs'||url.pathname==='/transport/view.mjs'||url.pathname==='/transport/client.mjs'){
   const file=url.pathname==='/sync.mjs'?'sync.mjs':url.pathname.endsWith('view.mjs')?'view.mjs':'web/client.mjs';res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});res.end(readFileSync(new URL(file,import.meta.url)));return;
  }
  const target=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!target.startsWith(root+path.sep))return reply(403,{error:'PATH_DENIED'});
  try{let bytes=readFileSync(target);const tag='W/"'+createHash('sha256').update(bytes).digest('hex')+'"';if(release&&req.headers['if-none-match']===tag){res.writeHead(304,{'ETag':tag,'Cache-Control':'private, max-age=0, must-revalidate'});res.end();return;}const zipped=release&&/\.(html|js|mjs|css|json|svg)$/.test(target)&&req.headers['accept-encoding']?.includes('gzip');if(zipped)bytes=gzipSync(bytes);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2'})[extname(target)]??'application/octet-stream','Cache-Control':release?'private, max-age=0, must-revalidate':'no-store',...(release?{'ETag':tag,'Vary':'Accept-Encoding'}:{}),...(zipped?{'Content-Encoding':'gzip'}:{})});res.end(bytes);}catch{reply(404,{error:'NOT_FOUND'});}

 });
 const wss=new WebSocketServer({noServer:true,maxPayload:32768,perMessageDeflate:false});
 server.on('upgrade',(req,socket,head)=>{const path=new URL(req.url,origin()).pathname,seat=path.match(/^\/(a|b)\/ws$/)?.[1],s=seat&&auth(req,seat);
  if(!s||access&&!access.authorized(req)||req.headers.host!==new URL(origin()).host||req.headers.origin!==origin()){socket.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n');return;}
  wss.handleUpgrade(req,socket,head,ws=>connect(ws,s,req));
 });
 function connect(ws,s,req){
  ws.lastPong=Date.now();ws.on('pong',()=>{ws.lastPong=Date.now();});s.connection?.close('REPLACED');s.epoch++;metrics.connections++;
  const conn={epoch:s.epoch,selection:{},dirty:true,full:true,view:null,viewVersion:0,serial:0,outstanding:[],stream:1,acked:0,trace:[],profile:'clean',closed:false,rendering:false,links:[],
   close(reason){if(conn.closed)return;conn.closed=true;for(const link of conn.links)link.close();if(ws.readyState===1)ws.close(1013,reason);if(release)queueMicrotask(()=>{if(![...seats.values()].some(x=>x.connection&&!x.connection.closed))void adapter.offline();});}};s.connection=conn;
  const down=new OrderedLink(profiles.clean,text=>{if(ws.readyState===1){if(ws.bufferedAmount>2*1024*1024){conn.close('SOCKET_BACKPRESSURE');return;}const message=JSON.parse(text);if(message.type==='STATE'){message.serverQueueMs=performance.now()-message.enqueuedAt;delete message.enqueuedAt;trace('state-dispatched',{stream:message.stream,version:message.viewVersion,serverQueueMs:message.serverQueueMs});}ws.send(JSON.stringify(message));}},()=>conn.close('DOWN_QUEUE_FULL'));
  const up=new OrderedLink(profiles.clean,text=>void message(text).catch(()=>{metrics.errors++;conn.close('PROTOCOL_ERROR');}),()=>conn.close('UP_QUEUE_FULL'));conn.links=[up,down];
  const observe=(name,link)=>{metrics[`peak${name}Messages`]=Math.max(metrics[`peak${name}Messages`],link.jobs.length);metrics[`peak${name}Bytes`]=Math.max(metrics[`peak${name}Bytes`],link.bytes);};
  const send=data=>{if(conn.closed||s.connection!==conn)return;const text=JSON.stringify({...data,instanceId:adapter.id,connectionEpoch:conn.epoch});metrics.sent++;metrics.sentBytes+=Buffer.byteLength(text);const queued=down.send(text);observe('Down',down);return queued;};
  const trace=(type,detail={})=>{conn.trace.push({type,at:performance.now(),...detail});if(conn.trace.length>2048)conn.trace.shift();};
  async function push(){if(conn.closed||s.connection!==conn||conn.rendering)return;if(access&&!access.authorized(req)){conn.close('AUTH_EXPIRED');return;}if(conn.outstanding.length&&performance.now()-conn.outstanding[0].sentAt>15000){conn.close('VIEW_ACK_TIMEOUT');return;}if(conn.outstanding.length>=STATE_WINDOW){if(conn.dirty)metrics.coalesced++;return;}if(!conn.dirty)return;if(release&&(down.bytes>128*1024||ws.bufferedAmount>256*1024)){metrics.coalesced++;return;}conn.rendering=true;conn.dirty=false;const stream=conn.stream;
   try{const view=await adapter.view(s.side,conn.selection);if(conn.closed||s.connection!==conn)return;const change=conn.view?diff(conn.view,view,[],undefined,release):null,results=adapter.pending(s.side);
    if(stream!==conn.stream){conn.dirty=true;return;}
    if(!conn.full&&change&&!change.set.length&&!change.remove.length)return;
    const next=++conn.serial,full=conn.full||!conn.view,baseViewVersion=full?null:conn.viewVersion;
    // Delta base is the last enqueued authorized view, not the last acknowledged view.
    if(send({type:'STATE',enqueuedAt:performance.now(),stream,baseViewVersion,viewVersion:next,...(full?{full:view}:{change}),results})){
     conn.outstanding.push({version:next,sentAt:performance.now()});conn.view=view;conn.viewVersion=next;conn.full=false;
     trace('state-enqueued',{stream,version:next,baseViewVersion,revision:view.revision,full,unacked:conn.outstanding.length,acked:conn.acked});
    }
   }finally{conn.rendering=false;}
  }
  conn.push=push;
  async function message(text){if(conn.closed||s.connection!==conn)return;if(access&&!access.authorized(req)){conn.close('AUTH_EXPIRED');return;}const m=JSON.parse(text);
   if(m.type==='HELLO'){send({type:'WELCOME',nextCommandSeq:adapter.c.transport.next[s.side],side:'GERMAN',era:adapter.era});await push();return;}
   if(m.instanceId!==adapter.id||m.connectionEpoch!==conn.epoch){send({type:'ERROR',reason:'SESSION_EPOCH_OR_INSTANCE_MISMATCH'});return;}
   if(m.type==='PING'){send({type:'PONG',id:m.id});return;}
   if(m.type==='PROFILE'){if(!Object.hasOwn(profiles,m.name))throw Error('PROFILE');conn.profile=m.name;up.profile=profiles[m.name];down.profile=profiles[m.name];send({type:'PROFILE',name:m.name,profile:profiles[m.name]});return;}
   if(m.type==='VIEW_ACK'){if(m.stream===conn.stream&&conn.outstanding.some(x=>x.version===m.viewVersion)){conn.acked=m.viewVersion;conn.outstanding=conn.outstanding.filter(x=>x.version>m.viewVersion);trace('state-ack',{stream:conn.stream,version:m.viewVersion});await push();}return;}
   if(m.type==='RESULT_ACK'){if(Array.isArray(m.ids)&&m.ids.length<=128)for(const id of m.ids)adapter.ack(s.side,id);return;}
   if(m.type==='RESYNC'){if(m.stream!==conn.stream)return;conn.stream++;conn.outstanding=[];conn.view=null;conn.full=true;conn.dirty=true;metrics.resyncs++;trace('resync',{stream:conn.stream});await push();return;}
   if(m.type==='SELECT'){if(typeof m.unitId!=='string'||m.unitId.length>96||!Number.isSafeInteger(m.id))throw Error('SELECT');const u=adapter.c.state.units[m.unitId];if(!u||u.side!=='GERMAN'){send({type:'ERROR',reason:'UNIT_NOT_AUTHORIZED'});return;}conn.selection={unitId:m.unitId,id:m.id};conn.dirty=true;await push();return;}
   if(m.type==='QUERY'){const payload=await adapter.query(s.side,m.draft);if(release&&payload.model){delete payload.view;delete payload.model.playerView;delete payload.model.hexes;delete payload.model.edges;}send({type:'QUERY_RESULT',id:m.id,revision:adapter.revision,payload});return;}
   if(m.type==='COMMAND'){
    try{const oldEra=adapter.era;const result=await adapter.submit(s.side,m.command);if(conn.closed||s.connection!==conn)return;
     for(const seat of seats.values())if(seat.connection)seat.connection.dirty=true;
     // Business results are independent of a saturated state window and retained in the authority ledger.
     send({type:'RESULT',result});if(oldEra!==adapter.era){for(const seat of seats.values())seat.connection?.close('SAVE_LOADED_RECONNECT');return;}await push();for(const seat of seats.values())if(seat!==s)void seat.connection?.push();
    }catch(e){send({type:'ERROR',requestId:m.command?.requestId,reason:e.message});}return;
   }
   if(m.type==='METRICS'){send({type:'METRICS',metrics:{...metrics,peakAuthorityQueue:adapter.peakDepth,up:{...up.metrics,queued:up.jobs.length},down:{...down.metrics,queued:down.jobs.length},outstandingResults:adapter.pending(s.side).length,profile:conn.profile}});return;}
   throw Error('UNKNOWN_MESSAGE');
  }
  ws.on('message',data=>{if(conn.closed)return;metrics.received++;metrics.receivedBytes+=data.byteLength;up.send(data.toString());observe('Up',up);});ws.on('error',()=>conn.close('CONNECTION_ERROR'));ws.on('close',()=>conn.close('CLOSED'));
 }
 const heartbeat=release?setInterval(()=>{for(const ws of wss.clients){if(Date.now()-ws.lastPong>15000)ws.terminate();else if(ws.readyState===1)ws.ping();}},5000):null;
 let previousTime=performance.now();
 const tickTimer=setInterval(async()=>{if(closing||ticking||!autoTick)return;ticking=true;try{const now=performance.now(),elapsed=now-previousTime;previousTime=now;const before=adapter.revision;if(!release||[...seats.values()].some(s=>s.connection&&!s.connection.closed))await adapter.tick(elapsed);if(release)await adapter.autoSave();if(adapter.revision!==before)for(const s of seats.values()){if(s.connection)s.connection.dirty=true;}}catch{metrics.errors++;}finally{ticking=false;}},100);
 const pushTimer=setInterval(()=>{for(const s of seats.values())void s.connection?.push().catch(()=>{metrics.errors++;s.connection.close('VIEW_ERROR');});},150);
 await new Promise((yes,no)=>{server.once('error',no);server.listen(port,host,yes);});
 return {server,adapter,seats,metrics,url:origin(),enableTicks(){autoTick=true;},async close(){closing=true;if(release)await adapter.offline();clearInterval(tickTimer);clearInterval(pushTimer);if(heartbeat)clearInterval(heartbeat);for(const s of seats.values())s.connection?.close('SERVER_STOP');for(const ws of wss.clients)ws.terminate();await new Promise(r=>server.close(r));}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const service=await start({port:Number(process.argv[2]??4220),evidenceFile:fileURLToPath(new URL('../../evidence/grand-play-mp022/live.jsonl',import.meta.url))});console.log(`GRAND-PLAY MP022 ${service.url} | shared clock authority | local only`);process.on('SIGTERM',()=>void service.close());process.on('SIGINT',()=>void service.close());}

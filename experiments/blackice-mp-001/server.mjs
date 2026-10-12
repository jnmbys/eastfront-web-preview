import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,randomUUID,createHmac,createHash,timingSafeEqual} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {start as startWire} from '../grand-play-mp022/server.mjs';
import {readSave,atomicWrite} from '../grand-release-001/persistence.mjs';
import {Campaign,RoomAdapter,ROOM_VERSION} from './authority.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url)),digest=x=>createHash('sha256').update(x).digest('hex');
const validId=x=>typeof x==='string'&&/^[0-9a-f-]{36}$/.test(x);
const reply=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
async function body(req){let s='';for await(const c of req){s+=c;if(s.length>4096)throw Error('REQUEST_TOO_LARGE');}return JSON.parse(s||'{}');}
export async function start({port=4277,saveDir=path.join(process.env.LOCALAPPDATA??root,'Eastfront','blackice-mp-001'),autoTick=true,staticRoot=path.join(root,'.release-territory-preview'),visitorCookie='blackice_mp_visitor',CampaignClass=Campaign,roomVersion=ROOM_VERSION,lobbyFile=new URL('./lobby.html',import.meta.url)}={}){
 fs.mkdirSync(saveDir,{recursive:true});const keyFile=path.join(saveDir,'visitor-key');if(!fs.existsSync(keyFile))atomicWrite(keyFile,randomBytes(32));const key=fs.readFileSync(keyFile);
 const rooms=new Map(),loading=new Map(),source=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();let closing=false;
 const cookieName=visitorCookie,mac=x=>createHmac('sha256',key).update(x).digest('hex');
 function identity(req){const v=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);if(!v||!/^([0-9a-f]{64})\.([0-9a-f]{64})$/.test(v))return null;const[id,sig]=v.split('.');return timingSafeEqual(Buffer.from(sig,'hex'),Buffer.from(mac(id),'hex'))?id:null;}
 const origin=()=>`http://127.0.0.1:${server.address().port}`;
 const file=id=>path.join(saveDir,'rooms',id,'campaign.json');
 function savedRoom(id){if(!validId(id)||!fs.existsSync(file(id)))return null;const s=readSave(file(id));return s.campaign.roomVersion===roomVersion?s.campaign.clock.room:null;}
 function membership(id,who){if(!who||!validId(id))return null;const r=rooms.get(id)?.adapter.c.clock.room??savedRoom(id);return r&&Object.keys(r.members).find(s=>r.members[s]===who);}
 function authorized(req,id){const seat=membership(id,identity(req));if(!seat)return false;const route=new URL(req.url,origin()).pathname.match(/^\/(a|b)\//)?.[1];return !route||route===seat;}
 async function open(id,initial){if(rooms.has(id))return rooms.get(id);if(loading.has(id))return loading.get(id);const job=(async()=>{
  if(!initial&&!savedRoom(id))throw Error('ROOM_UNAVAILABLE');
  const access={authorized:req=>authorized(req,id),async gate(req,res){if(!authorized(req,id)){reply(res,403,{error:'ROOM_ACCESS_DENIED'});return true;}return false;}};
  const service=await startWire({port:0,host:'127.0.0.1',publicOrigin:origin(),autoTick,saveFile:file(id),CampaignClass,AdapterClass:RoomAdapter,release:true,staticRoot,releaseProtocol:'GRAND-RELEASE-TERRITORY-1',cookiePrefix:'bmp_'+id.replaceAll('-','')+'_',access,
   router:async(req,res,a)=>{const url=new URL(req.url,origin());if(url.pathname==='/release/info'){reply(res,200,{instanceId:a.id,revision:a.revision,tick:a.c.clock.tick,paused:a.c.clock.paused,saved:a.persistence.savedAt,room:a.summary(membership(id,identity(req))),source});return true;}if(url.pathname==='/release/new'){reply(res,403,{error:'CREATE_SEPARATE_ROOM_FROM_LOBBY'});return true;}return false;}});
  if(initial){service.adapter.c.clock.room=initial;await service.adapter.saveFileNow();}
  rooms.set(id,service);return service;
 })();loading.set(id,job);try{return await job;}finally{loading.delete(id);}}
 const server=http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,origin());res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.headers.host!==new URL(origin()).host)return reply(res,403,{error:'HOST_DENIED'});
  if(req.method==='POST'&&req.headers.origin!==origin())return reply(res,403,{error:'ORIGIN_DENIED'});
  if(url.pathname==='/healthz')return reply(res,200,{ok:true,source,roomVersion,rules:CampaignClass.rulesVersion,localOnly:true});
  if(url.pathname==='/visitor/start'&&req.method==='POST'){let id=identity(req);if(!id)id=randomBytes(32).toString('hex');res.setHeader('Set-Cookie',`${cookieName}=${id}.${mac(id)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000`);return reply(res,200,{ok:true});}
  if(url.pathname==='/room/create'&&req.method==='POST'){
   const who=identity(req);if(!who)return reply(res,401,{error:'VISITOR_REQUIRED'});
   const id=randomUUID(),invite=randomBytes(24).toString('hex');await open(id,{id,version:roomVersion,members:{a:who,b:null},inviteHash:digest(invite),started:false,pauseReason:'等待另一玩家加入；房主开始后仍初始暂停'});
   return reply(res,201,{roomId:id,url:`/?campaign=${id}`,joinUrl:`/rooms?room=${id}#invite=${invite}`});
  }
  if(url.pathname==='/room/join'&&req.method==='POST'){
   const who=identity(req);if(!who)return reply(res,401,{error:'VISITOR_REQUIRED'});const b=await body(req),r=validId(b.roomId)&&(rooms.get(b.roomId)?.adapter.c.clock.room??savedRoom(b.roomId));
   if(!r||typeof b.invite!=='string'||digest(b.invite)!==r.inviteHash)return reply(res,403,{error:'INVITATION_INVALID'});
   const svc=await open(b.roomId);const seat=await svc.adapter.exclusive(async()=>{const r=svc.adapter.c.clock.room,existing=Object.keys(r.members).find(s=>r.members[s]===who);if(existing)return existing;if(r.members.b)throw Error('ROOM_FULL');r.members.b=who;svc.adapter.c.version++;try{await svc.adapter.saveFileNow();}catch(e){r.members.b=null;throw e;}return 'b';});
   return reply(res,200,{url:`/?campaign=${b.roomId}&client=${seat}`,seat});
  }
  if(url.pathname==='/room/list'){
   const who=identity(req);if(!who)return reply(res,401,{error:'VISITOR_REQUIRED'});const dir=path.join(saveDir,'rooms'),rows=[];
   for(const id of fs.existsSync(dir)?fs.readdirSync(dir):[]){const seat=membership(id,who);if(seat){const r=rooms.get(id)?.adapter.c.clock.room??savedRoom(id);rows.push({id,seat,started:r.started,url:`/?campaign=${id}&client=${seat}`});}}
   return reply(res,200,{rooms:rows});
  }
  if(url.pathname==='/rooms'||url.pathname==='/'&&!url.searchParams.has('campaign')){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(fs.readFileSync(lobbyFile));}
  if(req.method==='GET'&&/\.(?:js|mjs|css|png|webp|jpg|svg|woff2|json)$/.test(url.pathname)){
   const transport={'/transport/client.mjs':'web/client.mjs','/transport/view.mjs':'view.mjs','/transport/stateCodec.mjs':'web/stateCodec.mjs','/sync.mjs':'sync.mjs'};
   const base=transport[url.pathname]?path.join(root,'experiments/grand-play-mp022'):staticRoot,target=path.resolve(base,transport[url.pathname]??'.'+decodeURIComponent(url.pathname));
   if(!target.startsWith(base+path.sep)||!fs.existsSync(target))return reply(res,404,{error:'NOT_FOUND'});
   res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'})[path.extname(target)],'Cache-Control':'no-store'});return res.end(fs.readFileSync(target));
  }
  const id=url.searchParams.get('campaign');if(!authorized(req,id))return reply(res,403,{error:'ROOM_ACCESS_DENIED'});const svc=await open(id);
  if(url.pathname==='/'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(fs.readFileSync(path.join(staticRoot,'index.html'),'utf8').replace('<head>','<head><meta name="blackice-mp" content="1">'));}
  if(url.pathname==='/room/start'&&req.method==='POST'){try{return reply(res,200,await svc.adapter.startRoom(identity(req)));}catch(e){return reply(res,409,{error:e.message});}}
  // Forward existing HTTP/WS transport unchanged; the outer signed visitor binding
  // is required in addition to the inner per-seat session cookie.
  const upstream=http.request({host:'127.0.0.1',port:svc.server.address().port,path:req.url,method:req.method,headers:req.headers},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});upstream.on('error',()=>{if(!res.headersSent)reply(res,503,{error:'ROOM_SERVICE_UNAVAILABLE'});else res.destroy();});req.pipe(upstream);
 }catch(e){reply(res,409,{error:['ROOM_FULL','REQUEST_TOO_LARGE'].includes(e.message)?e.message:'ROOM_REQUEST_FAILED'});}});
 server.on('upgrade',async(req,socket,head)=>{try{const url=new URL(req.url,origin()),id=url.searchParams.get('campaign');if(req.headers.host!==new URL(origin()).host||req.headers.origin!==origin()||!authorized(req,id))throw Error('DENIED');const svc=await open(id),up=net.connect(svc.server.address().port,'127.0.0.1',()=>{up.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`+Object.entries(req.headers).map(([k,v])=>`${k}: ${v}`).join('\r\n')+'\r\n\r\n');if(head.length)up.write(head);socket.pipe(up);up.pipe(socket);});up.on('error',()=>socket.destroy());socket.on('error',()=>up.destroy());socket.on('close',()=>up.destroy());}catch{socket.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n');}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 return {server,rooms,source,url:origin(),async close(){if(closing)return;closing=true;for(const s of rooms.values())await s.close();await new Promise(r=>server.close(r));}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const svc=await start({port:Number(process.env.PORT??4277),saveDir:process.env.SAVE_DIR});console.log(JSON.stringify({ready:true,url:svc.url,source:svc.source}));
 const stop=async()=>{await svc.close();process.exit(0);};process.on('SIGTERM',stop);process.on('SIGINT',stop);process.on('message',m=>{if(m==='shutdown')void stop();});
 if(process.env.STOP_FILE)setInterval(()=>{if(fs.existsSync(process.env.STOP_FILE)){fs.unlinkSync(process.env.STOP_FILE);void stop();}},500).unref();
}

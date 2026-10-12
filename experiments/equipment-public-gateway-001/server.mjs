import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {start as multiplayer} from '../blackice-mp-001/server.mjs';
import {RoomAdapter} from '../blackice-mp-001/authority.mjs';
import {publicServer} from '../grand-release-tablet/public-server.mjs';
import {campaignModes} from '../grand-release-002/server.mjs';
import {directories,validateStorage,validateRoom,initializeKeys,locks,RoomCampaign,ROOM_VERSION,VERSION,MAP_VERSION} from './storage.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});res.end(JSON.stringify(data));};
class PublicRoomAdapter extends RoomAdapter{summary(seat){return {...super.summary(seat),localOnly:false};}}
export async function start({port=Number(process.env.PORT),host=process.env.HOST,origin=process.env.PUBLIC_ORIGIN,legacyDir=process.env.SAVE_DIR,mpDir=process.env.MP_SAVE_DIR,trustProxyIPs=(process.env.TRUST_PROXY_IPS??'').split(',').filter(Boolean),tls=null,autoTick=true,verifyBuild=true,localPreview=process.env.LOCAL_PREVIEW==='1'}={}){
 if(!Number.isInteger(port)||port<0||port>65535||!host)throw Error('PORT_AND_HOST_REQUIRED');
 if(!origin)throw Error('PUBLIC_ORIGIN_REQUIRED');const url=new URL(origin);
 if(localPreview&&(process.env.NODE_ENV==='production'||host!=='127.0.0.1'||url.hostname!=='127.0.0.1'||url.protocol!=='http:'))throw Error('LOCAL_PREVIEW_LOOPBACK_ONLY');
 if((!localPreview&&url.protocol!=='https:')||url.origin!==origin||url.username||url.password)throw Error('EXACT_HTTPS_ORIGIN_REQUIRED');
 if(trustProxyIPs.some(x=>!net.isIP(x))||(!localPreview&&!tls&&!trustProxyIPs.length))throw Error('EXPLICIT_TRUST_PROXY_IPS_REQUIRED');
 const d=directories(legacyDir,mpDir);validateStorage(d);
 // Validate old files with their original readers; never convert them to the room engine.
 const old=path.join(d.legacy,'visitors');
 const {readSave}=await import('../grand-release-001/persistence.mjs');
 for(const id of fs.existsSync(old)?fs.readdirSync(old):[])for(const mode of Object.values(campaignModes)){const file=path.join(old,id,mode.directory,'campaign.json');if(fs.existsSync(file)){const c=new mode.CampaignClass();c.restore(readSave(file).campaign);}}
 const source=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 if(process.env.RELEASE_SOURCE_SHA&&process.env.RELEASE_SOURCE_SHA!==source)throw Error('RELEASE_SOURCE_SHA_MISMATCH');
 const dirty=!!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim();
 const manifestFile=path.join(root,'.release-territory-preview/release-build.json');
 const build=fs.existsSync(manifestFile)?JSON.parse(fs.readFileSync(manifestFile)):null;
 if(verifyBuild&&(!build||build.source!==source||build.rules!==VERSION||build.geography!==MAP_VERSION))throw Error('BUILD_SOURCE_OR_RULES_MISMATCH');
 if(process.env.NODE_ENV==='production'&&(dirty||build?.dirty))throw Error('CLEAN_RELEASE_BUILD_REQUIRED');
 if(process.env.REQUIRE_PERSISTENT_DISK==='1'){
  const mount=process.env.PERSISTENT_MOUNT;
  if(process.platform!=='linux'||!mount||!fs.readFileSync('/proc/self/mountinfo','utf8').split('\n').some(l=>l.split(' ')[4]===mount))throw Error('PERSISTENT_DISK_NOT_MOUNTED');
  for(const p of Object.values(d))if(!p.startsWith(fs.realpathSync(mount)+path.sep))throw Error('SAVE_DIR_OUTSIDE_PERSISTENT_MOUNT');
 }
 const unlock=locks(d);let legacy,mp,server,closed=false;
 const close=async()=>{if(closed)return;closed=true;const wait=server?new Promise(r=>server.close(r)):Promise.resolve();try{await mp?.close();await legacy?.close();await wait;}finally{unlock();}};
 try{
  initializeKeys(d);
  legacy=await publicServer({port:0,host:'127.0.0.1',origin,saveDir:d.legacy,campaignModes,autoTick});
  mp=await multiplayer({port:0,saveDir:d.rooms,publicOrigin:origin,allowLoopbackHttp:localPreview,CampaignClass:RoomCampaign,AdapterClass:localPreview?RoomAdapter:PublicRoomAdapter,roomVersion:ROOM_VERSION,validateSaved:validateRoom,visitorCookie:'equipment_mp_visitor',lobbyFile:new URL('./lobby.html',import.meta.url),autoTick});
  const metadata={source,dirty,build,roomVersion:ROOM_VERSION,rules:VERSION,mapVersion:MAP_VERSION,localOnly:localPreview};
  function guard(req){
   if(req.headers.host!==url.host)throw Error('HOST_DENIED');
   if(req.headers.origin&&req.headers.origin!==origin)throw Error('ORIGIN_DENIED');
   if((!['GET','HEAD'].includes(req.method)||req.headers.upgrade)&&req.headers.origin!==origin)throw Error('ORIGIN_REQUIRED');
   const peer=req.socket.remoteAddress?.replace(/^::ffff:/,'');
   if(!localPreview&&!req.socket.encrypted&&(!trustProxyIPs.includes(peer)||req.headers['x-forwarded-proto']!=='https'))throw Error('HTTPS_TRUSTED_PROXY_REQUIRED');
   if(req.headers['x-forwarded-host']&&req.headers['x-forwarded-host']!==url.host)throw Error('FORWARDED_HOST_DENIED');
  }
  function route(req){const u=new URL(req.url,origin),mode=u.searchParams.get('campaign');
   if(u.searchParams.getAll('campaign').length>1)throw Error('AMBIGUOUS_CAMPAIGN');
   if(u.pathname==='/mp/visitor/start'){req.url='/visitor/start';return mp;}
   if(u.pathname==='/rooms'||u.pathname.startsWith('/room/'))return mp;
   if(req.method==='GET'&&/\.(?:js|mjs|css|png|webp|jpg|svg|woff2|json)$/.test(u.pathname)&&!mode)return mp;
   if(mode&&!Object.hasOwn(campaignModes,mode)){if(!/^[a-f0-9-]{36}$/.test(mode))throw Error('UNKNOWN_CAMPAIGN');return mp;}
   return legacy;
  }
  function headers(req){const h={...req.headers};delete h.forwarded;for(const k of Object.keys(h))if(k.startsWith('x-forwarded-'))delete h[k];return h;}
  const landing='<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>EASTFRONT 战役入口</title><style>body{background:#182321;color:#eadfc6;font:18px system-ui;max-width:760px;margin:8vh auto;padding:24px}a,button{display:block;padding:18px;margin:20px 0;background:#46513c;color:#fff;font:inherit;border:1px solid #9a997c}</style><h1>EASTFRONT</h1><a href="/rooms">新双人战役 · 装备分配与省份候选</a><p>房主德军、受邀玩家苏军。双方连接后由房主开始；各自只看授权信息。</p><form method="post" action="/visitor/start"><button>继续原单人战役／选择旧模式</button></form><p>新房间独立保存，不转换旧战役。请保留本浏览器身份凭证。</p></html>';
  const handle=(req,res)=>{try{guard(req);const u=new URL(req.url,origin);if(u.pathname==='/healthz')return json(res,200,{ok:true,...metadata});if(u.pathname==='/'&&!u.searchParams.has('campaign')){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(landing);}
   const target=route(req),p=http.request({host:'127.0.0.1',port:target.server.address().port,path:req.url,method:req.method,headers:headers(req)},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});p.on('error',()=>{if(!res.headersSent)json(res,503,{error:'UPSTREAM_UNAVAILABLE'});else res.destroy();});req.on('aborted',()=>p.destroy());req.pipe(p);
  }catch(e){json(res,403,{error:e.message});}};
  server=tls?https.createServer(tls,handle):http.createServer(handle);
  server.on('upgrade',(req,socket,head)=>{try{guard(req);if(!/^\/[ab]\/ws$/.test(new URL(req.url,origin).pathname))throw Error('WS_PATH_DENIED');const target=route(req);const p=http.request({host:'127.0.0.1',port:target.server.address().port,path:req.url,headers:headers(req)});
   p.on('upgrade',(r,peer,initial)=>{socket.write(`HTTP/1.1 ${r.statusCode} ${r.statusMessage}\r\n`+Object.entries(r.headers).map(([k,v])=>`${k}: ${v}\r\n`).join('')+'\r\n');if(initial.length)socket.write(initial);if(head.length)peer.write(head);socket.pipe(peer);peer.pipe(socket);socket.on('close',()=>peer.destroy());peer.on('close',()=>socket.destroy());socket.on('error',()=>peer.destroy());peer.on('error',()=>socket.destroy());});p.on('response',r=>{socket.end(`HTTP/1.1 ${r.statusCode} Forbidden\r\nConnection: close\r\n\r\n`);r.resume();});p.on('error',()=>socket.destroy());p.end();
  }catch{socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');}});
  await new Promise((r,j)=>{server.once('error',j);server.listen(port,host,r);});return {server,mp,legacy,metadata,close};
 }catch(e){await close();throw e;}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const tls=process.env.TLS_CERT&&process.env.TLS_KEY?{cert:fs.readFileSync(process.env.TLS_CERT),key:fs.readFileSync(process.env.TLS_KEY)}:null;
 const s=await start({tls});console.log(JSON.stringify({ready:true,...s.metadata}));const stop=async()=>{await s.close();process.exit(0);};process.on('SIGINT',stop);process.on('SIGTERM',stop);process.on('message',m=>{if(m==='shutdown')void stop();});
}

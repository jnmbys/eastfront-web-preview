import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes,createHmac,timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {releaseServer} from '../grand-release-001/server.mjs';
import {readSave,atomicWrite} from '../grand-release-001/persistence.mjs';

// Public admission is separate from campaign authorization. Each browser receives
// an unguessable signed identity; it never supplies a campaign directory or ID.
export async function publicServer({port=Number(process.env.PORT??4261),host=process.env.HOST??'127.0.0.1',origin=process.env.PUBLIC_ORIGIN??`http://127.0.0.1:${port}`,saveDir=process.env.SAVE_DIR,maxActive=2,maxVisitors=100,idleMs=30000,autoTick=true}={}){
 if(!saveDir)throw Error('PERSISTENT_SAVE_DIR_REQUIRED');
 if(process.env.REQUIRE_PERSISTENT_DISK==='1'){
  if(process.platform!=='linux'||!fs.readFileSync('/proc/self/mountinfo','utf8').split('\n').some(line=>line.split(' ')[4]==='/var/data'))throw Error('PERSISTENT_DISK_NOT_MOUNTED');
  if(!path.resolve(saveDir).startsWith('/var/data/'))throw Error('SAVE_DIR_OUTSIDE_PERSISTENT_DISK');
 }
 const url=new URL(origin),secure=url.protocol==='https:';
 if(url.origin!==origin||(!secure&&host!=='127.0.0.1'))throw Error('PUBLIC_HTTPS_ORIGIN_REQUIRED');
 fs.mkdirSync(saveDir,{recursive:true});
 const keyFile=path.join(saveDir,'visitor-key');
 if(!fs.existsSync(keyFile))fs.writeFileSync(keyFile,randomBytes(32),{flag:'wx',mode:0o600});
 const key=fs.readFileSync(keyFile);if(key.length!==32)throw Error('INVALID_VISITOR_KEY');
 const root=path.join(saveDir,'visitors');fs.mkdirSync(root,{recursive:true});
 // One non-rotating pre-UX004 checkpoint per existing visitor. Ordinary .bak
 // continues to rotate independently; neither identity nor current save changes.
 let backedUp=0;
 for(const id of fs.readdirSync(root).filter(id=>/^[a-f0-9]{64}$/.test(id))){
  const file=path.join(root,id,'campaign.json'),backup=file+'.before-ux004';
  if(fs.existsSync(file)&&!fs.existsSync(backup)){readSave(file);atomicWrite(backup,fs.readFileSync(file));backedUp++;}
 }
 console.log('UX004 pre-update checkpoints: '+backedUp);
 const active=new Map();let chain=Promise.resolve(),closing=false,lastAdmission=0;
 const serial=fn=>{const next=chain.then(fn);chain=next.catch(()=>{});return next;};
 const signature=value=>createHmac('sha256',key).update(value).digest('hex');
 function identity(req){
  const token=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('grand_visitor='))?.slice(14);
  if(!token||!/^([a-f0-9]{64})\.([0-9]{13})\.([a-f0-9]{64})$/.test(token))return null;
  const [id,expires,mac]=token.split('.');
  if(Number(expires)<Date.now()||!timingSafeEqual(Buffer.from(mac,'hex'),Buffer.from(signature(id+'.'+expires),'hex')))return null;
  return fs.existsSync(path.join(root,id,'visitor.json'))?id:null;
 }
 const connected=s=>[...s.seats.values()].some(x=>x.connection&&!x.connection.closed);
 async function reap(){for(const[id,x]of active){if(!connected(x.service)&&Date.now()-x.touched>=idleMs){await x.service.close();active.delete(id);}}}
 async function obtain(id){return serial(async()=>{
  if(closing)throw Error('SERVICE_CLOSING');
  await reap();if(active.has(id)){const x=active.get(id);x.touched=Date.now();return x.service;}
  if(active.size>=maxActive)throw Error('BUSY');
  const authorized=req=>identity(req)===id;
  const accessControl={authorized,async gate(req,res){if(authorized(req))return false;res.writeHead(401);res.end('请返回首页重新进入');return true;}};
  const service=await releaseServer({port:0,host:'127.0.0.1',origin,local:false,saveDir:path.join(root,id),accessControl,autoTick});
  active.set(id,{service,touched:Date.now()});return service;
 });}
 const page=`<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>EASTFRONT 公开试玩</title><style>body{background:#253339;color:#eee;font:18px system-ui;max-width:560px;margin:10vh auto;padding:24px}button{font:inherit;min-height:48px;padding:12px 24px}</style><h1>EASTFRONT</h1><p>独立战役 · 德军对苏军AI</p><p>每位访客独立指挥和保存，不会进入其他人的战役。此浏览器保留30天访问凭证；清除Cookie或换浏览器不会自动找回原局。离线暂停，重新进入后由你继续时间。</p><p>首轮最多同时载入两场战役；满员时请稍后重试。不会覆盖已有存档。</p><form method="post" action="/visitor/start"><button>开始独立试玩</button></form></html>`;
 function reply(res,status,body,type='text/plain; charset=utf-8'){res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(body);}
 const request=(req,res)=>void(async()=>{
  if(req.headers.host!==url.host)return reply(res,403,'HOST_DENIED');
  const pathname=new URL(req.url,origin).pathname;
  if(pathname==='/healthz')return reply(res,200,'{"ok":true}','application/json');
  if(pathname==='/visitor/start'&&req.method==='POST'){
   if(req.headers.origin!==origin)return reply(res,403,'ORIGIN_DENIED');
   let id=identity(req);
   if(!id){
    if(Date.now()-lastAdmission<2000)return reply(res,429,'请稍后再试');
    if(fs.readdirSync(root).length>=maxVisitors)return reply(res,503,'本轮试玩名额已满，已有访客仍可继续。');
    id=randomBytes(32).toString('hex');fs.mkdirSync(path.join(root,id));fs.writeFileSync(path.join(root,id,'visitor.json'),JSON.stringify({createdAt:new Date().toISOString(),schema:1}),{flag:'wx',mode:0o600});lastAdmission=Date.now();
   }
   const value=id+'.'+(Date.now()+30*86400000);
   res.writeHead(303,{'Location':'/','Cache-Control':'no-store','Set-Cookie':`grand_visitor=${value}.${signature(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${secure?'; Secure':''}`});res.end();return;
  }
  const id=identity(req);
  if(!id)return reply(res,req.method==='GET'&&pathname==='/'?200:401,page,'text/html; charset=utf-8');
  if(!['GET','HEAD'].includes(req.method)&&req.headers.origin!==origin)return reply(res,403,'ORIGIN_DENIED');
  const service=await obtain(id);
  const upstream=http.request({host:'127.0.0.1',port:service.server.address().port,path:req.url,method:req.method,headers:req.headers},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});
  upstream.on('error',()=>{if(!res.headersSent)reply(res,502,'连接暂时中断，请重新连接');else res.destroy();});req.on('aborted',()=>upstream.destroy());req.pipe(upstream);
 })().catch(e=>{if(!res.headersSent)reply(res,503,e.message==='BUSY'?'当前两场战役正在使用，请稍后重试；你的存档保留。':'服务暂不可用，请稍后重试');else res.destroy();});
 const server=http.createServer(request);
 server.on('upgrade',(req,socket,head)=>void(async()=>{
  const id=identity(req);
  if(!id||req.headers.host!==url.host||req.headers.origin!==origin||!/^\/[ab]\/ws$/.test(req.url)){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
  const service=await obtain(id);
  const upstream=http.request({host:'127.0.0.1',port:service.server.address().port,path:req.url,headers:req.headers});
  upstream.on('upgrade',(r,peer,initial)=>{socket.write(`HTTP/1.1 ${r.statusCode} ${r.statusMessage}\r\n`+Object.entries(r.headers).map(([k,v])=>`${k}: ${v}\r\n`).join('')+'\r\n');if(initial.length)socket.write(initial);if(head.length)peer.write(head);socket.pipe(peer);peer.pipe(socket);socket.on('error',()=>peer.destroy());peer.on('error',()=>socket.destroy());socket.on('close',()=>peer.destroy());peer.on('close',()=>socket.destroy());});
  upstream.on('response',r=>{socket.end(`HTTP/1.1 ${r.statusCode} Forbidden\r\nConnection: close\r\n\r\n`);r.resume();});upstream.on('error',()=>socket.destroy());upstream.end();
 })().catch(()=>socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n')));
 const timer=setInterval(()=>void serial(reap).catch(()=>{}),5000);
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
 return {server,active,async close(){closing=true;clearInterval(timer);await serial(async()=>{for(const x of active.values())await x.service.close();active.clear();});await new Promise(r=>server.close(r));}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const s=await publicServer();console.log('EASTFRONT independent visitor preview ready');let stopping=false;
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{if(stopping)return;stopping=true;await s.close();process.exit(0);});
}

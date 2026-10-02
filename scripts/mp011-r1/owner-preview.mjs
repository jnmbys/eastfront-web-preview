// Optional preview access boundary, outside both unchanged game/server builds.
// Starts only when explicitly run. Never logs passwords, cookies, requests or game payloads.
import {createServer,request} from 'node:http';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {resolve} from 'node:path';
import {appendFileSync} from 'node:fs';
import {observe} from './diagnostics.mjs';
export function ownerPreview({origin,passwordSha256,upstreamPort=4180,now=Date.now,diagnostic=()=>{}}) {
  const url=new URL(origin);
  if(url.protocol!=='https:'||url.origin!==origin||!/^[a-f0-9]{64}$/i.test(passwordSha256??''))
    throw Error('Exact HTTPS origin and owner password SHA256 are required');
  const expected=Buffer.from(passwordSha256,'hex'),sessions=new Map();let attemptWindow=now(),attempts=0;
  const cookieName='__Host-mp010_owner';
  const authenticated=req=>{
    const cookie=(req.headers.cookie??'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='));
    const value=cookie?.slice(cookieName.length+1),expires=sessions.get(value);
    return !!expires&&expires>now();
  };
  const headers=req=>Object.fromEntries(Object.entries(req.headers).filter(([name])=>!['cookie','authorization','proxy-authorization'].includes(name)));
  const form='<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MP010 本人验收入口</title><h1>MP010 本人验收入口</h1><p>仅供拥有者本人测试。输入本次临时口令；不要填写游戏 token。</p><form action="/__mp010_login" method="post"><label>临时口令 <input name="password" type="password" autocomplete="off" required maxlength="256"></label><button>进入验收</button></form>';
  const server=createServer((req,res)=>{
    const trace=observe(req,res,'http',diagnostic);
    res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy',"frame-ancestors 'self'");
    if(req.headers.host!==url.host){trace.decision(403,'host');res.writeHead(403);res.end();return;}
    if(req.url==='/__mp010_login'){
      if(req.method==='GET'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(form);return;}
      if(req.method!=='POST'||req.headers.origin!==origin||!req.headers['content-type']?.startsWith('application/x-www-form-urlencoded')){res.writeHead(403);res.end();return;}
      if(now()-attemptWindow>=60000){attemptWindow=now();attempts=0;}
      if(++attempts>5){res.writeHead(429);res.end('Too many attempts');return;}
      let body='',size=0,oversize=false;
      req.on('data',chunk=>{size+=chunk.length;if(size>4096){oversize=true;body='';}else if(!oversize)body+=chunk;});
      req.on('end',()=>{
        if(oversize){res.writeHead(413);res.end();return;}
        const password=new URLSearchParams(body).get('password')??'';body='';
        if(!timingSafeEqual(createHash('sha256').update(password).digest(),expected)){res.writeHead(403);res.end('Access denied');return;}
        for(const [key,expires] of sessions)if(expires<=now())sessions.delete(key);
        if(sessions.size>=4)sessions.delete(sessions.keys().next().value);
        const token=randomBytes(32).toString('hex');sessions.set(token,now()+8*3600000);
        res.setHeader('Set-Cookie',`${cookieName}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=28800`);
        res.writeHead(303,{Location:'/'});res.end();
      });return;
    }
    if(!authenticated(req)){trace.decision(303,'unauthenticated');res.writeHead(303,{Location:'/__mp010_login'});res.end();return;}
    const proxy=request({host:'127.0.0.1',port:upstreamPort,path:req.url,method:req.method,headers:headers(req)},reply=>{
      res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);
    });proxy.on('error',error=>{trace.error(error);if(!res.headersSent)res.writeHead(502);res.end();});req.pipe(proxy);
  });
  server.on('upgrade',(req,socket,head)=>{
    const trace=observe(req,socket,'ws',diagnostic);
    if(req.headers.host!==url.host||req.headers.origin!==origin||!authenticated(req)){
      trace.decision(403,req.headers.host!==url.host?'host':req.headers.origin!==origin?'origin':'unauthenticated');
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;
    }
    const proxy=request({host:'127.0.0.1',port:upstreamPort,path:req.url,method:'GET',headers:headers(req)});
    proxy.on('upgrade',(reply,upstream,upHead)=>{
      trace.decision(reply.statusCode,'authorized-upstream');
      socket.write(`HTTP/1.1 ${reply.statusCode} ${reply.statusMessage}\r\n`+reply.rawHeaders.reduce((s,v,i,a)=>i%2?s:s+v+': '+a[i+1]+'\r\n','')+'\r\n');
      if(upHead.length)socket.write(upHead);if(head.length)upstream.write(head);
      upstream.pipe(socket);socket.pipe(upstream);socket.on('error',()=>upstream.destroy());upstream.on('error',()=>socket.destroy());socket.on('close',()=>upstream.destroy());
    });proxy.on('response',reply=>{trace.decision(reply.statusCode,'upstream-non-upgrade');socket.destroy();});proxy.on('error',error=>{trace.error(error);socket.destroy();});proxy.end();
  });
  return server;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){
  const diagnostic=event=>appendFileSync(process.env.MP011_DIAGNOSTIC_LOG,JSON.stringify(event)+'\n');
  const server=ownerPreview({origin:process.env.MP010_ORIGIN,passwordSha256:process.env.MP010_OWNER_PASSWORD_SHA256,diagnostic});
  delete process.env.MP010_OWNER_PASSWORD_SHA256;
  server.listen(4181,'127.0.0.1',()=>console.log('MP010 owner-only boundary listening on loopback 4181; upstream 4180'));
}

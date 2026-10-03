// Diagnostic routing only. Authentication is the unchanged MP011-R1 boundary.
import {createServer,request} from 'node:http';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export const diagnosticFiles=['trace.mjs','entry.mjs','panel.mjs'];
export function exactOrigin(origin){const u=new URL(origin);if(u.protocol!=='https:'||u.origin!==origin||u.username||u.password)throw Error('One exact HTTPS origin required');return u;}
export function diagnostics(){const hashes=Object.fromEntries(diagnosticFiles.map(p=>[p,createHash('sha256').update(readFileSync(new URL('../mp012/'+p,import.meta.url))).digest('hex')]));return {hashes,diagnosticSha256:createHash('sha256').update(JSON.stringify(hashes)).digest('hex')};}
export function gateway({origin,upstreamPort,manifest,observe=()=>{}}){
  const url=exactOrigin(origin),diag=diagnostics();
  const safeHeaders=req=>Object.fromEntries(Object.entries(req.headers).filter(([k])=>!['cookie','authorization','proxy-authorization','x-forwarded-host','x-forwarded-proto'].includes(k)));
  const sockets=new Set();
  const server=createServer((req,res)=>{
    observe(req);res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    if(req.headers.host!==url.host){res.writeHead(403);res.end();return;}
    if(req.method!=='GET'){res.writeHead(405);res.end();return;}
    const path=new URL(req.url,origin).pathname;
    const send=(body,type)=>{res.writeHead(200,{'Content-Type':type,'Content-Length':Buffer.byteLength(body)});res.end(body);};
    if(path==='/')return send(readFileSync(new URL('web/index.html',import.meta.url)),'text/html; charset=utf-8');
    if(['/mp013/controller.mjs','/mp013/export.mjs'].includes(path))return send(readFileSync(new URL('web/'+path.split('/').at(-1),import.meta.url)),'text/javascript; charset=utf-8');
    if(path==='/mp013/config.json')return send(JSON.stringify({versions:manifest.versions,origin,serverSha:manifest.serverSha,snapshotFormat:manifest.snapshotFormat,diagnosticSha256:diag.diagnosticSha256,entryVersion:'control',scenario:'move',mode:'real'}),'application/json');
    const match=path.match(/^\/mp012\/config\/(candidate|control)$/);
    if(match){const b=manifest.builds[match[1]];return send(JSON.stringify({sourceSha:b.sourceSha,paths:[...Object.keys(b.hashes),'multiplayer-config.json'],...diag,fault:'none'}),'application/json');}
    if(diagnosticFiles.some(p=>path==='/mp012/'+p))return send(readFileSync(new URL('../mp012/'+path.split('/').at(-1),import.meta.url)),'text/javascript');
    // Keep original asset URLs and original gateway's dynamic multiplayer-config.json.
    if(!/^\/v\/(candidate|control)\/(deployment|move)\/(real|delay|timeout)\//.test(path)&&path!=='/lab-config.json'){res.writeHead(404);res.end();return;}
    const proxy=request({host:'127.0.0.1',port:upstreamPort,path:req.url,method:'GET',headers:safeHeaders(req)},reply=>{
      const chunks=[];reply.on('data',d=>chunks.push(d));reply.on('error',()=>res.destroy());reply.on('end',()=>{
        let body=Buffer.concat(chunks);
        if(reply.statusCode===200&&reply.headers['content-type']?.startsWith('text/html'))body=Buffer.from(body.toString().replace('src="./mp010/bootstrap.mjs"','src="/mp012/entry.mjs"'));
        res.writeHead(reply.statusCode??502,{'Content-Type':reply.headers['content-type']??'application/octet-stream','Content-Length':body.length});res.end(body);
      });
    });proxy.on('error',()=>{if(!res.headersSent){res.writeHead(502);res.end();}else res.destroy();});proxy.end();
  });
  server.on('connection',s=>{sockets.add(s);s.once('close',()=>sockets.delete(s));});
  server.on('upgrade',(req,socket,head)=>{
    observe(req);
    if(req.headers.host!==url.host||req.headers.origin!==origin||!/^\/ws\/(deployment|move)\/(real|delay|timeout)$/.test(req.url)){socket.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n');return;}
    const proxy=request({host:'127.0.0.1',port:upstreamPort,path:req.url,headers:safeHeaders(req)});
    proxy.on('upgrade',(reply,upstream,upHead)=>{
      socket.write(`HTTP/1.1 ${reply.statusCode} ${reply.statusMessage}\r\n`+reply.rawHeaders.reduce((s,v,i,a)=>i%2?s:s+v+': '+a[i+1]+'\r\n','')+'\r\n');
      if(head.length)upstream.write(head);if(upHead.length)socket.write(upHead);upstream.pipe(socket);socket.pipe(upstream);
      socket.on('error',()=>upstream.destroy());upstream.on('error',()=>socket.destroy());socket.on('close',()=>upstream.destroy());
    });proxy.on('error',()=>socket.destroy());proxy.on('response',()=>socket.destroy());proxy.end();
  });
  server.stop=async()=>{for(const s of sockets)s.destroy();await new Promise(r=>server.close(r));};
  return server;
}

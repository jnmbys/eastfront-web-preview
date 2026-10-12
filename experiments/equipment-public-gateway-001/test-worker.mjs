import fs from 'node:fs';
import http from 'node:http';import https from 'node:https';
import {start} from './server.mjs';
const cfg=JSON.parse(fs.readFileSync(process.env.GATEWAY_TEST_CONFIG));
const tls=cfg.cert?{cert:fs.readFileSync(cfg.cert),key:fs.readFileSync(cfg.key)}:null;
if(cfg.ingressMode==='render')Object.assign(process.env,{RENDER:'true',RENDER_SERVICE_TYPE:'web',RENDER_SERVICE_ID:'srv-synthetic',RENDER_EXTERNAL_HOSTNAME:new URL(cfg.origin).hostname,RENDER_EXTERNAL_URL:cfg.origin,PORT:'0'});
const s=await start({...cfg,...(cfg.proxyMode?{port:0,trustProxyIPs:cfg.ingressMode==='render'?[]:['127.0.0.1']}:{}),tls:cfg.proxyMode?null:tls,autoTick:false});
let edge;
if(cfg.proxyMode){
 // Synthetic TLS terminator only: public Host/Origin retained, proto replaced by the trusted edge.
 const options=req=>({host:'127.0.0.1',port:s.server.address().port,path:req.url,method:req.method,headers:{...req.headers,'x-forwarded-proto':'https'}});
 edge=https.createServer(tls,(req,res)=>{const p=http.request(options(req),r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});p.on('error',()=>res.destroy());req.pipe(p);});
 edge.on('upgrade',(req,socket,head)=>{const p=http.request(options(req));p.on('upgrade',(r,peer,initial)=>{socket.write(`HTTP/1.1 ${r.statusCode} ${r.statusMessage}\r\n`+Object.entries(r.headers).map(([k,v])=>`${k}: ${v}\r\n`).join('')+'\r\n');if(head.length)peer.write(head);if(initial.length)socket.write(initial);socket.pipe(peer);peer.pipe(socket);socket.on('close',()=>peer.destroy());peer.on('close',()=>socket.destroy());socket.on('error',()=>peer.destroy());peer.on('error',()=>socket.destroy());});p.on('response',r=>{socket.end(`HTTP/1.1 ${r.statusCode} Forbidden\r\n\r\n`);r.resume();});p.on('error',()=>socket.destroy());p.end();});
 await new Promise(r=>edge.listen(cfg.port,'127.0.0.1',r));
}
console.log(JSON.stringify({ready:true,pid:process.pid}));
process.on('message',async m=>{try{if(m==='shutdown'){await s.close();if(edge)await new Promise(r=>edge.close(r));process.exit(0);}else if(m?.type==='steps'){for(const room of s.mp.rooms.values())await room.adapter.exclusive(async()=>{for(let i=0;i<m.count;i++)room.adapter.c.advance();await room.adapter.saveFileNow();});process.send({done:true});}}catch(e){process.send({error:e.message});}});

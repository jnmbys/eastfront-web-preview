// Test-only loopback relay: one fresh public visitor in a private cookie jar.
// Avoids changing cookies or campaign in the user's already-open public tab.
// No simulation here. Assets, business HTTP and WSS all come from real public service.
import http from 'node:http';import https from 'node:https';import {WebSocketServer,WebSocket} from 'ws';
const origin='https://eastfront-grand-preview.onrender.com',port=4267,jar=new Map();
const remember=cs=>{for(const c of cs??[]){const i=c.indexOf('=');jar.set(c.slice(0,i),c.slice(i+1).split(';')[0]);}},cookie=()=>[...jar].map(([k,v])=>k+'='+v).join('; ');
const admission=await fetch(origin+'/visitor/start',{method:'POST',redirect:'manual',headers:{origin}});if(admission.status!==303)throw Error('TEST_VISITOR_ADMISSION_'+admission.status);remember(admission.headers.getSetCookie());
const server=http.createServer((req,res)=>{if(req.headers.host!==`127.0.0.1:${port}`||req.headers.origin&&req.headers.origin!==`http://127.0.0.1:${port}`){res.writeHead(403);res.end();return;}
 const headers={...req.headers,host:new URL(origin).host,origin,cookie:cookie()};delete headers['accept-encoding'];
 const up=https.request(origin+req.url,{method:req.method,headers},r=>{remember(r.headers['set-cookie']);const h={...r.headers};delete h['set-cookie'];if(h.location?.startsWith(origin))h.location=h.location.slice(origin.length);res.writeHead(r.statusCode,h);r.pipe(res);});up.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end();});req.pipe(up);
});const wss=new WebSocketServer({noServer:true});
server.on('upgrade',(req,socket,head)=>{if(req.headers.origin!==`http://127.0.0.1:${port}`||!/^\/[ab]\/ws$/.test(req.url)){socket.destroy();return;}wss.handleUpgrade(req,socket,head,local=>{const remote=new WebSocket(origin.replace('https','wss')+req.url,{headers:{origin,cookie:cookie()}}),queue=[];local.on('message',(b,binary)=>{if(remote.readyState===1)remote.send(b,{binary});else if(queue.length<8)queue.push([b,binary]);else local.close();});remote.on('open',()=>{for(const [b,binary]of queue)remote.send(b,{binary});queue.length=0;});remote.on('message',(b,binary)=>{if(local.readyState===1)local.send(b,{binary});});local.on('close',()=>remote.close());remote.on('close',()=>local.close());local.on('error',()=>remote.terminate());remote.on('error',()=>local.close());});});
server.listen(port,'127.0.0.1',()=>console.log('Isolated PUBLIC browser relay at http://127.0.0.1:'+port+'; extra loopback relay latency included. No local authority.'));

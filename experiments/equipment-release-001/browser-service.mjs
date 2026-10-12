import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import http from 'node:http';import net from 'node:net';
import {start} from '../blackice-mp-001/server.mjs';import {roomCampaign} from '../blackice-mp-001/authority.mjs';import {Campaign} from '../hoi4-equipment-priority-001/authority.mjs';
const out='evidence/equipment-release-001',runtime=process.env.RUNTIME_FILE??path.join(os.tmpdir(),'equipment-release-current.json');
const previous=process.env.RESTORE==='1'?JSON.parse(fs.readFileSync(runtime)):null;
const saveDir=previous?.saveDir??fs.mkdtempSync(path.join(os.tmpdir(),'equipment-release-'));
const version='HOI4-EQUIPMENT-PRIORITY-MP-001-1';
const svc=await start({port:0,saveDir,CampaignClass:roomCampaign(Campaign,version),roomVersion:version,visitorCookie:'equipment_release_visitor'});
const metrics={scope:'local loopback test only; 36 units; G-013/S-013 adjacent fixture before room starts; no equipment or work granted',step:[],view:[],queue:[],save:[]};
const set=svc.rooms.set.bind(svc.rooms);svc.rooms.set=(id,s)=>{const a=s.adapter,c=a.c;
 if(!previous&&c.clock.tick===0){for(const [i,id]of ['G-013','S-013'].entries())c.state.units[id].hex={q:23+i,r:4};c.observeVision();}
 for(const [name,key]of [['step','step'],['view','view'],['saveFileNow','save']]){const original=a[name].bind(a);a[name]=async(...args)=>{const t=performance.now();try{return await original(...args);}finally{metrics[key].push({ms:performance.now()-t,tick:c.clock.tick,battles:c.clock.battles.length,seat:name==='view'?args[0]:undefined});}};}
 const ex=a.exclusive.bind(a);a.exclusive=fn=>{const t=performance.now();return ex(()=>{metrics.queue.push({ms:performance.now()-t,depth:a.depth});return fn();});};return set(id,s);};
// Test-only reverse proxy permits two loopback hostnames, giving independent
// browser host-only cookie stores. It rewrites only exact allowed Host/Origin;
// authoritative session, membership and command checks remain in the gateway.
const backend=new URL(svc.url);let front;
function headers(req){const accepted=[`127.0.0.1:${front.address().port}`,`localhost:${front.address().port}`];if(!accepted.includes(req.headers.host))throw Error('TEST_HOST_DENIED');if(req.headers.origin&&!accepted.map(h=>'http://'+h).includes(req.headers.origin))throw Error('TEST_ORIGIN_DENIED');return {...req.headers,host:backend.host,...(req.headers.origin?{origin:backend.origin}:{})};}
front=http.createServer((req,res)=>{let h;try{h=headers(req);}catch{res.writeHead(403);res.end();return;}const p=http.request({hostname:'127.0.0.1',port:backend.port,path:req.url,method:req.method,headers:h},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});p.on('error',()=>{res.writeHead(502);res.end();});req.pipe(p);});
front.on('upgrade',(req,socket,head)=>{let h;try{h=headers(req);}catch{socket.destroy();return;}const upstream=net.connect(Number(backend.port),'127.0.0.1',()=>{upstream.write(`${req.method} ${req.url} HTTP/1.1\r\n`+Object.entries(h).map(([k,v])=>`${k}: ${v}`).join('\r\n')+'\r\n\r\n');if(head.length)upstream.write(head);socket.pipe(upstream);upstream.pipe(socket);});upstream.on('error',()=>socket.destroy());socket.on('error',()=>upstream.destroy());socket.on('close',()=>upstream.destroy());});
await new Promise(r=>front.listen(previous?.port??0,'127.0.0.1',r));const port=front.address().port;
fs.writeFileSync(runtime,JSON.stringify({saveDir,port,pid:process.pid,backend:svc.url}));console.log(JSON.stringify({ready:true,port,runtime,source:svc.source}));
const timer=setInterval(()=>{fs.writeFileSync(out+'/server-metrics.json',JSON.stringify(metrics));const stop=path.join(saveDir,'stop');if(fs.existsSync(stop)){fs.unlinkSync(stop);void close();}},1000);
async function close(){clearInterval(timer);await svc.close();front.close();fs.writeFileSync(out+'/server-metrics.json',JSON.stringify(metrics));process.exit(0);}process.on('SIGTERM',close);process.on('message',m=>{if(m==='shutdown')void close();});

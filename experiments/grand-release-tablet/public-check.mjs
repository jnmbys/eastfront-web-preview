import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import WebSocket from 'ws';
import {publicServer} from './public-server.mjs';
const origin='http://127.0.0.1:4261',saveDir=fs.mkdtempSync(path.join(os.tmpdir(),'public-preview-'));
const opts={port:4261,origin,saveDir,autoTick:false};let s=await publicServer(opts);const sockets=[];
const request=(p,cookie='',method='GET',headers={})=>fetch(origin+p,{method,headers:{origin,cookie,...headers},redirect:'manual'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function join(){const r=await request('/visitor/start','','POST');assert.equal(r.status,303);return r.headers.get('set-cookie').split(';')[0];}
async function connect(cookie){
 const r=await request('/a/session',cookie,'POST',{'X-Grand-Protocol':'GRAND-RELEASE-TERRITORY-1'});assert.equal(r.status,200);
 const ws=new WebSocket(origin.replace('http','ws')+'/a/ws',{headers:{origin,cookie:cookie+'; '+r.headers.get('set-cookie').split(';')[0]}});sockets.push(ws);let welcome,view;const rows=[];
 const send=m=>ws.send(JSON.stringify({...m,instanceId:welcome?.instanceId,connectionEpoch:welcome?.connectionEpoch}));
 ws.on('message',b=>{const m=JSON.parse(b);rows.push(m);if(m.type==='WELCOME')welcome=m;if(m.type==='STATE'){view=m.full??view;send({type:'VIEW_ACK',stream:m.stream,viewVersion:m.viewVersion});}if(m.type==='RESULT')send({type:'RESULT_ACK',ids:[m.result.requestId]});});
 await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});send({type:'HELLO'});for(let i=0;i<200&&!view;i++)await wait(20);assert(view);assert.match(ws.extensions,/permessage-deflate/);
 return {ws,send,rows,get welcome(){return welcome;},get view(){return view;}};
}
try{
 assert.equal((await request('/')).status,200);assert.equal((await request('/release/info')).status,401);
 assert.equal((await request('/visitor/start','','POST',{origin:'https://bad.invalid'})).status,403);
 const a=await join();await wait(2100);const b=await join();assert.notEqual(a,b);
 const ca=await connect(a),cb=await connect(b);assert.notEqual(ca.welcome.instanceId,cb.welcome.instanceId);
 assert.equal(s.active.size,2);
 const command={instanceId:ca.welcome.instanceId,era:ca.view.era,commandSeq:1,requestId:'public-save-a',kind:'SAVE',payload:{},dependencies:{worldGeneration:0}};
 ca.send({type:'COMMAND',command});for(let i=0;i<200&&!ca.rows.some(x=>x.type==='RESULT');i++)await wait(20);
 assert.equal(ca.rows.find(x=>x.type==='RESULT').result.status,'APPLIED');
 cb.send({type:'COMMAND',command});await wait(200);assert(!cb.rows.some(x=>x.type==='RESULT'&&x.result.status==='APPLIED'));
 ca.send({type:'COMMAND',command});await wait(150);
 const entries=[...s.active.values()];assert.deepEqual(entries.map(x=>x.service.adapter.c.transport.next.a),[2,1]);
 const forged=a.replace(/.$/,'x');assert.equal((await request('/release/info',forged)).status,401);
 const ia=await (await request('/release/info',a)).json(),ib=await (await request('/release/info',b)).json();assert.notEqual(ia.instanceId,ib.instanceId);
 // Real advance for A does not advance B; both use unchanged authority rules.
 entries[0].service.adapter.c.clock.paused=false;entries[0].service.adapter.c.clock.autopause=false;await entries[0].service.adapter.step();
 assert.equal(entries[0].service.adapter.c.clock.tick,1);assert.equal(entries[1].service.adapter.c.clock.tick,0);
 for(const ws of sockets)ws.terminate();await wait(150);assert(entries.every(x=>x.service.adapter.c.clock.paused));
 await s.close();s=await publicServer(opts);
 const ra=await (await request('/release/info',a)).json(),rb=await (await request('/release/info',b)).json();
 assert.equal(ra.tick,1);assert.equal(rb.tick,0);assert(ra.paused&&rb.paused);assert.notEqual([...s.active.values()][0].service.adapter.era,ca.welcome.era ?? ca.view.era);
 assert.deepEqual([...s.active.values()].map(x=>x.service.adapter.c.transport.next.a),[2,1]);
 const dirs=fs.readdirSync(path.join(saveDir,'visitors'));assert.equal(dirs.length,2);assert(dirs.every(id=>fs.existsSync(path.join(saveDir,'visitors',id,'campaign.json'))));
 const out={checks:['public landing; protected campaign','cross-origin admission denied','two independent browser identities and authorities','HTTP/WS forwarding with original protocol; bounded permessage-deflate negotiated','cross-instance command refused','duplicate does not repeat','forged cookie denied','A progresses without B','disconnect pause','restart paused; separate time and receipt ledgers preserved'],rssBytes:process.memoryUsage().rss,source:'Automated HTTP/WS integration; not public TLS or tablet acceptance'};
 fs.mkdirSync('evidence/grand-release-public',{recursive:true});fs.writeFileSync('evidence/grand-release-public/check.json',JSON.stringify(out,null,2));console.log(out);
}finally{for(const ws of sockets)ws.terminate();await s.close();}


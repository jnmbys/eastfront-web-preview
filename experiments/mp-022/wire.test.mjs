import {test} from 'node:test';import assert from 'node:assert/strict';import WebSocket from 'ws';
import {start} from './server.mjs';
async function denied(url,headers={}){return new Promise((resolve,reject)=>{const ws=new WebSocket(url, {headers});ws.once('unexpected-response',(_req,res)=>{res.resume();resolve(res.statusCode);});ws.once('open',()=>{ws.close();reject(Error('unauthorized upgrade'));});ws.once('error',reject);});}
async function connect(base,cookie){const ws=new WebSocket(base.replace('http','ws')+'/a/ws',{headers:{origin:base,cookie}}),rows=[];ws.on('message',d=>rows.push(JSON.parse(d)));await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
 const wait=async pred=>{for(let i=0;i<200;i++){const row=rows.find(pred);if(row)return row;await new Promise(r=>setTimeout(r,10));}throw Error('wire wait timeout');};ws.send(JSON.stringify({type:'HELLO'}));const welcome=await wait(r=>r.type==='WELCOME');return {ws,rows,wait,send:m=>ws.send(JSON.stringify({instanceId:welcome.instanceId,connectionEpoch:welcome.connectionEpoch,...m})),welcome};}
test('actual WS auth, command sequence, connection replacement, monotonic full-resync versions and persistent receipts',async()=>{
 const service=await start({port:0,autoTick:false});try{
  assert.equal(await denied(service.url.replace('http','ws')+'/a/ws',{origin:service.url}),403);
  assert.equal((await fetch(service.url+'/a/session',{method:'POST',headers:{origin:'http://wrong.example'}})).status,403);
  const response=await fetch(service.url+'/a/session',{method:'POST',headers:{origin:service.url}});assert.equal(response.status,200);const cookie=response.headers.get('set-cookie').split(';')[0];
  assert.equal(await denied(service.url.replace('http','ws')+'/a/ws',{origin:'http://wrong.example',cookie}),403);
  const first=await connect(service.url,cookie),view=await first.wait(r=>r.type==='STATE');first.send({type:'VIEW_ACK',stream:1,viewVersion:view.viewVersion});
  const cmd={instanceId:service.adapter.id,requestId:'wire-command-build',commandSeq:1,kind:'BUILD',payload:{district:view.full.cities.items.flatMap(c=>c.districts).find(d=>d.canBuild).id},dependencies:{account:view.full.accountStamp}};
  first.send({type:'COMMAND',command:{...cmd,commandSeq:2}});assert.equal((await first.wait(r=>r.type==='ERROR')).reason,'COMMAND_SEQUENCE_GAP');assert.equal(service.adapter.revision,0);
  first.send({type:'COMMAND',command:cmd});await first.wait(r=>r.type==='STATE'&&r.results.some(x=>x.requestId===cmd.requestId));const budget=service.adapter.c.econ.accounts.GERMAN.I;
  const second=await connect(service.url,cookie);assert.ok(second.welcome.connectionEpoch>first.welcome.connectionEpoch);const latest=await second.wait(r=>r.type==='STATE');assert.equal(latest.results[0].requestId,cmd.requestId);
  second.send({type:'COMMAND',command:cmd});await new Promise(r=>setTimeout(r,100));assert.equal(service.adapter.c.econ.accounts.GERMAN.I,budget);assert.equal(service.adapter.c.receipts.size,1);
  second.send({type:'RESYNC',stream:1});const resync=await second.wait(r=>r.type==='STATE'&&r.stream===2&&r.viewVersion>latest.viewVersion);assert.ok(resync.full);second.send({type:'VIEW_ACK',stream:1,viewVersion:latest.viewVersion});await new Promise(r=>setTimeout(r,20));assert.equal(service.seats.get('a').connection.outstanding.at(-1).version,resync.viewVersion);
  second.send({type:'VIEW_ACK',stream:resync.stream,viewVersion:resync.viewVersion});second.send({type:'RESULT_ACK',ids:[cmd.requestId]});await new Promise(r=>setTimeout(r,50));assert.equal(service.adapter.pending('GERMAN').length,0);
  second.ws.close();first.ws.close();
 }finally{await service.close();}
});

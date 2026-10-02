import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request} from 'node:http';
import {createHash} from 'node:crypto';
import {WebSocketServer,WebSocket} from 'ws';
import {ownerPreview} from '../scripts/mp010/owner-preview.mjs';
test('MP010R1 owner preview rejects anonymous/foreign requests and strips credentials from authorized HTTP and WS',async()=>{
  const origin='https://owner-preview.test',password='test-only-credential-not-a-real-secret',received=[];
  const upstream=createServer((req,res)=>{received.push(req.headers);res.end('fixed test build');});
  const wss=new WebSocketServer({server:upstream});wss.on('connection',(ws,req)=>{received.push(req.headers);ws.on('message',data=>ws.send(data));});
  await new Promise(r=>upstream.listen(0,'127.0.0.1',r));
  let now=1000;const gate=ownerPreview({origin,passwordSha256:createHash('sha256').update(password).digest('hex'),upstreamPort:upstream.address().port,now:()=>now});
  await new Promise(r=>gate.listen(0,'127.0.0.1',r));const port=gate.address().port;
  function http(path='/',headers={},body){return new Promise((resolve,reject)=>{
    const req=request({host:'127.0.0.1',port,path,method:body===undefined?'GET':'POST',headers:{host:'owner-preview.test',...headers}},res=>{
      let text='';res.on('data',data=>text+=data);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text}));
    });req.on('error',reject);req.end(body);
  });}
  try{
    assert.equal((await http()).status,303);assert.equal((await http('/',{host:'foreign.test'})).status,403);
    const formHeaders={origin,'content-type':'application/x-www-form-urlencoded'};
    assert.equal((await http('/__mp010_login',{...formHeaders,origin:'https://foreign.test'},'password='+password)).status,403);
    assert.equal((await http('/__mp010_login',formHeaders,'password=wrong')).status,403);
    const login=await http('/__mp010_login',formHeaders,'password='+password);assert.equal(login.status,303);
    const setCookie=login.headers['set-cookie'][0];assert.match(setCookie,/Secure; HttpOnly; SameSite=Strict/);const cookie=setCookie.split(';')[0];
    assert.equal((await http('/',{cookie,authorization:'must-not-reach-game'})).text,'fixed test build');
    assert.equal(received[0].cookie,undefined);assert.equal(received[0].authorization,undefined);
    await new Promise((resolve,reject)=>{const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`,{headers:{host:'owner-preview.test',origin}});
      ws.on('unexpected-response',(_req,res)=>{assert.equal(res.statusCode,403);res.resume();resolve();});ws.on('error',reject);
    });
    await new Promise((resolve,reject)=>{const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`,{headers:{host:'owner-preview.test',origin,cookie}});
      ws.on('open',()=>ws.send('test-metadata'));ws.on('message',data=>{assert.equal(data.toString(),'test-metadata');ws.close();});ws.on('close',resolve);ws.on('error',reject);
    });assert.equal(received[1].cookie,undefined);
    now+=8*3600000;assert.equal((await http('/',{cookie})).status,303);
  }finally{gate.closeAllConnections();await new Promise(r=>gate.close(r));for(const ws of wss.clients)ws.terminate();await new Promise(r=>wss.close(r));upstream.closeAllConnections();await new Promise(r=>upstream.close(r));}
});

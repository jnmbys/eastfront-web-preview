import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request} from 'node:http';
import {createHash} from 'node:crypto';
import {WebSocketServer,WebSocket} from 'ws';
import {ownerPreview} from '../scripts/mp011-r1/owner-preview.mjs';
test('MP011R1 diagnostics preserve authentication, denial, credential stripping and expiry',async()=>{
  const origin='https://owner-preview.test',password='test-only-credential-not-a-real-secret',received=[],events=[];
  const upstream=createServer((req,res)=>{received.push(req.headers);res.end('fixed test build');});
  const wss=new WebSocketServer({server:upstream});wss.on('connection',(ws,req)=>{received.push(req.headers);ws.on('message',data=>ws.send(data));});
  await new Promise(r=>upstream.listen(0,'127.0.0.1',r));
  let now=1000;const gate=ownerPreview({origin,passwordSha256:createHash('sha256').update(password).digest('hex'),upstreamPort:upstream.address().port,now:()=>now,diagnostic:event=>events.push(event)});
  await new Promise(r=>gate.listen(0,'127.0.0.1',r));const port=gate.address().port;
  function http(path='/',headers={},body){return new Promise((resolve,reject)=>{
    const req=request({host:'127.0.0.1',port,path,method:body===undefined?'GET':'POST',headers:{host:'owner-preview.test',...headers}},res=>{
      let text='';res.on('data',data=>text+=data);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text}));
    });req.on('error',reject);req.end(body);
  });}
  const deny=path=>new Promise((resolve,reject)=>{const ws=new WebSocket(`ws://127.0.0.1:${port}${path}`,{headers:{host:'owner-preview.test',origin,'x-mp011-request-id':'mp011-12345678-abcd','cf-ray':'1234567890abcdef-LAX'}});ws.on('unexpected-response',(_req,res)=>{assert.equal(res.headers['content-length'],'0');assert.equal(res.headers.connection,'close');let size=0;res.on('data',data=>size+=data.length);res.on('end',()=>{assert.equal(size,0);resolve(res.statusCode);});});ws.on('open',()=>{ws.terminate();reject(Error('Unexpected anonymous acceptance'));});ws.on('error',reject);});
  try{
    assert.equal((await http()).status,303);
    assert.equal((await http('/__mp010_login')).headers['referrer-policy'],'same-origin');
    assert.equal((await http('/')).headers['referrer-policy'],'no-referrer');
    assert.equal((await http('/',{host:'foreign.test'})).status,403);
    for(let repeat=0;repeat<3;repeat++)for(const scenario of ['deployment','move'])for(const mode of ['real','delay','timeout'])assert.equal(await deny(`/ws/${scenario}/${mode}`),403);
    const wsEvents=events.filter(e=>e.kind==='ws');
    assert.equal(wsEvents.filter(e=>e.event==='received').length,18);
    assert.equal(wsEvents.filter(e=>e.event==='response-finish'&&e.status===403).length,18);
    assert(wsEvents.every(e=>e.requestId==='mp011-12345678-abcd'&&e.cfRay==='1234567890abcdef-LAX'));
    const formHeaders={origin,'content-type':'application/x-www-form-urlencoded'};
    assert.equal((await http('/__mp010_login',{...formHeaders,origin:'https://foreign.test'},'password='+password)).status,403);
    assert.equal((await http('/__mp010_login',{...formHeaders,origin:'null'},'password='+password)).status,403);
    assert.equal((await http('/__mp010_login',formHeaders,'password=wrong')).status,403);
    assert(events.some(e=>e.reason==='login-origin'&&e.status===403));
    assert(events.some(e=>e.reason==='credential-mismatch'&&e.status===403));
    const login=await http('/__mp010_login',formHeaders,'password='+password);assert.equal(login.status,303);
    const setCookie=login.headers['set-cookie'][0];assert.match(setCookie,/Secure; HttpOnly; SameSite=Strict/);const cookie=setCookie.split(';')[0];
    assert.equal((await http('/',{cookie,authorization:'must-not-reach-game'})).text,'fixed test build');
    assert.equal(received[0].cookie,undefined);assert.equal(received[0].authorization,undefined);
    await new Promise((resolve,reject)=>{const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`,{headers:{host:'owner-preview.test',origin,cookie}});ws.on('open',()=>ws.send('test-metadata'));ws.on('message',data=>{assert.equal(data.toString(),'test-metadata');ws.close();});ws.on('close',resolve);ws.on('error',reject);});
    assert.equal(received[1].cookie,undefined);assert.equal(received[1].authorization,undefined);
    await http('/?token=must-not-log',{cookie,authorization:'must-not-log','cf-ray':'must-not-log','x-mp011-request-id':'must-not-log'});
    const serialized=JSON.stringify(events);
    for(const secret of [password,cookie,setCookie,'must-not-log','must-not-reach-game','test-metadata'])assert(!serialized.includes(secret));
    assert(events.some(e=>e.path==='<other>'));
    now+=8*3600000;assert.equal((await http('/',{cookie})).status,303);
  }finally{gate.closeAllConnections();await new Promise(r=>gate.close(r));for(const ws of wss.clients)ws.terminate();await new Promise(r=>wss.close(r));upstream.closeAllConnections();await new Promise(r=>upstream.close(r));}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer as httpServer,request as httpRequest} from 'node:http';
import {createServer as httpsServer,request as httpsRequest} from 'node:https';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {WebSocket} from 'ws';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {startStack} from '../scripts/mp017/stack.mjs';

const hash=b=>createHash('sha256').update(b).digest('hex');
async function freePort(){const s=httpServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
test('MP017 full local HTTPS path: unchanged auth -> diagnostics -> fixed game; anonymous denial, login, resources, authorized WS and synthetic resource failure', {timeout:60000},async()=>{
  mkdirSync('.mp010-build/mp017-test',{recursive:true});mkdirSync('evidence/mp-017',{recursive:true});
  const keyPath='.mp010-build/mp017-test/key.pem',certPath='.mp010-build/mp017-test/cert.pem';
  execFileSync('C:/Program Files/Git/usr/bin/openssl.exe',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',keyPath,'-out',certPath,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'],{stdio:'ignore'});
  const cert=readFileSync(certPath),sockets=new Set();let target=0;
  const front=httpsServer({key:readFileSync(keyPath),cert},(req,res)=>{
    if(!target){res.writeHead(503);res.end();return;}
    const p=httpRequest({host:'127.0.0.1',port:target,path:req.url,method:req.method,headers:req.headers},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});p.on('error',()=>{res.writeHead(502);res.end();});req.pipe(p);
  });
  front.on('connection',s=>{sockets.add(s);s.once('close',()=>sockets.delete(s));});
  front.on('upgrade',(req,socket,head)=>{
    const p=httpRequest({host:'127.0.0.1',port:target,path:req.url,headers:req.headers});
    p.on('response',r=>{socket.write(`HTTP/1.1 ${r.statusCode} ${r.statusMessage}\r\n`+r.rawHeaders.reduce((s,v,i,a)=>i%2?s:s+v+': '+a[i+1]+'\r\n','')+'\r\n');r.pipe(socket);});
    p.on('upgrade',(r,up,upHead)=>{socket.write(`HTTP/1.1 ${r.statusCode} ${r.statusMessage}\r\n`+r.rawHeaders.reduce((s,v,i,a)=>i%2?s:s+v+': '+a[i+1]+'\r\n','')+'\r\n');if(upHead.length)socket.write(upHead);if(head.length)up.write(head);up.pipe(socket);socket.pipe(up);socket.on('close',()=>up.destroy());socket.on('error',()=>up.destroy());up.on('error',()=>socket.destroy());});p.on('error',()=>socket.destroy());p.end();
  });
  await new Promise(r=>front.listen(0,'127.0.0.1',r));
  const origin=`https://127.0.0.1:${front.address().port}`,password=randomBytes(32).toString('hex'),events=[],credentialLeaks=[];
  let stack;
  const request=(path,headers={},body)=>new Promise((ok,fail)=>{const req=httpsRequest(origin+path,{ca:cert,method:body===undefined?'GET':'POST',headers},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>ok({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));});req.on('error',fail);req.end(body);});
  const deniedWS=(path,headers={})=>new Promise((ok,fail)=>{
    const req=httpsRequest(origin+path,{ca:cert,servername:'localhost',headers:{origin,connection:'Upgrade',upgrade:'websocket','sec-websocket-version':'13','sec-websocket-key':randomBytes(16).toString('base64'),...headers}},res=>{let bytes=0;res.on('data',c=>bytes+=c.length);res.on('end',()=>ok({status:res.statusCode,length:res.headers['content-length'],connection:res.headers.connection,bytes}));});req.on('upgrade',(_r,s)=>{s.destroy();fail(Error('Unexpected upgrade'));});req.on('error',fail);req.end();
  });
  try{
    stack=await startStack({origin,passwordSha256:hash(password),ports:{boundary:0,fixture:await freePort()},diagnostic:e=>events.push(e)});target=stack.ports.boundary;
    const anonymousHTTP=[];
    for(const path of ['/','/mp017/config.json','/controller.mjs','/export.mjs','/mp017/config/control','/v/control/move/real/mp017/entry.mjs','/v/control/move/real/app/main.js','/v/candidate/deployment/real/mp010-build.json']){const r=await request(path);assert.equal(r.status,303);assert.equal(r.headers.location,'/__mp010_login');anonymousHTTP.push({path,status:r.status});}
    const anonymousWS=[];for(let i=0;i<3;i++)for(const s of ['deployment','move'])for(const m of ['real','delay','timeout']){const path=`/ws/${s}/${m}`,r=await deniedWS(path);assert.deepEqual(r,{status:403,length:'0',connection:'close',bytes:0});anonymousWS.push({path,...r});}
    const loginPage=await request('/__mp010_login');assert.equal(loginPage.status,200);assert.equal(loginPage.headers['referrer-policy'],'same-origin');
    const form={origin,'content-type':'application/x-www-form-urlencoded'};
    assert.equal((await request('/__mp010_login',{...form,origin:'https://foreign.invalid'},'password='+password)).status,403);
    assert.equal((await request('/__mp010_login',form,'password=wrong')).status,403);
    const login=await request('/__mp010_login',form,'password='+password);assert.equal(login.status,303);
    assert.match(login.headers['set-cookie'][0],/Secure; HttpOnly; SameSite=Strict/);const cookie=login.headers['set-cookie'][0].split(';')[0];
    for(const headers of [{cookie,origin:'null'},{cookie,origin:'https://foreign.invalid'},{cookie,host:'foreign.invalid'}])assert.equal((await deniedWS('/ws/move/real',headers)).status,403);
    const headers={cookie,authorization:'fixture-must-not-forward','proxy-authorization':'fixture-must-not-forward'};
    const page=await request('/',headers);assert.equal(page.status,200);assert.match(page.body.toString(),/开始本版本/);
    const config=JSON.parse((await request('/mp017/config.json',headers)).body);assert.equal(config.origin,origin);assert.equal(config.versions.control,'6ea4983047757a4a32a707a23d61f4962bca36d3');
    const assets=[];
    for(const label of ['candidate','control'])for(const file of ['index.html','app/main.js','app/multiplayer/networkSession.js','app/web/startupDiagnostics.js','vendor/eastfront-digital-core/reference/strategic-reset-f-map.json','assets/terrain/vs2-002/assets/ground/grass.webp','multiplayer-config.json','mp010-build.json','mp017/entry.mjs','mp017/observer.mjs','mp017/timeline.mjs','mp017/bootstrap.mjs']){
      const r=await request(`/v/${label}/move/real/${file}`,headers);assert.equal(r.status,200);assert.equal(r.headers['cache-control'],'no-store');
      if(file==='index.html')assert.match(r.body.toString(),/src=".\/mp017\/entry.mjs"/);
      else if(file==='multiplayer-config.json')assert.equal(JSON.parse(r.body).serverUrl,origin.replace('https:','wss:')+'/ws/move/real');
      else assert.equal(hash(r.body),stack.manifest.builds[label].hashes[file]);
      assets.push({label,file,status:r.status,sha256:hash(r.body)});
    }
    for(const path of ['/v/control/move/real/mp017/entry.mjs','/v/control/move/real/mp017/trace-base.mjs','/controller.mjs','/export.mjs'])assert.equal((await request(path,headers)).status,200);
    const {clientMessage}=await import(pathToFileURL(resolve('.mp010-build/mp017/artifacts/control/app/multiplayer/protocol.js')));
    const {decodeSnapshot}=await import(pathToFileURL(resolve('.mp010-build/mp017/artifacts/control/app/multiplayer/snapshotCodec.js')));
    const flows=[];
    for(const version of ['control','candidate'])for(const scenario of ['deployment','move']){
      const ws=new WebSocket(origin.replace('https:','wss:')+`/ws/${scenario}/real`,{ca:cert,servername:'localhost',headers:{origin,...headers}}),messages=[],listeners=new Set();
      ws.on('message',b=>{const m=JSON.parse(b);messages.push(m);for(const f of listeners)f(m);});
      await new Promise((ok,fail)=>{ws.once('open',ok);ws.once('error',fail);});
      const wait=predicate=>{const found=messages.findLast(predicate);if(found)return Promise.resolve(found);return new Promise((ok,fail)=>{const timeout=setTimeout(()=>{listeners.delete(f);fail(Error('Authorized fixture message timeout'));},10000),f=m=>{if(predicate(m)){clearTimeout(timeout);listeners.delete(f);ok(m);}};listeners.add(f);});};
      const send=(type,payload={})=>{const id=randomUUID(),reply=wait(m=>m.requestId===id);ws.send(JSON.stringify(clientMessage(type,payload,id)));return reply;};
      try{
        await send('HELLO',{displayName:'MP013 local fixture'});await send('SET_SNAPSHOT_FORMAT',{format:config.snapshotFormat});await send('CREATE_ROOM');await send('SELECT_SEAT',{seat:scenario==='move'?'GERMANY':'SOVIET'});await send('SET_READY',{ready:true});
        const initial=decodeSnapshot((await wait(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT')).payload,true,true);
        const [q,r]=initial.model.deployment?.zoneKeys[0]?.split(',').map(Number)??[0,0];
        const action=scenario==='move'?{type:'MOVE',unitId:'G-I-01',path:[{q:1,r:1}]}:{type:'DEPLOY_INITIAL_UNIT',deploymentUnitId:initial.model.deployment.roster[0].id,hex:{q,r}};
        const ack=await send('SUBMIT_ACTION',{matchId:initial.matchId,expectedRevision:0,action});assert.equal(ack.messageType,'ACTION_ACCEPTED');
        const snapshot=decodeSnapshot((await wait(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT'&&m.payload.matchRevision===1)).payload,true,true);assert.equal(snapshot.matchRevision,ack.payload.acceptedRevision);
        flows.push({version,scenario,authorizedWS:true,acceptedRevision:ack.payload.acceptedRevision,appliedRevision:snapshot.matchRevision});
      }finally{ws.terminate();}
    }
    await stack.close();stack=await startStack({origin,passwordSha256:hash(password),ports:{boundary:0,fixture:await freePort()},fault:'map404'});target=stack.ports.boundary;
    const faultLogin=await request('/__mp010_login',form,'password='+password),faultHeaders={cookie:faultLogin.headers['set-cookie'][0].split(';')[0]};
    for(const version of ['control','candidate'])assert.equal((await request(`/v/${version}/move/real/vendor/eastfront-digital-core/reference/strategic-reset-f-map.json`,faultHeaders)).status,404);
const safe=JSON.stringify(events);for(const secret of [password,cookie,'fixture-must-not-forward'])assert.ok(!safe.includes(secret));
    writeFileSync('evidence/mp-017/local-https-'+Date.now()+'.json',JSON.stringify({kind:'Local TLS integration, not public or real-device acceptance',tls:{validation:'Explicit ephemeral test CA; certificate verification enabled; no system trust change',certificateSha256:hash(cert)},originKind:'ephemeral loopback HTTPS',anonymousHTTP,anonymousWS,foreignWSRejected:3,loginPassed:true,assets,flows,syntheticResource404BothVersions:true,upstreamCredentialForwarding:"Original boundary regression covers stripping; new stack does not instrument headers",originalBoundaryUnchanged:true,browserCookieJarTested:false,publicOpened:false},null,2)+'\n');
  }finally{if(stack)await stack.close();for(const s of sockets)s.destroy();await new Promise(r=>front.close(r));}
});

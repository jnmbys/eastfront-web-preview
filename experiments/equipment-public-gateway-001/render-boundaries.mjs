import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
import {start} from './server.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'render-boundaries-')),legacyDir=path.join(root,'old'),mpDir=path.join(root,'rooms');fs.mkdirSync(legacyDir);fs.mkdirSync(mpDir);
const cfg={port:0,host:'127.0.0.1',origin:'https://gateway.example',legacyDir,mpDir,trustProxyIPs:[],autoTick:false,verifyBuild:false,ingressMode:'render'};
const env={RENDER:'true',RENDER_SERVICE_TYPE:'web',RENDER_SERVICE_ID:'srv-synthetic',RENDER_EXTERNAL_HOSTNAME:'gateway.example',RENDER_EXTERNAL_URL:cfg.origin,PORT:'0'};Object.assign(process.env,env);const results=[];
for(const key of Object.keys(env)){const value=process.env[key];delete process.env[key];await assert.rejects(()=>start(cfg),/RENDER_PLATFORM_CONFIG_REQUIRED/);process.env[key]=value;}
await assert.rejects(()=>start({...cfg,ingressMode:'typo'}),/INGRESS_MODE_INVALID/);
await assert.rejects(()=>start({...cfg,tls:{}}),/RENDER_INGRESS_CONFLICT/);
await assert.rejects(()=>start({...cfg,trustProxyIPs:['127.0.0.1']}),/RENDER_INGRESS_CONFLICT/);
await assert.rejects(()=>start({...cfg,origin:'http://gateway.example'}),/EXACT_HTTPS_ORIGIN_REQUIRED/);
await assert.rejects(()=>start({...cfg,origin:'https://wrong.example'}),/RENDER_PLATFORM_CONFIG_REQUIRED/);
await assert.rejects(()=>start({...cfg,localPreview:true}),/LOCAL_PREVIEW_LOOPBACK_ONLY/);
results.push('all six platform configuration fields required; conflicting TLS/IP/preview modes, unknown mode and wrong origin rejected');
let s;
const request=(url,headers={},method='GET')=>new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port:s.server.address().port,path:url,method,headers},r=>{let body='';r.on('data',b=>body+=b);r.on('end',()=>resolve({status:r.statusCode,headers:r.headers,body}));});req.on('error',reject);req.end();});
try{
 s=await start(cfg);
 const probe=await request('/readyz',{Host:'internal-service:10000'});assert.equal(probe.status,200);assert.deepEqual(JSON.parse(probe.body),{ok:true});assert.equal(probe.headers['set-cookie'],undefined);
 assert.equal((await request('/readyz',{},'HEAD')).status,200);
 for(const [url,method]of [['/readyz','POST'],['/readyz?campaign=legacy','GET'],['/room/list','GET'],['/healthz','GET']])assert.equal((await request(url,{Host:'internal-service:10000'},method)).status,403);
 const good={Host:'gateway.example',Origin:cfg.origin,'X-Forwarded-Proto':'https'};
 assert.equal((await request('/healthz',good)).status,200);
 for(const headers of [{...good,Host:'wrong.example'},{...good,Origin:'https://wrong.example'},{...good,'X-Forwarded-Host':'evil.example'},{...good,'X-Forwarded-Proto':'https,http'},{Host:'gateway.example','X-Forwarded-For':'127.0.0.1'}])assert.equal((await request('/room/list',headers)).status,403);
 assert.equal((await request('/room/create',{Host:'gateway.example','X-Forwarded-Proto':'https'},'POST')).status,403);
 // A private caller can forge proxy metadata. It still cannot read rooms without signed identity.
 let forwarded;const observe=req=>{forwarded=Object.keys(req.headers).filter(k=>k==='forwarded'||k.startsWith('x-forwarded-'));};s.mp.server.prependListener('request',observe);
 assert.equal((await request('/room/list',{...good,'X-Forwarded-For':'127.0.0.1',Forwarded:'for=127.0.0.1;host=evil.example;proto=https'})).status,401);assert.deepEqual(forwarded,[]);s.mp.server.removeListener('request',observe);
 results.push('exact GET/HEAD readiness only; no cookies/metadata; business Host/Origin and scheme consistency retained; forged private headers get no identity and are stripped');
 await s.close();
 // Render flags alone do not enable platform mode. Strict remains the default.
 delete process.env.INGRESS_MODE;
 await assert.rejects(()=>start({...cfg,ingressMode:undefined}),/EXPLICIT_TRUST_PROXY_IPS_REQUIRED/);
 s=await start({...cfg,ingressMode:'strict',trustProxyIPs:['192.0.2.1']});assert.equal((await request('/healthz',good)).status,403);assert.equal((await request('/readyz',{})).status,403);await s.close();
 s=await start({...cfg,ingressMode:'strict',trustProxyIPs:['127.0.0.1']});assert.equal((await request('/healthz',good)).status,200);assert.equal((await request('/healthz',{Host:'gateway.example'})).status,403);await s.close();
 results.push('default strict despite Render environment; exact-IP allow/deny unchanged; no health bypass in strict mode');
}finally{await s?.close();}
const output=process.argv[2]??'evidence/equipment-public-gateway-001/render-proxy/boundaries.json';fs.mkdirSync(path.dirname(output),{recursive:true});const report={passed:true,source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),results,scope:'Windows synthetic platform environment; direct HTTP negative tests; not real Render'};fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));

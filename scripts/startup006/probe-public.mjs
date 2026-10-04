import https from 'node:https';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const state=JSON.parse(readFileSync('.startup006/run/state.json')),origin=state.origin;
assert(/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin));assert.equal(state.ports.boundary,4301);
const paths=['/','/r1/index.html','/r1/app/main.js','/r1/app/render/terrainSurface.js','/r1/assets/terrain/vs2-002/assets/ground/grass.webp','/s006/config.json','/s006/records','/__mp010_login'];
const results=[];
for(const path of paths){
 const start=performance.now();const row=await new Promise(resolve=>{
  const r=https.get(origin+path,{timeout:15000,headers:{'User-Agent':'STARTUP006-anonymous-check'}},res=>{let bytes=0;const tlsAuthorized=res.socket.authorized===true;res.on('data',b=>bytes+=b.length);res.on('end',()=>resolve({path,status:res.statusCode,location:res.headers.location??null,bodyBytes:bytes,tlsAuthorized,setCookie:!!res.headers['set-cookie'],elapsedMs:performance.now()-start}));});
  r.on('timeout',()=>r.destroy(new Error('timeout')));r.on('error',()=>resolve({path,status:null,error:'transport-or-TLS-unverified',elapsedMs:performance.now()-start}));
 });results.push(row);
}
const pass=results.every(r=>r.tlsAuthorized===true&&!r.setCookie&&(r.path==='/__mp010_login'?r.status===200:r.status===303&&r.location==='/__mp010_login'&&r.bodyBytes===0));
writeFileSync('evidence/startup-006/public-anonymous.json',JSON.stringify({origin,kind:'Actual anonymous HTTPS, no cookies; no game service',pass,results},null,2)+'\n',{flag:'wx'});
assert(pass,'Anonymous/TLS check failed: do not provide device entry');console.log(JSON.stringify({origin,pass}));

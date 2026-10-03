// One authorized temporary origin, anonymous metadata only; fail closed on any mismatch.
import {request} from 'node:https';
import {randomBytes,randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {verify} from '../mp014/verify.mjs';
verify();
const dir=resolve(process.argv[2]??''),root=resolve('.mp010-build/mp014')+sep;
if(!dir.startsWith(root))throw Error('Explicit MP014 run directory required');
const state=JSON.parse(readFileSync(resolve(dir,'processes.json'),'utf8').replace(/^\uFEFF/,''));
const origin=state.origin;
if(!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin)||state.target!=='http://127.0.0.1:4181')throw Error('Unexpected origin/target');
if(!readFileSync(resolve(dir,'stack.json')))throw Error('Local stack not ready');
const out='evidence/mp-014-public';mkdirSync(out,{recursive:true});
const results=[];
const probe=(path,ws=false)=>new Promise(ok=>{
  const start=performance.now(),row={at:new Date().toISOString(),path,kind:ws?'ws':'http',requestId:'mp011-'+randomUUID(),status:null,errorCode:null,tlsAuthorized:false};let done=false;
  const finish=()=>{if(done)return;done=true;row.elapsedMs=performance.now()-start;results.push(row);ok(row);};
  const headers={'x-mp011-request-id':row.requestId};
  if(ws)Object.assign(headers,{origin,connection:'Upgrade',upgrade:'websocket','sec-websocket-version':'13','sec-websocket-key':randomBytes(16).toString('base64')});
  const req=request(origin+path,{headers,agent:false},res=>{
    row.status=res.statusCode;row.cfRay=res.headers['cf-ray']??null;row.contentLength=res.headers['content-length']??null;row.location=res.headers.location??null;let body='';
    res.on('data',b=>{if(body.length<10000)body+=b;});res.on('end',()=>{row.bodyBytes=Buffer.byteLength(body);if(path==='/__mp010_login')row.loginForm=body.includes('form action="/__mp010_login" method="post"')&&body.includes('type="password"');finish();});
    res.on('error',e=>{row.errorCode=e.code??'RESPONSE_ERROR';finish();});
  });
  req.on('socket',socket=>socket.once('secureConnect',()=>{row.tlsAuthorized=socket.authorized===true;const c=socket.getPeerCertificate();row.certificate={subject:c.subject?.CN??null,issuer:c.issuer?.CN??null,validTo:c.valid_to??null,fingerprint256:c.fingerprint256??null};}));
  req.on('upgrade',(_res,socket)=>{row.status=101;socket.destroy();finish();});
  req.setTimeout(15000,()=>{const e=new Error('timeout');e.code='TIMEOUT';req.destroy(e);});
  req.on('error',e=>{row.errorCode=/^[A-Z0-9_]+$/.test(e.code??'')?e.code:'TRANSPORT_ERROR';finish();});req.end();
});
let pass=true,failedPath=null;
for(const [path,ws,expected] of [
  ['/__mp010_login',false,200],['/',false,303],['/mp013/config.json',false,303],['/mp012/entry.mjs',false,303],['/v/control/move/real/app/main.js',false,303],
  ...['deployment','move'].flatMap(s=>['real','delay','timeout'].map(m=>[`/ws/${s}/${m}`,true,403]))
]){
  const row=await probe(path,ws);
  if(row.status!==expected||row.errorCode||!row.tlsAuthorized||(expected===303&&row.location!=='/__mp010_login')||(expected===200&&!row.loginForm)){
    pass=false;failedPath=path;break;
  }
}
writeFileSync(out+'/anonymous-probes.json',JSON.stringify({kind:'Actual public HTTPS anonymous probes; no cookies or credentials',origin,target:state.target,pass,failedPath,results},null,2)+'\n');
if(!pass){
  const stop=spawnSync('pwsh',['-NoProfile','-File','scripts/mp014/stop.ps1','-RunDir',dir,'-FailedValidation'],{encoding:'utf8',windowsHide:true});
  writeFileSync(out+'/failure-stop.txt',stop.stdout??'');
  try{writeFileSync(out+'/closure.json',readFileSync(resolve(dir,'closure-mp014.json')));}catch{}
  console.log(JSON.stringify({pass:false,failedPath,closureExitCode:stop.status}));process.exitCode=1;
}else console.log(JSON.stringify({pass:true,checks:results.length,origin}));

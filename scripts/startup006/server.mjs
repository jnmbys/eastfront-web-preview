import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync,appendFileSync} from 'node:fs';
import {resolve,join,sep,extname} from 'node:path';
import {randomBytes} from 'node:crypto';
import {ownerPreview} from '../mp011-r1/owner-preview.mjs';
import {verify,candidate,manifest,SOURCE,sha256} from './integrity.mjs';
const integrity=verify(),dir=resolve(process.argv[2]??'.startup006/run');mkdirSync(dir,{recursive:true});
const records=resolve('evidence/startup-006/records');mkdirSync(records,{recursive:true});
const ports={fixture:4300,boundary:4301,control:4302},local=`http://127.0.0.1:${ports.control}`;
const cloudflared=resolve('../mp-007/.mp010-build/tools/cloudflared.exe');
if(sha256(readFileSync(cloudflared))!=='f096265ec2fcbe9bb6e2d64268db167ced3fcbb83d894bdb9e2fcdb26f2ea7e2')throw Error('Pinned tunnel executable mismatch');
const allowedFiles=new Set(manifest.files.map(f=>f.path)),types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
let boundary,tunnel,origin=null,closing=false,localPassed=false,publicAuthorized=false;
const sockets=new Set(),state={integrity,ports,pid:process.pid,startedAt:new Date().toISOString(),tunnelPid:null,origin:null,deviceClaim:null};
const stateFile=join(dir,'state.json');const saveState=()=>writeFileSync(stateFile,JSON.stringify(state,null,2)+'\n');saveState();
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
async function body(req,limit=2*1024*1024){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>limit)throw Error('Body too large');chunks.push(chunk);}return Buffer.concat(chunks);}
const track=s=>{s.on('connection',socket=>{sockets.add(socket);socket.once('close',()=>sockets.delete(socket));});return s;};
function validate(record){
 if(record.schema!=='STARTUP006-device-v1'||record.sourceCommit!==SOURCE||record.mode!=='default'||!Array.isArray(record.events)||!Array.isArray(record.resources)||!record.diagnostics||record.diagnostics.build!==SOURCE)throw Error('Invalid diagnostic record');
 if(record.events.length>4000||record.resources.length>3000||JSON.stringify(record).length>1500000)throw Error('Record exceeds limits');
 for(const key of ['device','network','cacheCondition'])if(typeof record[key]!=='string'||record[key].length>200)throw Error('Missing actual conditions');
 if(!Array.isArray(record.samples)||record.samples.length>40)throw Error('Invalid bounded samples');
 if(record.diagnostics.imageJobs.active<0)throw Error('Invalid counters');
}
const fixture=track(createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1');if(url.searchParams.has('terrainLoad'))return json(res,403,{error:'Only default mode is authorized'});res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-src 'self'; frame-ancestors 'self'; object-src 'none'");
 if(req.method==='POST'&&url.pathname==='/s006/claim'){
  if(![origin,`http://127.0.0.1:${ports.fixture}`].includes(req.headers.origin))return json(res,403,{error:'origin'});
  const kind=req.headers.origin===origin?'device':'desktop';
  if(kind==='device'&&state.deviceClaim)return json(res,409,{error:'This device run was already started; do not refresh or retry'});
  const conditions=JSON.parse(await body(req,4096));for(const key of ['device','network','cacheCondition'])if(typeof conditions[key]!=='string'||!conditions[key].trim()||conditions[key].length>200)throw Error('conditions');
  if(kind==='device'&&state.deviceClaim)return json(res,409,{error:'A concurrent start already claimed this run'});
  const claim={id:randomBytes(8).toString('hex'),kind,startedAt:new Date().toISOString(),budgetMs:300000};
  if(kind==='device'){state.deviceClaim=claim;saveState();writeFileSync(join(records,'device-claim.json'),JSON.stringify({...claim,conditions},null,2)+'\n',{flag:'wx'});setTimeout(()=>void stop('five-minute-budget-final-save-grace-ended'),315000).unref();}
  return json(res,201,claim);
 }
 if(req.method==='POST'&&url.pathname==='/s006/records'){
  if(![origin,`http://127.0.0.1:${ports.fixture}`].includes(req.headers.origin))return json(res,403,{error:'origin'});
  const bytes=await body(req),record=JSON.parse(bytes);validate(record);
  const kind=req.headers.origin===origin?'device':'desktop';
  if(kind==='device'&&record.claimId!==state.deviceClaim?.id)throw Error('Unclaimed device record');
  const id=`${kind}-${record.mode}-${Date.now()}-${randomBytes(4).toString('hex')}`;
  writeFileSync(join(records,id+'.json'),bytes,{flag:'wx'});
  const receipt={id,bytes:bytes.length,sha256:sha256(bytes),sourceCommit:SOURCE,kind,mode:record.mode,receivedAt:new Date().toISOString(),outcome:record.outcome};
  writeFileSync(join(records,id+'.receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
  state.lastReceipt=receipt;saveState();json(res,201,receipt);if(kind==='device'&&record.final)setTimeout(()=>void stop('device-final-record-saved:'+record.outcome),2500);return;
 }
 if(req.method==='POST'&&url.pathname==='/s006/screenshot'){
  if(![origin,`http://127.0.0.1:${ports.fixture}`].includes(req.headers.origin))return json(res,403,{error:'origin'});
  const bytes=await body(req,12*1024*1024);if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Expected PNG');
  const id=`${req.headers.origin===origin?'device':'desktop'}-terrain-${Date.now()}-${randomBytes(4).toString('hex')}.png`;
  writeFileSync(join(records,id),bytes,{flag:'wx'});return json(res,201,{id,bytes:bytes.length,sha256:sha256(bytes)});
 }
 if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'method'});
 if(url.pathname==='/s006/config.json')return json(res,200,{...integrity,budgetMs:300000,sampleIntervalMs:15000,mode:'default',scope:'STARTUP006 only; no multiplayer service',cachePolicy:'HTML/JS no-store; terrain images private,max-age=3600; device cache not assumed cold'});
 let file;
 if(url.pathname.startsWith('/r1/')){const path=decodeURIComponent(url.pathname.slice(4))||'index.html';if(!allowedFiles.has(path))return json(res,404,{error:'file'});file=resolve(candidate,path);if(!file.startsWith(candidate+sep))throw Error('path');if(/\.(png|webp)$/.test(path))res.setHeader('Cache-Control','private,max-age=3600');}
 else{const root=resolve('scripts/startup006/web'),path=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.replace(/^\/s006\//,''));file=resolve(root,path);if(!file.startsWith(root+sep))throw Error('path');}
 const bytes=readFileSync(file);res.setHeader('Content-Type',types[extname(file)]??'application/octet-stream');res.end(req.method==='HEAD'?undefined:bytes);
 }catch{if(!res.headersSent)json(res,400,{error:'request rejected'});else res.end();}}));
fixture.on('upgrade',(_req,socket)=>socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'));
await new Promise((ok,fail)=>{fixture.once('error',fail);fixture.listen(ports.fixture,'127.0.0.1',ok);});
const control=track(createServer(async(req,res)=>{try{
 if(req.headers.host!==`127.0.0.1:${ports.control}`)return json(res,403,{error:'host'});
 if(req.method==='GET'&&req.url==='/'){
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'"});
  res.end(`<!doctype html><meta charset="utf-8"><title>STARTUP-006 本地设置</title><h1>STARTUP-006 华为近景复验</h1><p>这是本机设置页，不是华为入口。仅本任务的固定005包；不使用其他实例。</p><p>在此输入您保留的本人临时口令（24–256 字符），不要发到聊天。仅复用认证方案，不读取另一实例的会话。</p><form><input type="password" name="password" autocomplete="off" minlength="24" maxlength="256" required><button>设置口令并启动本次临时 HTTPS</button></form><pre id="status"></pre><script>document.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=e.target,p=f.password.value;f.password.value='';document.querySelector('#status').textContent='正在设置…';const r=await fetch('/open',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:p})});document.querySelector('#status').textContent=JSON.stringify(await r.json(),null,2);};</script>`);return;
 }
 if(req.method==='GET'&&req.url==='/status')return json(res,200,{...state,localPassed,publicAuthorized,closing});
 if(req.method!=='POST'||req.headers.origin!==local)return json(res,403,{error:'local origin'});
 if(req.url==='/local-passed'){localPassed=true;return json(res,200,{localPassed});}
 if(req.url==='/authorize-public'){if(!localPassed)return json(res,409,{error:'preflight required'});publicAuthorized=true;state.publicAuthorizedAt=new Date().toISOString();saveState();return json(res,200,{publicAuthorized});}
 if(req.url==='/stop'){json(res,200,{closing:true});setTimeout(()=>void stop('operator-complete'),50);return;}
 if(req.url==='/open'){
  if(!localPassed||!publicAuthorized)return json(res,409,{error:'本地预检和用户明确开始确认均完成后，才能开放入口'});
  if(origin||tunnel)return json(res,409,{error:'本次入口已启动'});
  const input=JSON.parse(await body(req,4096)),password=input.password;delete input.password;
  if(typeof password!=='string'||password.length<24||password.length>256)return json(res,400,{error:'口令须为24–256字符'});
  const passwordSha256=sha256(Buffer.from(password));
  tunnel=spawn(cloudflared,['tunnel','--url',`http://127.0.0.1:${ports.boundary}`,'--no-autoupdate','--protocol','quic'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  state.tunnelPid=tunnel.pid;state.tunnelStartedAt=new Date().toISOString();saveState();
  const found=await new Promise((ok,fail)=>{let text='';const timer=setTimeout(()=>fail(Error('No temporary origin')),45000);const capture=b=>{appendFileSync(join(dir,'tunnel.log'),b);text=(text+b).slice(-10000);const match=text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);if(match){clearTimeout(timer);ok(match[0]);}};tunnel.stdout.on('data',capture);tunnel.stderr.on('data',capture);tunnel.once('error',fail);tunnel.once('exit',()=>{clearTimeout(timer);fail(Error('Tunnel exited'));});});
  origin=found;
  boundary=track(ownerPreview({origin,passwordSha256,upstreamPort:ports.fixture,diagnostic:e=>appendFileSync(join(dir,'boundary.jsonl'),JSON.stringify(e)+'\n')}));
  await new Promise((ok,fail)=>{boundary.once('error',fail);boundary.listen(ports.boundary,'127.0.0.1',ok);});
  state.origin=origin;state.publicOpenedAt=new Date().toISOString();saveState();
  json(res,200,{origin,message:'入口已受本人认证保护；待匿名检查通过后再在华为打开。'});return;
 }
 json(res,404,{error:'route'});
 }catch(error){json(res,500,{error:'启动未完成；请由本次任务检查。'});appendFileSync(join(dir,'errors.log'),String(error)+'\n');if(tunnel&&!origin)void stop('open-failed');}}));
await new Promise((ok,fail)=>{control.once('error',fail);control.listen(ports.control,'127.0.0.1',ok);});
async function stop(reason){if(closing)return;closing=true;state.closingReason=reason;state.closedAt=new Date().toISOString();saveState();if(tunnel&&tunnel.exitCode===null){tunnel.kill();await new Promise(r=>{tunnel.once('exit',r);setTimeout(r,3000);});}for(const socket of sockets)socket.destroy();await Promise.all([fixture,control,boundary].filter(Boolean).map(s=>new Promise(r=>s.close(r))));process.exit();}
process.on('SIGINT',()=>void stop('SIGINT'));process.on('SIGTERM',()=>void stop('SIGTERM'));
setTimeout(()=>void stop('90-minute-maximum-lifetime'),90*60*1000).unref();
console.log(JSON.stringify({ready:true,ports,pid:process.pid,sourceCommit:SOURCE}));

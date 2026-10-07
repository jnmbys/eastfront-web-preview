import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';import {Campaign} from './authority.mjs';import {Campaign as Legacy} from '../city-001/authority.mjs';import {rules as clockRules} from './rules.mjs';
const root=path.resolve(fileURLToPath(new URL('../../.ai003-preview',import.meta.url))),port=Number(process.argv[2]??4200);
fs.mkdirSync(new URL('../../evidence/grand-play-001/',import.meta.url),{recursive:true});
const sessions=new Map(),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{
 if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host)){res.writeHead(403);res.end('HOST_DENIED');return;}
 const url=new URL(req.url,`http://127.0.0.1:${port}`),reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 if(url.pathname.startsWith('/grand/')){
  try{
   if(req.method!=='POST')throw Error('POST_ONLY');if(req.headers.origin&&!new Set([`http://127.0.0.1:${port}`,`http://localhost:${port}`]).has(req.headers.origin))throw Error('ORIGIN_DENIED');
   let body='';for await(const chunk of req){body+=chunk;if(body.length>65536)throw Error('BODY_TOO_LARGE');}const q=JSON.parse(body||'{}');
   if(url.pathname==='/grand/create'){if(q.resume&&sessions.has(req.headers['x-grand-session'])){const c=sessions.get(req.headers['x-grand-session']);reply(200,{token:req.headers['x-grand-session'],...c.snapshot()});return;}if(sessions.size>=4)throw Error('LOCAL_SESSION_LIMIT');const token=crypto.randomUUID(),c=q.mode==='continuous'?new Campaign():new Legacy();c.viewer=c.continuous?'GERMAN':q.side==='SOVIET'?'SOVIET':'GERMAN';sessions.set(token,c);reply(200,{token,...c.snapshot()});return;}
   const c=sessions.get(req.headers['x-grand-session']);if(!c)throw Error('SESSION_NOT_FOUND');
   if(url.pathname==='/grand/save'){if(!c.continuous)throw Error('CONTINUOUS_ONLY');const save=c.save(),raw=JSON.stringify(save),envelope={checksum:crypto.createHash('sha256').update(raw).digest('hex'),payload:raw};const file=path.join(saveRoot,'campaign.json');fs.writeFileSync(file+'.tmp',JSON.stringify(envelope));fs.renameSync(file+'.tmp',file);reply(200,{saved:true,tick:c.clock.tick});}
   else if(url.pathname==='/grand/load'){if(!c.continuous)throw Error('CONTINUOUS_ONLY');const e=JSON.parse(fs.readFileSync(path.join(saveRoot,'campaign.json'),'utf8'));if(crypto.createHash('sha256').update(e.payload).digest('hex')!==e.checksum)throw Error('SAVE_CHECKSUM_FAILED');const revision=c.version,instance=c.id;c.restore(JSON.parse(e.payload));c.id=instance;c.match.id=instance;c.match.matchId=instance;c.version=Math.max(revision,c.version)+1;c.match.matchRevision=c.version;reply(200,c.snapshot());}
   else if(url.pathname==='/grand/state')reply(200,c.snapshot());
   else if(url.pathname==='/grand/receipt')reply(200,{instanceId:c.id,status:c.receipts.has(q.id)?'COMMITTED':c.httpOutcomes?.get(q.id)?.status??'UNKNOWN',receipt:c.receipts.get(q.id)?.result??null,error:c.httpOutcomes?.get(q.id)?.error??null});
   else if(url.pathname==='/grand/action'){const previousEpoch=c.econ.epoch,signature=JSON.stringify(q);c.httpOutcomes??=new Map();const existing=c.httpOutcomes.get(q.id);if(existing&&existing.signature!==signature)throw Error('ID_REUSE_CONFLICT');if(existing?.status==='REJECTED')throw Error(existing.error);
    c.httpOutcomes.set(q.id,{signature,status:'PROCESSING'});let receipt;try{receipt=c.transaction(q);c.httpOutcomes.set(q.id,{signature,status:'COMMITTED'});}catch(e){c.httpOutcomes.set(q.id,{signature,status:'REJECTED',error:e.message});throw e;}if(true){const out=new URL('../../evidence/grand-play-001/browser.jsonl',import.meta.url);fs.appendFileSync(out,JSON.stringify({instance:c.id,request:q,receipt,viewer:c.viewer,turn:c.state.turn,phase:c.state.phase,random:c.state.random,units:Object.values(c.state.units).filter(u=>u.side===c.viewer).map(u=>({id:u.id,hex:u.hex,step:u.step,alive:u.alive})),accounts:c.econ.accounts,ux:c.econ.ux,orders:c.econ.orders,shipments:c.econ.shipments,...(previousEpoch!==c.econ.epoch?{ledger:c.econ.ledger.at(-1)}:{}),memory:process.memoryUsage()})+'\n');}reply(200,{receipt,...c.snapshot()});}
   else if(url.pathname==='/grand/officer-config'){if(c.continuous)throw Error('USE_CORPS_ORDERS');c.delegation.config(q);reply(200,c.snapshot());}
   else if(url.pathname==='/grand/officer-tick'){if(c.continuous)throw Error('USE_SHARED_CLOCK');const officerResult=await c.delegation.tick(q);if(true)fs.appendFileSync(new URL('../../evidence/grand-play-001/browser.jsonl',import.meta.url),JSON.stringify({kind:'officer',request:q,result:officerResult,instance:c.id,viewer:c.viewer,version:c.version,turn:c.state.turn,phase:c.state.phase,pending:c.state.pendingDecision,random:c.state.random,reports:c.delegation.seat().reports,accounts:c.econ.accounts,uses:c.econ.uses})+'\n');reply(200,{officerResult,...c.snapshot()});}
   else if(url.pathname==='/grand/query'){
    if(q.version!==c.version)throw Error('STALE_VERSION');const p=c.projection(q.draft);reply(200,{messageType:'MATCH_QUERY',requestId:q.id,payload:{matchId:c.id,matchRevision:c.version,serverSequence:++c.seq,...p}});
   }else if(url.pathname==='/grand/takeover'){if(c.continuous)throw Error('ENEMY_AI_SEAT_PRIVATE');c.delegation.pauseSide(c.viewer);c.viewer=c.owner();c.delegation.pauseSide(c.viewer);reply(200,c.snapshot());}
   else if(url.pathname==='/grand/close'){sessions.delete(req.headers['x-grand-session']);reply(200,{closed:true});}
   else reply(404,{error:'NOT_FOUND'});
  }catch(e){reply(409,{error:e.message});}return;
 }
 // Existing PLAYABLE-004 API remains optional, on its unchanged local port.
 if(url.pathname.startsWith('/play/')||url.pathname.startsWith('/api/')){
  try{let body='';for await(const c of req)body+=c;const r=await fetch(`http://127.0.0.1:4186${url.pathname}`,{method:req.method,headers:{'Content-Type':'application/json','X-Local-Session':req.headers['x-local-session']??''},...(req.method==='POST'?{body}:{})});reply(r.status,await r.json());}catch{reply(503,{error:'旧工业模式请另启原PLAYABLE-004服务4186；原640格AI模式可直接运行。'});}return;
 }
 const target=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
 if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 try{const stat=fs.statSync(target);if(!stat.isFile())throw Error();res.writeHead(200,{'Content-Type':mime[path.extname(target)]??'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(target).pipe(res);}catch{res.writeHead(404);res.end('Not found');}
});
const saveRoot=path.join(process.env.LOCALAPPDATA??process.cwd(),'EastfrontSaves','grand-play-001');fs.mkdirSync(saveRoot,{recursive:true});
let lastTime=performance.now();const accumulated=new Map();setInterval(()=>{const now=performance.now(),elapsed=Math.min(1000,now-lastTime);lastTime=now;for(const [token,c]of sessions){if(!c.continuous)continue;if(c.clock.paused||c.clock.ended){accumulated.set(token,0);continue;}const n=(accumulated.get(token)??0)+elapsed*c.clock.speed;if(n>=clockRules.wallMs){accumulated.set(token,n-clockRules.wallMs);try{c.tick();}catch(e){console.error('SIMULATION_PAUSED',e.stack);}}else accumulated.set(token,n);}},100);
server.listen(port,'127.0.0.1',()=>console.log(`GRAND-PLAY-001 http://127.0.0.1:${port}/ · local only`));

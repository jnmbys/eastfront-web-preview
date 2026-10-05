import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';import {Campaign} from './authority.mjs';
const root=path.resolve(fileURLToPath(new URL('../../.ai003-preview',import.meta.url))),port=Number(process.argv[2]??4190);
const sessions=new Map(),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,`http://127.0.0.1:${port}`),reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 if(url.pathname.startsWith('/grand/')){
  try{
   if(req.method!=='POST')throw Error('POST_ONLY');if(req.headers.origin&&!new Set([`http://127.0.0.1:${port}`,`http://localhost:${port}`]).has(req.headers.origin))throw Error('ORIGIN_DENIED');
   let body='';for await(const chunk of req){body+=chunk;if(body.length>65536)throw Error('BODY_TOO_LARGE');}const q=JSON.parse(body||'{}');
   if(url.pathname==='/grand/create'){if(sessions.size>=4)throw Error('LOCAL_SESSION_LIMIT');const token=crypto.randomUUID(),c=new Campaign();c.viewer=q.side==='SOVIET'?'SOVIET':'GERMAN';sessions.set(token,c);reply(200,{token,...c.snapshot()});return;}
   const c=sessions.get(req.headers['x-grand-session']);if(!c)throw Error('SESSION_NOT_FOUND');
   if(url.pathname==='/grand/state')reply(200,c.snapshot());
   else if(url.pathname==='/grand/action'){const previousEpoch=c.econ.epoch,receipt=c.transaction(q);if(process.env.GRAND_EVIDENCE==='1'){const out=new URL('../../docs/grand-campaign-001/evidence/browser-authority.jsonl',import.meta.url);fs.appendFileSync(out,JSON.stringify({instance:c.id,request:q,receipt,viewer:c.viewer,turn:c.state.turn,phase:c.state.phase,random:c.state.random,units:Object.values(c.state.units).filter(u=>u.side===c.viewer).map(u=>({id:u.id,hex:u.hex,step:u.step,alive:u.alive})),accounts:c.econ.accounts,orders:c.econ.orders,shipments:c.econ.shipments,...(previousEpoch!==c.econ.epoch?{ledger:c.econ.ledger.at(-1)}:{}),memory:process.memoryUsage()})+'\n');}reply(200,{receipt,...c.snapshot()});}
   else if(url.pathname==='/grand/query'){
    if(q.version!==c.version)throw Error('STALE_VERSION');const p=c.projection(q.draft);reply(200,{messageType:'MATCH_QUERY',requestId:q.id,payload:{matchId:c.id,matchRevision:c.version,serverSequence:++c.seq,...p}});
   }else if(url.pathname==='/grand/takeover'){c.viewer=c.owner();reply(200,c.snapshot());}
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
server.listen(port,'127.0.0.1',()=>console.log(`GRAND-CAMPAIGN-001 http://127.0.0.1:${port}/ · local only`));

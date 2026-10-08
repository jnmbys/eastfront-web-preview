import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
export const passwordHash=(password,salt=randomBytes(16).toString('hex'))=>salt+':'+scryptSync(password,salt,32).toString('hex');
export function access({local=false,origin,passwordDigest}={}){
 if(!local&&!/^[a-f0-9]{32}:[a-f0-9]{64}$/.test(passwordDigest??''))throw Error('OWNER_PASSWORD_HASH required (scrypt salt:hash)');
 const sessions=new Map(),attempts=[];const secure=origin.startsWith('https:'),cookie='grand_release_owner';
 const authorized=req=>local||(()=>{const token=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookie+'='))?.slice(cookie.length+1),expires=sessions.get(token);return !!expires&&expires>Date.now();})();
 const page=`<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>EASTFRONT 私人试玩</title><style>body{background:#253339;color:#eee;font:18px system-ui;max-width:440px;margin:12vh auto;padding:24px}input,button{font:inherit;padding:12px;width:100%;box-sizing:border-box;margin:8px 0}</style><h1>EASTFRONT</h1><p>私人战役试玩 · 德军对苏军AI</p><form method="post" action="/login"><label>访问口令<input name="password" type="password" autocomplete="current-password" required maxlength="256"></label><button>进入试玩</button></form><p>仅限获准的本人访问。</p></html>`;
 async function gate(req,res){
  const pathname=new URL(req.url,origin).pathname;
  if(pathname==='/healthz'){res.writeHead(200,{'Content-Type':'application/json'});res.end('{"ok":true}');return true;}
  if(pathname==='/login'&&req.method==='POST'){
   if(req.headers.origin!==origin){res.writeHead(403);res.end();return true;}
   while(attempts.length&&attempts[0]<Date.now()-60000)attempts.shift();if(attempts.length>=5){res.writeHead(429,{'Retry-After':'60'});res.end('请稍后再试');return true;}attempts.push(Date.now());
   let body='',overflow=false;for await(const chunk of req){body+=chunk;if(body.length>2048){overflow=true;break;}}if(overflow){res.writeHead(413);res.end();return true;}
   const input=new URLSearchParams(body).get('password')??'',parts=(passwordDigest??'').split(':');
   if(!local&&(input.length>256||!timingSafeEqual(scryptSync(input,parts[0],32),Buffer.from(parts[1],'hex')))){res.writeHead(401,{'Content-Type':'text/html; charset=utf-8'});res.end(page+'<p>口令不正确</p>');return true;}
   for(const[t,e]of sessions)if(e<Date.now())sessions.delete(t);if(sessions.size>=16)sessions.delete(sessions.keys().next().value);
   const token=randomBytes(32).toString('hex');sessions.set(token,Date.now()+12*3600000);res.writeHead(303,{'Location':'/','Set-Cookie':`${cookie}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${secure?'; Secure':''}`});res.end();return true;
  }
  if(!authorized(req)){if(req.method!=='GET'){res.writeHead(401,{'Content-Type':'application/json'});res.end('{"error":"请重新登录"}');}else{res.writeHead(401,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(page);}return true;}
  if(pathname==='/logout'&&req.method==='POST'){if(req.headers.origin!==origin){res.writeHead(403);res.end();return true;}const t=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookie+'='))?.slice(cookie.length+1);sessions.delete(t);res.writeHead(303,{'Location':'/','Set-Cookie':`${cookie}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure?'; Secure':''}`});res.end();return true;}
  return false;
 }
 return {gate,authorized};
}

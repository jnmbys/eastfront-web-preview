// Local-only diagnostic overlay; pinned server and both client trees are read-only.
import {createServer,request} from 'node:http';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {verifyArtifacts} from '../mp010/integrity.mjs';
const manifest=verifyArtifacts(),origin='http://127.0.0.1:4190';
const faults=new Set(['none','map404']),fault=process.argv.find(x=>x.startsWith('--fault='))?.slice(8)??'none';
if(!faults.has(fault))throw Error('Unknown local fault');
const hash=x=>createHash('sha256').update(x).digest('hex');
const files=['trace.mjs','entry.mjs','panel.mjs'];
const hashes=Object.fromEntries(files.map(p=>[p,hash(readFileSync(new URL(p,import.meta.url)))]));
const diagnosticSha256=hash(JSON.stringify(hashes));
mkdirSync('.mp010-build/mp012',{recursive:true});
const child=spawn(process.execPath,['scripts/mp010/serve.mjs'],{env:{...process.env,MP010_HOST:'127.0.0.1',MP010_PORT:'4192',MP010_ORIGIN:origin,MP010_TLS_CERT:'',MP010_BEHIND_TLS:''},windowsHide:true,stdio:['ignore','pipe','pipe']});
child.stdout.on('data',d=>process.stdout.write(d));child.stderr.on('data',d=>process.stderr.write(d));
let closing=false;
const gateway=createServer((req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'){res.writeHead(405);res.end();return;}
  const path=new URL(req.url,origin).pathname;
  if(path.startsWith('/mp012/config/')){
    const label=path.slice('/mp012/config/'.length),b=manifest.builds[label];if(!b){res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({sourceSha:b.sourceSha,paths:[...Object.keys(b.hashes),'multiplayer-config.json'],diagnosticSha256,hashes,fault}));return;
  }
  if(files.some(p=>path==='/mp012/'+p)){res.setHeader('Content-Type','text/javascript');res.end(readFileSync(new URL(path.split('/').at(-1),import.meta.url)));return;}
  if(fault==='map404'&&path.endsWith('/strategic-reset-f-map.json')){res.writeHead(404,{'Content-Type':'text/plain'});res.end('MP012 synthetic resource failure');return;}
  const proxy=request({host:'127.0.0.1',port:4192,path:req.url,method:'GET',headers:req.headers},up=>{
    const chunks=[];up.on('data',d=>chunks.push(d));up.on('end',()=>{
      const body=Buffer.concat(chunks);let out=body;
      if(up.statusCode===200&&up.headers['content-type']?.startsWith('text/html')){
        let html=body.toString();
        if(path==='/'||path==='/index.html')html=html.replace('</body>','<script type="module" src="/mp012/panel.mjs"></script></body>');
        else if(/^\/v\/(candidate|control)\//.test(path))html=html.replace('src="./mp010/bootstrap.mjs"','src="/mp012/entry.mjs"');
        out=Buffer.from(html);
      }
      res.writeHead(up.statusCode??502,{'Content-Type':up.headers['content-type']??'application/octet-stream','Content-Length':out.length});res.end(out);
    });
  });proxy.on('error',()=>{res.writeHead(502);res.end('Local fixture unavailable');});proxy.end();
});
gateway.on('upgrade',(req,socket,head)=>{
  if(req.headers.origin!==origin||!/^\/ws\/(deployment|move)\/(real|delay|timeout)$/.test(req.url)){socket.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n');return;}
  const proxy=request({host:'127.0.0.1',port:4192,path:req.url,headers:req.headers});
  proxy.on('upgrade',(response,upstream,upHead)=>{socket.write(`HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n`+response.rawHeaders.reduce((s,v,i,a)=>i%2?s:s+v+': '+a[i+1]+'\r\n','')+'\r\n');if(head.length)upstream.write(head);if(upHead.length)socket.write(upHead);upstream.pipe(socket);socket.pipe(upstream);socket.on('error',()=>upstream.destroy());upstream.on('error',()=>socket.destroy());socket.on('close',()=>upstream.destroy());});
  proxy.on('error',()=>socket.destroy());proxy.on('response',()=>socket.destroy());proxy.end();
});
function stop(){if(closing)return;closing=true;child.kill();gateway.close();setTimeout(()=>process.exit(),100).unref();}
child.on('exit',()=>{if(!closing){gateway.close();process.exitCode=1;}});
process.on('SIGINT',stop);process.on('SIGTERM',stop);process.on('exit',()=>child.kill());
gateway.listen(4190,'127.0.0.1',()=>{
  writeFileSync('.mp010-build/mp012/processes.json',JSON.stringify({pid:process.pid,childPid:child.pid,origin,fault,diagnosticSha256},null,2));
  console.log(`MP012 loopback only: ${origin}; fault=${fault}; diagnostics=${diagnosticSha256}`);
});

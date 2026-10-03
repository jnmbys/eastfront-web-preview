import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
const pw=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE??'playwright');
const root=resolve('dist'),out=resolve(process.argv[2]??'evidence/startup-003-r1/decode-probe.json');
const requests=[];
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');if(url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Local decode probe</title>');return;}
 const path=resolve(root,'.'+url.pathname);if(!path.startsWith(root+sep))throw Error('path');const bytes=await readFile(path);
 requests.push({path:url.pathname,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
 res.writeHead(200,{'Content-Type':extname(path)==='.webp'?'image/webp':'image/png','Cache-Control':'no-store'});res.end(bytes);
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await pw.webkit.launch({headless:true});const rows=[];
try{
 for(const mode of ['async-decode-release','async-decode-retain','sync-decode-release','async-no-decode','async-decode-wait']){
  for(let repeat=0;repeat<3;repeat++){
   const context=await browser.newContext(),page=await context.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/`);
   const row=await page.evaluate(async({mode})=>{
    const events=[],samples=[];const stamp=(kind,details={})=>events.push({kind,at:performance.now(),...details});
    const img=new Image();img.decoding=mode.startsWith('sync-')?'sync':'async';
    const scratch=document.createElement('canvas');scratch.width=512;scratch.height=512;const ctx=scratch.getContext('2d');
    const captures=[];const capture=(kind,source)=>{ctx.clearRect(0,0,512,512);ctx.drawImage(source,0,0);const data=ctx.getImageData(0,0,512,512).data;
     let visible=0;for(let i=3;i<data.length;i+=4)visible+=data[i]>0;stamp(kind,{visible,complete:img.complete,width:img.naturalWidth});captures.push({kind,visible,data});};
    let loadDone;const loaded=new Promise(r=>loadDone=r);let decodeDone;const decoded=new Promise(r=>decodeDone=r);
    img.onload=()=>{
     stamp('load');if(mode!=='async-decode-wait')capture('onload-copy-before-release',img);
     if(mode.endsWith('-release')){img.src='';stamp('clear-src');const data=ctx.getImageData(0,0,512,512).data;captures.push({kind:'copy-after-release',data});}
     loadDone();
    };img.onerror=()=>{stamp('error');loadDone();};
    img.src='/assets/terrain/vs2-002/assets/ground/grass.webp';stamp('src');
    if(mode==='async-no-decode')decodeDone();else{stamp('decode-start');void img.decode().then(()=>{stamp('decode-resolve');if(!mode.endsWith('-release'))capture('after-decode-copy',img);decodeDone();},e=>{stamp('decode-reject',{error:e.name});decodeDone();});}
    await loaded;await Promise.race([decoded,new Promise(r=>setTimeout(r,1000))]);
    for(const c of captures){const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',c.data))).map(v=>v.toString(16).padStart(2,'0')).join('');samples.push({kind:c.kind,visible:c.visible??null,hash});}
    img.src='';scratch.width=0;scratch.height=0;return {mode,events,samples};
   },{mode});rows.push({repeat,...row});await context.close();console.log(JSON.stringify({mode,repeat,samples:row.samples}));
  }
 }
 await mkdir(resolve(out,'..'),{recursive:true});await writeFile(out,JSON.stringify({browserVersion:browser.version(),rows,requests},null,2)+'\n',{flag:'wx'});
}finally{await browser.close();await new Promise(r=>server.close(r));}

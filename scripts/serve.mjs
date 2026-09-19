import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const root=process.argv[2] ?? 'dist';
const port=Number(process.env.PORT ?? 4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
createServer(async(req,res)=>{
  try{
    const raw=(req.url??'/').split('?')[0] || '/';
    const safe=normalize(decodeURIComponent(raw)).replace(/^([.][.][/\\])+/, '');
    let path=join(root,safe==='/'?'index.html':safe);
    if((await stat(path)).isDirectory()) path=join(path,'index.html');
    const data=await readFile(path); res.writeHead(200,{'Content-Type':types[extname(path)]??'application/octet-stream'});res.end(data);
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Eastfront UI Prototype: http://127.0.0.1:${port}`));

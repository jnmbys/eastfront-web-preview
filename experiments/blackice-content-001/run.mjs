import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {fork} from 'node:child_process';
const out=path.resolve(process.argv[2]??('evidence/blackice-content-001/replay-'+Date.now()));
if(fs.existsSync(out))throw Error('OUTPUT_ALREADY_EXISTS: choose a fresh evidence directory');fs.mkdirSync(out,{recursive:true});
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'eastfront-content-001-'));
const free=await new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
fs.writeFileSync(path.join(out,'environment.json'),JSON.stringify({runtime:'c69b38b32bcae748dd631a4297fe16118b69fb5f',node:process.version,platform:process.platform,port:free,started:new Date().toISOString(),kind:'normal campaign automated authority; not browser'},null,2));
async function stage(n){await new Promise((resolve,reject)=>{const p=fork(new URL('./worker.mjs',import.meta.url),[temp,String(free),out,String(n)],{stdio:['ignore','inherit','inherit','ipc']});p.once('error',reject);p.once('exit',code=>code===0?resolve():reject(Error('worker exit '+code)));});}
try{await stage(1);if(fs.existsSync(path.join(temp,'restart.json')))await stage(2);}
finally{fs.writeFileSync(path.join(out,'resources.json'),JSON.stringify({childProcessesExited:true,privateEvidenceDirectory:temp,originalServicesUntouched:[4275,4277]},null,2));}

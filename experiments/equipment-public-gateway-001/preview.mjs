import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {start} from './server.mjs';
// Explicit local-only convenience entry. Production server rejects this mode.
const record=path.join(os.tmpdir(),'equipment-public-gateway-preview.json');
const prior=process.env.RESTORE==='1'?JSON.parse(fs.readFileSync(record)):null;
const dir=prior?.dir??fs.mkdtempSync(path.join(os.tmpdir(),'equipment-gateway-preview-'));
const port=Number(process.env.PREVIEW_PORT??prior?.port??4302);
for(const name of ['legacy','rooms'])fs.mkdirSync(path.join(dir,name),{recursive:true});
const svc=await start({port,host:'127.0.0.1',origin:`http://127.0.0.1:${port}`,legacyDir:path.join(dir,'legacy'),mpDir:path.join(dir,'rooms'),localPreview:true});
fs.writeFileSync(record,JSON.stringify({dir,port,pid:process.pid,source:svc.metadata.source}));
console.log(JSON.stringify({ready:true,url:`http://127.0.0.1:${port}/`,source:svc.metadata.source,record}));
let stopping=false;const stop=async()=>{if(stopping)return;stopping=true;clearInterval(timer);await svc.close();process.exit(0);};
const timer=setInterval(()=>{const f=path.join(dir,'stop');if(fs.existsSync(f)){fs.unlinkSync(f);void stop();}},500);
process.on('SIGTERM',stop);process.on('SIGINT',stop);process.on('message',m=>{if(m==='shutdown')void stop();});

import path from 'node:path';import os from 'node:os';import {fileURLToPath} from 'node:url';
const before=process.argv[2]==='before',port=before?4253:process.argv[2]==='comparison'?4254:4252;
const {releaseServer}=await import(before?'../../../grand-release-001-preview/experiments/grand-release-001/server.mjs':'../grand-release-001/server.mjs');
const service=await releaseServer({port,host:'127.0.0.1',origin:`http://127.0.0.1:${port}`,local:true,autoTick:!before,mid:true,midFile:fileURLToPath(new URL('../../evidence/grand-ui-003/natural-contact.json.gz',import.meta.url)),saveDir:path.join(os.homedir(),'.eastfront/grand-ui-003/evidence-'+port)});
console.log(`UI003 same-save ${before?'before':'candidate'} ${service.url} PID ${process.pid}`);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await service.close();process.exit(0);});

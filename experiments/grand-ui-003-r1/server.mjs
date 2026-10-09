import path from 'node:path';import os from 'node:os';import {fileURLToPath} from 'node:url';
const mode=process.argv[2]??'normal',port=mode==='before-capture'?4259:mode==='before'?4257:mode==='capture'?4258:mode==='evidence'?4256:4255;
const {releaseServer}=await import(mode.startsWith('before')?'../../../grand-ui-003-tablet-command/experiments/grand-release-001/server.mjs':'../grand-release-001/server.mjs');
const service=await releaseServer({port,host:'127.0.0.1',origin:`http://127.0.0.1:${port}`,local:true,autoTick:!mode.startsWith('before'),...(mode!=='normal'?{mid:true,midFile:fileURLToPath(new URL('../../evidence/grand-ui-003/natural-contact.json.gz',import.meta.url))}:{}),saveDir:path.join(os.homedir(),'.eastfront/grand-ui-003-r1',String(port))});
console.log(`UI003-R1 ${service.url} PID ${process.pid}`);for(const sig of ['SIGINT','SIGTERM'])process.on(sig,async()=>{await service.close();process.exit(0);});

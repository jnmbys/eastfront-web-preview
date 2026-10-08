import path from 'node:path';
import os from 'node:os';
import {releaseServer} from '../grand-release-001/server.mjs';
// Task-local, loopback-only preview. Older ports and save directories are never opened.
const service=await releaseServer({port:4249,host:'127.0.0.1',origin:'http://127.0.0.1:4249',local:true,saveDir:path.join(os.homedir(),'.eastfront/grand-ui-003/4249')});
console.log('GRAND-UI-003 http://127.0.0.1:4249/ PID '+process.pid);
let closing=false;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{if(closing)return;closing=true;await service.close();process.exit(0);});

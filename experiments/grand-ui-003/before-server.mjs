// Comparison only: the frozen preceding worktree is read, never rebuilt or written.
import path from 'node:path';import os from 'node:os';
import {releaseServer} from '../../../grand-release-001-preview/experiments/grand-release-001/server.mjs';
const s=await releaseServer({port:4250,host:'127.0.0.1',origin:'http://127.0.0.1:4250',local:true,autoTick:false,saveDir:path.join(os.homedir(),'.eastfront/grand-ui-003/before')});
console.log('UI003 frozen baseline comparison '+s.url);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await s.close();process.exit(0);});

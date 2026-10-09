import path from 'node:path';
const before=process.env.PERF_TAG==='before',port=before?4270:4271;
const {releaseServer}=await import(before?'../../../grand-officer-003-persistent-front/experiments/grand-release-001/server.mjs':'../grand-release-001/server.mjs');
const service=await releaseServer({port,local:true,saveDir:path.resolve('.perf005-'+(before?'before':'after')),midFile:path.resolve('evidence/grand-perf-005/combat-start.json.gz')});console.log(service.url);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await service.close();process.exit()});

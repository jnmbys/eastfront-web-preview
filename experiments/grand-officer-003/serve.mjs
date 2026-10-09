import {releaseServer} from '../grand-release-001/server.mjs';
const s=await releaseServer({port:4268,local:true,saveDir:'.officer003-test/normal'});console.log(s.url);for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await s.close();process.exit()});

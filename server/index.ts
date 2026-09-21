import {createMultiplayerServer} from './runtime.js';
const server=createMultiplayerServer();
const port=await server.listen();
console.info(`EASTFRONT MP-001 server listening on port ${port}`);
for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>{void server.close().then(()=>process.exit(0));});

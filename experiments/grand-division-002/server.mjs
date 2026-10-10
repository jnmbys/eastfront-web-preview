import {releaseServer} from '../grand-release-001/server.mjs';
import {Campaign} from './authority.mjs';
if(process.env.HOST&&process.env.HOST!=='127.0.0.1')throw Error('DIVISION_CANDIDATE_LOCAL_ONLY');
if(!process.env.SAVE_DIR)throw Error('DIVISION_DEDICATED_SAVE_DIR_REQUIRED');
const server=await releaseServer({port:Number(process.env.PORT??4267),host:'127.0.0.1',local:true,CampaignClass:Campaign});
console.log('DIVISION-002 NEW RULE CAMPAIGN '+server.url);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await server.close();process.exit(0);});

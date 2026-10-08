import {start} from '../grand-play-mp022/server.mjs';
import {Campaign} from '../grand-vision-001/authority.mjs';
import path from 'node:path';
const service=await start({port:Number(process.argv[2]??4228),CampaignClass:Campaign,cookiePrefix:'grandui002_',saveFile:path.join(process.env.LOCALAPPDATA??process.cwd(),'EastfrontSaves/grand-ui-002/campaign.json'),evidenceFile:path.resolve('evidence/grand-ui-002/live.jsonl')});
console.log(`GRAND-UI-002 ${service.url} | local only | unified command interface`);
process.on('SIGTERM',()=>void service.close());process.on('SIGINT',()=>void service.close());

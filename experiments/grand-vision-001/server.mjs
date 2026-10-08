import {start} from '../grand-play-mp022/server.mjs';
import {Campaign} from './authority.mjs';
import path from 'node:path';
const service=await start({port:Number(process.argv[2]??4227),CampaignClass:Campaign,cookiePrefix:'grandvision001_',saveFile:path.join(process.env.LOCALAPPDATA??process.cwd(),'EastfrontSaves/grand-vision-001/campaign.json'),evidenceFile:path.resolve('evidence/grand-vision-001/live.jsonl')});
console.log(`GRAND-VISION-001 ${service.url} | local only | unified command interface`);
process.on('SIGTERM',()=>void service.close());process.on('SIGINT',()=>void service.close());

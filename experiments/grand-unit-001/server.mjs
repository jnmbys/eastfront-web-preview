import {start} from '../grand-play-mp022/server.mjs';
import {Campaign} from './authority.mjs';
import path from 'node:path';
const service=await start({port:Number(process.argv[2]??4225),CampaignClass:Campaign,cookiePrefix:'grandunit001_',saveFile:path.join(process.env.LOCALAPPDATA??process.cwd(),'EastfrontSaves/grand-unit-001/campaign.json'),evidenceFile:path.resolve('evidence/grand-unit-001/live.jsonl')});
console.log(`GRAND-UNIT-001 ${service.url} | local only | authorized dual status bars`);
process.on('SIGTERM',()=>void service.close());process.on('SIGINT',()=>void service.close());

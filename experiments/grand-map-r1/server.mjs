import {start} from '../grand-play-mp022/server.mjs';
import {Campaign} from './authority.mjs';
import path from 'node:path';
const service=await start({port:Number(process.argv[2]??4222),CampaignClass:Campaign,cookiePrefix:'grandmapr1_',saveFile:path.join(process.env.LOCALAPPDATA??process.cwd(),'EastfrontSaves/grand-map-r1/campaign.json'),evidenceFile:path.resolve('evidence/grand-map-r1/live.jsonl')});
console.log(`GRAND-MAP-001-R1 ${service.url} | local only | independent save`);
process.on('SIGTERM',()=>void service.close());process.on('SIGINT',()=>void service.close());

import {start} from '../grand-play-mp022/server.mjs';
import {Campaign} from '../grand-map-r1/authority.mjs';
import path from 'node:path';
const service=await start({port:Number(process.argv[2]??4223),CampaignClass:Campaign,cookiePrefix:'grandmapr2_',saveFile:path.join(process.env.LOCALAPPDATA??process.cwd(),'EastfrontSaves/grand-map-r2/campaign.json'),evidenceFile:path.resolve('evidence/grand-map-r2/live.jsonl')});
console.log(`GRAND-MAP-001-R2 ${service.url} | local only | unchanged R1 authority`);
process.on('SIGTERM',()=>void service.close());process.on('SIGINT',()=>void service.close());

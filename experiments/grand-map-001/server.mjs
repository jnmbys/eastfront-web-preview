import {start} from '../grand-play-mp022/server.mjs';
import {Campaign} from './authority.mjs';
import path from 'node:path';
const service=await start({port:Number(process.argv[2]??4221),CampaignClass:Campaign,cookiePrefix:'grandmap001_',saveFile:path.join(process.env.LOCALAPPDATA??process.cwd(),'EastfrontSaves/grand-map-001/campaign.json'),evidenceFile:path.resolve('evidence/grand-map-001/live.jsonl')});
console.log(`GRAND-MAP-001 ${service.url} | local only | independent save`);
process.on('SIGTERM',()=>void service.close());process.on('SIGINT',()=>void service.close());

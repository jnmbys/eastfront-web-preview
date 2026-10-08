import {start} from '../grand-play-mp022/server.mjs';
import {Campaign} from './authority.mjs';
import path from 'node:path';
const service=await start({port:Number(process.argv[2]??4224),CampaignClass:Campaign,cookiePrefix:'grandmap002_',saveFile:path.join(process.env.LOCALAPPDATA??process.cwd(),'EastfrontSaves/grand-map-002/campaign.json'),evidenceFile:path.resolve('evidence/grand-map-002/live.jsonl')});
console.log(`GRAND-MAP-002 ${service.url} | local only | display-only forecasts`);
process.on('SIGTERM',()=>void service.close());process.on('SIGINT',()=>void service.close());

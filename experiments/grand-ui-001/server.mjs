import {start} from '../grand-play-mp022/server.mjs';
import {Campaign} from '../grand-unit-001/authority.mjs';
import path from 'node:path';
const service=await start({port:Number(process.argv[2]??4226),CampaignClass:Campaign,cookiePrefix:'grandui001_',saveFile:path.join(process.env.LOCALAPPDATA??process.cwd(),'EastfrontSaves/grand-ui-001/campaign.json'),evidenceFile:path.resolve('evidence/grand-ui-001/live.jsonl')});
console.log(`GRAND-UI-001 ${service.url} | local only | unified command interface`);
process.on('SIGTERM',()=>void service.close());process.on('SIGINT',()=>void service.close());

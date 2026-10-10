import {releaseServer} from '../grand-release-001/server.mjs';
import {PieceFixture} from './fixture.mjs';
if(process.env.HOST&&process.env.HOST!=='127.0.0.1')throw Error('PIECE_TEST_LOCAL_ONLY');
if(!process.env.SAVE_DIR)throw Error('PIECE_TEST_DEDICATED_SAVE_DIR_REQUIRED');
const s=await releaseServer({port:Number(process.env.PORT??4266),host:'127.0.0.1',local:true,autoTick:false,CampaignClass:PieceFixture});
console.log('INTERNAL INTEGER PIECES FIXTURE ONLY '+s.url);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await s.close();process.exit(0);});

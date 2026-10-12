import fs from 'node:fs';
import {releaseServer} from '../grand-release-001/server.mjs';
import {Campaign} from '../hoi4-recruitment-001/authority.mjs';
const s=await releaseServer({port:Number(process.env.PORT),local:true,saveDir:process.env.SAVE_DIR,CampaignClass:Campaign,cookiePrefix:'conversion_f1_'});
console.log(JSON.stringify({url:s.url,pid:process.pid}));
setInterval(async()=>{if(fs.existsSync(process.env.STOP_FILE)){await s.close();process.exit(0);}},500).unref();

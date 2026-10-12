// Test harness only: not imported or exposed by the playable server.
import fs from 'node:fs';import path from 'node:path';import {releaseServer} from '../grand-release-001/server.mjs';import {RearFixture as Campaign,setupRear} from './fixture.mjs';const existing=fs.existsSync(path.join(process.env.SAVE_DIR,'campaign.json'));
const s=await releaseServer({port:0,local:true,origin:'http://127.0.0.1:4299',saveDir:process.env.SAVE_DIR,CampaignClass:Campaign,autoTick:false,cookiePrefix:'ai_training_restart_'});
if(!existing){const c=s.adapter.c;setupRear(c);await s.adapter.saveFileNow();}
process.send({ready:true,pid:process.pid,port:s.server.address().port});
process.on('message',async m=>{try{if(m.type==='steps'){for(let i=0;i<m.count;i++)s.adapter.c.advance();await s.adapter.saveFileNow();process.send({done:true});}else if(m.type==='state')process.send({state:s.adapter.c.save()});else if(m.type==='stop'){await s.close();process.exit(0);}}catch(e){process.send({error:e.message});}});

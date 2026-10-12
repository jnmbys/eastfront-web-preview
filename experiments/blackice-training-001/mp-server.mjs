import fs from 'node:fs';
import {Campaign} from './authority.mjs';
import {roomCampaign} from '../blackice-mp-001/authority.mjs';
import {start as serve} from '../blackice-mp-001/server.mjs';
export const ROOM_VERSION='BLACKICE-TRAINING-ROOM-1';
export const RoomCampaign=roomCampaign(Campaign,ROOM_VERSION);
export const start=(o={})=>serve({...o,CampaignClass:RoomCampaign,roomVersion:ROOM_VERSION,visitorCookie:'training_mp_visitor',lobbyFile:new URL('./lobby.html',import.meta.url)});
if(process.argv[1]?.replaceAll('\\','/').endsWith('/blackice-training-001/mp-server.mjs')){
 const s=await start({port:Number(process.env.PORT??4292),saveDir:process.env.SAVE_DIR});console.log(JSON.stringify({ready:true,url:s.url,source:s.source}));let closing=false;const stop=async()=>{if(closing)return;closing=true;await s.close();process.exit(0);};process.on('SIGTERM',stop);process.on('SIGINT',stop);process.on('message',m=>{if(m==='shutdown')void stop();});if(process.env.STOP_FILE)setInterval(()=>{if(fs.existsSync(process.env.STOP_FILE)){fs.unlinkSync(process.env.STOP_FILE);void stop();}},500).unref();
}

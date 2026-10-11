import path from 'node:path';import fs from 'node:fs';import {fileURLToPath} from 'node:url';
import {Campaign} from './authority.mjs';import {roomCampaign} from '../blackice-mp-001/authority.mjs';import {start as roomServer} from '../blackice-mp-001/server.mjs';
export const ROOM_VERSION='BLACKICE-CONTENT-002-ROOM-1';
export const RoomCampaign=roomCampaign(Campaign,ROOM_VERSION);
export const start=(options={})=>{if(!options.saveDir)throw Error('CONTENT002_ISOLATED_SAVE_DIR_REQUIRED');return roomServer({...options,CampaignClass:RoomCampaign,roomVersion:ROOM_VERSION,lobbyFile:new URL('./lobby.html',import.meta.url)});};
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const s=await start({port:Number(process.env.PORT??4280),saveDir:process.env.SAVE_DIR});console.log(JSON.stringify({ready:true,url:s.url,source:s.source}));
 const stop=async()=>{await s.close();process.exit(0);};process.on('SIGTERM',stop);process.on('SIGINT',stop);process.on('message',m=>{if(m==='shutdown')void stop();});
 if(process.env.STOP_FILE)setInterval(()=>{if(fs.existsSync(process.env.STOP_FILE)){fs.unlinkSync(process.env.STOP_FILE);void stop();}},500).unref();
}

import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';
import {Campaign} from './authority.mjs';import {VERSION} from './authority.mjs';import {releaseServer} from '../grand-release-001/server.mjs';
if(!process.env.SAVE_DIR)throw Error('CONSTRUCTION_ISOLATED_SAVE_DIR_REQUIRED');
const s=await releaseServer({port:Number(process.env.PORT??4300),local:true,saveDir:process.env.SAVE_DIR,CampaignClass:Campaign,cookiePrefix:'equipment_priority_'});
const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();console.log(JSON.stringify({ready:true,url:s.url,source,rules:VERSION,mode:'normal new campaign / local loopback only'}));
const stop=async()=>{await s.close();process.exit(0);};process.on('message',m=>{if(m==='shutdown')void stop();});process.on('SIGTERM',()=>void stop());
if(process.env.STOP_FILE)setInterval(()=>{if(fs.existsSync(process.env.STOP_FILE)){fs.unlinkSync(process.env.STOP_FILE);void stop();}},500).unref();

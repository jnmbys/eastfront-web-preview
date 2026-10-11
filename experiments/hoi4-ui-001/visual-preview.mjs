import fs from 'node:fs';
import {start} from '../blackice-content-002/server.mjs';
// Separate identity cookie and mandatory separate saves; never reuse an existing room directory.
if(!process.env.SAVE_DIR)throw Error('Set the isolated SAVE_DIR');
const s=await start({port:Number(process.env.PORT??4283),saveDir:process.env.SAVE_DIR,visitorCookie:'hoi_visual_visitor'});
console.log(JSON.stringify({url:s.url,source:s.source}));
let closing=false;const close=async()=>{if(closing)return;closing=true;await s.close();process.exit(0);};
process.on('SIGINT',close);process.on('SIGTERM',close);
if(process.env.STOP_FILE)setInterval(()=>{if(fs.existsSync(process.env.STOP_FILE)){fs.unlinkSync(process.env.STOP_FILE);void close();}},500).unref();

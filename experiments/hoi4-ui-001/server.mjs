import fs from 'node:fs';
import {start as candidate} from '../blackice-content-002/server.mjs';
export const start=(options={})=>candidate({...options,visitorCookie:'hoi4_ui_001_visitor'});
if(process.argv[1]?.replaceAll('\\','/').endsWith('/hoi4-ui-001/server.mjs')){
 const s=await start({port:Number(process.env.PORT??4281),saveDir:process.env.SAVE_DIR});
 console.log(JSON.stringify({ready:true,url:s.url,source:s.source}));
 let closing=false;const close=async()=>{if(closing)return;closing=true;await s.close();process.exit(0);};
 process.on('message',m=>{if(m==='shutdown')void close();});process.on('SIGTERM',close);process.on('SIGINT',close);
 if(process.env.STOP_FILE)setInterval(()=>{if(fs.existsSync(process.env.STOP_FILE)){fs.unlinkSync(process.env.STOP_FILE);void close();}},500).unref();
}

import {Campaign as Base} from './province-authority.mjs';
import {reconcileProvinces} from './provinces.mjs';
import {production,refreshNetwork} from '../grand-economy-002/economy.mjs';
import {roomCampaign} from '../blackice-mp-001/authority.mjs';
import {start} from '../blackice-mp-001/server.mjs';
import fs from 'node:fs';
// Isolated, explicitly directed occupation fixture. Never imported by the normal server.
class Occupation extends Base {
 constructor(){super();const p=this.clock.provinces.items.find(p=>p.id==='P001');this.state.hexes[p.capital].control='SOVIET';this.state.hexes[p.cells.find(k=>k!==p.capital)].control='SOVIET';this.observeVision();reconcileProvinces(this);production(this,false);refreshNetwork(this);}
 snapshot(draft){const d=super.snapshot(draft);if(d.provinces)d.provinces.rule='【定向占领测试，非自然战果】'+d.provinces.rule;return d;}
}
const version='HOI4-PROVINCE-OCCUPATION-FIXTURE-1';
const s=await start({port:Number(process.env.PORT),saveDir:process.env.SAVE_DIR,CampaignClass:roomCampaign(Occupation,version),roomVersion:version,visitorCookie:'hoi_province_occupation_fixture',lobbyFile:new URL('./lobby.html',import.meta.url)});
console.log(JSON.stringify({ready:true,url:s.url,source:s.source,fixture:'capital and one noncapital occupied, not natural conquest'}));
let closing=false;const stop=async()=>{if(closing)return;closing=true;await s.close();process.exit(0);};process.on('message',m=>{if(m==='shutdown')void stop();});if(process.env.STOP_FILE)setInterval(()=>{if(fs.existsSync(process.env.STOP_FILE)){fs.unlinkSync(process.env.STOP_FILE);void stop();}},500).unref();

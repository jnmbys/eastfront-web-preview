// Private, offline browser evidence only. No fixture injection endpoint and no save writes.
import {start} from '../grand-play-mp022/server.mjs';
import {Campaign as Baseline} from '../grand-unit-001/authority.mjs';
import {Campaign} from './authority.mjs';
import {spottingHexes} from '../../.ai003-preview/src/player-view/playerView.js';
const mode=process.argv[2]??'baseline';
class LossFixture extends Campaign {constructor(){super();const f=Object.values(this.econ.ux.facilities).find(f=>f.side==='GERMAN'&&!spottingHexes(this.state,'GERMAN').contact.has(f.hex)),h=this.state.hexes[f.hex],e=Object.values(this.state.units).find(u=>u.alive&&u.side==='SOVIET');e.hex=structuredClone(h.coord);this.observeVision();this.clock.tick=2;h.control='SOVIET';this.observeVision();this.note('GERMAN','离线定向验证：模拟远方地块失守；不是自然战役战报');}}
const s=await start({port:0,autoTick:false,saveFile:null,CampaignClass:mode==='baseline'?Baseline:mode==='initial'?Campaign:LossFixture,cookiePrefix:'visionreview_'+mode+'_'});console.log(`${mode} READONLY ${s.url}`);process.on('SIGINT',async()=>{await s.close();process.exit()});

import {Campaign as Base} from '../grand-unit-001/authority.mjs';
import {playerSnapshot} from '../../.ai003-preview/server/playerSnapshot.js';
import {rememberPlayerView} from '../../.ai003-preview/src/player-view/playerView.js';
const sides=['GERMAN','SOVIET'],key=h=>h.q+','+h.r,copy=structuredClone;
export const VISION_RULES='GRAND-VISION-001';
export class Campaign extends Base {
 constructor(){super();this.vision={version:VISION_RULES,sides:Object.fromEntries(sides.map(side=>[side,{cells:{},knowledge:{viewer:side,sightings:[]}}]))};this.bindVision();this.observeVision();}
 bindVision(){this.match.authoritative.visionRules=VISION_RULES;this.match.authoritative.knowledge=Object.fromEntries(sides.map(side=>[side,this.vision.sides[side].knowledge]));}
 // Called only at committed simulation/transaction boundaries, never by an AI read.
 observeVision(){if(!this.vision)return;this.bindVision();for(const side of sides){const mem=this.vision.sides[side],v=playerSnapshot(this.match,side),seen=new Set(v.identifiedHexKeys),minute=this.clock.tick*5;
  const facilitiesByHex=new Map();for(const f of Object.values(this.econ.ux.facilities)){if(!facilitiesByHex.has(f.hex))facilitiesByHex.set(f.hex,[]);facilitiesByHex.get(f.hex).push({id:f.id,slot:f.slot,status:f.status});}
  for(const h of v.hexes){const k=key(h.coord),prev=mem.cells[k];if(seen.has(k)){
   const facilities=copy(facilitiesByHex.get(k)??[]);
   mem.cells[k]={hex:k,control:h.control,lastSeenMinute:minute,facilities};
  }else if(prev?.control===side&&!prev.lost&&this.state.hexes[k].control!==side){
   // The only extra disclosure is that our own territory was lost. No new enemy identity/control is inferred.
   prev.lostAt=minute;prev.lost=true;
  }}
  const remembered=rememberPlayerView(v);for(const s of remembered.sightings){const old=mem.knowledge.sightings.find(x=>x.contactId===s.contactId);s.lastSeenMinute=v.contactHexKeys.includes(key(s.hex))?minute:old?.lastSeenMinute??minute;}
  mem.knowledge=remembered;
 }this.bindVision();}
 fair(side){const f=super.fair(side);if(this.vision){const mem=this.vision.sides[side],identified=new Set(f.view.identifiedHexKeys);for(const [k,h]of Object.entries(mem.cells))if(h.lost)delete f.known[k];for(const h of f.view.hexes)if(identified.has(key(h.coord)))f.known[key(h.coord)]=h.control;}return f;}
 advance(){super.advance();this.observeVision();}
 transaction(req){const r=super.transaction(req);this.observeVision();return r;}
 save(){const s=super.save();s.vision=copy(this.vision);return s;}
 restore(s,pause=true){if(s.vision?.version!==VISION_RULES||!s.vision.sides?.GERMAN?.cells||!s.vision.sides?.SOVIET?.cells)throw Error('VISION_RULES_MISMATCH_START_NEW_CAMPAIGN');super.restore(s,pause);this.vision=copy(s.vision);this.bindVision();}
 snapshot(draft){const d=super.snapshot(draft),view=d.game.message.payload.view,seen=new Set(view.identifiedHexKeys),controls=new Map(view.hexes.map(h=>[key(h.coord),h.control])),mem=this.vision.sides[this.viewer];
  const stale=Object.values(mem.cells).filter(h=>!seen.has(h.hex));
  d.continuous.vision={version:VISION_RULES,minute:this.clock.tick*5,controlled:view.hexes.filter(h=>h.control===this.viewer).length,visible:seen.size,total:view.hexes.length,stale:copy(stale),sightings:copy(view.lastKnown)};
  // Current facility/warehouse projections disappear with sight. Private payment receipts remain historical.
  d.ux.facilities=d.ux.facilities.filter(f=>seen.has(f.hex));d.ux.lines=d.ux.lines.filter(l=>seen.has(l.hex));d.warehouses=d.warehouses.filter(w=>seen.has(w.node));
  for(const g of d.continuous.goals)if(!seen.has(key(g.hex)))g.control=null;
  for(const city of d.cities.items){for(const district of city.districts){const current=seen.has(district.hex),record=mem.cells[district.hex];
   if(current)Object.assign(district,{control:controls.get(district.hex),unconfirmed:false,hidden:false});
   if(!current){Object.assign(district,{control:record?.lost?null:record?.control??null,unconfirmed:true,hidden:!record,facilities:[],service:false,canBuild:false,assets:[],waitingWork:[],sealedConstruction:[],warehouse:null,lastSeenMinute:record?.lastSeenMinute??null,lost:!!record?.lost,lastFacilities:copy(record?.facilities??[])});}
   else if(district.control!==this.viewer){district.facilities=copy(record?.facilities??[]);district.assets=[];district.waitingWork=[];district.sealedConstruction=[];district.warehouse=null;district.canBuild=false;district.service=false;}
  }city.owner=city.districts.find(x=>x.hex===city.main)?.control??null;city.unconfirmed=city.districts.some(x=>x.unconfirmed);city.contested=city.districts.some(x=>x.control&&city.owner&&x.control!==city.owner);}
  return d;
 }
}

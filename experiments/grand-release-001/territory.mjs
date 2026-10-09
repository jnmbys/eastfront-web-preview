import {beforeManual,afterManual,resumeManual,completeManual} from '../grand-ux-004-r2/manual.mjs';
import {refreshNetwork} from '../grand-economy-002/economy.mjs';
import {validateMapIntent} from '../grand-ui-003-r1/intent.mjs';
import {directPreview} from '../grand-ui-003/preview.mjs';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {Campaign as Economy} from '../grand-economy-002/authority.mjs';
import {rules as previous,cfg} from '../grand-economy-002/config.mjs';
import {hexKey as key,hexDistance as distance} from '../../vendor/eastfront-digital-core/dist/index.js';
export const LEGACY_CONFIG=JSON.parse(fs.readFileSync(new URL('./territory-config.json',import.meta.url)));
export const CONFIG=JSON.parse(fs.readFileSync(new URL('../grand-ux-004-r1/territory-config.json',import.meta.url)));
export const RULES=Object.freeze({...previous,version:'GRAND-TERRITORY-1',saveVersion:1,duration:null,territorialSurrender:true});
const sides=['GERMAN','SOVIET'],other=s=>s==='GERMAN'?'SOVIET':'GERMAN',copy=structuredClone;
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function score(config,state){return Object.fromEntries(sides.map(side=>{const rows=config.rows.filter(r=>r.side===side),total=rows.reduce((n,r)=>n+r.weight,0),lost=rows.reduce((n,r)=>n+(state.hexes[r.hex]?.control===other(side)?r.weight:0),0),lostRatio=lost/total;return [side,{total,lost,lostRatio,threshold:config.threshold,progress:Math.min(1,lostRatio/config.threshold)}];}));}
export class Campaign extends Economy{
 validateOrder(o){super.validateOrder(o);if(o.planAdvance!==undefined&&(o.planAdvance!==true||o.kind!=='ADVANCE'||!o.front?.length))throw Error('INVALID_FRONT_ADVANCE_PLAN');}
 prepareMapPlan(){
  // Optional map plan: first approach assigned frontage, then the explicit final target.
  // Tactical ownOrder remains above this base assignment and can reserve/withdraw units.
  const active=this.clock.corps.filter(g=>g.order.planAdvance&&!g.order.paused);if(!active.length&&!this.clock.commandPlans)return;
  const plans=this.clock.commandPlans??={};
  for(const g of active){
   const stamp=JSON.stringify([g.order.kind,g.order.front,g.order.target]);
   for(const id of g.members){const u=this.state.units[id],front=this.frontAssignments[id];if(!u?.alive||this.clock.units[id].direct||!front)continue;
    if(plans[id]?.stamp!==stamp)plans[id]={stamp,reached:false};
    if(distance(u.hex,front)<=1)plans[id].reached=true;
    if(plans[id].reached)delete this.frontAssignments[id];
   }
  }
  for(const id of Object.keys(plans)){const g=this.clock.corps.find(g=>g.members.includes(id));if(!g?.order.planAdvance||this.clock.units[id]?.direct||!this.state.units[id]?.alive)delete plans[id];}
 }
 projection(draft){if(draft?.uiDirectPreview)return {directPreview:directPreview(this,draft)};return super.projection(draft);}
 constructor(){super();this.frontLimit=24;this.ruleOverride=RULES;this.simRules=RULES;this.clock.rules=RULES.version;this.clock.territory={config:copy(CONFIG),hash:digest(CONFIG),strategic:{}};
  // Initial layout only. Restore below replaces state/config/memory from the save,
  // and never reapplies this frontier to an existing campaign.
  for(const r of CONFIG.rows)this.state.hexes[r.hex].control=r.side;
  const e=this.econ.modern;
  for(const r of Object.values(e.rails)){const x=this.state.edges[r.id];e.owners[r.id]=[this.state.hexes[key(x.a)].control,this.state.hexes[key(x.b)].control].join('/');}
  for(const h of Object.values(e.hubs))e.owners[h.id]=this.state.hexes[h.hex].control;
  for(const side of sides)this.vision.sides[side]={cells:{},knowledge:{viewer:side,sightings:[]}};
  this.bindVision();this.observeVision();refreshNetwork(this);
 }

 finish(surrendered,voluntary=false){if(this.clock.ended)return;this.clock.ended={winner:surrendered.length===2?null:other(surrendered[0]),surrendered,tick:this.clock.tick,type:voluntary?'VOLUNTARY':'TERRITORIAL',reason:surrendered.length===2?'双方在同一时间步达到投降阈值，战役共同终止':`${surrendered[0]==='GERMAN'?'德军':'苏军'}${voluntary?'主动投降':'核心战区失守权重达到投降阈值，正式投降'}`};this.clock.paused=true;this.note(this.viewer,this.clock.ended.reason);}
 evaluateSurrender(){if(this.clock.ended)return;const scores=score(this.clock.territory.config,this.state),losers=sides.filter(s=>scores[s].lostRatio>=scores[s].threshold);if(losers.length)this.finish(losers);}
 advance(){if(this.clock.ended)return;if(!Number.isSafeInteger(this.clock.tick+1)||!Number.isFinite(new Date(Date.parse(cfg.date)+(this.clock.tick+1)*300000).getTime()))throw Error('CLOCK_RANGE_EXHAUSTED_SAVE_AND_STOP');super.advance();completeManual(this);this.econ.cities.events=this.econ.cities.events.slice(-500);this.evaluateSurrender();}
 transaction(req){if(!this.receipts.has(req.id))validateMapIntent(this,req.operation??{});if(req.operation?.type==='RESUME_PLAN')return resumeManual(this,req);if(req.operation?.type!=='SURRENDER'){const replay=this.receipts.has(req.id),w=beforeManual(this,req.operation??{}),result=super.transaction(req);if(!replay)afterManual(this,req.operation??{},w);return result;}const signature=JSON.stringify(req),prior=this.receipts.get(req.id);if(prior){if(prior.signature!==signature)throw Error('ID_REUSE_CONFLICT');return copy(prior.result);}
  if(typeof req.id!=='string'||req.id.length<8)throw Error('REQUEST_ID_REQUIRED');if(this.clock.ended)throw Error('CAMPAIGN_FINISHED');if(req.version!==this.version)throw Error('STALE_VERSION');if(req.operation.confirmed!==true||req.operation.side!==this.viewer||!sides.includes(this.viewer))throw Error('SURRENDER_CONFIRM_OWNER_REQUIRED');
  this.finish([this.viewer],true);this.version++;this.match.matchRevision=this.version;const result={ok:true,version:this.version};this.receipts.set(req.id,{signature,result});return result;
 }
 restore(s,pause=true){for(const u of Object.values(s.clock?.units??{}))if(u.manual&&u.manual.version!=='MANUAL-INTENT-1')throw Error('UNSUPPORTED_MANUAL_INTENT_VERSION');if(s?.format!==RULES.version||!s.clock?.territory?.config||![digest(CONFIG),digest(LEGACY_CONFIG)].includes(s.clock.territory.hash)||digest(s.clock.territory.config)!==s.clock.territory.hash)throw Error('TERRITORY_SAVE_VERSION_REQUIRES_NEW_GAME');this.ruleOverride=RULES;super.restore(s,pause);}
 territoryStrategy(view){
  // Only the supplied authorized view plus own formation condition and frozen public points.
  const side='SOVIET',seen=new Map(view.hexes.map(h=>[key(h.coord),h])),own=view.units.filter(u=>u.side===side),enemies=view.units.filter(u=>u.side!==side),memory=this.clock.territory?.strategic;if(!memory)return;
  const points=this.clock.territory.config.rows.filter(r=>r.weight>1),claimed=new Set();
  for(const g of this.clock.corps.filter(g=>g.side===side)){
   const us=own.filter(u=>g.members.includes(u.id));if(!us.length)continue;const origin=us[0].hex,old=memory[g.id],owned=r=>seen.get(r.hex)?.control===side;
   const threats=points.filter(r=>r.side===side&&seen.has(r.hex)&&(!owned(r)||enemies.some(e=>distance(e.hex,seen.get(r.hex).coord)<=2)));
   const invalid=old&&(old.defend?!threats.some(r=>r.hex===old.hex):seen.get(old.hex)?.control===side);
   if(old&&!invalid&&this.clock.tick<old.next){claimed.add(old.hex);continue;}
   const available=points.filter(r=>r.side!==side&&!owned(r)),pool=threats.length?threats:available;
   const chosen=pool.map(r=>({r,h:this.stateCoordinate(r.hex)})).sort((a,b)=>(distance(origin,a.h)*10-a.r.weight+(claimed.has(a.r.hex)?100:0))-(distance(origin,b.h)*10-b.r.weight+(claimed.has(b.r.hex)?100:0))||a.r.hex.localeCompare(b.r.hex))[0];
   if(!chosen)continue;claimed.add(chosen.r.hex);const org=us.reduce((n,u)=>n+this.clock.units[u.id].org,0)/us.length;
   const kind=org<38?'REFIT':threats.length&&owned(chosen.r)?'HOLD':'ADVANCE';const target=kind==='REFIT'?origin:chosen.h;
   g.order={...g.order,kind,target,risk:org>65?'NORMAL':'LOW',paused:false};memory[g.id]={hex:chosen.r.hex,defend:!!threats.length,next:this.clock.tick+72,reason:kind==='REFIT'?'组织不足，先整补':`${threats.length?'保护':'推进'}关键计分地区：${chosen.r.label}`};
  }
 }
 stateCoordinate(hex){const[q,r]=hex.split(',').map(Number);return {q,r};}
 snapshot(draft){const d=super.snapshot(draft);if(!this.clock.territory)return d;const config=this.clock.territory.config;const known=new Map(d.game.message.payload.view.hexes.map(h=>[key(h.coord),h])),scores=score(this.clock.territory.config,this.state);d.continuous.calendar=new Date(Date.parse(cfg.date)+this.clock.tick*300000).toISOString().slice(0,16).replace('T',' ');d.continuous.victoryText='无战役时限；核心战区失守权重达到80%时投降。';
  d.continuous.geography={version:config.version,layoutName:config.layoutName??'原战区（保留存档布局）',cells:config.rows.map(r=>({hex:r.hex,side:r.side})),labels:[{side:'GERMAN',name:'德军战区'},{side:'SOVIET',name:'苏军战区'}]};
  d.continuous.surrender={version:config.version,layoutName:config.layoutName??'原战区（保留存档布局）',side:this.viewer,scores,own:config.rows.filter(r=>r.side===this.viewer).map(r=>({...r,control:known.has(r.hex)?known.get(r.hex).control:null,current:known.has(r.hex)})),ended:copy(this.clock.ended)};return d;
 }
}

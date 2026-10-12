import {Campaign as Base} from '../hoi4-infrastructure-001/authority.mjs';
import {VERSION,config,legal,cost,syncCosts,effect,visibleForts,key} from './model.mjs';
export {VERSION};
export class Campaign extends Base{
 static newCampaignClass=Campaign;static rulesVersion=VERSION;
 constructor(){super();this.clock.forts={version:VERSION,levels:{},lastAI:-288};}
 enqueue(side,op){if(op.kind!=='FORT')return super.enqueue(side,op);if(!legal(this,op.target,side))throw Error('FORT_SITE_NOT_CONTROLLED_LAND');const e=this.econ.modern;if(e.queue.some(q=>q.kind==='FORT'&&q.hex===op.target&&q.status!=='DONE'&&q.side!==side))throw Error('FORT_PREVIOUS_OWNER_PROJECT_RESERVED');const level=this.clock.forts.levels[op.target]??0,queued=e.queue.filter(q=>q.kind==='FORT'&&q.hex===op.target&&q.status!=='DONE').length;if(level+queued>=config.cap)throw Error('FORT_LEVEL_RESERVED');const serial=++e.serial,id='BUILD:'+serial;e.queue.push({id,serial,side,kind:'FORT',hex:op.target,target:op.target,cost:cost(level+queued),levelFrom:level+queued,progress:0,status:'QUEUED',priority:3,queueRank:Math.max(0,...e.queue.filter(q=>q.side===side&&q.status!=='DONE').map(q=>q.queueRank??q.serial))+1});return id;}
 fixedFortification(target,source,pairs){return effect(this,target,source,pairs);}
 advance(){const f=this.clock.forts;if(!this.clock.ended&&!this.clock.room&&this.clock.tick-f.lastAI>=288){f.lastAI=this.clock.tick;const side='SOVIET',v=this.fair(side).view,e=this.econ.modern;if(!e.queue.some(q=>q.side===side&&q.status!=='DONE')){const known=new Map(v.hexes.map(h=>[key(h.coord),h])),sites=v.units.filter(u=>u.side===side&&u.friendly?.alive&&known.get(key(u.hex))?.control===side&&(f.levels[key(u.hex)]??0)<2).map(u=>key(u.hex)).sort();const target=sites[0];if(target){const old=this.viewer;this.viewer=side;try{this.transaction({id:'fort-ai-'+this.clock.tick,version:this.version,operation:{type:'ECON_BUILD',kind:'FORT',target}});f.lastResult={tick:this.clock.tick,target,status:'QUEUED'};}catch(e){f.lastResult={tick:this.clock.tick,status:'REJECTED',reason:e.message};}finally{this.viewer=old;}}}}super.advance();}
 transaction(req){const r=super.transaction(req);syncCosts(this);return r;}
 snapshot(draft){const d=super.snapshot(draft);if(!this.clock.forts)return d;d.modern.forts=visibleForts(this,d);for(const p of d.provinces.items)p.forts=d.modern.forts.filter(f=>p.cells.includes(f.hex)&&(f.level||f.queued));return d;}
 restore(s,pause=true){if(s.clock?.forts?.version!==VERSION)throw Error('FORT_NEW_CAMPAIGN_REQUIRED');super.restore(s,pause);}
}

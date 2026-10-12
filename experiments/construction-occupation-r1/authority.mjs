import {Campaign as Base} from '../hoi4-fortification-001/authority.mjs';
import {VERSION,active,nextLevel,reconcile} from './model.mjs';
import {config as infra} from '../hoi4-infrastructure-001/model.mjs';
import {config as forts,cost,legal} from '../hoi4-fortification-001/model.mjs';
export {VERSION};
export class Campaign extends Base{
 static newCampaignClass=Campaign;static rulesVersion=VERSION;
 constructor(){super();this.clock.constructionOccupation={version:VERSION};this.econ.modern.occupationSerial={GERMAN:0,SOVIET:0};}
 enqueue(side,op){if(!['CIV','MIL','INFRA','FORT'].includes(op.kind))return super.enqueue(side,op);const e=this.econ.modern;let hex,province,targetLevel,work;
  if(['CIV','MIL'].includes(op.kind)){const d=this.econ.cities.items.flatMap(c=>c.districts).find(d=>d.id===op.target);if(!d||d.type!=='INDUSTRIAL'||!d.slots)throw Error('工业区没有建筑槽位');if(this.state.hexes[d.hex]?.control!==side)throw Error('CONSTRUCTION_NOT_CONTROLLED');const used=Object.values(e.facilities).filter(f=>f.district===d.id).length+e.queue.filter(q=>active(q)&&q.side===side&&q.target===d.id&&['MIL','CIV'].includes(q.kind)).length;if(used>=d.slots)throw Error('FACTORY_SLOTS_FULL');hex=d.hex;work=e.balanceConfig.construction[op.kind];}
  else if(op.kind==='INFRA'){const p=this.clock.provinces.items.find(p=>p.id===op.target);if(!p||!p.cells.every(k=>this.state.hexes[k]?.control===side))throw Error('INFRA_PROVINCE_NOT_CONTROLLED');province=p.id;hex=p.capital;targetLevel=nextLevel(this,side,op.kind,op.target,this.clock.infrastructure.levels[p.id],infra.cap);work=infra.cost;}
  else {if(!legal(this,op.target,side))throw Error('FORT_SITE_NOT_CONTROLLED_LAND');hex=op.target;targetLevel=nextLevel(this,side,op.kind,op.target,this.clock.forts.levels[hex]??0,forts.cap);work=cost((targetLevel??1)-1);}
  if(!['CIV','MIL'].includes(op.kind)&&targetLevel===null)throw Error('CONSTRUCTION_LEVEL_RESERVED');const serial=++e.occupationSerial[side],id='BUILD:'+side+':OCC:'+serial;e.queue.push({id,serial,side,kind:op.kind,target:op.target,hex,...(province?{province}:{}),...(targetLevel?{targetLevel,levelFrom:targetLevel-1}:{}),cost:work,progress:0,status:'QUEUED',priority:3,queueRank:Math.max(0,...e.queue.filter(q=>q.side===side&&active(q)).map(q=>q.queueRank??q.serial))+1});return id;
 }
 transaction(req){const r=super.transaction(req);reconcile(this);return r;}
 snapshot(draft){const d=super.snapshot(draft),e=this.econ.modern;if(!this.clock.constructionOccupation)return d;
  for(const s of d.modern.sites){s.queued=e.queue.filter(q=>active(q)&&q.side===this.viewer&&q.target===s.id&&['MIL','CIV'].includes(q.kind)).length;s.free=Math.max(0,s.slots-s.used-s.queued);}
  for(const p of d.modern.infrastructure){if(p.level!==null)p.queued=e.queue.filter(q=>active(q)&&q.side===this.viewer&&q.kind==='INFRA'&&q.target===p.id&&q.targetLevel>p.level).length;const n=p.level===null?null:nextLevel(this,this.viewer,'INFRA',p.id,p.level,p.cap);p.canBuild=p.cells.every(k=>d.game.message.payload.view.hexes.some(h=>h.coord.q+','+h.coord.r===k&&h.control===this.viewer))&&n!==null;p.reason=p.canBuild?'可入队':p.level===null?'当前等级未掌握':'须控制全省且有未预留等级';p.nextLevel=n;}
  for(const f of d.modern.forts){f.queued=e.queue.filter(q=>active(q)&&q.side===this.viewer&&q.kind==='FORT'&&q.target===f.hex&&q.targetLevel>f.level).length;const n=nextLevel(this,this.viewer,'FORT',f.hex,f.level,f.cap);f.canBuild=f.controller===this.viewer&&n!==null;f.cost=n===null?null:cost(n-1);f.nextLevel=n;}
  for(const q of d.modern.queue)if(q.targetLevel)q.levelFrom=q.targetLevel-1;
  d.modern.occupationRule=VERSION;return d;
 }
 restore(s,pause=true){if(s.clock?.constructionOccupation?.version!==VERSION)throw Error('OCCUPATION_NEW_CAMPAIGN_REQUIRED');super.restore(s,pause);}
}

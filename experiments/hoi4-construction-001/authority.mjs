import {Campaign as Base} from '../blackice-ai-training-002/authority.mjs';
import {allocation,active,sortQueue,VERSION} from './construction.mjs';
export {VERSION};
export class Campaign extends Base {
 static newCampaignClass=Campaign;static rulesVersion=VERSION;
 constructor(){super();this.econ.modern.civilianQueue={version:VERSION};}
 enqueue(side,op){const e=this.econ.modern;let id;
  if(['MIL','CIV'].includes(op.kind)){
   const d=this.econ.cities.items.flatMap(c=>c.districts).find(d=>d.id===op.target);
   if(!d||d.type!=='INDUSTRIAL'||!d.slots)throw Error('工业区没有建筑槽位');if(this.state.hexes[d.hex]?.control!==side)throw Error('CONSTRUCTION_NOT_CONTROLLED');
   const used=Object.values(e.facilities).filter(f=>f.district===d.id).length+e.queue.filter(q=>active(q)&&q.target===d.id&&['MIL','CIV'].includes(q.kind)).length;
   if(used>=d.slots)throw Error('FACTORY_SLOTS_FULL');const serial=++e.serial;id='BUILD:'+serial;e.queue.push({id,serial,side,kind:op.kind,target:d.id,hex:d.hex,cost:e.balanceConfig.construction[op.kind],progress:0,status:'QUEUED',priority:3});
  }else id=super.enqueue(side,op);
  const q=e.queue.find(q=>q.id===id),rest=e.queue.filter(x=>x.side===side&&active(x)&&x!==q);q.queueRank=op.kind.startsWith('REPAIR_')?Math.min(0,...rest.map(x=>x.queueRank??x.serial))-1:Math.max(0,...rest.map(x=>x.queueRank??x.serial))+1;return id;
 }
 transaction(req){const op=req.operation??{};if(!['CONSTRUCTION_SORT','CONSTRUCTION_CANCEL'].includes(op.type))return super.transaction(req);
  if(typeof req.id!=='string'||req.id.length<8)throw Error('REQUEST_ID_REQUIRED');const signature=JSON.stringify(req),prior=this.receipts.get(req.id);if(prior){if(prior.signature!==signature)throw Error('ID_REUSE_CONFLICT');return structuredClone(prior.result);}
  if(req.version!==this.version)throw Error('STALE_VERSION');if(this.clock.ended)throw Error('CAMPAIGN_FINISHED');const e=this.econ.modern,rows=e.queue.filter(q=>q.side===this.viewer&&active(q)).sort(sortQueue);
  if(op.type==='CONSTRUCTION_SORT'){if(!Array.isArray(op.ids)||op.ids.length!==rows.length||new Set(op.ids).size!==rows.length||op.ids.some(id=>!rows.some(q=>q.id===id)))throw Error('QUEUE_NOT_OWNED_OR_CHANGED');op.ids.forEach((id,i)=>{e.queue.find(q=>q.id===id).queueRank=i;});}
  else {const q=rows.find(q=>q.id===op.id);if(!q)throw Error('PROJECT_NOT_OWNED_OR_FINISHED');q.status='DONE';q.cancelled=true;q.outcome='已取消；已用工时不返还，不生成资产';e.ledger.push({kind:'CONSTRUCTION_CANCELLED',side:this.viewer,tick:this.clock.tick,project:q.id,work:q.progress});}
  this.version++;this.match.matchRevision=this.version;const result={ok:true,version:this.version};this.receipts.set(req.id,{signature,result});return result;
 }
 snapshot(draft){const d=super.snapshot(draft),e=this.econ.modern;d.modern.construction=allocation(this,this.viewer);d.modern.queue.sort(sortQueue);d.modern.sites=d.modern.sites.filter(s=>this.econ.cities.items.some(c=>c.districts.some(d=>d.id===s.id&&d.type==='INDUSTRIAL')));d.modern.sites.forEach(s=>{const city=this.econ.cities.items.find(c=>c.districts.some(d=>d.id===s.id));s.label=(city?.label??city?.name??s.label)+' '+s.label;s.queued=e.queue.filter(q=>active(q)&&q.target===s.id&&['MIL','CIV'].includes(q.kind)).length;s.free=Math.max(0,s.slots-s.used-s.queued);});return d;}
 restore(s,pause=true){if(s.econ?.modern?.civilianQueue?.version!==VERSION)throw Error('CONSTRUCTION_NEW_CAMPAIGN_REQUIRED');super.restore(s,pause);}
}

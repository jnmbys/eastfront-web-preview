import {Campaign as Base} from '../hoi4-recruitment-001/authority.mjs';
import {validate} from '../grand-division-002/inventory.mjs';
export const VERSION='HOI4-EQUIPMENT-PRIORITY-001-1';
const sides=['GERMAN','SOVIET'],copy=structuredClone;
export class Campaign extends Base{
 static newCampaignClass=Campaign;static rulesVersion=VERSION;
 constructor(){super();this.clock.equipmentPriority={version:VERSION,sides:Object.fromEntries(sides.map(s=>[s,{policy:'FIELD',levels:{},cursors:{},last:[]}]))};}
 level(kind,id,side){const a=this.clock.equipmentPriority.sides[side],override=a.levels[id];if(override)return override;if(kind==='RECRUIT')return 2;const army=this.placements.find(x=>x.id===id)?.army,v=this.econ.modern.priorities[army]??3;return v<3?1:v>3?3:2;}
 enqueueEquipment(kind,id,side,run){this.equipmentJobs??=[];this.equipmentJobs.push({kind,id,side,run});}
 economyStep(){this.equipmentJobs=[];super.economyStep();const p=this.clock.divisionLedger;
  for(const side of sides){const a=this.clock.equipmentPriority.sides[side],groups=new Map();a.last=[];
   for(const j of this.equipmentJobs.filter(j=>j.side===side)){const group=(a.policy==='EQUAL'?0:j.kind===a.policy?0:1)*3+this.level(j.kind,j.id,side);if(!groups.has(group))groups.set(group,[]);groups.get(group).push(j);}
   for(const [group,rows] of [...groups].sort(([a],[b])=>a-b)){rows.sort((a,b)=>a.id.localeCompare(b.id));const cursor=a.cursors[group],i=rows.findIndex(x=>x.id>cursor),ordered=cursor?[...rows.slice(i<0?0:i),...rows.slice(0,i<0?0:i)]:rows;
    for(const j of ordered){const stock=copy(p.nations[side].stock);j.run();const allocated=Object.fromEntries(Object.keys(stock).map(k=>[k,Math.max(0,stock[k]-p.nations[side].stock[k])]).filter(([,n])=>n>0));if(Object.keys(allocated).length)a.cursors[group]=j.id;a.last.push({id:j.id,kind:j.kind,level:this.level(j.kind,j.id,side),reason:j.kind==='FIELD'?this.clock.units[j.id]?.refillStatus?.reason:p.recruitment.units[j.id]?.reason,allocated});}
   }
  }
  this.equipmentJobs=[];validate(p);
 }
 transaction(req){if(req.operation?.type!=='EQUIPMENT_PRIORITY')return super.transaction(req);const signature=JSON.stringify(req),old=this.receipts.get(req.id);if(old){if(old.signature!==signature)throw Error('ID_REUSE_CONFLICT');return copy(old.result);}if(typeof req.id!=='string'||req.id.length<8)throw Error('REQUEST_ID_REQUIRED');if(req.version!==this.version)throw Error('STALE_VERSION');if(this.clock.ended)throw Error('CAMPAIGN_FINISHED');const op=req.operation,a=this.clock.equipmentPriority.sides[this.viewer];
  if(op.policy!==undefined){if(!['FIELD','RECRUIT','EQUAL'].includes(op.policy)||op.unit)throw Error('INVALID_EQUIPMENT_PRIORITY');a.policy=op.policy;}
  else{const u=this.clock.divisionLedger.units[op.unit]??this.clock.divisionLedger.recruitment.units[op.unit];if(!u||u.side!==this.viewer)throw Error('EQUIPMENT_RECIPIENT_NOT_OWNED');if(![0,1,2,3].includes(op.level))throw Error('INVALID_EQUIPMENT_PRIORITY');if(op.level)a.levels[op.unit]=op.level;else delete a.levels[op.unit];}
  this.version++;this.match.matchRevision=this.version;const result={ok:true,version:this.version};this.receipts.set(req.id,{signature,result});return copy(result);
 }
 snapshot(draft){const d=super.snapshot(draft),a=this.clock.equipmentPriority?.sides[this.viewer];if(!a)return d;d.equipmentPriority={version:VERSION,policy:a.policy,levels:copy(a.levels),units:Object.fromEntries([...Object.values(this.clock.divisionLedger.units).filter(u=>u.side===this.viewer).map(u=>[u.id,this.level('FIELD',u.id,u.side)]),...Object.values(this.clock.divisionLedger.recruitment.units).filter(u=>u.side===this.viewer).map(u=>[u.id,this.level('RECRUIT',u.id,u.side)])]),last:copy(a.last)};return d;}
 restore(s,pause=true){if(s.clock?.equipmentPriority?.version!==VERSION)throw Error('EQUIPMENT_PRIORITY_NEW_CAMPAIGN_REQUIRED');super.restore(s,pause);this.equipmentJobs=[];}
}

import {Campaign as Weather} from '../blackice-weather-001/authority.mjs';
import {validate} from '../grand-division-002/inventory.mjs';
export const VERSION='BLACKICE-TRAINING-001-1';
export const MODEL=Object.freeze({cap:.2,gainDay:.02,minPersonnel:.8,minEquipment:.8,minSupply:.5,orgCeiling:25,orgLossStep:1,wearDay:.005,recoveryBonusMax:.2});
const copy=structuredClone;
export class Campaign extends Weather {
 static newCampaignClass=Campaign;static rulesVersion=VERSION;
 constructor(){super();this.clock.training={version:VERSION,tasks:{}};}
 trainingEligibility(id){const u=this.clock.divisionLedger.units[id],v=this.clock.units[id];if(!u||!this.state.units[id]?.alive)return '部队已失效';
  if(v.engaged)return '正在交战';if(v.march||this.isWithdrawalInProgress?.(id))return '行军或撤出尚未结束';
  if(u.personnel/Math.max(1,u.target.manpower)<MODEL.minPersonnel)return '人员不足80%';
  if(Object.entries(u.target.equipment).some(([k,q])=>q>0&&u.held[k]/q<MODEL.minEquipment))return '有装备不足80%';
  if((v.dailySupply?.effective??this.econ.modern.net[u.side]?.rows[id]?.ratio??0)<MODEL.minSupply)return '日常供给不足50%';
  if(!(this.econ.modern.net[u.side]?.rows[id]?.routes?.length))return '没有合法后方连通';
  if(u.trainingExperience>=MODEL.cap)return '已达基础训练上限';return null;
 }
 stopTraining(id,reason){const t=this.clock.training.tasks[id];if(t?.active){t.active=false;t.reason=reason;t.stopped=this.clock.tick;this.clock.units[id].reason=reason;}}
 transaction(req){const op=req.operation??{},prior=this.receipts.get(req.id);if(prior){if(prior.signature!==JSON.stringify(req))throw Error('ID_REUSE_CONFLICT');return copy(prior.result);}
  if(op.type!=='TRAINING'){const r=super.transaction(req);if(['DIRECT','ASSIGN','RESUME_PLAN','DIVISION_FORMAL_ADOPT'].includes(op.type))this.stopTraining(op.unit,op.type==='DIVISION_FORMAL_ADOPT'?'换编中断训练':'新命令中断训练');return r;}
  if(typeof req.id!=='string'||req.id.length<8)throw Error('REQUEST_ID_REQUIRED');if(req.version!==this.version)throw Error('STALE_VERSION');
  if(this.clock.ended)throw Error('CAMPAIGN_FINISHED');const id=op.unit,u=this.state.units[id];if(!u?.alive||u.side!==this.viewer)throw Error('UNIT_NOT_OWNED');if(typeof op.active!=='boolean')throw Error('INVALID_TRAINING_INTENT');
  if(op.active){const reason=this.trainingEligibility(id);if(reason)throw Error(reason);if(this.clock.units[id].org<MODEL.orgCeiling)throw Error('组织不足25%，先休整');}
  const backup=this.checkpoint();try{
   // Use the existing persistent manual HOLD overlay. Corps membership and timed withdrawals survive.
   const r=super.transaction({...req,operation:{type:'DIRECT',unit:id,order:{kind:'HOLD',target:copy(u.hex),risk:'LOW',paused:true}}});
   const old=this.clock.training.tasks[id];this.clock.training.tasks[id]={...(old??{ticks:0,wear:{},lost:{}}),active:op.active,reason:op.active?'基础训练中':'玩家停止，驻守恢复组织',since:this.clock.tick};this.clock.units[id].reason=this.clock.training.tasks[id].reason;
   this.receipts.set(req.id,{signature:JSON.stringify(req),result:r});return r;
  }catch(e){this.restore(backup,false);throw e;}
 }
 restOrgRate(id){if(this.clock.training?.tasks[id]?.active)return 0;const xp=this.clock.divisionLedger?.units[id]?.trainingExperience??0;return super.restOrgRate(id)*(1+MODEL.recoveryBonusMax*Math.min(MODEL.cap,xp)/MODEL.cap);}
 resolveDivisionCombat(args){for(const b of args.battles)for(const id of b.units)this.stopTraining(id,'遭遇交战，训练中断；仍承受正常战斗');return super.resolveDivisionCombat(args);}
 economyStep(){const p=this.clock.divisionLedger,prior=Object.fromEntries(Object.entries(p.units).map(([id,u])=>[id,{n:u.personnel,xp:u.trainingExperience}]));super.economyStep();for(const[id,u]of Object.entries(this.clock.divisionLedger.units)){const old=prior[id];if(u.personnel>old.n)u.trainingExperience=old.xp*old.n/u.personnel;this.clock.units[id].trainingExperience=u.trainingExperience;}}
 advance(){
  for(const[id,t]of Object.entries(this.clock.training.tasks)){if(t.active){const r=this.trainingEligibility(id);if(r)this.stopTraining(id,r);}}
  const result=super.advance(),p=this.clock.divisionLedger;
  for(const[id,t]of Object.entries(this.clock.training.tasks)){if(!t.active)continue;const why=this.trainingEligibility(id);if(why){this.stopTraining(id,why);continue;}
   const u=p.units[id],v=this.clock.units[id],equip=Math.min(1,...Object.entries(u.target.equipment).filter(([,q])=>q>0).map(([k,q])=>u.held[k]/q)),strength=Math.min(equip,u.personnel/u.target.manpower),supply=v.dailySupply?.effective??1;
   u.trainingExperience=Math.min(MODEL.cap,u.trainingExperience+MODEL.gainDay/288*strength*Math.min(1,supply));v.trainingExperience=u.trainingExperience;
   v.org=Math.max(0,Math.min(v.org,Math.max(MODEL.orgCeiling,v.org-MODEL.orgLossStep)));u.org=v.org/100*this.divisionAttributes(id).paper.orgMax;t.ticks++;v.reason='训练中：组织逐步降至25%，停止后驻守恢复';
   for(const[k,q]of Object.entries(u.held)){if(q<=0)continue;t.wear[k]=(t.wear[k]??0)+q*MODEL.wearDay/288;const lost=Math.min(q,Math.floor(t.wear[k]));if(lost){u.held[k]-=lost;p.nations[u.side].lost[k]+=lost;t.wear[k]-=lost;t.lost[k]=(t.lost[k]??0)+lost;u.revision++;}}
   if(u.trainingExperience>=MODEL.cap)this.stopTraining(id,'达到基础训练上限，驻守恢复组织');
  }
  validate(p);return result;
 }
 snapshot(draft){const d=super.snapshot(draft);if(!this.clock.training)return d;d.training={version:VERSION,model:MODEL};
  for(const[id,v]of Object.entries(d.continuous.units)){const u=this.clock.divisionLedger.units[id],t=this.clock.training.tasks[id];v.training={experience:u.trainingExperience,progress:Math.min(1,u.trainingExperience/MODEL.cap),recoveryBonus:MODEL.recoveryBonusMax*Math.min(MODEL.cap,u.trainingExperience)/MODEL.cap,eligibleReason:this.trainingEligibility(id),active:!!t?.active,reason:t?.reason??'未训练',ticks:t?.ticks??0,lost:copy(t?.lost??{})};if(t?.active)v.reason='基础训练中；停止后驻守恢复组织';}
  return d;
 }
 restore(s,pause=true){if(s.clock?.training?.version!==VERSION)throw Error('TRAINING_NEW_CAMPAIGN_REQUIRED');return super.restore(s,pause);}
}

import {Campaign as Previous,RULES as OLD_RULES} from '../grand-release-001/territory.mjs';
import {emptyDraft,transaction as draftTransaction} from '../grand-division-001/templates.mjs';

import {fairUnits} from '../grand-economy-002/planning.mjs';
import {cfg,products as legacyProducts} from '../grand-economy-002/config.mjs';
import {production,construction,ownership,dailySupply,refreshNetwork} from '../grand-economy-002/economy.mjs';
import {createInventory,validate,SCHEMA} from './inventory.mjs';
import {modelDemand,modelIds,reference} from './model-demand.mjs';
import {initializeFormal,formalTransaction,earnExperience,validateFormal,POLICY} from './formal.mjs';
import {attributes,resolveContacts,COMBAT_POLICY} from './combat.mjs';
import {transport} from './freight.mjs';
import {accrueReception,debitReception,freightPolicy,receptionRates,CURRENT_RECEPTION,LEGACY_RECEPTION} from './reception.mjs';
import {uniqueActions,explainBattle} from './presentation.mjs';
const copy=structuredClone,sides=['GERMAN','SOVIET'];
export const VERSION='GRAND-DIVISION-2-INTEGRATED-1';
// Leader approved the explicit aluminium/freight/initial-establishment proposal.
export const SCENARIO_APPROVED=true;
export const modelProducts={
 infantry_equipment_1:{label:'步兵装备Ⅰ（件）',cost:reference.models.infantry_equipment_1.cost,resources:{steel:2}},
 support_equipment_1:{label:'支援装备Ⅰ（件）',cost:reference.models.support_equipment_1.cost,resources:{steel:2,aluminium:1}},
 TRAIN:legacyProducts.TRAIN,TRUCK:legacyProducts.TRUCK
};
// Legacy v.retreat is a historical marker and never resets. Only an actual
// active withdrawal/march prevents adoption in this new ruleset.
export function eligibleModel(c,id){const u=c.state.units[id],v=c.clock.units[id],r=c.econ.modern.net[u?.side]?.rows[id];
 if(!u?.alive)throw Error('PIECE_UNIT_UNAVAILABLE');if(v.engaged)throw Error('PIECE_IN_COMBAT');if(v.march||c.clock.tactical?.withdrawals?.[id])throw Error('PIECE_MOVING_OR_WITHDRAWING');if(!r?.route&&!r?.routes?.length)throw Error('PIECE_REAR_DISCONNECTED');
}
export class Campaign extends Previous{
 static newCampaignClass=Campaign;
 constructor(){
  super();if(!SCENARIO_APPROVED)throw Error('DIVISION_SCENARIO_REVIEW_PENDING');
  const templates={},units={},nations={};
  for(const side of sides){const t=emptyDraft();t.name=(side==='GERMAN'?'德军':'苏军')+'初始步兵营';t.regiments[0][0]='INFANTRY';Object.assign(t,{id:side+':initial-infantry',version:1,side,status:'FORMAL'});templates[t.id]=t;
   nations[side]={manpower:4800,stock:{infantry_equipment_1:0,support_equipment_1:0,TRAIN:this.econ.modern.nations[side].stock.TRAIN,TRUCK:this.econ.modern.nations[side].stock.TRUCK}};
   for(const u of Object.values(this.state.units).filter(u=>u.side===side)){units[u.id]={id:u.id,side,personnel:1000,held:{infantry_equipment_1:100,support_equipment_1:0},target:modelDemand(t),revision:0,org:60,trainingExperience:0,templateId:t.id,templateVersion:1};u.type='INFANTRY';u.step=0;Object.assign(this.clock.units[u.id],{personnel:1000,max:1000,org:100,trainingExperience:0,losses:0});}
  }
  const p=createInventory({nations,units});p.receptionPolicy=CURRENT_RECEPTION;p.id=this.id;initializeFormal(p,templates);p.formal.lastExperienceTick=this.clock.tick;p.lossFractions={};p.rateCredits={};this.clock.divisionLedger=p;
  const e=this.econ.modern;e.modelProducts=copy(modelProducts);e.lines={};
  for(const side of sides){const factories=Object.values(e.facilities).filter(f=>f.kind==='MIL'&&this.state.hexes[f.hex].control===side).map(f=>f.id).sort();
   Object.keys(modelProducts).forEach((product,i)=>{e.lines[side+':'+product]={id:side+':'+product,side,product,factories:i<2?factories.filter((_,n)=>n%2===i):[],priority:i+1,efficiency:cfg.efficiencyStart,progress:0,completed:0,resourceFactor:1,workDay:0,missing:[],lostWork:0};});
   p.nations[side].produced.TRAIN=0;p.nations[side].produced.TRUCK=0;p.nations[side].lost.TRAIN=0;p.nations[side].lost.TRUCK=0;
  }
  for(const site of e.resourceSites)site.capacity.aluminium=1;
  this.bindModels();this.clock.rules=VERSION;this.ruleOverride={...OLD_RULES,version:VERSION};this.simRules=this.ruleOverride;this.clock.paused=true;refreshNetwork(this);
 }
 bindModels(preserveOrg=false){const p=this.clock.divisionLedger;if(!p)return;const e=this.econ.modern;e.divisionDailyNeed={};this.attributeCache=new Map();
  for(const side of sides){const n=e.nations[side],x=p.nations[side];n.stock=x.stock;n.manpower=x.manpower;n.produced=x.produced;n.lost=x.lost;}
  for(const [id,u]of Object.entries(p.units)){const v=this.clock.units[id],g=this.econ.gear.units[id];g.held=u.held;g.recipe=Object.fromEntries(Object.entries(u.target.equipment).map(([k,q])=>[k,q/g.base.maxDamageSteps]));e.establishment[id]=copy(u.target.equipment);e.lastPersonnel[id]=u.personnel;v.personnel=u.personnel;v.max=u.target.manpower;v.trainingExperience=u.trainingExperience;const a=this.divisionAttributes(id);if(!preserveOrg)v.org=u.org/a.paper.orgMax*100;e.divisionDailyNeed[id]=a.paper.supply;}
 }
 divisionAttributes(id){const p=this.clock.divisionLedger,u=p.units[id],t=p.formal.templates[u.templateId],signature=JSON.stringify([u.templateId,u.templateVersion,u.personnel,u.held]);this.attributeCache??=new Map();const old=this.attributeCache.get(id);if(old?.signature===signature)return old.value;const value=attributes(t,u);this.attributeCache.set(id,{signature,value});return value;}
 capability(id){if(!this.clock?.divisionLedger)return super.capability(id);const a=this.divisionAttributes(id),v=this.clock.units[id],supply=v.dailySupply?.effective??1;return {org:v.org,stock:this.econ.supply[id].stock,fire:a.effective.softAttack*(.3+.7*supply),protection:a.effective.defense,armor:0,antiArmor:a.effective.piercing,mobility:1,base:this.econ.gear.units[id].base.steps[0],division:a,divisionOrg:v.org/100*a.paper.orgMax};}
 resolveDivisionCombat({battles,damage,orgDamage}){const stats=Object.fromEntries(Object.keys(this.clock.divisionLedger.units).map(id=>{const a=copy(this.divisionAttributes(id)),s=this.clock.units[id].dailySupply?.effective??1;for(const k of ['softAttack','hardAttack','defense','breakthrough'])a.effective[k]*=.3+.7*s;return [id,a];})),r=resolveContacts({contacts:battles.map(b=>({...b,hex:b.hex.q+','+b.hex.r})),units:this.state.units,stats,random:()=>this.random(),tick:this.clock.tick});
  for(const id of r.participating){this.clock.units[id].engaged++;this.spend(id,this.simRules.combatQ);}
  for(const[id,hp]of Object.entries(r.damage))damage[id]=hp/stats[id].paper.hp*this.clock.units[id].max;
  for(const[id,org]of Object.entries(r.orgDamage))orgDamage[id]=org/stats[id].paper.orgMax*100;
  for(const id of r.waiting)this.clock.units[id].reason='当前接触宽度已满，等待进入；没有提供额外火力';
  this.clock.divisionCombat={tick:this.clock.tick,participants:r.participating,waiting:r.waiting};
 }
 recordEquipmentLoss(){const p=this.clock.divisionLedger;if(!p)return super.recordEquipmentLoss();
  for(const[id,u]of Object.entries(p.units)){const v=this.clock.units[id],n=p.nations[u.side],debt=p.lossFractions[id]??={personnel:0,...Object.fromEntries(modelIds.map(k=>[k,0]))},delta=Math.max(0,u.personnel-v.personnel);debt.personnel+=delta;const people=this.state.units[id].alive?Math.min(u.personnel,Math.floor(debt.personnel)):u.personnel;debt.personnel=this.state.units[id].alive?Math.max(0,debt.personnel-people):0;u.personnel-=people;n.personnelLost+=people;
   for(const k of modelIds){debt[k]+=u.target.equipment[k]*delta/u.target.manpower;const quantity=this.state.units[id].alive?Math.min(u.held[k],Math.floor(debt[k])):u.held[k];u.held[k]-=quantity;n.lost[k]+=quantity;debt[k]=this.state.units[id].alive?Math.max(0,debt[k]-quantity):0;}
   v.personnel=u.personnel;u.org=Math.min(this.divisionAttributes(id).paper.orgMax,v.org/100*this.divisionAttributes(id).paper.orgMax);if(people)u.revision++;
  }
 }
 economyStep(){const p=this.clock.divisionLedger;if(!p)return super.economyStep();const e=this.econ.modern;if(e.settled>=this.clock.tick)throw Error('ECONOMY_TICK_ALREADY_SETTLED');production(this);construction(this);ownership(this);dailySupply(this);
  const hour=Math.floor(this.clock.tick/cfg.networkTicks);if(e.cargoHour?.hour!==hour)e.cargoHour={hour,sides:Object.fromEntries(sides.map(s=>[s,{train:0,edges:{},hubs:{},sources:{}}]))};
  for(const side of sides){const ordered=fairUnits(Object.values(this.state.units).filter(u=>u.side===side&&u.alive),u=>e.priorities[this.placements.find(x=>x.id===u.id)?.army]??3,this.clock.tick);
   for(const {id} of ordered){const u=p.units[id],v=this.clock.units[id],credits=p.rateCredits[id]??={personnel:0,...Object.fromEntries(modelIds.map(k=>[k,0]))},factor=v.engaged?cfg.combatReinforcement:v.march?cfg.marchReinforcement:1;
    // Progress may accumulate up to one dispatch, never bank unlimited catch-up.
    const reception=receptionRates(p.receptionPolicy),rates=accrueReception(credits,factor,reception);
    const r=transport(p,id,{network:e.net[side],rails:e.rails,cargo:e.cargoHour.sides[side],trainCapacity:p.nations[side].stock.TRAIN*cfg.trainWork,sourceCapacity:cfg.sourceFlow,railCapacity:cfg.railFlow,policy:freightPolicy,rates});
    e.cargoHour.sides[side]=r.cargo;debitReception(credits,r);v.personnel=u.personnel;v.max=u.target.manpower;v.refillStatus={personnel:r.personnel,items:r.equipment,reason:r.reason,personnelRateDay:reception.personnelDay*factor,equipmentRateDay:reception.equipmentDay*factor,tick:this.clock.tick};e.nations[side].personnelSent+=r.personnel;for(const k of modelIds)e.nations[side].reinforced[k]=(e.nations[side].reinforced[k]??0)+r.equipment[k];if(r.personnel||Object.values(r.equipment).some(Boolean))e.ledger.push({kind:'REFILLED',tick:this.clock.tick,side,unit:id,personnel:r.personnel,items:r.equipment});
   }
   e.nations[side].manpower=p.nations[side].manpower;
  }
  const involved=[...new Set((this.clock.divisionCombat?.participants??[]).map(id=>this.state.units[id].side))];earnExperience(p,{tick:this.clock.tick,minutes:5,participantSides:involved});
  for(const[id,u]of Object.entries(p.units))u.org=this.clock.units[id].org/100*this.divisionAttributes(id).paper.orgMax;
  p.settledTick=this.clock.tick;e.settled=this.clock.tick;this.econ.epoch=hour;this.state.turn=1+hour;validate(p);validateFormal(p);
 }
 transaction(req){if(!req.operation?.type?.startsWith('DIVISION_FORMAL_')){try{return super.transaction(req);}catch(error){this.bindModels(true);throw error;}}if(this.clock.ended)throw Error('CAMPAIGN_FINISHED');
  const signature=JSON.stringify(req),prior=this.receipts.get(req.id);if(prior){if(prior.signature!==signature)throw Error('ID_REUSE_CONFLICT');return copy(prior.result);}
  if(req.version!==this.version)throw Error('STALE_VERSION');const before=this.checkpoint();try{const p=copy(this.clock.divisionLedger);p.version=this.version;
  for(const[id,u]of Object.entries(p.units))u.org=this.clock.units[id].org/100*this.divisionAttributes(id).paper.orgMax;
  const result=formalTransaction(p,{...req,operation:{...req.operation,type:req.operation.type.replace('DIVISION_','')}},this.viewer,id=>eligibleModel(this,id));this.clock.divisionLedger=result.state;
  for(const[id,u]of Object.entries(result.state.units)){const a=attributes(result.state.formal.templates[u.templateId],u);u.org=Math.min(u.org,a.paper.orgMax);}
  this.bindModels();refreshNetwork(this);this.version=result.receipt.version;this.match.matchRevision=this.version;this.receipts.set(req.id,{signature,result:result.receipt});return copy(result.receipt);
  }catch(error){this.restore(before,before.clock.paused);throw error;}
 }
 save(){const s=super.save();if(this.clock.divisionLedger){s.format=VERSION;s.divisionRules=VERSION;}return s;}
 restore(s,pause=true){if(s.format!==VERSION||s.divisionRules!==VERSION)throw Error('DIVISION_NEW_CAMPAIGN_SAVE_ONLY');receptionRates(s.clock.divisionLedger.receptionPolicy);validate(s.clock.divisionLedger);validateFormal(s.clock.divisionLedger);const adapted=copy(s);adapted.format=OLD_RULES.version;delete adapted.divisionRules;delete adapted.clock.divisionLedger;super.restore(adapted,pause);this.clock.divisionLedger=copy(s.clock.divisionLedger);this.clock.divisionLedger.receptionPolicy??=LEGACY_RECEPTION;this.clock.rules=VERSION;this.ruleOverride={...OLD_RULES,version:VERSION};this.simRules=this.ruleOverride;this.bindModels(true);this.clock.paused=pause;}
 snapshot(draft){const d=super.snapshot(draft),p=this.clock.divisionLedger;if(!p)return d;d.modern.products=copy(modelProducts);d.ux.products=copy(modelProducts);d.continuous.rules=VERSION;d.divisions.integrated={version:VERSION,reception:{policy:p.receptionPolicy??LEGACY_RECEPTION,...receptionRates(p.receptionPolicy)},policy:POLICY,combatPolicy:COMBAT_POLICY,xp:p.formal.xp[this.viewer],earnedMinutes:p.formal.earnedMinutes[this.viewer],templates:copy(Object.values(p.formal.templates).filter(t=>t.side===this.viewer)),units:copy(Object.values(p.units).filter(u=>u.side===this.viewer)),models:copy(reference.models),battalions:copy(reference.units)};
  for(const[id,v]of Object.entries(d.continuous.units)){v.division=this.divisionAttributes(id);v.divisionOrg=this.clock.units[id].org/100*v.division.paper.orgMax;}
  const m=d.continuous.map;m.actions=uniqueActions(m.actions??[]);
  for(const b of [...m.battles,...(m.history??[])])explainBattle(b);
  return d;
 }
}

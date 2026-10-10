import * as combined from '../grand-division-003/catalog.mjs';
import {fuelAdjusted,terrainModifier} from '../grand-division-003/attributes.mjs';
import {tempo,CURRENT_TEMPO} from './tempo.mjs';
import {Campaign as Previous,RULES as OLD_RULES} from '../grand-release-001/territory.mjs';
import {emptyDraft,transaction as draftTransaction} from '../grand-division-001/templates.mjs';

import {fairUnits} from '../grand-economy-002/planning.mjs';
import {cfg,products as legacyProducts} from '../grand-economy-002/config.mjs';
import {production,construction,ownership,dailySupply,refreshNetwork} from '../grand-economy-002/economy.mjs';
import {createInventory,validate,SCHEMA,cancelReservedFreight} from './inventory.mjs';
import {modelDemand,modelIds,reference,idsFor,referenceFor} from './model-demand.mjs';
import {initializeFormal,formalTransaction,earnExperience,validateFormal,POLICY} from './formal.mjs';
import {attributes,resolveContacts,COMBAT_POLICY} from './combat.mjs';
import {transport} from './freight.mjs';
import {transportProgress,FREIGHT_PROGRESS} from './freight-progress.mjs';
import {accrueReception,debitReception,freightPolicy,receptionRates,CURRENT_RECEPTION,LEGACY_RECEPTION} from './reception.mjs';
import {uniqueActions,explainBattle} from './presentation.mjs';
const copy=structuredClone,sides=['GERMAN','SOVIET'];
export const LEGACY_VERSION='GRAND-DIVISION-2-INTEGRATED-1';
export const PREVIOUS_VERSION='GRAND-DIVISION-2-INTEGRATED-2';
export const VERSION='GRAND-DIVISION-2-INTEGRATED-3';
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
  const profile=this.constructor.modelProfile,modelIds=idsFor(profile),templates={},units={},nations={};
  for(const side of sides){const t=emptyDraft();t.name=(side==='GERMAN'?'德军':'苏军')+'初始步兵营';t.regiments[0][0]='INFANTRY';Object.assign(t,{id:side+':initial-infantry',version:1,side,status:'FORMAL'});templates[t.id]=t;
   nations[side]={manpower:4800,stock:{infantry_equipment_1:0,support_equipment_1:0,TRAIN:this.econ.modern.nations[side].stock.TRAIN,TRUCK:this.econ.modern.nations[side].stock.TRUCK}};
   for(const u of Object.values(this.state.units).filter(u=>u.side===side)){units[u.id]={id:u.id,side,personnel:1000,held:{...Object.fromEntries(modelIds.map(k=>[k,0])),infantry_equipment_1:100},target:modelDemand(t,profile),revision:0,org:60,trainingExperience:0,templateId:t.id,templateVersion:1};u.type='INFANTRY';u.step=0;Object.assign(this.clock.units[u.id],{personnel:1000,max:1000,org:100,trainingExperience:0,losses:0});}
  }
  if(profile){for(const side of sides){const n=nations[side],trucks=n.stock.TRUCK;n.stock={...Object.fromEntries(modelIds.map(k=>[k,0])),TRAIN:n.stock.TRAIN,[combined.TRUCK]:trucks,FUEL:0};}}
  const p=createInventory({nations,units,...(profile?{profile}:{})});p.receptionPolicy=CURRENT_RECEPTION;p.tempo=CURRENT_TEMPO;p.freightProgress=FREIGHT_PROGRESS;p.id=this.id;initializeFormal(p,templates);p.formal.lastExperienceTick=this.clock.tick;p.lossFractions={};p.rateCredits={};this.clock.divisionLedger=p;
  const e=this.econ.modern;e.modelProducts=copy(this.constructor.modelProducts??modelProducts);e.lines={};if(profile){e.transportTruckModel=combined.TRUCK;p.fuel={version:1,units:{},consumed:{GERMAN:0,SOVIET:0},lost:{GERMAN:0,SOVIET:0}};}
  for(const side of sides){const factories=Object.values(e.facilities).filter(f=>f.kind==='MIL'&&this.state.hexes[f.hex].control===side).map(f=>f.id).sort();
   Object.keys(e.modelProducts).forEach((product,i)=>{e.lines[side+':'+product]={id:side+':'+product,side,product,factories:i<2?factories.filter((_,n)=>n%2===i):[],priority:i+1,efficiency:cfg.efficiencyStart,progress:0,completed:0,resourceFactor:1,workDay:0,missing:[],lostWork:0};});
   p.nations[side].produced.TRAIN=0;p.nations[side].produced.TRUCK=0;p.nations[side].lost.TRAIN=0;p.nations[side].lost.TRUCK=0;if(profile){delete p.nations[side].produced.TRUCK;delete p.nations[side].lost.TRUCK;p.nations[side].produced.FUEL=0;p.nations[side].lost.FUEL=0;}
  }
  for(const site of e.resourceSites){site.capacity.aluminium=1;if(profile)site.capacity.oil=1;}
  this.bindModels();this.clock.rules=this.constructor.rulesVersion??VERSION;this.ruleOverride={...OLD_RULES,version:this.clock.rules};this.simRules=this.ruleOverride;this.clock.paused=true;refreshNetwork(this);
 }
 bindModels(preserveOrg=false){const p=this.clock.divisionLedger;if(!p)return;const e=this.econ.modern;e.divisionDailyNeed={};this.attributeCache=new Map();
  for(const side of sides){const n=e.nations[side],x=p.nations[side];n.stock=x.stock;n.manpower=x.manpower;n.produced=x.produced;n.lost=x.lost;}
  for(const [id,u]of Object.entries(p.units)){const v=this.clock.units[id],g=this.econ.gear.units[id];if(p.profile){const line=p.formal.templates[u.templateId].regiments.flat().filter(Boolean);this.state.units[id].type=line.includes('LIGHT_ARMOR')?'TANK':line.every(x=>x==='MOTORIZED')?'MOTORIZED':line.every(x=>x==='ARTILLERY')?'ARTILLERY':'INFANTRY';}g.held=u.held;g.recipe=Object.fromEntries(Object.entries(u.target.equipment).map(([k,q])=>[k,q/g.base.maxDamageSteps]));e.establishment[id]=copy(u.target.equipment);e.lastPersonnel[id]=u.personnel;v.personnel=u.personnel;v.max=u.target.manpower;v.trainingExperience=u.trainingExperience;const a=this.divisionAttributes(id);if(!preserveOrg)v.org=u.org/Math.max(1,a.paper.orgMax)*100;e.divisionDailyNeed[id]=a.paper.supply;}
 }
 divisionAttributes(id){const p=this.clock.divisionLedger,u=p.units[id],t=p.formal.templates[u.templateId],signature=JSON.stringify([p.profile,p.tempo,u.templateId,u.templateVersion,u.personnel,u.held,p.fuel?.units[id]]);this.attributeCache??=new Map();const old=this.attributeCache.get(id);if(old?.signature===signature)return old.value;let value=attributes(t,u,p.profile);if(!p.profile)value.paper.speed=value.effective.speed=tempo(p.tempo).speed;else value=fuelAdjusted(value,p.fuel?.units[id]??0);this.attributeCache.set(id,{signature,value});return value;}
 capability(id){if(!this.clock?.divisionLedger)return super.capability(id);const a=this.divisionAttributes(id),v=this.clock.units[id],supply=v.dailySupply?.effective??1;return {org:v.org,stock:this.econ.supply[id].stock,fire:(a.effective.softAttack+(this.clock.divisionLedger.profile?(a.effective.hardAttack??0):0))*(.3+.7*supply),protection:a.effective.defense,armor:a.effective.armor,antiArmor:a.effective.piercing,mobility:this.clock.divisionLedger.profile?Math.max(.01,a.effective.speed/3):1,base:this.econ.gear.units[id].base.steps[0],division:a,divisionOrg:v.org/100*a.paper.orgMax};}
 decideAction(...args){const d=super.decideAction(...args);if(d.kind==='MARCH'&&this.clock.divisionLedger){const p=this.clock.divisionLedger;if(p.profile){const id=args[1].id,a=this.divisionAttributes(id);if(a.effective.speed<=0)return {kind:'REST',reason:'燃料不足，等待生产与配送'};const land=this.state.hexes[d.to.q+','+d.to.r]?.terrain;d.duration=Math.ceil(d.duration/Math.max(.1,1+terrainModifier(a,land,'movement')));}d.duration=Math.ceil(d.duration*tempo(p.tempo).march);}return d;}
 resolveDivisionCombat({battles,damage,orgDamage}){const stats=Object.fromEntries([...new Set(battles.flatMap(b=>b.units))].map(id=>{const a=copy(this.divisionAttributes(id)),s=this.clock.units[id].dailySupply?.effective??1;for(const k of ['softAttack','hardAttack','defense','breakthrough'])a.effective[k]*=.3+.7*s;return [id,a];})),r=resolveContacts({contacts:battles.map(b=>({...b,hex:b.hex.q+','+b.hex.r})),units:this.state.units,stats,random:()=>this.random(),tick:this.clock.tick,damageScale:tempo(this.clock.divisionLedger.tempo).damage,combined:!!this.clock.divisionLedger.profile,terrainFor:id=>this.state.hexes[this.state.units[id].hex.q+','+this.state.units[id].hex.r]?.terrain});
  for(const id of r.participating){this.clock.units[id].engaged++;this.spend(id,this.simRules.combatQ);}
  for(const[id,hp]of Object.entries(r.damage))damage[id]=hp/stats[id].paper.hp*this.clock.units[id].max;
  for(const[id,org]of Object.entries(r.orgDamage))orgDamage[id]=org/Math.max(1,stats[id].paper.orgMax)*100;
  for(const id of r.waiting)this.clock.units[id].reason='当前接触宽度已满，等待进入；没有提供额外火力';
  this.clock.divisionCombat={tick:this.clock.tick,participants:r.participating,waiting:r.waiting};
 }
 recordEquipmentLoss(){const p=this.clock.divisionLedger;if(!p)return super.recordEquipmentLoss();const modelIds=idsFor(p);
  for(const[id,u]of Object.entries(p.units)){const v=this.clock.units[id],n=p.nations[u.side],debt=p.lossFractions[id]??={personnel:0,...Object.fromEntries(modelIds.map(k=>[k,0]))},delta=Math.max(0,u.personnel-v.personnel);debt.personnel+=delta;const people=this.state.units[id].alive?Math.min(u.personnel,Math.floor(debt.personnel)):u.personnel;debt.personnel=this.state.units[id].alive?Math.max(0,debt.personnel-people):0;u.personnel-=people;n.personnelLost+=people;
   for(const k of modelIds){if(p.profile)debt[k]=(debt[k]??0)%1;if(p.profile&&u.held[k]===0){debt[k]=0;continue;}debt[k]+=u.target.equipment[k]*delta/u.target.manpower;const quantity=this.state.units[id].alive?Math.min(u.held[k],Math.floor(debt[k])):u.held[k];u.held[k]-=quantity;n.lost[k]+=quantity;debt[k]=this.state.units[id].alive&&(!p.profile||u.held[k]>0)?Math.max(0,debt[k]-quantity):0;}
   v.personnel=u.personnel;u.org=Math.min(this.divisionAttributes(id).paper.orgMax,v.org/100*this.divisionAttributes(id).paper.orgMax);if(people)u.revision++;
  }
 }
 economyStep(){const p=this.clock.divisionLedger;if(!p)return super.economyStep();const modelIds=idsFor(p);const e=this.econ.modern;if(e.settled>=this.clock.tick)throw Error('ECONOMY_TICK_ALREADY_SETTLED');production(this);construction(this);ownership(this);dailySupply(this);if(p.profile)p.vehicleCommitments=Object.fromEntries(sides.map(side=>[side,{[combined.TRUCK]:e.net[side].trucksUsed}]));
  for(const [id,u]of Object.entries(p.units))if(!this.state.units[id]?.alive)cancelReservedFreight(p,id);
  const hour=Math.floor(this.clock.tick/cfg.networkTicks);if(e.cargoHour?.hour!==hour)e.cargoHour={hour,sides:Object.fromEntries(sides.map(s=>[s,{train:0,edges:{},hubs:{},sources:{}}]))};
  for(const side of sides){const ordered=fairUnits(Object.values(this.state.units).filter(u=>u.side===side&&u.alive),u=>e.priorities[this.placements.find(x=>x.id===u.id)?.army]??3,this.clock.tick);
   for(const {id} of ordered){const u=p.units[id],v=this.clock.units[id],credits=p.rateCredits[id]??={personnel:0,...Object.fromEntries(modelIds.map(k=>[k,0]))},factor=v.engaged?cfg.combatReinforcement:v.march?cfg.marchReinforcement:1;
    // Progress may accumulate up to one dispatch, never bank unlimited catch-up.
    const reception=receptionRates(p.receptionPolicy),rates=accrueReception(credits,factor,reception,modelIds);
    const r=(p.freightProgress===FREIGHT_PROGRESS?transportProgress:transport)(p,id,{tick:this.clock.tick,destination:JSON.stringify(this.state.units[id].hex),network:e.net[side],rails:e.rails,cargo:e.cargoHour.sides[side],trainCapacity:p.nations[side].stock.TRAIN*cfg.trainWork,sourceCapacity:cfg.sourceFlow,railCapacity:cfg.railFlow,policy:p.profile?combined.freightPolicy:freightPolicy,rates});
    e.cargoHour.sides[side]=r.cargo;debitReception(credits,r,modelIds);v.personnel=u.personnel;v.max=u.target.manpower;v.refillStatus={personnel:r.personnel,items:r.equipment,inTransit:r.inTransit??[],reason:r.reason,personnelRateDay:reception.personnelDay*factor,equipmentRateDay:reception.equipmentDay*factor,tick:this.clock.tick};e.nations[side].personnelSent+=r.personnel;for(const k of modelIds)e.nations[side].reinforced[k]=(e.nations[side].reinforced[k]??0)+r.equipment[k];if(r.personnel||Object.values(r.equipment).some(Boolean))e.ledger.push({kind:'REFILLED',tick:this.clock.tick,side,unit:id,personnel:r.personnel,items:r.equipment});
   }
   e.nations[side].manpower=p.nations[side].manpower;
  }
  const involved=[...new Set((this.clock.divisionCombat?.participants??[]).map(id=>this.state.units[id].side))];earnExperience(p,{tick:this.clock.tick,minutes:5,participantSides:involved});
  for(const[id,u]of Object.entries(p.units))u.org=this.clock.units[id].org/100*this.divisionAttributes(id).paper.orgMax;
  p.settledTick=this.clock.tick;e.settled=this.clock.tick;this.econ.epoch=hour;this.state.turn=1+hour;validate(p);validateFormal(p);
 }
 transaction(req){if(req.operation?.type==='DIVISION_TEMPO'&&this.clock.divisionLedger?.profile)throw Error('COMBINED_TEMPO_FIXED');if(req.operation?.type==='DIVISION_TEMPO'){const signature=JSON.stringify(req),old=this.receipts.get(req.id);if(old){if(old.signature!==signature)throw Error('ID_REUSE_CONFLICT');return copy(old.result);}if(req.version!==this.version)throw Error('STALE_VERSION');if(!this.clock.paused||this.clock.ended)throw Error('TEMPO_REQUIRES_PAUSED_CAMPAIGN');if(req.operation.policy!==CURRENT_TEMPO)throw Error('UNSUPPORTED_DIVISION_TEMPO');this.clock.divisionLedger.tempo=CURRENT_TEMPO;this.clock.rules=VERSION;this.simRules=this.ruleOverride={...OLD_RULES,version:VERSION};this.attributeCache=new Map();this.version++;this.match.matchRevision=this.version;const result={ok:true,version:this.version,policy:CURRENT_TEMPO};this.receipts.set(req.id,{signature,result});return copy(result);}if(!req.operation?.type?.startsWith('DIVISION_FORMAL_')){try{return super.transaction(req);}catch(error){this.bindModels(true);throw error;}}if(this.clock.ended)throw Error('CAMPAIGN_FINISHED');
  const signature=JSON.stringify(req),prior=this.receipts.get(req.id);if(prior){if(prior.signature!==signature)throw Error('ID_REUSE_CONFLICT');return copy(prior.result);}
  if(req.version!==this.version)throw Error('STALE_VERSION');const before=this.checkpoint();try{const p=copy(this.clock.divisionLedger);p.version=this.version;
  for(const[id,u]of Object.entries(p.units))u.org=this.clock.units[id].org/100*this.divisionAttributes(id).paper.orgMax;
  const result=formalTransaction(p,{...req,operation:{...req.operation,type:req.operation.type.replace('DIVISION_','')}},this.viewer,id=>eligibleModel(this,id));this.clock.divisionLedger=result.state;
  for(const[id,u]of Object.entries(result.state.units)){const a=attributes(result.state.formal.templates[u.templateId],u,result.state.profile);u.org=Math.min(u.org,a.paper.orgMax);}
  this.bindModels();refreshNetwork(this);this.version=result.receipt.version;this.match.matchRevision=this.version;this.receipts.set(req.id,{signature,result:result.receipt});return copy(result.receipt);
  }catch(error){this.restore(before,before.clock.paused);throw error;}
 }
 save(){const s=super.save();if(this.clock.divisionLedger){s.format=this.clock.divisionLedger.tempo===CURRENT_TEMPO?VERSION:this.clock.divisionLedger.freightProgress?PREVIOUS_VERSION:LEGACY_VERSION;if(this.clock.divisionLedger.profile)s.format=this.constructor.rulesVersion;s.divisionRules=s.format;}return s;}
 restore(s,pause=true){const combinedSave=s.format===this.constructor.rulesVersion&&!!this.constructor.modelProfile;if(s.clock.divisionLedger?.profile!==(combinedSave?this.constructor.modelProfile:undefined))throw Error('DIVISION_PROFILE_SAVE_MISMATCH');tempo(s.clock.divisionLedger?.tempo);if(s.format===VERSION&&s.clock.divisionLedger?.tempo!==CURRENT_TEMPO)throw Error('TEMPO_SAVE_MISMATCH');if(!combinedSave&&![VERSION,PREVIOUS_VERSION,LEGACY_VERSION].includes(s.format)||s.divisionRules!==s.format||s.format===LEGACY_VERSION&&s.clock.divisionLedger?.freightProgress)throw Error('DIVISION_NEW_CAMPAIGN_SAVE_ONLY');if(s.clock.divisionLedger.freightProgress&&s.clock.divisionLedger.freightProgress!==FREIGHT_PROGRESS)throw Error('UNSUPPORTED_FREIGHT_PROGRESS');receptionRates(s.clock.divisionLedger.receptionPolicy);validate(s.clock.divisionLedger);validateFormal(s.clock.divisionLedger);const adapted=copy(s);adapted.format=OLD_RULES.version;delete adapted.divisionRules;delete adapted.clock.divisionLedger;super.restore(adapted,pause);this.clock.divisionLedger=copy(s.clock.divisionLedger);this.clock.divisionLedger.receptionPolicy??=LEGACY_RECEPTION;this.clock.rules=s.format;this.ruleOverride={...OLD_RULES,version:s.format};this.simRules=this.ruleOverride;this.bindModels(true);this.clock.paused=pause;}
 snapshot(draft){const d=super.snapshot(draft),p=this.clock.divisionLedger;if(!p)return d;d.modern.products=copy(this.econ.modern.modelProducts);d.ux.products=copy(this.econ.modern.modelProducts);d.continuous.rules=this.clock.rules;d.divisions.integrated={version:this.clock.rules,profile:p.profile??null,tempo:tempo(p.tempo),reception:{policy:p.receptionPolicy??LEGACY_RECEPTION,...receptionRates(p.receptionPolicy)},policy:POLICY,combatPolicy:p.profile?'DIVISION-003-COMBAT-ADAPTATION-1':COMBAT_POLICY,xp:p.formal.xp[this.viewer],earnedMinutes:p.formal.earnedMinutes[this.viewer],templates:copy(Object.values(p.formal.templates).filter(t=>t.side===this.viewer)),units:copy(Object.values(p.units).filter(u=>u.side===this.viewer)),freightProgress:p.freightProgress??null,inTransit:copy(Object.values(p.freightReservations??{}).filter(r=>r.side===this.viewer)),models:copy(referenceFor(p).models),battalions:copy(referenceFor(p).units),catalog:p.profile?copy(combined.reference):null};
  for(const[id,v]of Object.entries(d.continuous.units)){v.division=this.divisionAttributes(id);v.divisionOrg=this.clock.units[id].org/100*v.division.paper.orgMax;}
  const m=d.continuous.map;m.actions=uniqueActions(m.actions??[]);
  for(const b of [...m.battles,...(m.history??[])])explainBattle(b);
  return d;
 }
}

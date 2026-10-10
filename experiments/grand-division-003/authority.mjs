import {Campaign as Previous,eligibleModel} from '../grand-division-002/authority.mjs';
import {formalTransaction} from '../grand-division-002/formal.mjs';
import {attributes} from '../grand-division-002/combat.mjs';
import {refreshNetwork} from '../grand-economy-002/economy.mjs';
import {products as legacyProducts} from '../grand-economy-002/config.mjs';
import {PROFILE,reference,TRUCK,TANK} from './catalog.mjs';
import {settleFuel,clampFuel,validateFuel} from './fuel.mjs';
export const VERSION='GRAND-DIVISION-3-COMBINED-1';
const labels={infantry_equipment_1:'步兵装备Ⅰ',support_equipment_1:'支援装备Ⅰ',artillery_equipment_1:'火炮Ⅰ',motorized_equipment_1:'卡车Ⅰ',leichttraktor_lt0:'轻型坦克 LT-0'};
export const modelProducts={...Object.fromEntries(Object.entries(reference.models).map(([id,m])=>[id,{label:labels[id]+'（件）',cost:m.cost,resources:{...m.archetypeResources,...m.modelResources}}])),TRAIN:legacyProducts.TRAIN,FUEL:{label:'燃料（单位）',cost:.5,resources:{oil:1}}};
export class Campaign extends Previous{
 static newCampaignClass=Campaign;static modelProfile=PROFILE;static rulesVersion=VERSION;static modelProducts=modelProducts;
 constructor(){super();this.clock.divisionLedger.combinedAI={lastDay:-1,sequence:0,units:[],records:[]};this.updateFuelDemand();}
 updateFuelDemand(){const e=this.econ.modern,p=this.clock.divisionLedger;e.fuelDemand={GERMAN:0,SOVIET:0};for(const[id,u]of Object.entries(p.units))if(this.state.units[id].alive)e.fuelDemand[u.side]+=Math.max(0,this.divisionAttributes(id).effective.fuelHour*12-(p.fuel.units[id]??0));}
 restOrgRate(id){return this.divisionAttributes(id).paper.orgMax>0?super.restOrgRate(id):0;}
 advance(){for(const[id,v]of Object.entries(this.clock.units))if(this.divisionAttributes(id).paper.orgMax<=0)v.org=0;const p=this.clock.divisionLedger;this.fuelActive=new Set();this.acceptedSpeeds=new Map();for(const[id,w]of Object.entries(this.clock.tactical?.withdrawals??{}))if(!w.blockedSignature)this.fuelActive.add(id);
  for(const[id,v]of Object.entries(this.clock.units)){if(v.march){this.fuelActive.add(id);const speed=this.divisionAttributes(id).effective.speed;v.march.acceptedSpeed??=speed;const ratio=v.march.acceptedSpeed>0?Math.min(1,speed/v.march.acceptedSpeed):0;v.march.remaining+=1-ratio;if(!ratio)v.reason='燃料不足，当前行军暂停，等待配送';}}
  super.advance();for(const[id,v]of Object.entries(this.clock.units))if(this.divisionAttributes(id).paper.orgMax<=0)v.org=0;for(const[id,v]of Object.entries(this.clock.units))if(v.march)v.march.acceptedSpeed??=this.acceptedSpeeds.get(id)??this.divisionAttributes(id).paper.speed;
 }
 decideAction(...args){const d=super.decideAction(...args);if(d.kind==='MARCH')this.acceptedSpeeds?.set(args[1].id,this.divisionAttributes(args[1].id).effective.speed);return d;}
 economyStep(){super.economyStep();settleFuel(this,this.fuelActive??new Set());this.updateFuelDemand();}
 transaction(req){const r=super.transaction(req);if(req.operation?.type==='DIVISION_FORMAL_ADOPT'){clampFuel(this,{unit:req.operation.unit,returning:true});this.updateFuelDemand();validateFuel(this);}return r;}
 enemyPlan(view){super.enemyPlan(view);const p=this.clock.divisionLedger,a=p?.combinedAI;if(!a)return;const day=Math.floor(this.clock.tick/288);if(day===a.lastDay||p.formal.xp.SOVIET<5)return;
  // Bounded adoption only from own authorized units. The existing manager sees
  // resulting deficits and pays real factories/inputs; no inventory or XP injection.
  const unit=view.units.filter(u=>u.side==='SOVIET'&&u.alive!==false&&!a.units.includes(u.id)).sort((x,y)=>x.id.localeCompare(y.id)).find(u=>{try{eligibleModel(this,u.id);return true;}catch{return false;}});
  if(!unit||!Object.values(this.econ.modern.facilities).some(f=>f.kind==='MIL'&&view.hexes.some(h=>h.control==='SOVIET'&&h.coord.q+','+h.coord.r===f.hex)))return;
  const u=p.units[unit.id],base=p.formal.templates[u.templateId],draft=structuredClone(base),kind=['ARTILLERY','MOTORIZED','LIGHT_ARMOR'][a.sequence%3];draft.name='合成试编 '+kind;
  if(kind==='MOTORIZED')draft.regiments[0][0]=kind;else draft.regiments[1][0]=kind;
  // Reuse the same formal validation, fee and return transaction as the player.
  try{p.version=this.version;const saved=formalTransaction(p,{id:`ai-formal-${this.clock.tick}-${unit.id}`,version:p.version,operation:{type:'FORMAL_SAVE',baseId:base.id,expectedBaseVersion:base.version,draft}},'SOVIET',id=>eligibleModel(this,id));
   const adopted=formalTransaction(saved.state,{id:`ai-adopt-${this.clock.tick}-${unit.id}`,version:saved.state.version,operation:{type:'FORMAL_ADOPT',unit:unit.id,expectedUnitRevision:u.revision,templateId:saved.receipt.templateId,expectedTemplateVersion:1}},'SOVIET',id=>eligibleModel(this,id));
   this.clock.divisionLedger=adopted.state;const next=adopted.state.combinedAI;next.lastDay=day;next.sequence++;next.units.push(unit.id);next.records.push({tick:this.clock.tick,unit:unit.id,kind,paidXP:saved.receipt.paidXP});next.records=next.records.slice(-30);
   const changed=adopted.state.units[unit.id];changed.org=Math.min(changed.org,attributes(adopted.state.formal.templates[changed.templateId],changed,PROFILE).paper.orgMax);this.bindModels();clampFuel(this,{unit:unit.id,returning:true});this.updateFuelDemand();refreshNetwork(this);
  }catch(error){a.lastReason=error.message;}
 }
 restore(s,pause=true){if(s.format!==VERSION||s.clock?.divisionLedger?.profile!==PROFILE)throw Error('COMBINED_SAVE_ONLY');super.restore(s,pause);validateFuel(this);this.updateFuelDemand();}
 snapshot(draft){const d=super.snapshot(draft);d.divisions.integrated.fuel={...structuredClone(this.clock.divisionLedger.fuel),units:Object.fromEntries(Object.entries(this.clock.divisionLedger.fuel.units).filter(([id])=>this.state.units[id].side===this.viewer))};delete d.divisions.integrated.fuel.consumed;delete d.divisions.integrated.fuel.lost;d.divisions.integrated.scope='多兵种项目适配：步兵、工兵、侦察、炮兵、摩托及固定LT-0；非完整原版复刻';return d;}
}

import {Campaign as Previous} from '../grand-division-003/authority.mjs';
import {reference,PROFILE,products} from './catalog.mjs';
import {VERSION,cfg,freightPolicy,reserve} from './config.mjs';
import {resolve} from './combat.mjs';
import {transport} from './freight.mjs';
import {modelDemand} from '../grand-division-002/model-demand.mjs';
import {totals,validate} from '../grand-division-002/inventory.mjs';
import {validateFormal} from '../grand-division-002/formal.mjs';
import {validateFuel} from '../grand-division-003/fuel.mjs';
import {production,refreshNetwork} from '../grand-economy-002/economy.mjs';
import {travel} from '../grand-play-001/planner.mjs';
import {canonicalEdgeKey} from '../../vendor/eastfront-digital-core/dist/index.js';
export class Campaign extends Previous{
 static newCampaignClass=Campaign;static modelProfile=PROFILE;static rulesVersion=VERSION;static modelProducts=products;static freightPolicy=freightPolicy;static transport=transport;static aiKinds=['ANTI_TANK','ARTILLERY','MOTORIZED','LIGHT_ARMOR'];
 constructor(){
  super();const p=this.clock.divisionLedger,e=this.econ.modern;
  e.balanceConfig=structuredClone(cfg);p.receptionPolicy='BLACKICE-RECEPTION-1';p.balance={version:VERSION,wear:{},initialManifest:{},source:'649a5410d9ea527a4f1618b58060f7cb9033f781'};
  const templates={};
  for(const side of ['GERMAN','SOVIET']){
   const old=p.formal.templates[side+':initial-infantry'],roles=[['INFANTRY','INFANTRY'],['INFANTRY','ARTILLERY'],['INFANTRY','ANTI_TANK'],['MOTORIZED'],['MOTORIZED','LIGHT_ARMOR']];
   roles.forEach((role,i)=>{const t=structuredClone(old);t.id=side+':blackice:'+i;t.name=['步兵战斗群','步炮战斗群','反坦克守备群','摩托步兵营','轻装甲战斗群'][i];t.regiments=t.regiments.map(c=>c.map(()=>null));role.forEach((id,k)=>t.regiments[k][0]=id);templates[t.id]=t;});
   Object.values(p.units).filter(u=>u.side===side).sort((a,b)=>a.id.localeCompare(b.id)).forEach((u,i)=>{
    // One specialist of each role per 12 formations; others infantry. No extra IDs.
    const role=i%12<4?i%12+1:0,t=templates[side+':blackice:'+role];
    u.templateId=t.id;u.target=modelDemand(t,PROFILE);u.personnel=u.target.manpower;u.held=structuredClone(u.target.equipment);u.org=30;u.trainingExperience=0;
    p.balance.initialManifest[u.id]={template:t.id,personnel:u.personnel,equipment:structuredClone(u.held),hex:structuredClone(this.state.units[u.id].hex)};
   });
   p.nations[side].stock=structuredClone(reserve);p.nations[side].manpower=4800;
   const lines=Object.values(e.lines).filter(l=>l.side===side),factories=lines.flatMap(l=>l.factories).sort();
   for(const l of lines){l.factories=[];l.efficiency=.3;}
   for(const [i,f]of factories.entries()){const product=['infantry_equipment_1','artillery_equipment_1','FUEL'][i%3];e.lines[side+':'+product].factories.push(f);}
  }
  p.formal.templates=templates;p.initial=totals(p);this.bindModels();for(const[id,u]of Object.entries(p.units)){u.org=Math.min(u.org,this.divisionAttributes(id).paper.orgMax);this.clock.units[id].org=u.org/this.divisionAttributes(id).paper.orgMax*100;}
  this.updateFuelDemand();production(this,false);refreshNetwork(this);validate(p);validateFormal(p);validateFuel(this);
 }
 capability(id){const cap=super.capability(id);if(this.clock?.divisionLedger?.profile===PROFILE)cap.physicalSpeed=cap.division.effective.speed*(.5+.5*(this.clock.units[id].dailySupply?.effective??1));return cap;}
 decideAction(...args){const d=super.decideAction(...args);if(d.kind==='MARCH'&&this.clock.divisionLedger?.profile===PROFILE){d.duration=travel(args[0],args[1].hex,d.to,this.capability(args[1].id));if(!Number.isFinite(d.duration))return {kind:'REST',reason:'缺油或已知交通中断，不能开始行军'};}return d;}
 restOrgRate(id){if(this.clock?.divisionLedger?.profile!==PROFILE)return super.restOrgRate(id);return .25*(this.clock.units[id].dailySupply?.effective??1);}
 advance(){
  const works=this.clock.divisionLedger.balance.works??={};
  for(const[id,v]of Object.entries(this.clock.units)){const hex=JSON.stringify(this.state.units[id].hex),old=works[id];if(!old||old.hex!==hex||v.march||this.clock.tactical?.withdrawals?.[id])works[id]={hex,ticks:0};else if(!v.engaged)old.ticks=Math.min(288,old.ticks+1);}
  for(const[id,w]of Object.entries(this.clock.tactical?.withdrawals??{})){if(w.blockedSignature)continue;const speed=this.capability(id).physicalSpeed;w.acceptedPhysicalSpeed??=speed;const ratio=w.acceptedPhysicalSpeed>0?Math.min(1,speed/w.acceptedPhysicalSpeed):0;w.remaining+=1-ratio;}
  super.advance();
  for(const[id,v]of Object.entries(this.clock.units))if(v.march&&!v.engaged){v.org=Math.max(0,v.org-.1);this.clock.divisionLedger.units[id].org=v.org/100*this.divisionAttributes(id).paper.orgMax;}
 }
 resolveDivisionCombat({battles,damage,orgDamage}){
  const stats={};for(const id of new Set(battles.flatMap(b=>b.units))){const a=structuredClone(this.divisionAttributes(id)),s=this.clock.units[id].dailySupply?.effective??1;for(const k of ['softAttack','hardAttack','defense','breakthrough'])a.effective[k]*=.3+.7*s;stats[id]=a;}
  const result=resolve({contacts:battles,units:this.state.units,stats,random:()=>this.random(),tick:this.clock.tick,
   ground:(target,source)=>{const a=this.state.units[source].hex,b=this.state.units[target].hex;return {terrain:this.state.hexes[b.q+','+b.r]?.terrain,river:this.state.edges[canonicalEdgeKey(a,b)]?.river};},
   fortification:id=>Math.min(1,(this.state.units[id].entrenched?(this.clock.divisionLedger.balance.works?.[id]?.ticks??0):0)/288)*(.1+.05*(stats[id].components.find(c=>c.id==='ENGINEER')?.satisfaction??0))});
  for(const id of result.participating){this.clock.units[id].engaged++;this.spend(id,this.simRules.combatQ);}
  for(const[id,hp]of Object.entries(result.damage))damage[id]=hp/Math.max(1,stats[id].paper.hp)*this.clock.units[id].max;
  for(const[id,org]of Object.entries(result.orgDamage))orgDamage[id]=org/Math.max(1,stats[id].paper.orgMax)*100;
  for(const id of result.waiting)this.clock.units[id].reason='接触宽度不足，等待；未贡献火力';
  this.clock.divisionCombat={tick:this.clock.tick,participants:result.participating,waiting:result.waiting};
 }
 economyStep(){
  super.economyStep();const p=this.clock.divisionLedger;if(!p.balance)return;
  for(const[id,u]of Object.entries(p.units)){
   const v=this.clock.units[id],exposure=v.engaged?.008:v.march?.004:0;
   if(!this.state.units[id].alive||!exposure)continue;
   const debt=p.balance.wear[id]??={};
   for(const[k,q]of Object.entries(u.held)){const m=reference.models[k],reliability=m.modelFields.reliability??m.archetypeFields.reliability??.8;debt[k]=(debt[k]??0)+q*(1-reliability)*exposure/288;const lost=Math.min(q,Math.floor(debt[k]));if(lost){u.held[k]-=lost;p.nations[u.side].lost[k]+=lost;debt[k]-=lost;}}
  }
  validate(p);
 }
 restore(s,pause=true){if(s.clock?.divisionLedger?.balance?.version!==VERSION)throw Error('BLACKICE_NEW_CAMPAIGN_REQUIRED');if(JSON.stringify(s.econ?.modern?.balanceConfig)!==JSON.stringify(cfg))throw Error('BLACKICE_CONFIG_MISMATCH');super.restore(s,pause);}
 snapshot(draft){const d=super.snapshot(draft),f=d.divisions.integrated;d.modern.config=structuredClone(cfg);f.scope='黑冰方向实验：营级战斗群／10公里格／共享吨位；不是BICE完整复刻';f.combatPolicy=VERSION;f.balance={version:VERSION,supplyUnit:'吨/小时',fuelUnit:'100升',factory:'一个军厂=10个作坊当量',warnings:['工兵可降低渡河惩罚并加强渐进工事；侦察不扩大视野','未接入动态天气、历史国家学说、完整科技与马匹制服生产']};
  d.divisions.demandReference={...d.divisions.demandReference,units:Object.fromEntries(Object.entries(reference.units).map(([id,u])=>[id,{...u,equipment:structuredClone(u.need)}]))};
  f.inTransit.push(...structuredClone((this.clock.divisionLedger.balance.transit??[]).filter(x=>x.side===this.viewer)));
  for(const [id,v]of Object.entries(d.continuous.units)){const incoming=f.inTransit.filter(x=>x.unit===id&&x.arrival);if(incoming.length&&v.refillStatus)v.refillStatus.reason+='；最早在 '+Math.max(0,(Math.min(...incoming.map(x=>x.arrival))-this.clock.tick)*5)+' 游戏分钟后抵达（路线须保持）';}
  for(const b of [...d.continuous.map.battles,...(d.continuous.map.history??[])]){b.winEstimate={percent:null,reason:'新数值未校准胜率；显示真实交战损耗与趋势，不提供保证胜率'};}
  return d;}
}

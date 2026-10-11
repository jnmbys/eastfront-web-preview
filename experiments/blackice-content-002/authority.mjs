import assert from 'node:assert/strict';
import {Campaign as R1} from '../blackice-001/r1-campaign.mjs';
import {modelDemand} from '../grand-division-002/model-demand.mjs';
import {totals,validate} from '../grand-division-002/inventory.mjs';
import {validateFormal} from '../grand-division-002/formal.mjs';
import {refreshNetwork} from '../grand-economy-002/economy.mjs';
export const VERSION='BLACKICE-CONTENT-002-1941-1';
export class Campaign extends R1 {
 static newCampaignClass=Campaign;static rulesVersion=VERSION;
 constructor(){
  super();const p=this.clock.divisionLedger,before=totals(p),templates=p.formal.templates;
  const labels={GERMAN:['步兵守备群','步炮协同群','反坦克支点群','摩托先遣营','轻装甲协同群'],SOVIET:['步兵战斗群','步炮分队','反坦克分队','摩托步兵营','轻装甲混成群']};
  for(const side of Object.keys(labels))labels[side].forEach((name,i)=>templates[side+':blackice:'+i].name=name);
  const make=(suffix,name,composition)=>{
   const t=structuredClone(templates['SOVIET:blackice:0']);t.id='SOVIET:content002:'+suffix;t.name=name;t.regiments=t.regiments.map(c=>c.map(()=>null));
   const columns=new Map();for(const kind of composition){if(!columns.has(kind))columns.set(kind,columns.size);const col=t.regiments[columns.get(kind)];col[col.findIndex(x=>!x)]=kind;}
   templates[t.id]=t;return t.id;
  };
  const massed=make('fire','集中炮兵战斗群',['INFANTRY','ARTILLERY','ARTILLERY']);
  const mobile=make('mobile','摩托化重编组',['MOTORIZED','MOTORIZED','LIGHT_ARMOR']);
  const light=make('screen','步兵警戒分队',['INFANTRY']);
  const assignments={'S-013':massed,'S-037':'SOVIET:blackice:0','S-019':light,'S-018':mobile,'S-041':light,'S-020':light};
  for(const[id,templateId]of Object.entries(assignments)){const u=p.units[id],t=templates[templateId];u.templateId=templateId;u.templateVersion=t.version;u.target=modelDemand(t,p.profile);u.personnel=u.target.manpower;u.held=structuredClone(u.target.equipment);}
  // Scenario construction redistributes existing battalions only. Never a restore path.
  assert.deepEqual(totals(p),before,'SCENARIO_MUST_NOT_CREATE_PERSONNEL_OR_EQUIPMENT');
  this.attributeCache?.clear();this.bindModels();
  for(const[id,u]of Object.entries(p.units)){u.org=Math.min(u.org,this.divisionAttributes(id).paper.orgMax);this.clock.units[id].org=u.org/this.divisionAttributes(id).paper.orgMax*100;p.balance.initialManifest[id]={template:u.templateId,personnel:u.personnel,equipment:structuredClone(u.held),hex:structuredClone(this.state.units[id].hex)};}
  p.balance.scenario={id:VERSION,date:'1941-07-01',basis:'有限战区编组实验，不是历史战斗序列；总人员与各型装备不增发'};
  this.updateFuelDemand();refreshNetwork(this);validate(p);validateFormal(p);
 }
 restore(s,pause=true){if(s.clock?.divisionLedger?.balance?.scenario?.id!==VERSION)throw Error('CONTENT002_NEW_SCENARIO_REQUIRED');super.restore(s,pause);}
}

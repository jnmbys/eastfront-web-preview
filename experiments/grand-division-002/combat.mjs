import {reference,modelDemand} from './model-demand.mjs';
// Leader-approved project continuous-time adaptation. NOT the HOI4 battle engine.
export const COMBAT_POLICY='DIVISION-002-COMBAT-ADAPTATION-1';
const weapon={...reference.models.infantry_equipment_1.archetypeFields,...reference.models.infantry_equipment_1.modelFields};
export function attributes(template,actual){
 const demand=modelDemand(template),ids=[...template.regiments.flat(),...template.support].filter(Boolean);
 const paper={orgMax:0,hp:0,width:0,supply:0,softAttack:0,hardAttack:0,defense:0,breakthrough:0,armor:0,piercing:weapon.ap_attack,speed:4};
 const effective={softAttack:0,hardAttack:0,defense:0,breakthrough:0},components=[];
 // Pro-rata assignment within this unit: never count the same rifles once per battalion.
 const people=Math.min(1,actual.personnel/demand.manpower),ratio=k=>Math.min(1,(actual.held[k]??0)/(demand.equipment[k]||1));
 for(const id of ids){const u=reference.units[id],a=u.scalarDefinitions;
  paper.orgMax+=a.max_organisation;paper.hp+=a.max_strength;paper.width+=a.combat_width;paper.supply+=a.supply_consumption;
  const served=Math.max(0,Math.min(people,...Object.keys(u.need).map(k=>ratio(k+'_1'))));
  const contribution={id,personnelRatio:people,equipmentRatios:Object.fromEntries(Object.keys(u.need).map(k=>[k+'_1',ratio(k+'_1')])),satisfaction:served,orgTerm:a.max_organisation,orgWeight:1/ids.length,paper:{},effective:{}};
  for(const[k,source]of [['softAttack','soft_attack'],['hardAttack','hard_attack'],['defense','defense'],['breakthrough','breakthrough']]){const n=weapon[source]*(1+(a[source]??0));paper[k]+=n;effective[k]+=n*served;contribution.paper[k]=n;contribution.effective[k]=n*served;}
  components.push(contribution);
 }
 paper.orgMax/=ids.length;
 return {policy:COMBAT_POLICY,paper,effective:{...paper,...effective},components,personnelRatio:people,equipmentRatios:Object.fromEntries(Object.keys(demand.equipment).map(k=>[k,ratio(k)]))};
}
/** Simultaneous contact resolution; each participant's fire budget is used once.
 * Caller supplies actual accepted contacts, authoritative random draws and unit data.
 * No future prediction and no query exposed to policy clients.
 */
export function resolveContacts({contacts,units,stats,random,minutes=5,tick=0,damageScale=1}){
 const groups=new Map();for(const c of contacts){const g=groups.get(c.hex)??{ids:new Set(),pairs:[]};g.pairs.push(c);for(const id of c.units)g.ids.add(id);groups.set(c.hex,g);}
 const participating=new Set(),waiting=new Set(),accepted=[];
 for(const [hex,g]of [...groups].sort(([a],[b])=>a.localeCompare(b))){
  const chosen=new Set();
  for(const side of ['GERMAN','SOVIET']){let width=0;const list=[...g.ids].filter(id=>units[id].side===side&&!participating.has(id)).sort();const offset=list.length?tick%list.length:0;
   for(const id of [...list.slice(offset),...list.slice(0,offset)]){const w=stats[id].paper.width;if(width+w<=60){width+=w;chosen.add(id);}else waiting.add(id);}}
  const pairs=g.pairs.filter(c=>c.units.every(id=>chosen.has(id)));
  for(const c of pairs){accepted.push(c);for(const id of c.units)participating.add(id);}
 }
 const opponents=new Map(),attacking=new Set();for(const c of accepted){for(const id of c.initiators??[])attacking.add(id);const[a,b]=c.units;for(const[id,other]of [[a,b],[b,a]]){const set=opponents.get(id)??new Set();set.add(other);opponents.set(id,set);}}
 const damage={},orgDamage={},traces=[];
 for(const id of [...opponents.keys()].sort()){const targets=[...opponents.get(id)].sort(),a=stats[id].effective;
  for(const target of targets){const d=stats[target].effective,attack=a.softAttack/targets.length,defense=(attacking.has(target)?d.breakthrough:d.defense)/Math.max(1,opponents.get(target).size),hits=(Math.min(attack,defense)*.1+Math.max(0,attack-defense)*.4)*minutes/60;
   const hp=hits*damageScale*.06*(1+Math.floor(random()*2)),org=hits*damageScale*.053*(1+Math.floor(random()*4));damage[target]=(damage[target]??0)+hp;orgDamage[target]=(orgDamage[target]??0)+org;traces.push({source:id,target,hits,hp,org});
  }
 }
 return {damage,orgDamage,participating:[...participating].sort(),waiting:[...waiting].sort(),traces};
}

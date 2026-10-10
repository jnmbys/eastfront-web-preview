import fs from 'node:fs';
const load=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const old=load('../grand-division-002/model-reference.json'),facts=load('./reference.json');
export const PROFILE='DIVISION-003-COMBINED-1';
export const TRUCK='motorized_equipment_1',TANK='leichttraktor_lt0';
export const families={INFANTRY:'infantry',ARTILLERY:'combat_support',MOTORIZED:'mobile',LIGHT_ARMOR:'armor'};
export const supportIds=['ENGINEER','RECON','SUPPORT_ARTILLERY'];
export const mapping={infantry_equipment:'infantry_equipment_1',support_equipment:'support_equipment_1',artillery_equipment:'artillery_equipment_1',motorized_equipment:TRUCK,light_tank_chassis:TANK};
// Approved project composition order, not a claimed observation of the original engine.
export function completeTank(t){
 const n={...t.chassisBase.scalar,...t.chassisConcrete.scalar},multiply={};
 const add=(x,count=1)=>{for(const[k,v]of Object.entries(x.add_stats??{}))n[k]=(n[k]??0)+v*count;for(const[k,v]of Object.entries(x.scalar??{}))n[k]=(n[k]??0)+v*count;for(const[k,v]of Object.entries(x.multiply_stats??{}))multiply[k]=(multiply[k]??0)+v*count;};
 for(const m of Object.values(t.modules))add(m);
 for(const[k,level]of Object.entries(t.upgradeLevels))add(t.upgrades[k],level);
 for(const[k,v]of Object.entries(multiply))n[k]=(n[k]??0)*(1+v);
 return n;
}
export const reference=structuredClone(old);
for(const[id,m]of Object.entries(facts.models)){const data={...m.base.scalar,...m.concrete.scalar};reference.models[id]={archetype:m.archetype,archetypeFields:m.base.scalar,modelFields:m.concrete.scalar,cost:data.build_cost_ic,archetypeResources:m.base.resources,modelResources:m.concrete.resources??{},source:m.source,unit:'piece'};}
const tank=completeTank(facts.tank);
reference.models[TANK]={archetype:'light_tank_chassis',archetypeFields:tank,modelFields:{},cost:tank.build_cost_ic,archetypeResources:facts.tank.chassisBase.resources,modelResources:{},source:facts.tank.source,unit:'piece',completeVariant:structuredClone(facts.tank),aggregation:'Approved project additive then summed multiplicative modifiers; not runtime-verified HOI4 totals'};
for(const[id,u]of Object.entries(facts.units))reference.units[id]={manpower:u.manpower,need:u.need,scalarDefinitions:u.stats.scalar,terrain:u.terrain,source:u.source,group:u.group};
reference.profile=PROFILE;reference.mapping=mapping;reference.families=families;reference.supportIds=supportIds;
reference.qualification={kind:'explicit-project-scenario',lineRows:4,columns:5,supportSlots:5,regimentalSupport:false,technologyTree:false};
export const modelIds=Object.freeze(Object.keys(reference.models));
export const freightPolicy={personnel:1/50,infantry_equipment_1:1/100,support_equipment_1:1/25,artillery_equipment_1:1/25,[TRUCK]:1/25,[TANK]:1/10};
export function demand(t){
 if(!Array.isArray(t.regiments)||t.regiments.length!==5||t.regiments.some(c=>!Array.isArray(c)||c.length!==5)||!Array.isArray(t.support)||t.support.length!==5)throw Error('MODEL_SLOT_SHAPE');
 if(t.regiments.some(c=>c[4]))throw Error('MODEL_FIFTH_ROW_UNVERIFIED');
 for(const c of t.regiments){const ids=c.filter(Boolean);if(ids.some(id=>!families[id]))throw Error('MODEL_LINE_NOT_ENABLED');if(new Set(ids.map(id=>families[id])).size>1)throw Error('MODEL_REGIMENT_FAMILY_MISMATCH');}
 const support=t.support.filter(Boolean);if(support.some(id=>!supportIds.includes(id)))throw Error('MODEL_SUPPORT_NOT_ENABLED');if(new Set(support).size!==support.length)throw Error('MODEL_DUPLICATE_SUPPORT');
 const line=t.regiments.flat().filter(Boolean);if(!line.length)throw Error('MODEL_LINE_REQUIRED');
 const equipment=Object.fromEntries(modelIds.map(k=>[k,0]));let manpower=0;
 for(const id of [...line,...support]){const u=reference.units[id];manpower+=u.manpower;for(const[k,q]of Object.entries(u.need)){const model=mapping[k];if(!model)throw Error('MODEL_MAPPING_MISSING');equipment[model]+=q;}}
 return {manpower,equipment};
}

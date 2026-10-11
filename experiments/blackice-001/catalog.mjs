import {reference as previous} from '../grand-division-003/catalog.mjs';
export const PROFILE='BLACKICE-001-CATALOG-1',AT='anti_tank_equipment_2';
export const reference=structuredClone(previous);
Object.assign(reference,{profile:PROFILE,speedScale:1,footSpeed:4,orgByManpower:true,armorHighestWeight:.225});
const source='BICE 649a5410d9ea527a4f1618b58060f7cb9033f781';
function model(id,cost,fields,resources,file){reference.models[id]={archetype:id.replace(/_\d+$/,''),cost,archetypeFields:{maximum_speed:4,hardness:0,armor_value:0,...fields},modelFields:{},archetypeResources:resources,modelResources:{},unit:'piece',source:source+' '+file};}
model('infantry_equipment_1',.48,{soft_attack:1.4,hard_attack:.5,defense:2,breakthrough:.4,ap_attack:.5,reliability:.8},{steel:2},'common/units/equipment/infantry.txt:124-147');
model('artillery_equipment_1',6,{soft_attack:10.5,hard_attack:.525,defense:1.5,breakthrough:3,ap_attack:2,reliability:.35},{steel:3},'common/units/equipment/artillery.txt:206-237; special production resource omitted');
model(AT,4.5,{soft_attack:2.5,hard_attack:8.5,defense:1.5,breakthrough:0,ap_attack:27,reliability:.5},{steel:2,tungsten:1},'common/units/equipment/anti_tank.txt model 2; special resource omitted');
// Explicitly retain the already-complete LT-0 variant, not an invented BICE tank.
Object.assign(reference.models.motorized_equipment_1,{cost:5,archetypeResources:{steel:3,rubber:1},modelResources:{},archetypeFields:{maximum_speed:10,hardness:.02,reliability:.6,fuel_consumption:1.2},modelFields:{},source:source+' motorized.txt model1; fuel use retained project 100L units'});
reference.mapping.anti_tank_equipment=AT;reference.families.ANTI_TANK='combat_support';reference.supportIds.push('SUPPORT_AT');
function unit(id,men,need,org,hp,width,supply,extra={}){
 reference.units[id]={manpower:men,need,scalarDefinitions:{max_organisation:org,max_strength:hp,combat_width:width,supply_consumption:supply},terrain:{},source:source+'; positive org and tonnes/day are project adaptation',...extra};
}
unit('INFANTRY',1250,{infantry_equipment:125},35,25,2,8,{scalarDefinitions:{max_organisation:35,max_strength:25,combat_width:2,supply_consumption:8,breakthrough:-.3}});
unit('ARTILLERY',700,{artillery_equipment:12},20,2,1.5,18);
unit('SUPPORT_ARTILLERY',350,{artillery_equipment:6},20,1,.5,9,{scalarDefinitions:{max_organisation:20,max_strength:1,combat_width:.5,supply_consumption:9,soft_attack:-.5,hard_attack:-.5}});
unit('ANTI_TANK',600,{anti_tank_equipment:24},25,2,1,6,{combatModel:AT});
unit('SUPPORT_AT',300,{anti_tank_equipment:12},25,1,.5,3,{combatModel:AT,scalarDefinitions:{max_organisation:25,max_strength:1,combat_width:.5,supply_consumption:3,soft_attack:-.5,hard_attack:-.5,defense:-.5}});
unit('ENGINEER',350,{infantry_equipment:5,support_equipment:30},25,2,0,2,{terrain:{forest:{defence:.07},hills:{defence:.07}},scalarDefinitions:{max_organisation:25,max_strength:2,combat_width:0,supply_consumption:2,soft_attack:-.4,hard_attack:-.2,defense:-.2,breakthrough:-.4}});
reference.units.RECON.scalarDefinitions.supply_consumption=2;
reference.units.MOTORIZED.scalarDefinitions.supply_consumption=12;
reference.units.LIGHT_ARMOR.scalarDefinitions.supply_consumption=32;
reference.labels={infantry_equipment_1:'步兵装备Ⅰ',support_equipment_1:'支援器材Ⅰ',artillery_equipment_1:'野战炮Ⅰ',anti_tank_equipment_2:'反坦克炮1941',motorized_equipment_1:'卡车Ⅰ',leichttraktor_lt0:'LT-0轻坦'};
export const products={...Object.fromEntries(Object.entries(reference.models).map(([id,m])=>[id,{label:reference.labels[id]+'（件）',cost:m.cost,resources:{...m.archetypeResources,...m.modelResources}}])),TRAIN:{label:'运输列车（组）',cost:120,resources:{steel:3}},FUEL:{label:'燃料（百升）',cost:.5,resources:{oil:1}}};

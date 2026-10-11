import {cfg as old} from '../grand-economy-002/config.mjs';
export const VERSION='BLACKICE-001-LAND-1';
export const cfg={...old,militaryWorkDay:120,civilWorkDay:30,efficiencyGainDay:.015,switchRetention:.25,
 supplyDayDivisor:24,combatSupplyFactor:1.5,marchSupplyFactor:1.25,localFlow:.02,
 truckPerHub:20,footRange:2,motorRange:5,fuelTonnes:.08,
 construction:{MIL:1800,CIV:2100,HUB:300,RAIL:36,REPAIR_RAIL:60,REPAIR_FACTORY:120,NEW_RAIL:36,NEW_HUB:300}};
export const freightPolicy={personnel:.1,infantry_equipment_1:.01,support_equipment_1:.05,artillery_equipment_1:1.5,anti_tank_equipment_2:1.2,motorized_equipment_1:3,leichttraktor_lt0:8};
export const combat={cyclesHour:6,coveredHit:.15,openHit:.37,hpLoss:.10,orgLoss:.05,width:75,extraDirection:25,maxWidth:125};
export const terrain={PLAIN:{move:1,attack:1,width:75},FOREST:{move:1.5,attack:.7,width:60},HILL:{move:1.7,attack:.6,width:60},MOUNTAIN:{move:2.5,attack:.4,width:45},MARSH:{move:2,attack:.6,width:45},CITY:{move:1.2,attack:.6,width:75}};
export const reserve={infantry_equipment_1:600,support_equipment_1:60,artillery_equipment_1:24,anti_tank_equipment_2:24,motorized_equipment_1:100,leichttraktor_lt0:12,TRAIN:8,FUEL:400};

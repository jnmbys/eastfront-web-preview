// Frozen ECONOMY-1 scenario, not HOI4's numerical balance. No old I/P/E economy runs.
import {rules as previous} from '../grand-play-001/rules.mjs';
export const VERSION='GRAND-ECONOMY-2';
export const rules=Object.freeze({...previous,version:VERSION,saveVersion:1,wallMs:650,duration:2016,victoryFrom:1440,holdTicks:288,epochTicks:12,damageScale:.12,orgDamageScale:.12,holdText:'第五日后保持中央枢纽与一侧站区满24小时',deadlineText:'七日战役期限；按三个战略地点控制判定'});
export const cfg=Object.freeze({planningTicks:72,maxRailLength:24,planBudget:1280,date:'1941-07-01T06:00:00Z',ticksPerDay:288,networkTicks:12,militaryWorkDay:12,civilWorkDay:6,efficiencyStart:.3,efficiencyCap:.8,efficiencyGainDay:.08,switchRetention:.4,addedFactoryEfficiency:.1,manpower:4800,personnelDay:60,equipmentDay:2,combatReinforcement:.25,marchReinforcement:.5,sourceFlow:18,localFlow:.35,railFlow:12,hubFlow:12,trainWork:80,truckPerHub:2,footRange:3,motorRange:7,carriedHours:12,marchScale:4,construction:{MIL:30,CIV:36,HUB:18,RAIL:10,REPAIR_RAIL:6,REPAIR_FACTORY:10,NEW_RAIL:8,NEW_HUB:24},resourcePerIndustry:{steel:2,tungsten:.6,chromium:.4,rubber:.5}});
export const products={
 RIFLE:{label:'步兵装备',cost:2,resources:{steel:1},use:'基础步兵火力'},
 GUN:{label:'野战火炮',cost:6,resources:{steel:2,tungsten:1},use:'火力与原支援资格'},
 AT:{label:'反坦克炮',cost:4,resources:{steel:2,tungsten:1},use:'对装甲火力'},
 TANK:{label:'中型装甲',cost:8,resources:{steel:3,tungsten:1},use:'突破、防护与机动'},
 HEAVY:{label:'重型装甲',cost:12,resources:{steel:3,chromium:2},use:'重装甲防护与火力'},
 KIT:{label:'工兵通信器材',cost:3,resources:{steel:1},use:'工兵防护与协同'},
 SCOUT:{label:'侦察器材',cost:4,resources:{steel:1,rubber:1},use:'现有侦察部队机动，不扩大隐藏情报'},
 TRUCK:{label:'卡车',cost:4,resources:{steel:1,rubber:2},use:'部队机动或枢纽机动化；不能重复占用'},
 TRAIN:{label:'火车',cost:8,resources:{steel:3},use:'铁路干线能力；可重复使用'}
};
export const sides=['GERMAN','SOVIET'];

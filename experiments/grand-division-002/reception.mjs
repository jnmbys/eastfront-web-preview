import {cfg} from '../grand-economy-002/config.mjs';
import {modelIds} from './model-demand.mjs';
// Existing approved project rates, extracted unchanged for executable time audits.
export const freightPolicy=Object.freeze({personnel:1/50,infantry_equipment_1:1/100,support_equipment_1:1/25});
export const LEGACY_RECEPTION='DIVISION-RECEPTION-1';
export const CURRENT_RECEPTION='DIVISION-RECEPTION-2';
export function receptionRates(policy){
 if(policy!==undefined&&![LEGACY_RECEPTION,CURRENT_RECEPTION].includes(policy))throw Error('UNSUPPORTED_RECEPTION_POLICY');
 return {ticksPerDay:cfg.ticksPerDay,personnelDay:policy===CURRENT_RECEPTION?300:60,equipmentDay:policy===CURRENT_RECEPTION?10:2};
}
export function accrueReception(credits,factor=1,rates=cfg){
 const people=rates.personnelDay/rates.ticksPerDay*factor,item=rates.equipmentDay/rates.ticksPerDay*factor;
 credits.personnel=Math.min(1+people,credits.personnel+people);
 for(const k of modelIds)credits[k]=Math.min(1+item,credits[k]+item);
 return Object.fromEntries(Object.entries(credits).map(([k,q])=>[k,Math.floor(q+1e-9)]));
}
export function debitReception(credits,sent){
 credits.personnel=Math.max(0,credits.personnel-sent.personnel);
 for(const k of modelIds)credits[k]=Math.max(0,credits[k]-sent.equipment[k]);
}

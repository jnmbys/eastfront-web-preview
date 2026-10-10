import {idsFor,referenceFor} from './model-demand.mjs';
const copy=structuredClone,fail=x=>{throw Error(x);};
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const finite=n=>Number.isFinite(n)&&n>=0;
const zero=s=>Object.fromEntries(idsFor(s).map(k=>[k,0]));
export const SCHEMA='DIVISION-MODEL-INVENTORY-1';
// Initial quantities must be an explicit new-scenario manifest, never legacy ratios.
export function createInventory(manifest){
 const s={schema:SCHEMA,...(manifest.profile?{profile:manifest.profile}:{}),version:0,nations:copy(manifest.nations),units:copy(manifest.units),lines:{},settledTick:-1};
 for(const n of Object.values(s.nations)){n.produced=zero(s);n.lost=zero(s);n.personnelLost=0;}
 s.initial=totals(s);validate(s);return s;
}
export function totals(s){const modelIds=idsFor(s);return Object.fromEntries(Object.entries(s.nations).map(([side,n])=>{const total={personnel:n.manpower,...n.stock};for(const u of Object.values(s.units).filter(u=>u.side===side)){total.personnel+=u.personnel;for(const k of modelIds)total[k]+=u.held[k];}for(const r of Object.values(s.freightReservations??{}))if(r.side===side)total[r.model]+=1;if(s.fuel){total.FUEL=Number((total.FUEL+Object.entries(s.fuel.units).filter(([id])=>s.units[id].side===side).reduce((v,[,q])=>v+q,0)).toFixed(9));}return [side,total];}));}
export function cancelReservedFreight(s,id){for(const[key,r]of Object.entries(s.freightReservations??{}))if(r.unit===id){s.nations[r.side].stock[r.model]++;delete s.freightReservations[key];}}
export function validate(s){const modelIds=idsFor(s);
 if(s.schema!==SCHEMA||!integer(s.version)||!Number.isSafeInteger(s.settledTick)||s.settledTick< -1)fail('MODEL_SAVE_VERSION');
 for(const side of ['GERMAN','SOVIET']){const n=s.nations[side];if(!n||!integer(n.manpower)||!integer(n.personnelLost)||modelIds.some(k=>!integer(n.stock[k])||!integer(n.produced[k])||!integer(n.lost[k])))fail('MODEL_POOL_INVALID');if(Object.keys(n.stock).some(k=>!modelIds.includes(k)&&!['TRAIN','TRUCK',...(s.profile?['FUEL']:[])].includes(k)||(s.profile&&k==='FUEL'?!finite(n.stock[k]):!integer(n.stock[k]))))fail('MODEL_UNKNOWN_STOCK');}
 for(const[id,u]of Object.entries(s.units)){if(id!==u.id||!s.nations[u.side]||!integer(u.personnel)||!integer(u.target.manpower)||!integer(u.revision)||!finite(u.org)||!finite(u.trainingExperience)||modelIds.some(k=>!integer(u.held[k])||!integer(u.target.equipment[k])))fail('MODEL_UNIT_INVALID');}
 for(const l of Object.values(s.lines))if(!modelIds.includes(l.model)||!finite(l.work)||!integer(l.completed)||!s.nations[l.side])fail('MODEL_LINE_INVALID');
 for(const[key,r]of Object.entries(s.freightReservations??{}))if(key!==r.unit+':'+r.model||!s.units[r.unit]||s.units[r.unit].side!==r.side||!modelIds.includes(r.model)||!finite(r.work)||!finite(r.required)||r.required<=0||r.work>=r.required||!r.route||!Array.isArray(r.route.path)||typeof r.destination!=='string')fail('MODEL_FREIGHT_RESERVATION_INVALID');
 const total=totals(s);for(const side of ['GERMAN','SOVIET']){const n=s.nations[side];if(total[side].personnel+n.personnelLost!==s.initial[side].personnel)fail('MODEL_PERSONNEL_CONSERVATION');for(const k of modelIds)if(total[side][k]+n.lost[k]!==s.initial[side][k]+n.produced[k])fail('MODEL_EQUIPMENT_CONSERVATION');}
}
/** Work is furnished by the existing factory allocator; no factory work is created. */
export function produce(s,{line,side,model,work}){const reference=referenceFor(s);
 if(!reference.models[model]||!s.nations[side]||!finite(work))fail('MODEL_PRODUCTION_INVALID');
 let l=s.lines[line];if(l&&(l.side!==side||l.model!==model))fail('MODEL_LINE_RETOOL_REQUIRED');
 l??=s.lines[line]={side,model,work:0,completed:0};l.work+=work;
 const cost=reference.models[model].cost,quantity=Math.floor(l.work/cost);
 if(!integer(quantity))fail('MODEL_PRODUCTION_OVERFLOW');
 l.work-=quantity*cost;l.completed+=quantity;s.nations[side].stock[model]+=quantity;s.nations[side].produced[model]+=quantity;
 return {line,model,quantity,remainderWork:l.work};
}
export function returnSurplus(s,id,target){const modelIds=idsFor(s);
 const u=s.units[id];if(!u||!integer(target.manpower)||modelIds.some(k=>!integer(target.equipment[k])))fail('MODEL_TARGET_INVALID');
 cancelReservedFreight(s,id);
 const n=s.nations[u.side],returned={personnel:Math.max(0,u.personnel-target.manpower),equipment:zero(s)};
 n.manpower+=returned.personnel;u.personnel-=returned.personnel;
 for(const k of modelIds){const q=Math.max(0,u.held[k]-target.equipment[k]);u.held[k]-=q;n.stock[k]+=q;returned.equipment[k]=q;}
 u.target=copy(target);u.revision++;return returned;
}
// Caller supplies already-authorized, paid capacity. No fractional equipment leaves stock.
export function deliver(s,id,{personnel,equipment}){const modelIds=idsFor(s);
 const u=s.units[id];if(!u||!integer(personnel)||modelIds.some(k=>!integer(equipment[k]??0)))fail('MODEL_DELIVERY_INVALID');
 const n=s.nations[u.side],sent={personnel:Math.min(personnel,n.manpower,Math.max(0,u.target.manpower-u.personnel)),equipment:zero(s)};
 n.manpower-=sent.personnel;u.personnel+=sent.personnel;
 for(const k of modelIds){const q=Math.min(equipment[k]??0,Math.max(0,n.stock[k]-(s.vehicleCommitments?.[u.side]?.[k]??0)),Math.max(0,u.target.equipment[k]-u.held[k]));u.held[k]+=q;n.stock[k]-=q;sent.equipment[k]=q;}
 if(sent.personnel||Object.values(sent.equipment).some(Boolean))u.revision++;return sent;
}
/** Copy/validate/commit boundary: failed work never mutates the supplied state. */
export function settle(s,tick,operation){
 if(!Number.isSafeInteger(tick)||tick!==s.settledTick+1)fail('MODEL_TICK_OUT_OF_SEQUENCE');
 const next=copy(s),receipt=operation(next);next.settledTick=tick;next.version++;validate(next);return {state:next,receipt};
}

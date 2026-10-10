import {transport} from './freight.mjs';
import {modelIds} from './model-demand.mjs';
export const FREIGHT_PROGRESS='MODEL-FREIGHT-PROGRESS-1';
const same=(a,b)=>a.hub===b.hub&&a.source===b.source&&JSON.stringify(a.path)===JSON.stringify(b.path);
// Capacity is work per settlement period, not a vehicle's per-piece payload limit.
// Only one real item per unit/model may reserve work; unused work is never banked.
export function transportProgress(s,id,options){
 const {network,rails,trainCapacity,sourceCapacity,railCapacity,policy,destination,tick}=options;
 if(typeof destination!=='string'||!Number.isSafeInteger(tick))throw Error('MODEL_FREIGHT_DESTINATION_REQUIRED');
 const u=s.units[id],n=s.nations[u.side],reservations=s.freightReservations??={},routes=network.rows[id]?.routes??(network.rows[id]?.route?[network.rows[id].route]:[]),rates={...options.rates},cancelled=[];
 for(const k of modelIds){const key=id+':'+k,r=reservations[key];if(!r)continue;
  if(r.destination!==destination||u.held[k]>=u.target.equipment[k]||!routes.some(x=>same(x,r.route)&&x.path.every(e=>rails[e]&&!rails[e].damage))){n.stock[k]++;delete reservations[key];cancelled.push(k);rates[k]=0;}
  else rates[k]=0;
 }
 const sent=transport(s,id,{...options,rates});sent.creditUse={personnel:sent.personnel,...sent.equipment};sent.reserved=[];sent.cancelled=cancelled;const cargo=sent.cargo;
 const room=r=>{const h=network.hubs.find(h=>h.id===r.hub);if(!h||!r.path.every(k=>rails[k]&&!rails[k].damage))return 0;return Math.max(0,Math.min((trainCapacity-network.trainUsed-cargo.train)/Math.max(1,r.path.length),h.capacity-h.used-(cargo.hubs[r.hub]??0),sourceCapacity-(network.sources[r.source]??0)-(cargo.sources[r.source]??0),...r.path.map(k=>railCapacity*rails[k].level-(network.edges[k]??0)-(cargo.edges[k]??0))));};
 const pay=(r,q)=>{cargo.train+=q*Math.max(1,r.path.length);cargo.hubs[r.hub]=(cargo.hubs[r.hub]??0)+q;cargo.sources[r.source]=(cargo.sources[r.source]??0)+q;for(const k of r.path)cargo.edges[k]=(cargo.edges[k]??0)+q;};
 for(const model of modelIds){const key=id+':'+model;let r=reservations[key];
  if(!r&&!cancelled.includes(model)&&options.rates[model]>sent.creditUse[model]&&n.stock[model]>0&&u.held[model]<u.target.equipment[model]){
   const route=routes.filter(r=>room(r)>1e-12).sort((a,b)=>room(b)-room(a)||a.hub.localeCompare(b.hub))[0];
   if(route){r=reservations[key]={unit:id,side:u.side,model,destination,route:structuredClone(route),required:policy[model],work:0,since:tick,lastTick:-1};n.stock[model]--;sent.creditUse[model]++;sent.reserved.push(model);}
  }
  if(!r||r.lastTick===tick)continue;r.lastTick=tick;
  const work=Math.min(room(r.route),r.required-r.work);if(work>0){pay(r.route,work);r.work+=work;sent.routes.push({kind:model,quantity:0,work,route:structuredClone(r.route),inTransit:true});}
  if(r.work>=r.required-1e-12){u.held[model]++;u.revision++;sent.equipment[model]++;delete reservations[key];}
 }
 sent.inTransit=Object.values(reservations).filter(r=>r.unit===id).map(r=>structuredClone(r));
 if(sent.inTransit.length)sent.reason='装备已预留，运输分期完成；未到达不计入部队';
 else if(cancelled.length)sent.reason='位置、路线或需求已改变，预留装备退回库存；已用运量不返还';
 else if(sent.personnel||Object.values(sent.equipment).some(Boolean))sent.reason='已按共享余量实际补充';
 return sent;
}

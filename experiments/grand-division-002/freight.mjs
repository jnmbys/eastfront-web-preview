import {idsFor} from './model-demand.mjs';
import {deliver} from './inventory.mjs';
const fail=x=>{throw Error(x);};
/** Reuses the existing network's sources/rails/hubs and daily-supply reservations.
 * The unit-work policy is explicit and required; it is not an inventory exchange rate.
 * Mutates only the transaction's draft cargo account and integer inventory.
 */
export function transport(s,id,{network,rails,cargo,trainCapacity,sourceCapacity,railCapacity,policy,rates}){
 const modelIds=idsFor(s);
 cargo=structuredClone(cargo);
 if(!policy||![policy.personnel,...modelIds.map(k=>policy[k])].every(x=>Number.isFinite(x)&&x>0))fail('MODEL_FREIGHT_POLICY_UNREVIEWED');
 if(!Number.isSafeInteger(rates.personnel)||rates.personnel<0||modelIds.some(k=>!Number.isSafeInteger(rates[k])||rates[k]<0))fail('MODEL_RATE_INVALID');
 const u=s.units[id];if(!u)fail('MODEL_UNIT_UNAVAILABLE');
 const row=network.rows[id],routes=row?.routes??(row?.route?[row.route]:[]),n=s.nations[u.side];
 const room=r=>{const hub=network.hubs.find(h=>h.id===r.hub);if(!hub||!r.path.every(k=>rails[k]&&!rails[k].damage))return 0;return Math.max(0,Math.min((trainCapacity-network.trainUsed-cargo.train)/Math.max(1,r.path.length),hub.capacity-hub.used-(cargo.hubs[r.hub]??0),sourceCapacity-(network.sources[r.source]??0)-(cargo.sources[r.source]??0),...r.path.map(k=>railCapacity*rails[k].level-(network.edges[k]??0)-(cargo.edges[k]??0))));};
 const pay=(r,q)=>{cargo.train+=q*Math.max(1,r.path.length);cargo.hubs[r.hub]=(cargo.hubs[r.hub]??0)+q;cargo.sources[r.source]=(cargo.sources[r.source]??0)+q;for(const k of r.path)cargo.edges[k]=(cargo.edges[k]??0)+q;};
 const sent={personnel:0,equipment:Object.fromEntries(modelIds.map(k=>[k,0])),routes:[]};
 for(const kind of ['personnel',...modelIds]){
  let allowance=rates[kind];
  for(const r of [...routes].sort((a,b)=>room(b)-room(a)||a.hub.localeCompare(b.hub)||a.source.localeCompare(b.source))){
   const deficit=kind==='personnel'?u.target.manpower-u.personnel:u.target.equipment[kind]-u.held[kind],stock=kind==='personnel'?n.manpower:Math.max(0,n.stock[kind]-(s.vehicleCommitments?.[u.side]?.[kind]??0));
   const quantity=Math.max(0,Math.min(allowance,stock,deficit,Math.floor((room(r)+1e-12)/policy[kind])));if(!quantity)continue;
   const actual=deliver(s,id,{personnel:kind==='personnel'?quantity:0,equipment:kind==='personnel'?{}:{[kind]:quantity}});
   const delivered=kind==='personnel'?actual.personnel:actual.equipment[kind];pay(r,delivered*policy[kind]);allowance-=delivered;
   if(kind==='personnel')sent.personnel+=delivered;else sent.equipment[kind]+=delivered;
   sent.routes.push({kind,quantity:delivered,work:delivered*policy[kind],route:structuredClone(r)});
  }
 }
 sent.reason=!routes.length?'后方补充通路未接通':sent.routes.length?'已按共享余量实际补充':'库存、速率或共享余量不足以运送一个完整计量单位';
 sent.cargo=cargo;
 return sent;
}

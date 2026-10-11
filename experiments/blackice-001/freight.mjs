import {transportProgress} from '../grand-division-002/freight-progress.mjs';
import {idsFor} from '../grand-division-002/model-demand.mjs';
const same=(a,b)=>a.hub===b.hub&&a.source===b.source&&JSON.stringify(a.path)===JSON.stringify(b.path);
// Paid dispatch and physical arrival are separate. Stock is escrowed once;
// cancelled routes return its ownership, never the transport work already spent.
export function transport(s,id,options){
 const u=s.units[id],n=s.nations[u.side],ids=idsFor(s),zero=()=>Object.fromEntries(ids.map(k=>[k,0])),arrived={personnel:0,equipment:zero()},routes=options.network.rows[id]?.routes??[],pending=s.balance.transit??=[];
 const kept=[];
 for(const x of pending){
  if(x.unit!==id){kept.push(x);continue;}
  const valid=x.destination===options.destination&&routes.some(r=>same(r,x.route)&&r.path.every(k=>options.rails[k]&&!options.rails[k].damage));
  if(!valid){if(x.model==='personnel')n.manpower+=x.quantity;else n.stock[x.model]+=x.quantity;continue;}
  if(options.tick<x.arrival){kept.push(x);continue;}
  const people=x.model==='personnel',room=Math.max(0,people?u.target.manpower-u.personnel:u.target.equipment[x.model]-u.held[x.model]),q=Math.min(room,x.quantity);
  if(people){u.personnel+=q;n.manpower+=x.quantity-q;arrived.personnel+=q;}else{u.held[x.model]+=q;n.stock[x.model]+=x.quantity-q;arrived.equipment[x.model]+=q;}if(q)u.revision++;
 }
 s.balance.transit=kept;
 const reserved={personnel:0,...zero()};for(const x of kept)if(x.unit===id)reserved[x.model]+=x.quantity;
 // Incoming cargo satisfies demand for dispatch planning only, never capabilities.
 u.personnel+=reserved.personnel;for(const k of ids)u.held[k]+=reserved[k];
 let sent;try{sent=transportProgress(s,id,options);}finally{u.personnel-=reserved.personnel;for(const k of ids)u.held[k]-=reserved[k];}
 u.personnel-=sent.personnel;for(const k of ids)u.held[k]-=sent.equipment[k];

 for(const batch of sent.routes.filter(r=>r.quantity>0)){const model=batch.kind,quantity=batch.quantity,route=batch.route;if(!route)throw Error('PAID_FREIGHT_ROUTE_MISSING');
  const hub=options.network.hubs.find(h=>h.id===route.hub),dest=JSON.parse(options.destination),[q,r]=(hub?.hex??`${dest.q},${dest.r}`).split(',').map(Number),last=Math.max(Math.abs(dest.q-q),Math.abs(dest.r-r),Math.abs(dest.q+dest.r-q-r));
  // 15min loading; rail 30km/h; terrain/road-weighted last mile, motor 10km/h or foot 5km/h.
  const lastCost=hub?.deliveryCosts?.[`${dest.q},${dest.r}`]??last;
  const duration=Math.max(3,Math.ceil(3+route.path.length*4+lastCost*(hub?.trucks>0?12:24)));
  kept.push({unit:id,side:u.side,model,quantity,route:structuredClone(route),destination:options.destination,dispatched:options.tick,arrival:options.tick+duration});
 }
 return {...sent,personnel:arrived.personnel,equipment:arrived.equipment,inTransit:[...sent.inTransit,...kept.filter(x=>x.unit===id)],reason:kept.some(x=>x.unit===id)?'已扣库发运；装卸、铁路与末端运输尚未完成':sent.reason};
}

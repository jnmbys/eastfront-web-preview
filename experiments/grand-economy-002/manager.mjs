import {cfg,products} from './config.mjs';
import {setLine} from './economy.mjs';
import {preview} from './planning.mjs';
import {hexKey as key,hexDistance} from '../../vendor/eastfront-digital-core/dist/index.js';
// Same manager can run for either side. Only caller's authorized view and own economy.
export function manage(c,view,side){const start=performance.now(),e=c.econ.modern,n=e.nations[side],net=e.net[side],cells=new Map(view.hexes.map(h=>[key(h.coord),h])),own=k=>cells.get(k)?.control===side;
 e.management??={};const m=e.management[side]??={reviews:0,lastProduct:-288,lastProject:-72,shortages:{},actions:[],expanded:0};m.reviews++;const need={};
 for(const u of view.units.filter(u=>u.side===side))for(const[k,v]of Object.entries(e.establishment[u.id]))need[k]=(need[k]??0)+Math.max(0,v-c.econ.gear.units[u.id].held[k]);
 need.TRAIN=Math.max(0,net.trainNeed-n.stock.TRAIN);need.TRUCK=Math.max(0,net.truckNeed-n.stock.TRUCK);
 for(const k of Object.keys(products))m.shortages[k]=(need[k]??0)>n.stock[k]?((m.shortages[k]??0)+1):0;
 const record=(kind,target,reason)=>{const x={tick:c.clock.tick,side,kind,target,reason};m.actions.push(x);m.actions=m.actions.slice(-24);e.ledger.push({kind:'AI_LOGISTICS',...x});};
 if(c.clock.tick-m.lastProduct>=288){const product=Object.keys(products).filter(k=>m.shortages[k]>=2).sort((a,b)=>(need[b]-n.stock[b])*products[b].cost-(need[a]-n.stock[a])*products[a].cost||a.localeCompare(b))[0],lines=Object.values(e.lines).filter(l=>l.side===side),target=lines.find(l=>l.product===product),donor=lines.filter(l=>l!==target&&l.factories.length).sort((a,b)=>(need[a.product]??0)-(need[b.product]??0)||a.id.localeCompare(b.id))[0];
  if(target&&donor){const f=donor.factories.find(id=>own(e.facilities[id].hex)&&!e.facilities[id].damage);if(f){setLine(e,side,{line:target.id,product,priority:1,factories:[...target.factories,f]});donor.factories=donor.factories.filter(id=>id!==f);m.lastProduct=c.clock.tick;record('PRODUCTION',product,'连续两次检查缺额；每天最多调拨一厂');}}
 }
 if(c.clock.tick-m.lastProject>=72&&e.queue.filter(q=>q.side===side&&q.status!=='DONE').length<3){let op=null;
  const damaged=Object.values(e.rails).filter(r=>r.damage&&view.edges.some(x=>x.key===r.id&&own(key(x.a))&&own(key(x.b)))).sort((a,b)=>a.id.localeCompare(b.id));
  const deficient=Object.entries(net.rows).filter(([id,r])=>r.ratio<.99||c.clock.units[id].personnel<c.clock.units[id].max-1).sort((a,b)=>a[1].ratio-b[1].ratio||a[0].localeCompare(b[0]));
  const queued=(kind,target)=>e.queue.some(q=>q.kind===kind&&q.target===target&&q.status!=='DONE');
  if(damaged.some(r=>!queued('REPAIR_RAIL',r.id)))op={kind:'REPAIR_RAIL',target:damaged.find(r=>!queued('REPAIR_RAIL',r.id)).id};
  if(!op){const h=net.hubs.find(h=>!e.hubs[h.id].motor&&h.route&&deficient.some(([id])=>{const u=view.units.find(u=>u.id===id);return u&&hexDistance(u.hex,cells.get(h.hex).coord)<=cfg.motorRange&&!h.coverage.includes(key(u.hex));}));if(h&&n.stock.TRUCK-net.trucksUsed>=cfg.truckPerHub){e.hubs[h.id].motor=1;m.lastProject=c.clock.tick;record('MOTOR',h.id,'已知缺供部队在近邻范围；使用现有空闲卡车');}}
  if(!op&&m.lastProject!==c.clock.tick){const r=Object.values(e.rails).find(r=>r.level<5&&(net.edges[r.id]??0)>=r.level*cfg.railFlow-1e-6&&!queued('RAIL',r.id)&&view.edges.some(x=>x.key===r.id&&own(key(x.a))&&own(key(x.b))));if(r)op={kind:'RAIL',target:r.id};}
  if(!op&&m.lastProject!==c.clock.tick){const h=net.hubs.find(h=>h.level<3&&h.used>=h.capacity-1e-6&&h.capacity&&!queued('HUB',h.id));if(h)op={kind:'HUB',target:h.id};}
  // At most one bounded path search or eight site checks per review, all in own territory.
  if(!op&&m.lastProject!==c.clock.tick&&deficient.length){const [id]=deficient[0],u=view.units.find(u=>u.id===id),isolated=net.hubs.find(h=>!h.route&&own(h.hex));if(isolated){const starts=net.hubs.filter(h=>h.route).sort((a,b)=>hexDistance(cells.get(a.hex).coord,cells.get(isolated.hex).coord)-hexDistance(cells.get(b.hex).coord,cells.get(isolated.hex).coord));if(starts[0]){const p=preview(view,e,side,{kind:'NEW_RAIL',start:starts[0].hex,end:isolated.hex},c.version);m.expanded+=p.expanded;if(p.valid)op={...p,planVersion:c.version};}}
   else if(u){const sites=[...cells.values()].filter(h=>own(key(h.coord))&&hexDistance(h.coord,u.hex)<=2).sort((a,b)=>hexDistance(a.coord,u.hex)-hexDistance(b.coord,u.hex)||key(a.coord).localeCompare(key(b.coord))).slice(0,8);for(const h of sites){const p=preview(view,e,side,{kind:'NEW_HUB',end:key(h.coord)},c.version);if(p.valid&&view.edges.some(x=>e.rails[x.key]&&[key(x.a),key(x.b)].includes(p.end))){op={...p,planVersion:c.version};break;}}}
  }
  if(op){try{c.enqueue(side,op);m.lastProject=c.clock.tick;record('BUILD',op.target??op.end,'持续缺额，排入真实民厂队列：'+op.kind);}catch(error){m.lastReason=error.message;}}
 }
 m.ms=performance.now()-start;m.totalMs=(m.totalMs??0)+m.ms;m.maxMs=Math.max(m.maxMs??0,m.ms);
}

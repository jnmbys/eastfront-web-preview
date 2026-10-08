import {hexKey as key,canonicalEdgeKey as edgeKey,getNeighbors} from '../../vendor/eastfront-digital-core/dist/index.js';
import {cfg} from './config.mjs';
// Input is the authorized current view. No hidden occupancy probes, no enemy private values.
export function planNetwork(view,e,side,nodes,clock,placements){
 const cells=new Map(view.hexes.map(h=>[key(h.coord),h])),edges=new Map(view.edges.map(x=>[x.key,x])),own=k=>cells.get(k)?.control===side&&cells.get(k)?.terrain!=='LAKE';
 const blocked=new Set(view.units.filter(u=>u.side!==side).map(u=>key(u.hex))),allowed=k=>own(k)&&!blocked.has(k);
 const rails=new Map();let expanded=0;
 for(const r of Object.values(e.rails)){const x=edges.get(r.id);if(!x||!allowed(key(x.a))||!allowed(key(x.b))||x.railway?.destroyed||x.bridge?.destroyed||r.damage>0)continue;for(const[a,b]of[[key(x.a),key(x.b)],[key(x.b),key(x.a)]]){if(!rails.has(a))rails.set(a,[]);rails.get(a).push({to:b,id:r.id,capacity:cfg.railFlow*r.level});}}
 const sources=nodes.filter(n=>n.sourceQ>0&&allowed(n.hex));
 const paths=new Map();
 // Widest path first, shortest among equal capacities. Per source bounded by map size.
 for(const source of sources){const best=new Map(),queue=[{at:source.hex,path:[],cap:cfg.sourceFlow,source:source.id}];let count=0;
  while(queue.length&&count++<4096){queue.sort((a,b)=>b.cap-a.cap||a.path.length-b.path.length||a.at.localeCompare(b.at));const x=queue.shift(),old=best.get(x.at);if(old&&(old.cap>x.cap||old.cap===x.cap&&old.path.length<=x.path.length))continue;best.set(x.at,x);expanded++;
   for(const n of rails.get(x.at)??[])if(!best.has(n.to))queue.push({at:n.to,path:[...x.path,n.id],cap:Math.min(x.cap,n.capacity),source:source.id});}
  paths.set(source.id,best);
 }
 const hubs=Object.values(e.hubs).filter(h=>allowed(h.hex)).sort((a,b)=>a.id.localeCompare(b.id));
 const activeUnits=view.units.filter(u=>u.side===side&&u.friendly?.alive),armyOf=id=>placements.find(p=>p.id===id)?.army;
 let trucks=e.nations[side].stock.TRUCK,truckNeed=0;
 const hubRows=hubs.map(h=>{
  const choices=sources.map(s=>paths.get(s.id)?.get(h.hex)).filter(Boolean).sort((a,b)=>b.cap-a.cap||a.path.length-b.path.length||a.source.localeCompare(b.source));
  const route=choices[0]??null,need=h.motor*cfg.truckPerHub;truckNeed+=need;const allocated=Math.min(need,trucks);trucks-=allocated;const range=cfg.footRange+(cfg.motorRange-cfg.footRange)*(need?allocated/need:0),reach=new Map(),queue=[{at:h.hex,cost:0}];
  while(queue.length){queue.sort((a,b)=>a.cost-b.cost||a.at.localeCompare(b.at));const x=queue.shift();if(reach.has(x.at)||x.cost>range)continue;reach.set(x.at,x.cost);expanded++;if(reach.size>1280)break;
   for(const n of getNeighbors(cells.get(x.at).coord)){const k=key(n),ed=edges.get(edgeKey(cells.get(x.at).coord,n));if(!allowed(k)||ed?.bridge?.destroyed||ed?.river==='MAJOR'&&!ed.bridge||reach.has(k))continue;const terrain=cells.get(k).terrain,cost=ed?.road?.6:terrain==='FOREST'?1.5:terrain==='MOUNTAIN'?2:terrain==='MARSH'?2:1;queue.push({at:k,cost:x.cost+cost});}}
  return {...h,route,routes:choices,range,trucks:allocated,truckNeed:need,reach,used:0,capacity:route?cfg.hubFlow*h.level:0};
 });
 const reserved=e.cargoHour?.hour===Math.floor(clock.tick/cfg.networkTicks)?e.cargoHour.sides[side]:null;
 const nation=e.nations[side],edgeUsed={},sourceUsed={},hubUsed={},localUsed={},rows={},shipments=[];
 let trainUsed=0,trainDemand=reserved?.train??0;
 const units=activeUnits.sort((a,b)=>(e.priorities[armyOf(a.id)]??3)-(e.priorities[armyOf(b.id)]??3)||a.id.localeCompare(b.id));
 for(const u of units){const v=clock.units[u.id],g=e.establishment[u.id],need=(.6+v.personnel/v.max*.4+ (g.TANK??0)*.12+(g.HEAVY??0)*.18+(g.GUN??0)*.1+(g.TRUCK??0)*.05)*(v.engaged?1.3:v.march?1.15:1),k=key(u.hex);
  const localCap=own(k)?(cells.get(k)?.terrain==='CITY'?cfg.localFlow*2:cfg.localFlow):0,local=Math.min(need,Math.max(0,localCap-(localUsed[k]??0)));localUsed[k]=(localUsed[k]??0)+local;let supplied=local,access=0;
  const choices=hubRows.filter(h=>h.reach.has(k)).sort((a,b)=>a.reach.get(k)-b.reach.get(k)||a.id.localeCompare(b.id));
  let reason=choices.length?'铁路断线或待维修':'枢纽末端覆盖不足',route=null;
  const reachable=choices.filter(h=>h.route);trainDemand+=Math.max(0,need-local)*Math.max(1,reachable[0]?.route.path.length??0);
  for(const {h,r} of choices.flatMap(h=>h.routes.map(r=>({h,r})))){const remaining=need-supplied,work=Math.max(1,r.path.length);if(remaining<=1e-8)break;
   const edgeRoom=Math.min(Infinity,...r.path.map(id=>cfg.railFlow*e.rails[id].level-(edgeUsed[id]??0)-(reserved?.edges[id]??0))),trainRoom=Math.max(0,nation.stock.TRAIN*cfg.trainWork-trainUsed-(reserved?.train??0))/work,sourceRoom=cfg.sourceFlow-(sourceUsed[r.source]??0)-(reserved?.sources?.[r.source]??0),hubRoom=h.capacity-(hubUsed[h.id]??0)-(reserved?.hubs[h.id]??0),q=Math.max(0,Math.min(remaining,edgeRoom,trainRoom,sourceRoom,hubRoom));
   if(q){supplied+=q;access+=q;route={hub:h.id,path:r.path,source:r.source};trainUsed+=q*work;sourceUsed[r.source]=(sourceUsed[r.source]??0)+q;hubUsed[h.id]=(hubUsed[h.id]??0)+q;for(const id of r.path)edgeUsed[id]=(edgeUsed[id]??0)+q;shipments.push({unit:u.id,quantity:q,...route});}
   reason=trainRoom<remaining?'火车不足':edgeRoom<remaining?'铁路瓶颈':hubRoom<remaining?'枢纽容量不足':sourceRoom<remaining?'后方来源能力不足':'部分供给';
  }
  if(supplied>=need-1e-7)reason='供给充足';else if(!choices.length&&hubRows.some(h=>h.motor&&h.trucks<h.truckNeed))reason='卡车不足，末端覆盖缩小';
  rows[u.id]={need,received:supplied,local,ratio:Math.min(1,supplied/need),access:Math.min(1,access/need),reason,route,routes:reachable.flatMap(h=>h.routes.map(r=>({hub:h.id,path:r.path,source:r.source})))};
 }
 return {side,rows,hubs:hubRows.map(({reach,...h})=>({...h,coverage:[...reach.keys()],used:hubUsed[h.id]??0})),trainUsed,trainDemand,trainNeed:Math.ceil(trainDemand/cfg.trainWork),trains:nation.stock.TRAIN,trucks:nation.stock.TRUCK,trucksUsed:nation.stock.TRUCK-trucks,truckNeed,edges:edgeUsed,sources:sourceUsed,shipments,expanded};
}

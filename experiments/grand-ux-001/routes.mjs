// Pure planner: authorized view, remembered public control, own assets, public rules.
// It never asks the authority whether a proposed route is legal.
import * as core from '../../vendor/eastfront-digital-core/dist/index.js';
const kh=core.hexKey;
export function routing(view,known,rules,cfg){
 const hexes=new Map(view.hexes.map(h=>[kh(h.coord),h])),edges=new Map(view.edges.map(e=>[e.key,e]));
 const own=new Set(view.units.filter(u=>u.side===view.viewer&&u.friendly?.alive).map(u=>kh(u.hex))),blocked=new Set();
 for(const contact of view.contacts??[])blocked.add(kh(contact.hex));
 for(const u of view.units.filter(u=>u.side!==view.viewer)){blocked.add(kh(u.hex));const templates=Object.values(rules.unitTemplates).filter(t=>t.side===u.side&&t.type===u.type);if(templates.length&&templates.every(t=>t.exertsZoc))for(const h of core.getNeighbors(u.hex))if(!own.has(kh(h)))blocked.add(kh(h));}
 const allowed=k=>hexes.has(k)&&(hexes.get(k).control??known[k])===view.viewer&&!blocked.has(k)&&hexes.get(k).terrain!=='LAKE';
 const rail=new Map(),railCache=new Map(),mileCache=new Map();let expansions=0;
 for(const e of edges.values())if(e.railway?.present&&!e.railway.destroyed&&(!e.bridge||!e.bridge.destroyed)&&allowed(kh(e.a))&&allowed(kh(e.b))&&(view.viewer!=='GERMAN'||e.railway.repairedBy==='GERMAN'))for(const [a,b]of[[kh(e.a),kh(e.b)],[kh(e.b),kh(e.a)]]){if(!rail.has(a))rail.set(a,[]);rail.get(a).push({to:b,edge:e.key});}
 const railPaths=from=>{if(railCache.has(from))return railCache.get(from);const found=new Map();if(allowed(from)){found.set(from,[]);const queue=[from];for(let i=0;i<queue.length&&i<cfg.routeExpansionLimit;i++){expansions++;for(const x of rail.get(queue[i])??[])if(!found.has(x.to)){found.set(x.to,[...found.get(queue[i]),x.edge]);queue.push(x.to);}}}railCache.set(from,found);return found;};
 const miles=from=>{if(mileCache.has(from))return mileCache.get(from);const found=new Map(),front=[];if(allowed(from))front.push({at:from,cost:0,steps:0,path:[],hexes:[from]});let n=0;
  while(front.length&&n++<cfg.routeExpansionLimit){front.sort((a,b)=>a.cost-b.cost||a.steps-b.steps||a.at.localeCompare(b.at));const x=front.shift(),label=`${x.at}/${x.steps}`;if(found.has(label))continue;found.set(label,x);expansions++;if(x.steps===cfg.truckRange)continue;
   for(const h of core.getNeighbors(hexes.get(x.at).coord)){const k=kh(h),e=edges.get(core.canonicalEdgeKey(hexes.get(x.at).coord,h));if(!allowed(k)||e?.bridge?.destroyed||e?.river==='MAJOR'&&!e.bridge)continue;
    front.push({at:k,cost:x.cost+(e?.road?cfg.roadCost:cfg.terrainCost[hexes.get(k).terrain]??2),steps:x.steps+1,path:[...x.path,e?.key??core.canonicalEdgeKey(hexes.get(x.at).coord,h)],hexes:[...x.hexes,k]});}}
  const best=new Map();for(const x of found.values())if(!best.has(x.at)||best.get(x.at).cost>x.cost)best.set(x.at,x);mileCache.set(from,best);return best;};
 return {rail:(from,to)=>railPaths(from).get(to)??null,mile:(from,to)=>miles(from).get(to)??null,metrics:()=>({expansions,railOrigins:railCache.size,mileOrigins:mileCache.size,limitPerOrigin:cfg.routeExpansionLimit})};
}
export function createCapacity(cfg,trains,trucks){
 const b={trains,trucks,trainCapacity:trains*cfg.trainWorkPerVehicle,truckCapacity:trucks*cfg.truckWorkPerVehicle,trainUsed:0,truckUsed:0,trainDemand:0,truckDemand:0,edges:{},near:{},nearDemand:{},deliveries:[],blocked:[]};
 const room=r=>{const edge=Math.min(Infinity,...r.path.map(e=>cfg.railEdgeQ-(b.edges[e]??0))),train=r.path.length?Math.floor((b.trainCapacity-b.trainUsed)/r.path.length):Infinity;
  const near=r.mile.steps<=cfg.baseNearRange?Math.max(0,cfg.baseNearQPerStation-(b.near[r.station]??0)):0;
  const last=r.mile.steps===0?Infinity:near+Math.floor((b.truckCapacity-b.truckUsed)/Math.max(1,r.mile.cost));return Math.max(0,Math.min(edge,train,last));};
 const spend=(r,q)=>{if(q<0||q>room(r))throw Error('CAPACITY_EXCEEDED');b.trainUsed+=q*r.path.length;for(const e of r.path)b.edges[e]=(b.edges[e]??0)+q;
  if(r.mile.steps){const near=r.mile.steps<=cfg.baseNearRange?Math.min(q,Math.max(0,cfg.baseNearQPerStation-(b.near[r.station]??0))):0;b.near[r.station]=(b.near[r.station]??0)+near;b.truckUsed+=(q-near)*r.mile.cost;}};
 const demand=(r,q)=>{b.trainDemand+=q*r.path.length;if(r.mile.steps){const base=r.mile.steps<=cfg.baseNearRange?Math.min(q,Math.max(0,cfg.baseNearQPerStation-(b.nearDemand[r.station]??0))):0;b.nearDemand[r.station]=(b.nearDemand[r.station]??0)+base;b.truckDemand+=(q-base)*r.mile.cost;}};
 const reason=r=>r.path.some(e=>(b.edges[e]??0)>=cfg.railEdgeQ)?'LINE_CAPACITY':r.path.length&&b.trainCapacity-b.trainUsed<r.path.length?'TRAIN_SHORTAGE':'TRUCK_SHORTAGE';
 return {b,room,spend,demand,reason};
}

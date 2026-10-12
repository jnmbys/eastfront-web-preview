import {idsFor,modelDemand} from '../grand-division-002/model-demand.mjs';
import {transportProgress} from '../grand-division-002/freight-progress.mjs';
import {accrueReception,debitReception,receptionRates} from '../grand-division-002/reception.mjs';
import {makeWork,progressWork} from '../blackice-weather-001/freight.mjs';
import {MODEL as training} from '../blackice-training-001/authority.mjs';
import {attributes} from '../grand-division-002/combat.mjs';
import {reconcileProvinces} from '../hoi4-map-province-001/provinces.mjs';
import {hexDistance,getNeighbors,hexKey} from '../../vendor/eastfront-digital-core/dist/index.js';
export const VERSION='HOI4-RECRUITMENT-001-1';
export const POLICY={experience:.1,gainDay:training.gainDay,wearDay:training.wearDay,maxQueue:12,maxBatch:4};
const copy=structuredClone;
export const zero=p=>Object.fromEntries(idsFor(p).map(k=>[k,0]));
export function cities(c,side){const view=c.fair(side).view,cells=new Map(view.hexes.map(h=>[hexKey(h.coord),h]));return c.clock.mapPlaces.filter(x=>x.cityId&&c.clock.provinces.items.find(p=>p.id===c.clock.provinces.index[x.hex])?.owner===side).map(x=>{const[q,r]=x.hex.split(',').map(Number),hex={q,r},net=c.econ.modern.net[side],hubs=net.hubs.filter(h=>h.coverage.includes(x.hex)&&h.routes.length);let reason=cells.get(x.hex)?.control!==side?'城市未受控':getNeighbors(hex).some(h=>cells.get(hexKey(h))&&cells.get(hexKey(h)).terrain!=='LAKE'&&cells.get(hexKey(h)).control!==side)?'接近控制边界':view.units.some(u=>u.side!==side&&hexDistance(u.hex,hex)<=2)?'附近存在已知敌军':!hubs.length?'后方通路未接通':null;return {...x,hexCoord:hex,reason,hubs};});}
export function add(c,side,op){const p=c.clock.divisionLedger,r=p.recruitment,t=p.formal.templates[op.template],city=cities(c,side).find(x=>x.id===op.city);if(!t||t.side!==side||t.version!==op.templateVersion)throw Error('RECRUIT_TEMPLATE_CHANGED');if(!city||city.reason)throw Error(city?.reason??'RECRUIT_CITY_NOT_OWNED');if(!Number.isInteger(op.quantity)||op.quantity<1||op.quantity>POLICY.maxBatch)throw Error('RECRUIT_QUANTITY_1_TO_4');if(Object.values(r.units).filter(u=>u.side===side).length+op.quantity>POLICY.maxQueue)throw Error('RECRUIT_QUEUE_FULL');const ids=[];for(let i=0;i<op.quantity;i++){const id='R-'+side+'-'+ ++r.serial[side];r.units[id]={id,side,templateId:t.id,templateVersion:t.version,template:copy(t),target:modelDemand(t,p.profile),personnel:0,held:zero(p),revision:0,org:0,trainingExperience:0,city:city.id,hex:city.hex,rank:r.serial[side],credits:{personnel:0,...zero(p)},wear:zero(p),status:'ASSEMBLING',created:c.clock.tick,reason:'等待人力及装备调运'};ids.push(id);}return ids;}
function routesFor(city){return city?.hubs.flatMap(h=>h.routes.map(r=>({hub:h.id,path:r.path,source:r.source})))??[];}
function legalBatch(c,b,city){return city&&!city.reason&&b.route.path.every(k=>c.econ.modern.rails[k]&&!c.econ.modern.rails[k].damage)&&routesFor(city).some(r=>r.hub===b.route.hub&&r.source===b.route.source&&JSON.stringify(r.path)===JSON.stringify(b.route.path));}
function trainingSupply(c,u,city){const e=c.econ.modern,n=e.net[u.side],cargo=e.cargoHour.sides[u.side],cfg=e.balanceConfig,need=attributes(u.template,u,c.clock.divisionLedger.profile).paper.supply/24/12;
 for(const r of routesFor(city)){const h=n.hubs.find(h=>h.id===r.hub),room=Math.min((c.clock.divisionLedger.nations[u.side].stock.TRAIN*cfg.trainWork-n.trainUsed-cargo.train)/Math.max(1,r.path.length),h.capacity-h.used-(cargo.hubs[h.id]??0),cfg.sourceFlow-(n.sources[r.source]??0)-(cargo.sources[r.source]??0),...r.path.map(k=>cfg.railFlow*e.rails[k].level-(n.edges[k]??0)-(cargo.edges[k]??0)));
  if(room+1e-9<need)continue;cargo.train+=need*Math.max(1,r.path.length);cargo.hubs[h.id]=(cargo.hubs[h.id]??0)+need;cargo.sources[r.source]=(cargo.sources[r.source]??0)+need;for(const k of r.path)cargo.edges[k]=(cargo.edges[k]??0)+need;return true;}return false;
}
// Recruitment uses the same paid shared-tonnage allocator. A scoped recipient is
// NOT a field unit; it never enters vision, combat, officer or daily-unit loops.
function dispatch(c,u,city,returning){const p=c.clock.divisionLedger,r=p.recruitment,e=c.econ.modern,net=e.net[u.side],cfg=e.balanceConfig,n=p.nations[u.side],incoming={personnel:0,...zero(p)};for(const b of r.transit)if(b.unit===u.id&&!b.returning)incoming[b.model]+=b.quantity;
 const recipient=returning?{...u,personnel:0,held:zero(p),target:{manpower:u.personnel,equipment:copy(u.held)}}:{...u,personnel:u.personnel+incoming.personnel,held:Object.fromEntries(idsFor(p).map(k=>[k,u.held[k]+incoming[k]]))};
 const pool=returning?{...n,manpower:u.personnel,stock:{...u.held}}:n;
 const scoped={...p,units:{[u.id]:recipient},nations:{...p.nations,[u.side]:pool},freightReservations:r.reservations,vehicleCommitments:returning?{}:p.vehicleCommitments};
 const rates=accrueReception(u.credits,1,receptionRates(p.receptionPolicy),idsFor(p));
 const sent=transportProgress(scoped,u.id,{tick:c.clock.tick,destination:JSON.stringify(city.hexCoord),network:{...net,rows:{[u.id]:{routes:routesFor(city)}}},rails:e.rails,cargo:e.cargoHour.sides[u.side],trainCapacity:n.stock.TRAIN*cfg.trainWork,sourceCapacity:cfg.sourceFlow,railCapacity:cfg.railFlow,policy:c.constructor.freightPolicy,rates});
 e.cargoHour.sides[u.side]=sent.cargo;debitReception(u.credits,sent,idsFor(p));
 if(returning){u.personnel=pool.manpower;u.held=copy(pool.stock);}
 for(const b of sent.routes.filter(b=>b.quantity>0)){const hub=net.hubs.find(h=>h.id===b.route.hub),work=makeWork(c.clock.tick,b.route,hub,u.hex,hub.deliveryCosts?.[u.hex]??0,c.clock.infrastructure);if(returning)work.segments.reverse();const batch={unit:u.id,side:u.side,model:b.kind,quantity:b.quantity,route:b.route,destination:u.hex,dispatched:c.clock.tick,arrival:c.clock.tick+1,weatherWork:work,returning};progressWork(batch,c.clock.tick,c.clock.weather);r.transit.push(batch);}
 u.reason=sent.reason;return sent;
}
export function step(c){const p=c.clock.divisionLedger,r=p.recruitment;if(!r)return;const cityLists=Object.fromEntries(['GERMAN','SOVIET'].map(side=>[side,cities(c,side)]));
 for(const u of Object.values(r.units).sort((a,b)=>a.rank-b.rank||a.id.localeCompare(b.id))){const city=cityLists[u.side].find(x=>x.id===u.city);const remaining=[];
  for(const b of r.transit){if(b.unit!==u.id){remaining.push(b);continue;}if(!legalBatch(c,b,city)){b.weatherWork.lastTick=c.clock.tick;remaining.push(b);continue;}progressWork(b,c.clock.tick,c.clock.weather);if(c.clock.tick<b.arrival){remaining.push(b);continue;}if(b.returning){if(b.model==='personnel')p.nations[u.side].manpower+=b.quantity;else p.nations[u.side].stock[b.model]+=b.quantity;}else if(b.model==='personnel')u.personnel+=b.quantity;else u.held[b.model]+=b.quantity;r.events.push({tick:c.clock.tick,id:u.id,kind:b.returning?'RETURNED':'ARRIVED',model:b.model,quantity:b.quantity});}
  r.transit=remaining;
  if(!city||city.reason){u.reason=city?.reason??'城市不可用';continue;}
  if(u.status==='CANCELLING'){
   // Source reservations have not departed: cancelling releases escrow only,
   // not the already consumed transport work. In-flight cargo remains physical.
   for(const[key,b]of Object.entries(r.reservations))if(b.unit===u.id&&!b.returning){p.nations[u.side].stock[b.model]++;delete r.reservations[key];}
   dispatch(c,u,city,true);for(const b of Object.values(r.reservations))if(b.unit===u.id)b.returning=true;
   if(!u.personnel&&!Object.values(u.held).some(Boolean)&&!r.transit.some(b=>b.unit===u.id)&&!Object.values(r.reservations).some(b=>b.unit===u.id)){r.history.push({id:u.id,side:u.side,status:'CANCELLED',tick:c.clock.tick});delete r.units[u.id];}else u.reason='取消中：等待到站及使用共享运量返运';continue;
  }
  dispatch(c,u,city,false);const full=u.personnel===u.target.manpower&&idsFor(p).every(k=>u.held[k]===u.target.equipment[k]);
  if(full){if(!trainingSupply(c,u,city)){u.reason='训练日常供给受共享运量限制';continue;}u.status='TRAINING';u.trainingExperience=Math.min(POLICY.experience,u.trainingExperience+POLICY.gainDay/288);u.reason='集结训练';for(const[k,q]of Object.entries(u.held)){u.wear[k]+=q*POLICY.wearDay/288;const lost=Math.min(q,Math.floor(u.wear[k]));u.held[k]-=lost;u.wear[k]-=lost;p.nations[u.side].lost[k]+=lost;}if(u.trainingExperience>=POLICY.experience&&idsFor(p).every(k=>u.held[k]===u.target.equipment[k])){u.status='READY';u.reason='训练完成，等待安全部署位置';if(Object.values(c.state.units).filter(x=>x.alive&&hexKey(x.hex)===u.hex).length<c.simRules.stack)c.deployRecruit(u);}}
  else {u.status='ASSEMBLING';u.reason=[u.personnel<u.target.manpower?'缺员 '+(u.target.manpower-u.personnel):'',...idsFor(p).filter(k=>u.held[k]<u.target.equipment[k]).map(k=>(c.econ.modern.modelProducts[k]?.label??k)+' −'+(u.target.equipment[k]-u.held[k])),u.reason].filter(Boolean).join('；');}
 }
 r.events=r.events.slice(-200);reconcileProvinces(c);
}

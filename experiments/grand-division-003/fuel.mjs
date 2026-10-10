import {fairUnits} from '../grand-economy-002/planning.mjs';
import {cfg} from '../grand-economy-002/config.mjs';
const sides=['GERMAN','SOVIET'];
export function validateFuel(c){const p=c.clock.divisionLedger,f=p.fuel;if(f?.version!==1)throw Error('FUEL_SAVE_VERSION');
 for(const side of sides){let held=0;for(const[id,q]of Object.entries(f.units)){if(!p.units[id]||!Number.isFinite(q)||q< -1e-8)throw Error('FUEL_UNIT_INVALID');if(p.units[id].side===side)held+=q;}
  const n=p.nations[side],total=n.stock.FUEL+held+f.consumed[side]+f.lost[side];if(!Number.isFinite(total)||Math.abs(total-n.produced.FUEL)>1e-6)throw Error('FUEL_CONSERVATION');}
}
export function clampFuel(c,{unit=null,returning=false}={}){const p=c.clock.divisionLedger;for(const[id,u]of Object.entries(p.units)){if(unit&&id!==unit)continue;const cap=c.divisionAttributes(id).effective.fuelHour*12,q=p.fuel.units[id]??0;if(q>cap){p.fuel.units[id]=cap;if(returning)p.nations[u.side].stock.FUEL+=q-cap;else p.fuel.lost[u.side]+=q-cap;}}}
export function settleFuel(c,active){const p=c.clock.divisionLedger,f=p.fuel,e=c.econ.modern;
 for(const[id,u]of Object.entries(p.units)){const v=c.clock.units[id],q=f.units[id]??0;
  if(!c.state.units[id].alive){f.lost[u.side]+=q;f.units[id]=0;continue;}
  const a=c.divisionAttributes(id);if(active.has(id)||v.march||v.engaged){const used=Math.min(q,a.effective.fuelHour/12);f.units[id]=Math.max(0,q-used);f.consumed[u.side]+=used;}
 }
 clampFuel(c);
 for(const side of sides){const n=p.nations[side],net=e.net[side],cargo=e.cargoHour.sides[side];
  const room=r=>{const hub=net.hubs.find(h=>h.id===r.hub);if(!hub||r.path.some(k=>!e.rails[k]||e.rails[k].damage))return 0;return Math.max(0,Math.min((n.stock.TRAIN*cfg.trainWork-net.trainUsed-cargo.train)/Math.max(1,r.path.length),hub.capacity-hub.used-(cargo.hubs[r.hub]??0),cfg.sourceFlow-(net.sources[r.source]??0)-(cargo.sources[r.source]??0),...r.path.map(k=>cfg.railFlow*e.rails[k].level-(net.edges[k]??0)-(cargo.edges[k]??0))));};
  const ordered=fairUnits(Object.keys(p.units).filter(id=>p.units[id].side===side&&c.state.units[id].alive).map(id=>({id})),u=>e.priorities[c.placements.find(x=>x.id===u.id)?.army]??3,c.clock.tick);
  for(const {id} of ordered){const a=c.divisionAttributes(id),cap=a.effective.fuelHour*12;let received=0;const routes=net.rows[id]?.routes??[];
   for(const r of routes){const amount=Math.min(n.stock.FUEL,Math.max(0,cap-(f.units[id]??0)),room(r)*25);if(amount<=1e-9)continue;const work=amount/25;n.stock.FUEL-=amount;f.units[id]=(f.units[id]??0)+amount;received+=amount;cargo.train+=work*Math.max(1,r.path.length);cargo.hubs[r.hub]=(cargo.hubs[r.hub]??0)+work;cargo.sources[r.source]=(cargo.sources[r.source]??0)+work;for(const k of r.path)cargo.edges[k]=(cargo.edges[k]??0)+work;}
   c.clock.units[id].fuel={held:f.units[id]??0,capacity:cap,consumptionHour:a.effective.fuelHour,received,reason:!cap?(a.paper.fuelHour?'缺车辆，补装后形成燃料需求':'无需燃料'):received?'燃料已按运输余量到达':!routes.length?'燃料通路未连通':n.stock.FUEL<=1e-9?'国家燃料不足：分配燃料生产线':'燃料等待日常供给与补装后的运输余量'};
  }
 }
 validateFuel(c);
}

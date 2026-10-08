import {cfg,products,sides,VERSION} from './config.mjs';
import {planNetwork} from './network.mjs';
import {hexKey as key} from '../../vendor/eastfront-digital-core/dist/index.js';
const copy=structuredClone,zero=()=>Object.fromEntries(Object.keys(products).map(k=>[k,0]));
export const equipmentNeed=(c,id)=>Object.fromEntries(Object.entries(c.econ.gear.units[id].recipe).map(([k,n])=>[k,n*c.econ.gear.units[id].base.maxDamageSteps]));
export function initialize(c){
 const e=c.econ.modern={version:VERSION,settled:0,serial:0,facilities:{},lines:{},hubs:{},rails:{},queue:[],priorities:{},nations:{},establishment:{},lastPersonnel:{},net:{},ledger:[],owners:{},initial:{},resourceSites:[]};
 for(const side of sides){const stock=zero();stock.TRAIN=c.vehicleCount(side,'TRAIN');stock.TRUCK=c.vehicleCount(side,'TRUCK');
  e.nations[side]={stock,manpower:cfg.manpower,produced:zero(),reinforced:zero(),lost:zero(),personnelSent:0,resources:{},resourceUsed:{}};
  const fs=Object.values(c.econ.ux.facilities).filter(f=>f.side===side).sort((a,b)=>a.id.localeCompare(b.id));
  fs.forEach((f,i)=>{e.facilities[f.id]={id:f.id,hex:f.hex,district:f.district,kind:i<3?'MIL':'CIV',damage:0};e.owners[f.id]=side;f.economicKind=i<3?'MIL':'CIV';
   e.resourceSites.push({id:'RESOURCE:'+f.id,hex:f.hex,capacity:copy(cfg.resourcePerIndustry)});
  });
  for(const[k,i]of Object.keys(products).map((k,i)=>[k,i]))e.lines[side+':'+k]={id:side+':'+k,side,product:k,factories:i<3?[fs[i].id]:[],priority:i+1,efficiency:cfg.efficiencyStart,progress:0,completed:0,resourceFactor:1,workDay:0,missing:[],lostWork:0};
  for(const a of c.econ.ux.armies[side])e.priorities[a.id]=a.priority;
  // Explicit replacement of old personnel packets and administrative currency.
  c.econ.accounts[side]={I:0,reserve:0,incomeI:0,spentI:0};
 }
 for(const n of c.nodes.filter(n=>['depot','junction','industry','capital'].includes(n.role))){e.hubs[n.id]={id:n.id,hex:n.hex,label:n.label,level:1,motor:0};e.owners[n.id]=c.state.hexes[n.hex].control;}
 for(const x of Object.values(c.state.edges).filter(e=>e.railway?.present)){e.rails[x.key]={id:x.key,level:1,damage:x.railway.destroyed||x.bridge?.destroyed?1:0};e.owners[x.key]=[c.state.hexes[key(x.a)].control,c.state.hexes[key(x.b)].control].join('/');}
 for(const u of Object.values(c.state.units)){e.establishment[u.id]=equipmentNeed(c,u.id);e.lastPersonnel[u.id]=c.clock.units[u.id].personnel;c.econ.supply[u.id]={stock:16,debt:0,short:0};c.econ.gear.units[u.id].staged=[];c.clock.units[u.id].carriedHours=cfg.carriedHours;}
 for(const w of Object.values(c.econ.warehouses))w.lots=[];
 for(const side of sides)c.econ.ux.vehicles[side]=[];
 for(const side of sides)e.initial[side]={stock:copy(e.nations[side].stock),personnel:cfg.manpower,held:Object.fromEntries(Object.keys(products).map(k=>[k,Object.values(c.state.units).filter(u=>u.side===side).reduce((n,u)=>n+(c.econ.gear.units[u.id].held[k]??0),0)]))};
 production(c,false);refreshNetwork(c);
}
export function available(c,f,side){return c.state.hexes[f.hex]?.control===side&&f.damage<1;}
export function refreshNetwork(c){const e=c.econ.modern;for(const side of sides)e.net[side]={...planNetwork(c.fair(side).view,e,side,c.nodes,c.clock,c.placements),tick:c.clock.tick};}
export function setLine(e,side,op){const l=e.lines[op.line];if(!l||l.side!==side||!products[op.product]||!Array.isArray(op.factories)||new Set(op.factories).size!==op.factories.length||!Number.isSafeInteger(op.priority)||op.priority<1||op.priority>9)throw Error('INVALID_PRODUCTION_LINE');
 const old=l.factories.length,added=op.factories.filter(id=>!l.factories.includes(id)).length;
 if(l.product!==op.product){l.efficiency=Math.max(.1,l.efficiency*cfg.switchRetention);l.lostWork+=l.progress;l.progress=0;l.product=op.product;}
 if(added)l.efficiency=(l.efficiency*Math.max(0,op.factories.length-added)+cfg.addedFactoryEfficiency*added)/Math.max(1,op.factories.length);
 l.factories=[...op.factories];l.priority=op.priority;
 return {lostWork:l.lostWork,efficiency:l.efficiency,oldFactories:old};
}
export function production(c,settle=true){const e=c.econ.modern;
 for(const side of sides){const n=e.nations[side],supply={steel:0,tungsten:0,chromium:0,rubber:0};for(const s of e.resourceSites)if(c.state.hexes[s.hex].control===side)for(const[k,v]of Object.entries(s.capacity))supply[k]+=v;
  n.resources=copy(supply);n.resourceUsed=Object.fromEntries(Object.keys(supply).map(k=>[k,0]));
  for(const l of Object.values(e.lines).filter(l=>l.side===side).sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id))){const fs=l.factories.map(id=>e.facilities[id]).filter(f=>f&&available(c,f,side)&&f.kind==='MIL'),p=products[l.product],factoryCount=fs.reduce((v,f)=>v+1-f.damage,0);l.missing=[];let factor=1;
   for(const[k,r]of Object.entries(p.resources)){const need=r*factoryCount,got=Math.min(need,supply[k]);supply[k]-=got;n.resourceUsed[k]+=got;if(need>got+1e-8){factor=Math.min(factor,got/need);l.missing.push({resource:k,need,got});}}
   l.resourceFactor=factor;l.workDay=cfg.militaryWorkDay*factoryCount*l.efficiency*factor;
   if(!factoryCount||!settle)continue;l.progress+=l.workDay/cfg.ticksPerDay;l.efficiency=Math.min(cfg.efficiencyCap,l.efficiency+cfg.efficiencyGainDay/cfg.ticksPerDay*factor);
   const qty=Math.floor((l.progress+1e-9)/p.cost);if(qty){l.progress=Math.max(0,l.progress-qty*p.cost);l.completed+=qty;n.stock[l.product]+=qty;n.produced[l.product]+=qty;e.ledger.push({kind:'PRODUCED',tick:c.clock.tick,side,line:l.id,type:l.product,qty});}
  }
 }
}
function construction(c){const e=c.econ.modern;
 for(const side of sides){let work=Object.values(e.facilities).filter(f=>f.kind==='CIV'&&available(c,f,side)).reduce((n,f)=>n+cfg.civilWorkDay*(1-f.damage)/cfg.ticksPerDay,0);
  for(const q of e.queue.filter(q=>q.side===side&&q.status!=='DONE').sort((a,b)=>a.priority-b.priority||a.serial-b.serial)){
   if(c.state.hexes[q.hex]?.control!==side||q.other&&c.state.hexes[q.other]?.control!==side){q.status='OCCUPIED';continue;}q.status='BUILDING';const used=Math.min(work,q.cost-q.progress);q.progress+=used;work-=used;if(q.progress<q.cost-1e-8)continue;
   if(q.kind==='RAIL')e.rails[q.target].level++;
   else if(q.kind==='REPAIR_RAIL'){e.rails[q.target].damage=0;const x=c.state.edges[q.target];x.railway.destroyed=false;x.railway.repairedBy=side;if(x.bridge)x.bridge.destroyed=false;}
   else if(q.kind==='REPAIR_FACTORY')e.facilities[q.target].damage=0;
   else if(q.kind==='HUB')e.hubs[q.target].level++;
   else {const id='FACTORY:'+q.id;e.facilities[id]={id,hex:q.hex,district:q.target,kind:q.kind,damage:0};e.owners[id]=side;const district=c.district(q.hex),w=Object.values(c.econ.warehouses).find(w=>w.node===q.hex);c.econ.ux.facilities[id]={id,hex:q.hex,district:district.id,warehouse:w?.id,side,status:'BUILT',economicKind:q.kind,slot:Object.values(e.facilities).filter(f=>f.district===district.id).length-1};}
   q.status='DONE';e.ledger.push({kind:'BUILT',tick:c.clock.tick,side,project:q.id,type:q.kind,target:q.target});if(work<=0)break;
  }
 }
}
function reinforcement(c){const e=c.econ.modern;const hour=Math.floor(c.clock.tick/cfg.networkTicks);if(e.cargoHour?.hour!==hour)e.cargoHour={hour,sides:Object.fromEntries(sides.map(s=>[s,{train:0,edges:{},hubs:{},sources:{}}]))};
 for(const side of sides){const n=e.nations[side],net=e.net[side],cargo=e.cargoHour.sides[side],capacity=(route)=>{if(!route?.route)return 0;const r=route.route,h=net.hubs.find(h=>h.id===r.hub);return Math.max(0,Math.min((n.stock.TRAIN*cfg.trainWork-net.trainUsed-cargo.train)/Math.max(1,r.path.length),h.capacity-h.used-(cargo.hubs[h.id]??0),cfg.sourceFlow-(net.sources[r.source]??0)-(cargo.sources?.[r.source]??0),...r.path.map(id=>cfg.railFlow*e.rails[id].level-(net.edges[id]??0)-(cargo.edges[id]??0))));},pay=(route,q)=>{if(!q)return;const r=route.route;cargo.sources??={};cargo.sources[r.source]=(cargo.sources[r.source]??0)+q;cargo.train+=q*Math.max(1,r.path.length);cargo.hubs[r.hub]=(cargo.hubs[r.hub]??0)+q;for(const id of r.path)cargo.edges[id]=(cargo.edges[id]??0)+q;},units=Object.values(c.state.units).filter(u=>u.alive&&u.side===side).sort((a,b)=>{const army=u=>c.placements.find(p=>p.id===u.id)?.army;return(e.priorities[army(a)]??3)-(e.priorities[army(b)]??3)||a.id.localeCompare(b.id);});
  for(const u of units){const v=c.clock.units[u.id],g=c.econ.gear.units[u.id],daily=net.rows[u.id],routes=(daily?.routes??[]).map(route=>({route})).sort((a,b)=>capacity(b)-capacity(a)||a.route.hub.localeCompare(b.route.hub)),route=routes[0]??daily,access=route?.route?1:0,factor=access*(v.engaged?cfg.combatReinforcement:v.march?cfg.marchReinforcement:1),sent=Math.min(n.manpower,v.max-v.personnel,cfg.personnelDay/cfg.ticksPerDay*factor,capacity(route)*50),items={};
   v.refillStatus={tick:c.clock.tick,capacity:capacity(route),route:route?.route??null,reason:!route?.route?'后方补充通路未接通':capacity(route)<=1e-9?'日常供给已占满运输能力':'可按速率部分补充'};
   if(sent>0){n.manpower-=sent;n.personnelSent+=sent;v.personnel+=sent;pay(route,sent/50);}
   for(const[k,required]of Object.entries(e.establishment[u.id])){const logisticsReserve=k==='TRUCK'?net.trucksUsed:k==='TRAIN'?Math.ceil(net.trainUsed/cfg.trainWork):0,amount=Math.max(0,Math.min(n.stock[k]-logisticsReserve,required-g.held[k],cfg.equipmentDay/cfg.ticksPerDay*factor,capacity(route)/(1+products[k].cost/8)));if(amount>1e-9){n.stock[k]-=amount;g.held[k]+=amount;n.reinforced[k]+=amount;items[k]=amount;pay(route,amount*(1+products[k].cost/8));}}
   if(sent>1e-9||Object.keys(items).length){e.ledger.push({kind:'REFILLED',tick:c.clock.tick,side,unit:u.id,personnel:sent,items,engaged:!!v.engaged,route:route.route});}
   u.step=Math.min(g.base.maxDamageSteps-1,Math.max(0,Math.floor((v.max-v.personnel)/100)));e.lastPersonnel[u.id]=v.personnel;
  }
 }
}
export function equipmentLoss(c){const e=c.econ.modern;if(!e)return;
 for(const u of Object.values(c.state.units)){const v=c.clock.units[u.id],delta=Math.max(0,e.lastPersonnel[u.id]-v.personnel),g=c.econ.gear.units[u.id],loss={};for(const[k,required]of Object.entries(e.establishment[u.id])){const qty=u.alive?Math.min(g.held[k],required*delta/v.max):g.held[k];if(qty){g.held[k]-=qty;e.nations[u.side].lost[k]+=qty;loss[k]=qty;}}e.lastPersonnel[u.id]=v.personnel;if(Object.keys(loss).length)e.ledger.push({kind:'LOSS',tick:c.clock.tick,side:u.side,unit:u.id,items:loss});}
}
export function ownership(c){const e=c.econ.modern;if(!e)return;
 for(const f of Object.values(e.facilities)){const side=c.state.hexes[f.hex].control;if(e.owners[f.id]!==side){e.owners[f.id]=side;f.damage=Math.max(.5,f.damage);for(const l of Object.values(e.lines))l.factories=l.factories.filter(id=>id!==f.id);}}
 for(const r of Object.values(e.rails)){const x=c.state.edges[r.id],owners=[c.state.hexes[key(x.a)].control,c.state.hexes[key(x.b)].control].join('/');if(e.owners[r.id]!==owners){e.owners[r.id]=owners;r.damage=Math.max(.25,r.damage);x.railway.destroyed=true;}}
}
export function step(c){const e=c.econ.modern;if(e.settled>=c.clock.tick)throw Error('ECONOMY_TICK_ALREADY_SETTLED');production(c);construction(c);ownership(c);
 e.networkSignatures??={};
 for(const side of sides){const view=c.fair(side).view,sig=JSON.stringify([view.units.map(u=>[u.id,key(u.hex)]),view.hexes.filter(h=>h.control===side).map(h=>key(h.coord)),view.edges.filter(x=>x.railway?.present).map(x=>[x.key,x.railway.destroyed,x.bridge?.destroyed,e.rails[x.key]?.level,e.rails[x.key]?.damage]),Object.values(e.hubs).filter(h=>view.hexes.some(x=>key(x.coord)===h.hex&&x.control===side)).map(h=>[h.id,h.level,h.motor])]);
  if(c.clock.tick%cfg.networkTicks===0||sig!==e.networkSignatures[side]){e.net[side]={...planNetwork(view,e,side,c.nodes,c.clock,c.placements),tick:c.clock.tick};e.networkSignatures[side]=sig;}
 }

 for(const u of Object.values(c.state.units).filter(u=>u.alive)){const v=c.clock.units[u.id],r=e.net[u.side].rows[u.id],ratio=r?.ratio??0;v.carriedHours=Math.max(0,Math.min(cfg.carriedHours,v.carriedHours+(ratio>=.99?.5:-(1-ratio))*5/60));const effective=Math.max(ratio,v.carriedHours>0?.65:0);v.dailySupply={...r,effective,carriedHours:v.carriedHours};c.econ.supply[u.id].stock=16*effective;c.econ.supply[u.id].debt=0;}
 reinforcement(c);e.settled=c.clock.tick;c.econ.epoch=Math.floor(c.clock.tick/cfg.networkTicks);c.state.turn=1+c.econ.epoch;
}

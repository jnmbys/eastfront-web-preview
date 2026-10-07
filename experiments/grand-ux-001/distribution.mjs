import {capacity} from './equipment.mjs';
export function demand(c,side,view){const targets=[];
 for(const u of view.units.filter(u=>u.side===side&&u.friendly?.alive)){
  const army=c.placements.find(p=>p.id===u.id)?.army,a=c.econ.ux.armies[side].find(a=>a.id===army);if(!a?.materials)continue;
  const g=c.econ.gear.units[u.id],need=capacity(c,u.id),cargo={};
  for(const[k,n]of Object.entries(g.recipe))cargo[k]=Math.max(0,need[k]-g.held[k])+n*(u.step>0?1:0);
  cargo.P=u.step>0?1:0;for(const l of g.staged)if(l.availableTurn<Number.MAX_SAFE_INTEGER)cargo[l.type]=Math.max(0,(cargo[l.type]??0)-l.qty);
  targets.push({unit:u.id,army,priority:a.priority,cargo});
 }return {targets:targets.sort((a,b)=>a.priority-b.priority||a.unit.localeCompare(b.unit)),unserved:[]};
}
export function shipEquipment(c,{side,view,net,ws,cap,physical,epoch,log,demand,config}){
 const b=cap.b,factories=ws.filter(w=>c.econ.ux.lines[w.id]);
 let PNeeded=demand.targets.reduce((n,t)=>n+t.cargo.P,0)-factories.reduce((n,w)=>n+w.lots.filter(l=>l.type==='P').reduce((v,l)=>v+l.qty,0),0),transfers=0;
 for(const w of factories){while(PNeeded>0&&transfers<config.personnelTransfersPerSidePerEpoch&&c.econ.accounts[side].reserve>0&&c.econ.accounts[side].I>=config.personnelCostI&&w.lots.reduce((n,l)=>n+l.qty,0)<w.capacity){
  const a=c.econ.accounts[side];a.reserve--;a.personnelCommitted++;a.I-=config.personnelCostI;a.spentI+=config.personnelCostI;
  const lot={id:`RESERVE:${side}:${epoch}:${transfers}`,type:'P',qty:1,availableTurn:epoch+1,origin:'TRAINED_RESERVE'};w.lots.push(lot);log.production.push({side,...structuredClone(lot),paidI:config.personnelCostI,completeEpoch:epoch});transfers++;PNeeded--;
 }}
 for(const target of demand.targets){const unit=c.state.units[target.unit];for(const[type,need0]of Object.entries(target.cargo)){
  let need=need0;if(!need)continue;const options=[];
  for(const from of factories)for(const to of ws){const path=net.rail(from.node,to.node),mile=net.mile(to.node,`${unit.hex.q},${unit.hex.r}`);if(path&&mile)options.push({from,to,r:{path,station:to.id,mile}});}
  options.sort((a,b)=>(c.econ.ux.lines[a.from.id].priority-c.econ.ux.lines[b.from.id].priority)||a.r.path.length+a.r.mile.cost-b.r.path.length-b.r.mile.cost||a.from.id.localeCompare(b.from.id));
  const load=type==='P'?4:config.products[type].load;if(options[0])cap.demand(options[0].r,need*load);
  for(const{from,to,r}of options){if(!physical(r))continue;const qty=Math.min(need,c.available(from,type,epoch),Math.floor(cap.room(r)/load));if(!qty)continue;
   const id=`AUTO:${side}:${epoch}:${c.econ.shipments.length}`,lots=c.take(from,type,qty,epoch);cap.spend(r,qty*load);
   const shipment={id,side,from:from.id,to:to.id,unit:unit.id,type,qty,status:'DELIVERED',arrivalEpoch:epoch,availableTurn:epoch+1,path:r.path,lastMile:r.mile,load:qty*load,custody:['REAR','RESERVED','IN_TRANSIT','STATION','UNIT_STAGED']};
   for(const l of lots)c.econ.gear.units[unit.id].staged.push({...l,id:`${id}:${l.id}`,origin:l.id,availableTurn:epoch+1});c.econ.shipments.push(shipment);log.shipping.push(structuredClone(shipment));b.deliveries.push({kind:'EQUIPMENT',unit:unit.id,type,qty,load:qty*load,...structuredClone(r)});need-=qty;if(!need)break;
  }if(need)b.blocked.push({unit:unit.id,type,qty:need,reason:!options.length?'LINE_OR_SERVICE_RANGE':options.every(o=>c.available(o.from,type,epoch)===0)?'MATERIAL_SHORTAGE':'TRANSPORT_CAPACITY'});
 }}
 // Vehicles go to exactly one custodian: unit delivery first, then transport pool.
 for(const w of factories)for(const type of ['TRAIN','TRUCK']){const qty=c.available(w,type,epoch);if(!qty)continue;
  const outstanding=type==='TRUCK'&&demand.targets.some(t=>t.cargo.TRUCK>c.econ.gear.units[t.unit].staged.filter(l=>l.type==='TRUCK').reduce((n,l)=>n+l.qty,0));if(outstanding)continue;
  for(const l of c.take(w,type,qty,epoch))c.econ.ux.vehicles[side].push({...l,id:`POOL:${l.id}`,availableTurn:epoch+1});
 }
}

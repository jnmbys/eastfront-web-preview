import fs from 'node:fs';
import {Campaign as OriginalCampaign} from '../grand-campaign-001/authority.mjs';
import {config as old,sides} from '../grand-campaign-001/scenario.mjs';
import {playerSnapshot} from '../../.ai003-preview/server/playerSnapshot.js';
import * as core from '../../vendor/eastfront-digital-core/dist/index.js';
import {routing,createCapacity} from './routes.mjs';
import {createScenario} from '../grand-campaign-003/scenario.mjs';
import * as gear from './equipment.mjs';
import {shipEquipment,demand as equipmentDemand} from './distribution.mjs';
export const config=JSON.parse(fs.readFileSync(new URL('./config.json',import.meta.url),'utf8'));
config.products=gear.products;
const copy=structuredClone,kh=core.hexKey,fail=s=>{throw Error(s);};
export class Campaign extends OriginalCampaign {
 constructor(){super(createScenario);this.econ.ux={
  lines:Object.fromEntries(this.nodes.filter(n=>n.role==='industry').map(n=>[n.id,{id:n.id,side:n.side,product:'IDLE',progress:Object.fromEntries(Object.keys(config.products).map(k=>[k,0])),completed:Object.fromEntries(Object.keys(config.products).map(k=>[k,0])),factories:[`FACTORY:${n.id}:1`],priority:3,workAssigned:0}])),
  vehicles:Object.fromEntries(sides.map(side=>[side,Object.entries(config.initialVehiclesPerSide).map(([type,qty])=>({id:`INITIAL:${side}:${type}`,type,qty,availableTurn:1}))])),
  armies:Object.fromEntries(sides.map(side=>[side,[...new Set(this.placements.filter(p=>p.side===side).map(p=>p.army))].map(id=>({id,priority:config.initialArmyPriority,materials:config.initialAutoMaterials,reserve:0}))])),
  // Initial deployment zones are public scenario information, not a hidden-state query.
  known:Object.fromEntries(sides.map(side=>[side,Object.fromEntries(this.scenario.deployment.zones[side].hexes.map(h=>[kh(h),side]))])),
  last:[]
 };gear.initialize(this);this.econ.ux.facilities=Object.fromEntries(this.nodes.filter(n=>n.role==='industry').map(n=>[`FACTORY:${n.id}:1`,{id:`FACTORY:${n.id}:1`,warehouse:n.id,side:n.side,status:'BUILT'}]));}
 recoveryReady(id){return !gear.repairPlan(this,id).missing.length;}
 payRecovery(id,request){gear.payRepair(this,id,request);}
 capture(action){const before=this._beforeAction;super.capture(action);if(before)gear.recordLoss(this,before);}
 serviceAllowed(w,side){return true;}
 vehicleCount(side,type,turn=this.state.turn){return this.econ.ux.vehicles[side].filter(v=>v.type===type&&v.availableTurn<=turn).reduce((n,v)=>n+v.qty,0);}
 fair(side){const view=playerSnapshot(this.match,side),known={...this.econ.ux.known[side]};for(const h of view.hexes)if(h.control!==null&&h.control!==undefined)known[kh(h.coord)]=h.control;return {view,known};}
 transaction(req,delegated=false){
  if(!req.operation){this._beforeAction=copy(this.state);gear.sync(this);const support=req.action?.support?.attackerArtilleryUnitId??req.action?.reaction?.artilleryUnitId;if(support&&this.econ.gear.units[support]?.ratio<1)fail('ARTILLERY_EQUIPMENT_INCOMPLETE');try{return super.transaction(req,delegated);}finally{gear.sync(this);this._beforeAction=null;}}
  if(typeof req.id!=='string'||req.id.length<8)fail('REQUEST_ID_REQUIRED');const signature=JSON.stringify({version:req.version,action:req.action,operation:req.operation});
  if(this.receipts.has(req.id)){const x=this.receipts.get(req.id);if(x.signature!==signature)fail('ID_REUSE_CONFLICT');return copy(x.result);}
  if(req.version!==this.version)fail('STALE_VERSION');if(this.match.status!=='ACTIVE')fail('GAME_OVER');if(this.state.pendingDecision||this.viewer!==this.state.activeSide)fail('NOT_ACTIVE_SERVICE_WINDOW');
  const next=copy(this.econ.ux),op=req.operation;
  if(op.type==='PRODUCTION_LINE'){
   const w=this.ownWarehouse(op.warehouse),line=next.lines[w.id];if(!line||!['IDLE',...Object.keys(config.products)].includes(op.product))fail('INVALID_FACTORY_LINE');const ids=op.factories??line.factories;if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some(id=>!next.facilities[id]||next.facilities[id].warehouse!==w.id||next.facilities[id].side!==this.viewer||next.facilities[id].status!=='BUILT'))fail('FACTORY_ALLOCATION_INVALID');
   if(Object.values(next.lines).some(l=>l.id!==line.id&&l.factories.some(id=>ids.includes(id))))fail('FACTORY_ALREADY_ASSIGNED');
   if(op.priority!==undefined&&(!Number.isSafeInteger(op.priority)||op.priority<1||op.priority>5))fail('INVALID_PRIORITY');line.factories=ids;line.priority=op.priority??line.priority;line.product=op.product;
  }else if(op.type==='ARMY_PRIORITY'){
   const a=next.armies[this.viewer].find(a=>a.id===op.army);if(!a||!Number.isSafeInteger(op.priority)||op.priority<config.priorityMin||op.priority>config.priorityMax||typeof op.materials!=='boolean'||!Number.isSafeInteger(op.reserve)||op.reserve<0||op.reserve>config.maxReservePackagesPerArmy)fail('INVALID_ARMY_PRIORITY');
   Object.assign(a,{priority:op.priority,materials:op.materials,reserve:op.reserve});
  }else fail('USE_CONTINUOUS_LINES_AND_ARMY_PRIORITIES');
  this.econ.ux=next;this.version++;this.match.matchRevision=this.version;const result={ok:true,version:this.version,ms:0};this.receipts.set(req.id,{signature,result});return result;
 }
 // Demands aggregate on actual service depots. Material recovery remains same-hex Core service.
 demand(side,view,net){return equipmentDemand(this,side,view);}
 finishEpoch(epoch){
  if(this.econ.epoch>=epoch)fail('EPOCH_ALREADY_SETTLED');
  const log={epoch,income:[],production:[],supply:[],shipping:[],care:[],transport:[],vp:{GERMAN:0,SOVIET:0},factories:[]};
  for(const n of this.nodes){const side=this.state.hexes[n.hex].control;if(!side)continue;log.vp[side]+=n.vp;const line=this.econ.ux.lines[n.id],active=line&&line.side===side&&line.product!=='IDLE'&&line.factories.length>0;
   // The same industrial output is allocated either to work OR to I, never both.
   if(n.incomeI&&!active){const a=this.econ.accounts[side];a.I+=n.incomeI;a.incomeI+=n.incomeI;log.income.push({node:n.id,side,I:n.incomeI});}
   if(!active)continue;const spec=config.products[line.product],w=this.econ.warehouses[n.id];const work=line.factories.filter(id=>this.econ.ux.facilities[id]?.status==='BUILT').length*config.factoryWorkPerEpoch;line.workAssigned+=work;line.progress[line.product]+=work;
   let produced=0;while(line.progress[line.product]>=spec.work){if(w.lots.reduce((n,l)=>n+l.qty,0)+spec.output>w.capacity)break;
    line.progress[line.product]-=spec.work;line.completed[line.product]+=spec.output;const lot={id:`LINE:${n.id}:${line.product}:${line.completed[line.product]}`,type:line.product,qty:spec.output,availableTurn:epoch+1,origin:n.id};
    w.lots.push(lot);produced+=spec.output;log.production.push({side,...copy(lot),completeEpoch:epoch});}
   log.factories.push({side,id:n.id,product:line.product,work,produced,remaining:line.progress[line.product]});
  }
  for(const side of sides){
   const {view,known}=this.fair(side);this.econ.ux.known[side]=known;const net=routing(view,known,this.rules,config),ws=Object.values(this.econ.warehouses).filter(w=>w.owner===side&&this.serviceAllowed(w,side)&&(view.hexes.find(h=>kh(h.coord)===w.node)?.control??known[w.node])===side);
   const sources=this.nodes.filter(n=>n.sourceQ&&this.serviceAllowed({node:n.hex},side)&&(view.hexes.find(h=>kh(h.coord)===n.hex)?.control??known[n.hex])===side),stock=Object.fromEntries(sources.map(s=>[s.id,s.sourceQ]));
   const cap=createCapacity(config,this.vehicleCount(side,'TRAIN',epoch),this.vehicleCount(side,'TRUCK',epoch)),b=cap.b;
   const armies=this.econ.ux.armies[side],armyOf=u=>this.placements.find(p=>p.id===u.id)?.army,priority=u=>armies.find(a=>a.id===armyOf(u))?.priority??3;
   const units=view.units.filter(u=>u.side===side&&u.friendly?.alive).sort((a,b)=>priority(a)-priority(b)||a.id.localeCompare(b.id));
   const routes=new Map(units.map(u=>{const choices=[];for(const w of ws){const mile=net.mile(w.node,kh(u.hex));if(!mile)continue;for(const s of sources){const path=net.rail(s.hex,w.node);if(path)choices.push({station:w.id,source:s.id,path,mile});}}choices.sort((a,b)=>a.path.length+a.mile.cost-b.path.length-b.mile.cost||a.station.localeCompare(b.station));return[u.id,choices];}));
   // Authority validates submitted routes only, never supplies alternatives to the planner.
   const physical=r=>{
    const own=this.state.hexes[this.econ.warehouses[r.station].node]?.control===side;if(!own)return false;
    if(r.path.some(k=>{const e=this.state.edges[k];return !e?.railway?.present||e.railway.destroyed||e.bridge?.destroyed||this.state.hexes[kh(e.a)].control!==side||this.state.hexes[kh(e.b)].control!==side||side==='GERMAN'&&e.railway.repairedBy!=='GERMAN';}))return false;
    const ownHex=new Set(Object.values(this.state.units).filter(u=>u.alive&&u.side===side).map(u=>kh(u.hex))),blocked=new Set();for(const u of Object.values(this.state.units).filter(u=>u.alive&&u.side!==side)){blocked.add(kh(u.hex));if(this.rules.unitTemplates[u.templateId].exertsZoc)for(const h of core.getNeighbors(u.hex))if(!ownHex.has(kh(h)))blocked.add(kh(h));}
    const routeHex=[...r.path.flatMap(k=>[kh(this.state.edges[k].a),kh(this.state.edges[k].b)]),...r.mile.hexes];return routeHex.every(k=>this.state.hexes[k]?.control===side&&!blocked.has(k))&&r.mile.path.every(k=>{const e=this.state.edges[k];return !e?.bridge?.destroyed&&!(e?.river==='MAJOR'&&!e.bridge);});
   };
   const deliver=(u,need,kind)=>{if(!need)return 0;let got=0;const choices=routes.get(u.id);if(choices[0])cap.demand(choices[0],need);
    for(const r of choices){if(!physical(r)){b.blocked.push({unit:u.id,kind,reason:'ROUTE_UNAVAILABLE',qty:need-got});break;}
     const q=Math.min(need-got,stock[r.source],cap.room(r));if(q){cap.spend(r,q);stock[r.source]-=q;got+=q;b.deliveries.push({unit:u.id,army:armyOf(u),kind,qty:q,...copy(r)});}if(got===need)break;}
    if(got<need)b.blocked.push({unit:u.id,army:armyOf(u),kind,qty:need-got,reason:!choices.length?'LINE_OR_SERVICE_RANGE':choices.every(r=>stock[r.source]===0)?'MATERIAL_SHORTAGE':cap.reason(choices.find(r=>stock[r.source]>0)??choices[0])});return got;};
   // Mandatory maintenance uses on-hand SP before any new transport; no player priority can demote it below equipment.
   for(const u of units){const s=this.econ.supply[u.id],before=copy(s),due=this.due(this.state.units[u.id]),received=deliver(u,Math.max(0,due-s.stock),'MAINTENANCE');s.stock+=received;const paid=Math.min(due,s.stock);s.stock-=paid;s.debt=paid===due?Math.max(0,s.debt-due):s.debt+due-paid;s.short=paid===due?0:s.short+1;let loss=0;
    if(s.short>=old.supply.shortageLossEvery){s.short=0;loss=1;const real=this.state.units[u.id];if(real.step+1>=this.rules.unitTemplates[real.templateId].maxDamageSteps)real.alive=false;else real.step++;}
    log.supply.push({side,id:u.id,army:armyOf(u),before,due,received,paid,loss,after:copy(s),refill:0});}
   const demand=this.demand(side,view,net);shipEquipment(this,{side,view,net,ws,cap,physical,epoch,log,demand,config});
   for(const u of units.filter(u=>this.state.units[u.id].alive)){const s=this.econ.supply[u.id],got=deliver(u,old.supply.maxStockQ-s.stock,'RESERVE');s.stock+=got;const line=log.supply.find(x=>x.id===u.id);line.refill=got;line.after=copy(s);}
   log.transport.push({side,...b,sourceRemaining:stock,edgeCapacity:config.railEdgeQ,demand,metrics:net.metrics()});
  }
  for(const w of Object.values(this.econ.warehouses)){const P=w.lots.filter(l=>l.type==='P'&&l.availableTurn<Number.MAX_SAFE_INTEGER).reduce((n,l)=>n+l.qty,0);if(!P)continue;const a=this.econ.accounts[w.owner],cost=Math.ceil(P/4)*old.economy.careIperFourPperEpoch;
   if(a.I>=cost){a.I-=cost;a.spentI+=cost;log.care.push({warehouse:w.id,P,I:cost,status:'PAID'});}else{for(const l of w.lots)if(l.type==='P')l.availableTurn=Number.MAX_SAFE_INTEGER;log.care.push({warehouse:w.id,P,I:0,status:'QUARANTINED_NO_AUTO_REVIVAL'});}}
  for(const [id,g] of Object.entries(this.econ.gear.units)){const P=g.staged.filter(l=>l.type==='P'&&l.availableTurn<Number.MAX_SAFE_INTEGER).reduce((n,l)=>n+l.qty,0);if(!P)continue;const side=this.state.units[id].side,a=this.econ.accounts[side],cost=Math.ceil(P/4)*old.economy.careIperFourPperEpoch;
   const paid=a.I>=cost;if(paid){a.I-=cost;a.spentI+=cost;}else for(const l of g.staged)if(l.type==='P')l.availableTurn=Number.MAX_SAFE_INTEGER;
   log.care.push({unit:id,side,P,I:paid?cost:0,status:g.staged.some(l=>l.type==='P'&&l.availableTurn===Number.MAX_SAFE_INTEGER)?'QUARANTINED':'PAID'});
  }
  gear.recordLoss(this,this._beforeAction??this.state);gear.receive(this,epoch+1);
  this.econ.epoch=epoch;this.econ.ledger.push(log);
  if(epoch===old.turns){const {GERMAN:g,SOVIET:s}=log.vp;this.state.turn=epoch;this.state.phase='GAME_OVER';this.state.victory={winner:g===s?null:g>s?'GERMAN':'SOVIET',reason:g===s?'GRAND_VP_DRAW':'GRAND_VP_FINAL',turn:epoch,checkedAtPhase:'SOVIET_ENTRENCHMENT'};this.match.status='FINISHED';}
  this.syncSupply();return log;
 }
 snapshot(draft){const d=super.snapshot(draft),side=this.viewer,last=d.lastLedger?.transport?.[0];
  d.ux={id:config.id,lines:Object.values(this.econ.ux.lines).filter(l=>l.side===side).map(l=>({...copy(l),label:this.nodes.find(n=>n.id===l.id).label,hex:this.econ.warehouses[l.id].node,controlled:d.warehouses.find(w=>w.id===l.id).controlled})),products:config.products,work:config.factoryWorkPerEpoch,
   armies:copy(this.econ.ux.armies[side]).map(a=>({...a,units:d.units.filter(u=>u.alive&&u.army===a.id).length,damage:d.units.filter(u=>u.alive&&u.army===a.id).reduce((n,u)=>n+u.step,0),missingSP:d.units.filter(u=>u.alive&&u.army===a.id).reduce((n,u)=>n+Math.max(0,u.due-u.stock),0)/4,missingE2:last?.blocked.filter(x=>x.type==='E2'&&x.armies?.includes(a.id)).reduce((n,x)=>n+x.qty,0)??0})),
   vehicles:Object.fromEntries(['TRAIN','TRUCK'].map(type=>[type,{available:this.vehicleCount(side,type),pending:this.econ.ux.vehicles[side].filter(v=>v.type===type&&v.availableTurn>this.state.turn).reduce((n,v)=>n+v.qty,0),needed:last?Math.ceil((type==='TRAIN'?last.trainDemand:last.truckDemand)/(type==='TRAIN'?config.trainWorkPerVehicle:config.truckWorkPerVehicle)):null}])),last:last??null};
  d.ux.catalog=config.products;d.ux.equipment=d.units.map(u=>({id:u.id,...copy(this.econ.gear.units[u.id]),required:gear.capacity(this,u.id),repair:gear.repairPlan(this,u.id),stats:copy(this.rules.unitTemplates[this.state.units[u.id].templateId].steps[this.state.units[u.id].step])}));
  d.ux.facilities=Object.values(this.econ.ux.facilities).filter(f=>f.side===side);d.ux.deficit=Object.fromEntries(Object.keys(config.products).map(k=>[k,d.ux.equipment.reduce((n,g)=>n+Math.max(0,(g.required[k]??0)-(g.held[k]??0))+(this.state.units[g.id].step>0?(g.recipe[k]??0):0),0)]));
  // New fields on the shared ledger are also seat-private.
  if(d.lastLedger)d.lastLedger.factories=d.lastLedger.factories.filter(x=>x.side===side);return d;
 }
}

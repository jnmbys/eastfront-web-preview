import crypto from 'node:crypto';
import * as core from '../../vendor/eastfront-digital-core/dist/index.js';
import {createScenario,config,sides} from './scenario.mjs';
import {queryModel,forcedAction,validateIntent,recordAcceptedIntent} from '../../.ai003-preview/server/gameplay.js';
import {playerSnapshot} from '../../.ai003-preview/server/playerSnapshot.js';
import {isNetworkAction,isQueryDraft} from '../../.ai003-preview/src/multiplayer/gameplayProtocol.js';
const copy=structuredClone,kh=core.hexKey;
function fail(code){throw Error(code);}
export class Campaign {
 constructor(scenarioFactory=createScenario){
  const {rules,scenario,state,engine,nodes,placements}=scenarioFactory();
  this.seq=0;this.id=crypto.randomUUID();this.viewer='GERMAN';this.version=0;this.receipts=new Map();this.rules=rules;this.scenario=scenario;this.nodes=nodes;this.placements=placements;
  this.match={id:this.id,matchId:this.id,authoritative:{state,rules,scenario,engine,activeViewerControllerId:this.viewer,lastResult:null,integrityIssues:[]},controllerAssignments:sides.map(side=>({controllerId:side,coreControllerId:side,viewer:side,seat:side})),status:'ACTIVE',matchRevision:0,actionSequence:0,disclosedBattles:{GERMAN:new Set(),SOVIET:new Set()},battleSummaries:{GERMAN:{entries:new Map(),olderOmitted:false},SOVIET:{entries:new Map(),olderOmitted:false}}};
  this.econ={epoch:0,accounts:Object.fromEntries(sides.map(s=>[s,{initialI:config.economy.initialI,incomeI:0,spentI:0,I:config.economy.initialI,reserve:config.economy.trainedReservePerSide,personnelCommitted:0}])),warehouses:Object.fromEntries(nodes.filter(n=>['industry','depot'].includes(n.role)).map(n=>[n.id,{id:n.id,owner:n.side,node:n.hex,capacity:config.economy.warehouseCapacity,lots:[]}])),orders:[],shipments:[],uses:[],ledger:[],supply:Object.fromEntries(Object.values(state.units).map(u=>[u.id,{stock:config.supply.initialStockQ,debt:0,short:0}]))};
  this.lastMs=0;this.syncSupply();
 }
 capture(action){
  // Explicit GRAND-only territorial occupation, absent from legacy Core movement.
  const u=action.unitId?this.state.units[action.unitId]:null;
  if(u?.alive&&['MOVE','BREAKTHROUGH'].includes(action.type))for(const h of action.path??[])this.state.hexes[kh(h)].control=u.side;
  for(const unit of Object.values(this.state.units).filter(u=>u.alive))this.state.hexes[kh(unit.hex)].control=unit.side;
 }
 get state(){return this.match.authoritative.state;}
 owner(){return this.state.pendingDecision?.side??this.state.activeSide;}
 available(w,type,turn=this.state.turn){return w.lots.filter(l=>l.type===type&&l.availableTurn<=turn).reduce((a,l)=>a+l.qty,0);}
 ownWarehouse(id){const w=this.econ.warehouses[id];if(!w||w.owner!==this.viewer||this.state.hexes[w.node].control!==this.viewer)fail('WAREHOUSE_NOT_AUTHORIZED');return w;}
 take(w,type,qty,turn=this.state.turn){if(this.available(w,type,turn)<qty)fail('MATERIAL_NOT_AVAILABLE');const taken=[];for(const l of w.lots)if(l.type===type&&l.availableTurn<=turn&&qty>0){const n=Math.min(l.qty,qty);l.qty-=n;qty-=n;taken.push({id:l.id,type,qty:n,availableTurn:l.availableTurn});}return taken;}
 network(side){
  const occupied=new Set(Object.values(this.state.units).filter(u=>u.alive&&u.side===side).map(u=>kh(u.hex))),blocked=new Set();
  for(const u of Object.values(this.state.units).filter(u=>u.alive&&u.side!==side)){blocked.add(kh(u.hex));if(this.rules.unitTemplates[u.templateId].exertsZoc)for(const h of core.getNeighbors(u.hex))if(!occupied.has(kh(h)))blocked.add(kh(h));}
  const allowed=k=>this.state.hexes[k]?.control===side&&!blocked.has(k)&&this.state.hexes[k].terrain!=='LAKE',adj=new Map();
  for(const e of Object.values(this.state.edges))if(e.railway?.present&&!e.railway.destroyed&&(!e.bridge||!e.bridge.destroyed)&&allowed(kh(e.a))&&allowed(kh(e.b))&&(side!=='GERMAN'||e.railway.repairedBy==='GERMAN')){
   for(const [a,b]of[[kh(e.a),kh(e.b)],[kh(e.b),kh(e.a)]]){if(!adj.has(a))adj.set(a,[]);adj.get(a).push({to:b,edge:e.key});}}
  const path=(from,to)=>{if(!allowed(from)||!allowed(to))return null;if(from===to)return [];const queue=[from],seen=new Map([[from,null]]);for(let i=0;i<queue.length;i++)for(const x of adj.get(queue[i])??[])if(!seen.has(x.to)){seen.set(x.to,{from:queue[i],edge:x.edge});queue.push(x.to);if(x.to===to){const out=[];let k=to;while(k!==from){const p=seen.get(k);out.unshift(p.edge);k=p.from;}return out;}}return null;};
  const lastMile=(from,to)=>{if(!allowed(from)||!allowed(to))return null;const q=[[from,0]],seen=new Set([from]);for(let i=0;i<q.length;i++){const[k,d]=q[i];if(k===to)return d;if(d>=config.transport.lastMileRadius)continue;for(const h of core.getNeighbors(this.state.hexes[k].coord)){const n=kh(h);const e=this.state.edges[core.canonicalEdgeKey(this.state.hexes[k].coord,h)];if(allowed(n)&&!seen.has(n)&&!(e?.river==='MAJOR'&&(!e.bridge||e.bridge.destroyed))){seen.add(n);q.push([n,d+1]);}}}return null;};return {path,lastMile};
 }
 due(u){return this.rules.unitTemplates[u.templateId].isArmor?config.supply.armorMaintenanceQ:config.supply.maintenanceQ;}
 syncSupply(){for(const u of Object.values(this.state.units)){const s=this.econ.supply[u.id];if(s&&s.stock===0)u.supplyState='OUT_OF_SUPPLY';}}
 costs(action){const c={};if(action.type==='MOVE'||action.type==='BREAKTHROUGH')c[action.unitId]=(action.path?.length??0)*config.supply.moveQPerHex;
  if(action.type==='ATTACK')for(const id of action.attackerUnitIds)c[id]=config.supply.attackQ;
  if(action.type==='SCHWERPUNKT_ATTACK')c[action.unitId]=config.supply.attackQ;return c;}
 finishEpoch(epoch){
  if(this.econ.epoch>=epoch)fail('EPOCH_ALREADY_SETTLED');
  const log={epoch,income:[],production:[],supply:[],shipping:[],care:[],transport:[],vp:{GERMAN:0,SOVIET:0}};
  for(const n of this.nodes){const side=this.state.hexes[n.hex].control;if(side){log.vp[side]+=n.vp;if(n.incomeI){const a=this.econ.accounts[side];a.I+=n.incomeI;a.incomeI+=n.incomeI;log.income.push({node:n.id,side,I:n.incomeI});}}}
  for(const o of this.econ.orders.filter(o=>['BUILDING','WAITING_STORE'].includes(o.status)&&o.completeEpoch<=epoch)){
   const w=this.econ.warehouses[o.warehouse],own=this.state.hexes[w.node].control===o.side;
   if(!own||w.lots.reduce((a,l)=>a+l.qty,0)+o.qty>w.capacity){o.status='WAITING_STORE';continue;}
   w.lots.push({id:`${o.id}:output`,type:o.product,qty:o.qty,availableTurn:epoch+1,origin:o.id});o.status='STORED';log.production.push(copy(o));
  }
  // WAITING_STORE retains its paid output claim and retries only at a later E.
  for(const side of sides){
   const net=this.network(side),sources=this.nodes.filter(n=>n.sourceQ&&this.state.hexes[n.hex].control===side),ws=Object.values(this.econ.warehouses).filter(w=>w.owner===side&&this.state.hexes[w.node].control===side);
   const budget={deliveries:[],source:Object.fromEntries(sources.map(s=>[s.id,s.sourceQ])),edges:{},W:Object.fromEntries(ws.map(w=>[w.id,config.transport.warehouseW])),T:config.transport.workQ};
   const units=Object.values(this.state.units).filter(u=>u.alive&&u.side===side).sort((a,b)=>a.id.localeCompare(b.id));
   const routes=new Map(units.map(u=>{const choices=[];for(const w of ws){const d=net.lastMile(w.node,kh(u.hex));if(d===null)continue;for(const s of sources){const p=net.path(s.hex,w.node);if(p)choices.push({w,s,p,d});}}choices.sort((a,b)=>a.d-b.d||a.p.length-b.p.length);return[u.id,choices];}));
   const consume=(path,w,qty,d=0)=>{budget.W[w]-=qty;budget.T-=qty*(path.length+d);for(const e of path)budget.edges[e]=(budget.edges[e]??0)+qty;};
   const room=(path,w,d=0)=>Math.max(0,Math.min(budget.W[w]??0,Math.floor(budget.T/Math.max(1,path.length+d)),...path.map(e=>config.transport.edgeQ-(budget.edges[e]??0))));
   const deliver=(u,need,kind)=>{let got=0;for(const r of routes.get(u.id)){const qty=Math.min(need-got,budget.source[r.s.id],room(r.p,r.w.id,r.d));if(qty>0){consume(r.p,r.w.id,qty,r.d);budget.source[r.s.id]-=qty;budget.deliveries.push({unit:u.id,source:r.s.id,warehouse:r.w.id,path:r.p,lastMile:r.d,qty,kind});got+=qty;}if(got===need)break;}return got;};
   // Protect feasible net maintenance before cargo and optional reserve refill.
   for(const u of units){const s=this.econ.supply[u.id],before=copy(s),due=this.due(u),received=deliver(u,Math.max(0,due-s.stock),'MAINTENANCE');s.stock+=received;const paid=Math.min(due,s.stock);s.stock-=paid;s.debt=paid===due?Math.max(0,s.debt-due):s.debt+due-paid;s.short=paid===due?0:s.short+1;let loss=0;
    if(s.short>=config.supply.shortageLossEvery){s.short=0;loss=1;if(u.step+1>=this.rules.unitTemplates[u.templateId].maxDamageSteps)u.alive=false;else u.step++;}
    log.supply.push({side,id:u.id,before,due,received,paid,loss,after:copy(s),refill:0});}
   for(const sh of this.econ.shipments.filter(x=>x.side===side&&x.status==='QUEUED')){
    const from=this.econ.warehouses[sh.from],to=this.econ.warehouses[sh.to],path=net.path(from.node,to.node),load=sh.P*config.transport.materialLoad.P+sh.E2*config.transport.materialLoad.E2;
    if(!path||this.state.hexes[to.node].control!==side||this.state.hexes[from.node].control!==side||room(path,to.id)<load||to.lots.reduce((a,l)=>a+l.qty,0)+sh.P+sh.E2>to.capacity||this.available(from,'P',epoch)<sh.P||this.available(from,'E2',epoch)<sh.E2){log.shipping.push({id:sh.id,status:'WAITING',reason:'ROUTE_CAPACITY_OR_STOCK'});continue;}
    // Source and destination ownership, inventory and all budgets commit together with E.
    const lots=[...this.take(from,'P',sh.P,epoch),...this.take(from,'E2',sh.E2,epoch)];consume(path,to.id,load);
    sh.status='DELIVERED';sh.arrivalEpoch=epoch;sh.availableTurn=epoch+1;sh.path=path;sh.load=load;
    for(const l of lots)to.lots.push({...l,id:`${sh.id}:${l.id}`,origin:l.id,availableTurn:epoch+1});log.shipping.push(copy(sh));
   }
   for(const u of units.filter(u=>u.alive)){const s=this.econ.supply[u.id],got=deliver(u,config.supply.maxStockQ-s.stock,'REFILL');s.stock+=got;const line=log.supply.find(x=>x.id===u.id);line.refill=got;line.after=copy(s);}
   log.transport.push({side,...budget,edgeCapacity:config.transport.edgeQ,workCapacity:config.transport.workQ});
  }
  // Personnel warehoused/in an unfinished request are not duplicated or automatically converted into VP.
  for(const w of Object.values(this.econ.warehouses)){const P=w.lots.filter(l=>l.type==='P').reduce((a,l)=>a+l.qty,0);if(!P)continue;const a=this.econ.accounts[w.owner],cost=Math.ceil(P/4)*config.economy.careIperFourPperEpoch;if(a.I>=cost){a.I-=cost;a.spentI+=cost;log.care.push({warehouse:w.id,P,I:cost,status:'PAID'});}else{for(const l of w.lots)if(l.type==='P')l.availableTurn=Number.MAX_SAFE_INTEGER;log.care.push({warehouse:w.id,P,I:0,status:'QUARANTINED_NO_AUTO_REVIVAL'});}}
  this.econ.epoch=epoch;this.econ.ledger.push(log);
  if(epoch===config.turns){const {GERMAN:g,SOVIET:s}=log.vp;this.state.turn=epoch;this.state.phase='GAME_OVER';this.state.victory={winner:g===s?null:g>s?'GERMAN':'SOVIET',reason:g===s?'GRAND_VP_DRAW':'GRAND_VP_FINAL',turn:epoch,checkedAtPhase:'SOVIET_ENTRENCHMENT'};this.match.status='FINISHED';}
  this.syncSupply();return log;
 }
 transaction(req){
  if(typeof req.id!=='string'||req.id.length<8)fail('REQUEST_ID_REQUIRED');const signature=JSON.stringify({version:req.version,action:req.action,operation:req.operation});
  if(this.receipts.has(req.id)){const r=this.receipts.get(req.id);if(r.signature!==signature)fail('ID_REUSE_CONFLICT');return copy(r.result);}
  if(req.version!==this.version)fail('STALE_VERSION');if(this.match.status!=='ACTIVE')fail('GAME_OVER');
  const beforeState=this.state,beforeEcon=copy(this.econ),oldStatus=this.match.status,oldRevision=this.match.matchRevision,oldSequence=this.match.actionSequence,oldBattles=copy(this.match.battleSummaries),oldDisclosed=copy(this.match.disclosedBattles);const start=performance.now();let result;
  try{
   this.match.authoritative.state=copy(beforeState);
   if(req.action){const a=req.action;if(!isNetworkAction(a)||validateIntent(this.match,this.viewer,a))fail('ACTION_NOT_AUTHORIZED');
    const costs=this.costs(a),repair=a.type==='REPAIR_UNIT';let warehouse;
    if(repair){warehouse=Object.values(this.econ.warehouses).find(w=>w.owner===this.viewer&&w.node===kh(this.state.units[a.unitId].hex)&&this.state.hexes[w.node].control===this.viewer);if(!warehouse||this.available(warehouse,'P')<1||this.available(warehouse,'E2')<2)fail('SAME_HEX_USABLE_1P_2E2_REQUIRED');}
    const views=new Map(sides.map(s=>[s,playerSnapshot(this.match,s)]));
    result=this.match.authoritative.engine.apply(this.state,{...a,controllerId:this.viewer});if(!result.accepted)fail(result.issues.map(i=>i.details?.reason??i.code).join(','));
    this.match.authoritative.state=result.state;this.capture(a);
    for(const[id,cost]of Object.entries(costs)){const s=this.econ.supply[id],paid=Math.min(cost,s.stock);s.stock-=paid;s.debt+=cost-paid;}
    if(repair){const P=this.take(warehouse,'P',1),E2=this.take(warehouse,'E2',2);this.econ.uses.push({id:`USE:${req.id}`,side:this.viewer,unitId:a.unitId,warehouse:warehouse.id,turn:this.state.turn,P,E2,rp:0});}
    if(beforeState.phase==='SOVIET_ENTRENCHMENT'&&result.state.phase!==beforeState.phase)this.finishEpoch(beforeState.turn);
    this.syncSupply();result.state=this.state;
    recordAcceptedIntent(this.match,beforeState,result,views);
   }else{
    if(this.state.pendingDecision||this.viewer!==this.state.activeSide)fail('NOT_ACTIVE_SERVICE_WINDOW');
    const op=req.operation;if(!op||typeof op.type!=='string')fail('INVALID_OPERATION');
    if(op.type==='ORDER'){
     const product=config.economy.products[op.product];if(!product)fail('UNKNOWN_PRODUCT');const w=this.ownWarehouse(op.warehouse),node=this.nodes.find(n=>n.id===w.id);if(node.role!=='industry')fail('INDUSTRY_REQUIRED');
     const a=this.econ.accounts[this.viewer];if(a.I<product.costI||a.reserve<product.reserveCost)fail('INSUFFICIENT_SOURCE');if(this.econ.orders.filter(o=>o.side===this.viewer&&o.placedTurn===this.state.turn).length>=config.economy.ordersPerSidePerTurn)fail('ORDER_LIMIT');
     a.I-=product.costI;a.spentI+=product.costI;a.reserve-=product.reserveCost;a.personnelCommitted+=product.reserveCost;
     this.econ.orders.push({id:`ORDER:${req.id}`,side:this.viewer,product:op.product,qty:product.output,paidI:product.costI,warehouse:w.id,placedTurn:this.state.turn,completeEpoch:this.state.turn+product.turns-1,status:'BUILDING'});
    }else if(op.type==='SHIP'){
     const from=this.ownWarehouse(op.from),to=this.ownWarehouse(op.to);if(from.id===to.id)fail('DIFFERENT_WAREHOUSE_REQUIRED');
     const P=op.P,E2=op.E2;if(!Number.isSafeInteger(P)||!Number.isSafeInteger(E2)||P<0||E2<0||P+E2===0||P+E2>12)fail('INVALID_CARGO');
     for(const[type,n]of[['P',P],['E2',E2]]){const reserved=this.econ.shipments.filter(s=>s.status==='QUEUED'&&s.from===from.id).reduce((v,s)=>v+s[type],0);if(this.available(from,type)-reserved<n)fail('STOCK_ALREADY_RESERVED_OR_UNAVAILABLE');}
     this.econ.shipments.push({id:`SHIP:${req.id}`,side:this.viewer,from:from.id,to:to.id,P,E2,status:'QUEUED',orderedTurn:this.state.turn});
    }else if(op.type==='CANCEL_SHIPMENT'){
     const sh=this.econ.shipments.find(s=>s.id===op.id&&s.side===this.viewer);if(!sh||sh.status!=='QUEUED')fail('CANNOT_CANCEL');sh.status='CANCELLED';
    }else fail('UNKNOWN_OPERATION');
   }
   if(performance.now()-start>3000)fail('TRANSACTION_TIMEOUT');
   this.version++;this.match.matchRevision=this.version;this.lastMs=performance.now()-start;
   const outcome={ok:true,version:this.version,ms:this.lastMs};this.receipts.set(req.id,{signature,result:outcome});return outcome;
  }catch(e){this.match.authoritative.state=beforeState;this.econ=beforeEcon;this.match.status=oldStatus;this.match.matchRevision=oldRevision;this.match.actionSequence=oldSequence;this.match.battleSummaries=oldBattles;this.match.disclosedBattles=oldDisclosed;throw e;}
 }
 projection(draft){
  if(draft&&!isQueryDraft(draft))fail('INVALID_DRAFT');
  const view=playerSnapshot(this.match,this.viewer),safe={...this.match,authoritative:{...this.match.authoritative,state:copy(this.state)}};
  const visible=new Set(view.units.map(u=>u.id));for(const[id,u]of Object.entries(safe.authoritative.state.units))if(u.side!==this.viewer&&!visible.has(id))delete safe.authoritative.state.units[id];
  const model=queryModel(safe,this.viewer,draft);model.playerView=view;model.hexes=view.hexes;model.edges=view.edges;
  if(model.recovery&&model.selectedCounter){const u=this.state.units[model.selectedCounter.id],w=Object.values(this.econ.warehouses).find(w=>w.owner===this.viewer&&w.node===kh(u.hex)&&this.state.hexes[w.node].control===this.viewer);if(!w||this.available(w,'P')<1||this.available(w,'E2')<2)model.recovery.selectedIssues.push({code:'INVALID_SUPPORT',message:'需要同格已可用1P＋2E2'});}
  return {model,view,status:this.match.status,canAct:this.owner()===this.viewer,forcedAction:forcedAction(safe,this.viewer,draft),events:[]};
 }
 snapshot(draft){
  const p=this.projection(draft),own=Object.values(this.state.units).filter(u=>u.side===this.viewer),warehouses=Object.values(this.econ.warehouses).filter(w=>w.owner===this.viewer).map(w=>({...copy(w),label:this.nodes.find(n=>n.id===w.id).label,role:this.nodes.find(n=>n.id===w.id).role,controlled:this.state.hexes[w.node].control===this.viewer,P:this.available(w,'P'),E2:this.available(w,'E2')}));
  return {scenarioId:this.scenario.id,scenarioLabel:this.scenario.displayName,instanceId:this.id,version:this.version,turn:this.state.turn,phase:this.state.phase,viewer:this.viewer,owner:this.owner(),ms:this.lastMs,
   game:{message:{messageType:'PLAYER_VIEW_SNAPSHOT',payload:{matchId:this.id,matchRevision:this.version,actionSequence:this.version,serverSequence:++this.seq,revision:this.version,format:'snapshot-v1',resync:true,...p}},meta:{humanSide:this.viewer,ownerSide:this.owner(),paused:false,manual:true,reason:'GRAND_MANUAL_LOGISTICS',accepted:this.version,rejected:0}},
   account:copy(this.econ.accounts[this.viewer]),epoch:this.econ.epoch,warehouses,orders:copy(this.econ.orders.filter(o=>o.side===this.viewer)),shipments:copy(this.econ.shipments.filter(s=>s.side===this.viewer)),
   uses:copy(this.econ.uses.filter(u=>u.side===this.viewer)),units:own.map(u=>({id:u.id,hex:kh(u.hex),label:core.axialToPaper(u.hex).label,step:u.step,alive:u.alive,army:this.placements.find(p=>p.id===u.id).army,...this.econ.supply[u.id],due:this.due(u)})),
   objectives:this.nodes.map(n=>({id:n.id,hex:n.hex,label:n.label,vp:n.vp,incomeI:n.incomeI,sourceQ:n.sourceQ,control:p.view.hexes.find(h=>kh(h.coord)===n.hex)?.control??null})),
   lastLedger:this.econ.ledger.length?{...this.econ.ledger.at(-1),income:this.econ.ledger.at(-1).income.filter(x=>x.side===this.viewer),production:this.econ.ledger.at(-1).production.filter(x=>x.side===this.viewer),supply:this.econ.ledger.at(-1).supply.filter(x=>x.side===this.viewer),shipping:this.econ.ledger.at(-1).shipping.filter(x=>this.econ.shipments.some(s=>s.id===x.id&&s.side===this.viewer)),care:this.econ.ledger.at(-1).care.filter(x=>warehouses.some(w=>w.id===x.warehouse)),transport:this.econ.ledger.at(-1).transport.filter(x=>x.side===this.viewer)}:null};
 }
}


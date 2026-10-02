// Offline conditional account. Does not import Core, invoke a solver, or create legal game events.
import assert from 'node:assert/strict';
import {hash,canonical} from './check-baseline.mjs';
const sum=(xs,f)=>xs.reduce((a,x)=>a+f(x),0);
const snap=x=>structuredClone(x);
export function candidate(saved,profile,scenario){
 const route=saved.summary.route,p=saved.summary.params,start=saved.rows.find(x=>x.newOrders>0).turn;
 const prefix=saved.rows.filter(x=>x.turn<start),prior=saved.trace[start-2],last=prefix.at(-1);
 let units=snap(prior.units),rear=last.rearE*2,depot=last.depotE*2,personnel=last.personnel,wreck=last.wreckE*2;
 assert.equal(prior.inTransit.length,0);assert.equal(last.newTotal,0);
 let batches=[],orders=[],nextOrder=0,nextBatch=0,rows=[],trace=[],fork=null;
 const z={produced:sum(prefix,x=>x.productionE*2),purchased:sum(prefix,x=>x.purchaseE*2),salvaged:sum(prefix,x=>x.reconditionE*2),repairs:sum(prefix,x=>x.recovered),rearPaid:0,frontIssued:sum(prefix,x=>x.spReceived*4),frontMaintenance:sum(prefix,x=>x.maintenancePaid*4),actions:sum(prefix,x=>x.spActionCost*4),destroyed:0,battleLoss:Math.max(0,start-3),attritionLoss:0,full:sum(prefix,x=>x.fullAttack),reduced:sum(prefix,x=>x.degradedAttack),power:sum(prefix,x=>x.attackPower)};
 for(let t=start;t<=24;t++){
  const events=[],maintRows=[],rearRows=[],entryRows=[],actions=[],owners=[];
  const event=(sequence,type,entity,data)=>events.push({id:`${route}:${scenario.id}:E${t}:${events.length}`,sequence,type,entity,...data});
  function damage(u,kind,at){if(!u?.alive)return;u.step++;u.wounds.push({at});wreck++;z[kind]++;if(u.step===3){u.alive=false;z.destroyed+=u.stock;u.stock=0;const o=orders.find(x=>x.unitId===u.id);if(o)o.status='DESTROYED';}}
  // Same exogenous old-unit damage as 003. No speculative tactical or VP consequences.
  if(t>=3)damage(units.find(u=>u.id==='O'+String((t-3)%8+1).padStart(2,'0')),'battleLoss',t);
  let entered=0;
  for(const o of orders.filter(o=>o.status==='WAITING_ENTRY').sort((a,b)=>a.acceptedTurn-b.acceptedTurn||a.id.localeCompare(b.id))){
   let reason=t<o.entryEligibleFromTurn?'NOT_YET_ELIGIBLE':o.arrearsQ>0?'ARREARS':o.lastRearPaidEpoch!==t-1?'PREVIOUS_UPKEEP_UNPAID':scenario.entryBlockedTurns.includes(t)?'ENTRY_WINDOW_BLOCKED':entered>=profile.entryCapPerTurn?'ENTRY_SLOT_FULL':null;
   if(reason){entryRows.push({order:o.id,turn:t,result:'CONDITIONAL_REJECTED',reason});continue;}
   const u={id:o.unitId,stock:0,debt:0,step:0,alive:true,born:t,wounds:[]};units.push(u);o.status='DEPLOYED';o.enteredTurn=t;o.firstActionEligibleTurn=t;entered++;
   const receipt={order:o.id,turn:t,result:'CONDITIONAL_ACCEPTED',stockQ:0,debt:0,resourceDeltaP:0,resourceDeltaE2:0,legalCoreEventId:null};entryRows.push(receipt);event(-30,'AssumedEntryReceipt',o.id,receipt);
  }
  const live=units.filter(u=>u.alive),n=live.length,depotBeforeT=depot;
  const eligible=live.filter(u=>u.step>0&&u.debt<2).sort((a,b)=>a.wounds[0].at-b.wounds[0].at||a.id.localeCompare(b.id));
  const repair=eligible.length&&depot>=2&&personnel>=1?eligible[0]:null;
  for(const u of live.filter(u=>u!==repair).sort((a,b)=>a.id.localeCompare(b.id)).slice(0,p.targets)){
   const paid=Math.min(4,u.stock),factor=Math.min(.5+.5*paid/4,u.debt>=2?.5:u.debt>=1?.75:1),power=Math.ceil([5,4,3][u.step]*factor);
   actions.push({unit:u.id,step:u.step,stockBeforeQ:u.stock,debt:u.debt,paidQ:paid,factor,power});u.stock-=paid;z.actions+=paid;if(factor===1)z.full++;else z.reduced++;z.power+=power;
  }
  let repairWait=null;if(repair){const w=repair.wounds.shift();repair.step--;depot-=2;personnel--;z.repairs++;if(w.at>0)repairWait=t-w.at+1;event(-10,'ConditionalRepair',repair.id,{costE2:2,costP:1,RP:0,positionProof:null});}
  // The decline counterfactual forks here, before any T13 new commitment. Earlier orders survive.
  if(t===13){const state={t,route,units:snap(units),orders:snap(orders),batches:snap(batches),rear,depot,personnel,wreck,totals:snap(z)};fork={phase:'T13_PRE_ORDER_AFTER_COMMON_ACTION_AND_REPAIR',hash:hash(canonical(state)),state};}
  const waiting=orders.filter(o=>['ASSEMBLING','WAITING_ENTRY'].includes(o.status));
  const assembling=waiting.filter(o=>o.status==='ASSEMBLING');
  let accepted=null,orderReason=null;
  if(t===24)orderReason='TERMINAL_POLICY_NO_ORDER';
  else if(scenario.declineOrdersFromTurn!==null&&t>=scenario.declineOrdersFromTurn)orderReason='UNCOMMITTED_POLICY';
  else if(depot<6||personnel<3)orderReason='MATERIAL_OR_PERSONNEL';
  else if(assembling.length>=profile.assemblyQueueCap)orderReason='ASSEMBLY_QUEUE_FULL';
  else if(waiting.length>=profile.undeployedOrderCap)orderReason='UNDEPLOYED_CAP_FULL';
  else {depot-=6;personnel-=3;const id=String(++nextOrder).padStart(2,'0');accepted={id:'F'+id,unitId:'N'+id,acceptedTurn:t,status:'ASSEMBLING',workDone:0,workNeeded:profile.assemblyBoundaries,arrearsQ:0,lastRearPaidEpoch:null,completedEpoch:null,entryEligibleFromTurn:null,enteredTurn:null,firstActionEligibleTurn:null,sourceId:profile.rearSourceId,costE2:6,costP:3};orders.push(accepted);event(-5,'OrderAccepted',accepted.id,{availablePDelta:-3,availableE2Delta:-6,escrowPDelta:3,escrowE2Delta:6});}
  // 00 freezes the roster, source, residual wreck, and currently operational facilities.
  const rearAt00=orders.filter(o=>['ASSEMBLING','WAITING_ENTRY'].includes(o.status));
  const frontAt00=units.filter(u=>u.alive),wreckAt00=wreck;
  const sourceQ=scenario.sourceUnavailableEpochs.includes(t)?0:p.sourceSP*4;
  const cargoQ=4*(p.cargo+(route==='C'&&t>=p.firstFacility?p.extraCargo:0));let sourceLeftQ=sourceQ,rearPaidQ=0;
  event(0,'EpochPrepared',route,{sourceQ,cargoQ,wreckAt00E2:wreckAt00,frontIds:frontAt00.map(u=>u.id),rearIds:rearAt00.map(o=>o.unitId)});
  for(const o of rearAt00.sort((a,b)=>a.acceptedTurn-b.acceptedTurn||a.id.localeCompare(b.id))){
   const before=o.arrearsQ,paidArrearsQ=Math.min(before,sourceLeftQ);sourceLeftQ-=paidArrearsQ;
   const paidCurrentQ=Math.min(4,sourceLeftQ);sourceLeftQ-=paidCurrentQ;o.arrearsQ=before+4-paidArrearsQ-paidCurrentQ;
   if(o.arrearsQ===0)o.lastRearPaidEpoch=t;
   const rr={epoch:t,order:o.id,unit:o.unitId,source:profile.rearSourceId,arrearsBeforeQ:before,currentDueQ:4,paidArrearsQ,paidCurrentQ,arrearsAfterQ:o.arrearsQ};rearRows.push(rr);event(10,'RearUpkeepBooked',o.id,rr);owners.push({unit:o.unitId,owner:'REAR',epoch:t});rearPaidQ+=paidArrearsQ+paidCurrentQ;
  }
  z.rearPaid+=rearPaidQ;
  for(const o of rearAt00){if(o.status==='ASSEMBLING'&&o.arrearsQ===0){o.workDone++;event(11,'FormationAdvanced',o.id,{workDone:o.workDone});if(o.workDone===o.workNeeded){o.status='WAITING_ENTRY';o.completedEpoch=t;o.entryEligibleFromTurn=t+1;event(11,'FormationCompleted',o.id,{escrowPDelta:-3,escrowE2Delta:-6,embodiedPDelta:3,embodiedE2Delta:6,eligible:t+1});}}}
  // Construction completion never activates its benefit in the same E.
  if(route==='B'&&t===p.firstIndustry-1)event(11,'ConstructionCompleted','B-workshop',{operationalFromEpoch:t+1});
  if(route==='C'&&t===p.firstFacility-1)event(11,'ConstructionCompleted','C-transport-repair',{operationalFromEpoch:t+1});
  const produced=Math.max(0,Math.min(2*(p.baseE+(route==='B'&&t>=p.firstIndustry?p.extraE:0)),48-rear));
  const purchased=route==='A'&&t===1?24:0;rear+=produced+purchased;z.produced+=produced;z.purchased+=purchased;
  const reserved=sum(batches,b=>b.state!=='RECEIVED'?b.e2:0);
  const salvaged=route==='C'&&t>=p.firstFacility?Math.max(0,Math.min(2*p.salvageE,wreckAt00,48-depot-reserved)):0;
  wreck-=salvaged;depot+=salvaged;z.salvaged+=salvaged;event(12,'OutputRecorded',route,{producedE2:produced,reconditionedE2:salvaged,localOutputAvailableTurn:t+1});
  let arrived=0;function receive(b,sequence){assert.equal(b.state,'IN_TRANSIT');b.state='RECEIVED';b.receivedEpoch=t;b.availableFromTurn=t+1;depot+=b.e2;arrived+=b.e2;event(sequence,'CargoReceived',b.id,{qtyE2:b.e2,availableFromTurn:t+1});}
  for(const b of batches.filter(b=>b.state==='IN_TRANSIT'&&b.due<=t))receive(b,13);
  const needQ=sum(frontAt00,u=>Math.max(0,4-u.stock)),desiredShip=Math.min(8,rear,Math.max(0,48-depot-sum(batches,b=>b.state==='IN_TRANSIT'?b.e2:0)));
  const feasible=sourceLeftQ>=needQ&&cargoQ>=needQ;
  const ship=feasible?Math.min(desiredShip,Math.floor((cargoQ-needQ)/2)):0;
  const desiredSPQ=sum(frontAt00,u=>Math.max(0,16-u.stock));rear-=ship;
  event(14,'MaintenanceCertificate',route,{kind:'SCALAR_EXACT_CONDITIONAL',remainingSourceQ:sourceLeftQ,needQ,cargoQ,feasible});
  if(ship){const b={id:'B'+String(++nextBatch).padStart(3,'0'),e2:ship,dispatch:t,due:t+p.transit-1,state:'IN_TRANSIT',receivedEpoch:null,availableFromTurn:null,capacityLoadQ:ship*2,destination:profile.assemblyDepotId};batches.push(b);event(14,'FreightDispatched',b.id,snap(b));if(b.due===t)receive(b,15);}
  let budget=Math.min(sourceLeftQ,cargoQ-2*ship),frontIssuedQ=0;const receiveById=new Map(frontAt00.map(u=>[u.id,0]));
  const stocksBefore=new Map(frontAt00.map(u=>[u.id,u.stock])),debtBefore=new Map(frontAt00.map(u=>[u.id,u.debt]));
  const rotation=t%Math.max(1,frontAt00.length),ids=frontAt00.map(u=>u.id),rank=new Map(ids.slice(rotation).concat(ids.slice(0,rotation)).map((id,i)=>[id,i]));
  for(const target of [4,16])while(budget>0){const cs=frontAt00.filter(u=>u.stock<target).sort((a,b)=>a.stock-b.stock||rank.get(a.id)-rank.get(b.id));if(!cs.length)break;cs[0].stock++;receiveById.set(cs[0].id,receiveById.get(cs[0].id)+1);frontIssuedQ++;budget--;}
  let maintenancePaidQ=0;for(const u of frontAt00){const paid=Math.min(4,u.stock);u.stock-=paid;maintenancePaidQ+=paid;u.debt=paid===4?Math.max(0,u.debt-1):Math.min(3,u.debt+(4-paid)/4);const loss=u.debt===3&&paid<4?1:0;
   const mr={unit:u.id,epoch:t,stockBeforeQ:stocksBefore.get(u.id),receivedQ:receiveById.get(u.id),dueQ:4,paidQ:paid,stockAfterMaintenanceQ:u.stock,debtBefore:debtBefore.get(u.id),debtAfter:u.debt,attritionAccumulatorBefore:0,attritionAccumulatorAfter:0,loss,stockDestroyedQ:loss&&u.step===2?u.stock:0};maintRows.push(mr);owners.push({unit:u.id,owner:'FRONT',epoch:t});event(20,'FrontMaintenance',u.id,mr);}
  for(const mr of maintRows)if(mr.loss){damage(units.find(u=>u.id===mr.unit),'attritionLoss',t+1);event(21,'Attrition',mr.unit,{steps:1,stockDestroyedQ:mr.stockDestroyedQ,newWreckAvailableEpoch:t+1});}
  z.frontIssued+=frontIssuedQ;z.frontMaintenance+=maintenancePaidQ;
  const inTransit=sum(batches,b=>b.state==='IN_TRANSIT'?b.e2:0),stockQ=sum(units,u=>u.stock),escrow=orders.filter(o=>o.status==='ASSEMBLING').length,embodied=orders.filter(o=>o.status==='WAITING_ENTRY').length,enteredEver=orders.filter(o=>o.enteredTurn!==null).length;
  assert.equal(new Set(owners.map(o=>o.unit)).size,owners.length,'maintenance owner unique');
  assert.equal(60,personnel+z.repairs+3*orders.length,'personnel commitment once');
  assert.equal(z.produced+z.purchased+z.salvaged,rear+depot+inTransit+2*z.repairs+6*orders.length,'003-compatible equipment flow');
  assert.equal(96+z.rearPaid+z.frontIssued,stockQ+z.actions+z.rearPaid+z.frontMaintenance+z.destroyed,'SP includes rear consumption');
  assert.equal(2+z.battleLoss+z.attritionLoss,wreck+z.salvaged,'wreck');
  const installed=sum(units,u=>u.alive?(3-u.step)*2:0),scrap=z.battleLoss+z.attritionLoss;
  assert.equal(46+z.produced+z.purchased,rear+depot+inTransit+6*(escrow+embodied)+installed+wreck+scrap,'physical equipment incl initial installed/wreck');
  assert.equal(orders.length,escrow+embodied+enteredEver);
  assert.ok(rearPaidQ+frontIssuedQ<=sourceQ);assert.ok(2*ship+frontIssuedQ<=cargoQ);assert.ok(depot+inTransit<=48&&rear<=48);
  assert.ok(orders.filter(o=>o.status==='ASSEMBLING').length<=profile.assemblyQueueCap&&escrow+embodied<=profile.undeployedOrderCap);
  assert.ok(orders.every(o=>o.enteredTurn===null||o.enteredTurn>=o.entryEligibleFromTurn));assert.ok(personnel>=0);
  for(const mr of maintRows)assert.equal(mr.stockBeforeQ+mr.receivedQ,mr.paidQ+mr.stockAfterMaintenanceQ);
  const row={turn:t,unitsAtAction:n,endingFrontUnits:units.filter(u=>u.alive).length,newOrder:accepted?.id??null,orderReason,entered,completed:orders.filter(o=>o.completedEpoch===t).length,assembling:escrow,waiting:embodied,totalOrders:orders.length,enteredEver,escrowP:escrow*3,escrowE:escrow*3,embodiedWaitingP:embodied*3,embodiedWaitingE:embodied*3,personnel,productionE:produced/2,reconditionE:salvaged/2,shippedE:ship/2,desiredShipE:desiredShip/2,blockedShipmentE:(desiredShip-ship)/2,shipmentBlockReason:!feasible?'FRONT_MAINTENANCE_NOT_FEASIBLE':ship<desiredShip?'SHARED_CAPACITY':null,arrivedE:arrived/2,rearE:rear/2,depotE:depot/2,inTransitE:inTransit/2,wreckE:wreck/2,sourceCapSP:sourceQ/4,rearDueSP:rearAt00.length,rearPaidSP:rearPaidQ/4,rearPaidOldSP:sum(rearRows,r=>r.paidArrearsQ)/4,rearPaidCurrentSP:sum(rearRows,r=>r.paidCurrentQ)/4,rearArrearsSP:sum(orders,o=>o.arrearsQ)/4,frontSourceAvailableSP:sourceLeftQ/4,frontIssuedSP:frontIssuedQ/4,sourceUnusedSP:(sourceQ-rearPaidQ-frontIssuedQ)/4,frontNetMaintenanceNeedSP:needQ/4,maintenanceDemand:frontAt00.length,maintenancePaid:maintenancePaidQ/4,maintenanceShort:frontAt00.length-maintenancePaidQ/4,spStock:stockQ/4,cargoCapacity:cargoQ/4,cargoUsed:(2*ship+frontIssuedQ)/4,desiredLoad:(2*desiredShip+desiredSPQ)/4,fullAttack:actions.filter(a=>a.factor===1).length,degradedAttack:actions.filter(a=>a.factor<1).length,zeroPaid:actions.filter(a=>a.paidQ===0).length,attackPower:sum(actions,a=>a.power),spActionCost:sum(actions,a=>a.paidQ)/4,recovered:repair?1:0,repairWait,recoveryCapacity:Math.min(1,eligible.length,Math.floor(depotBeforeT/2),personnel+(repair?1:0)+(accepted?3:0)),damagedSteps:sum(units,u=>u.alive?u.step:0),debtUnits:units.filter(u=>u.alive&&u.debt>0).length,debtMax:Math.max(...units.map(u=>u.debt)),deaths:units.filter(u=>!u.alive).length,frontAttritionSteps:sum(maintRows,r=>r.loss),scoreStatus:'UNRESOLVED'};
  rows.push(row);trace.push({turn:t,events,entryRows,rearRows,maintRows,maintenanceOwners:owners,unitActions:actions,units:snap(units),orders:snap(orders),batches:snap(batches)});
 }
 const allRows=[...prefix,...rows],lastRow=rows.at(-1);
 const summary={route,scenario:scenario.id,startTurn:start,status:'CONDITIONAL_LEDGER_NO_CORE_ENTRY',endingUnits:lastRow.endingFrontUnits,acceptedOrders:orders.length,completedOrders:orders.filter(o=>o.completedEpoch!==null).length,enteredUnits:orders.filter(o=>o.enteredTurn!==null).length,waitingOrders:lastRow.waiting,assemblingOrders:lastRow.assembling,personnel,repaired:z.repairs,producedE:z.produced/2,purchasedE:z.purchased/2,reconditionedE:z.salvaged/2,eFreeRemaining:(rear+depot+sum(batches,b=>b.state==='IN_TRANSIT'?b.e2:0))/2,eCommittedUnentered:(lastRow.escrowE+lastRow.embodiedWaitingE),rearPaidSP:z.rearPaid/4,rearArrearsSP:lastRow.rearArrearsSP,frontIssuedSP:z.frontIssued/4,frontMaintenanceSP:z.frontMaintenance/4,maintenanceShort:sum(rows,r=>r.maintenanceShort),actionPaidSP:z.actions/4,spRemaining:sum(units,u=>u.stock)/4,destroyedSP:z.destroyed/4,fullAttacks:z.full,degradedAttacks:z.reduced,attackPowerSum:z.power,deaths:lastRow.deaths,attritionSteps:z.attritionLoss,blockedShipmentE:sum(rows,r=>r.blockedShipmentE),entryWaitingUnitTurns:sum(orders,o=>o.completedEpoch===null?0:Math.max(0,(o.enteredTurn??25)-o.entryEligibleFromTurn)),scoreStatus:'UNRESOLVED'};
 return {summary,checkpoint:{source:'003 saved end-E snapshot',endEpoch:start-1,savedTraceHash:hash(canonical(prior)),firstAffectedOrderTurn:start},prefixRows:snap(prefix),rows,trace,finalOrders:snap(orders),fork};
}

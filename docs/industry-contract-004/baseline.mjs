// Offline reconstruction of the documented 003 algorithm, gated by exact saved-data comparison.
export function baseline(route,p) {
 const make=(id,t)=>({id,stock:t===0?12:0,debt:0,step:0,alive:true,born:t,wounds:[]});
 let units=Array.from({length:p.initialOld},(_,i)=>make('O'+String(i+1).padStart(2,'0'),0));
 units[0].step=units[1].step=1;units[0].wounds=[{at:0}];units[1].wounds=[{at:0}];
 let rear=0,depot=0,personnel=60,wreck=2,newId=0,inTransit=[],rows=[],trace=[];
 const z={production:0,purchase:0,salvage:0,spIn:0,spActions:0,spMaintenance:0,spDestroyed:0,repair:0,new:0,battleLoss:0,attritionLoss:0,dead:0,full:0,degraded:0,attackPower:0,unitTurns:0,damageStepTurns:0,repairWaits:[]};
 for(let t=1;t<=p.horizon;t++){
  function damage(u,kind,at){if(!u||!u.alive)return;u.step++;u.wounds.push({at});wreck++;z[kind]++;if(u.step>=3){u.alive=false;z.dead++;z.spDestroyed+=u.stock;u.stock=0;}}
  if(t>=3&&(t<p.horizon||p.terminalDamage))for(let j=0;j<p.damagePerTurn;j++)damage(units[(t-3+p.initialOld-j)%p.initialOld],'battleLoss',t);
  let live=units.filter(u=>u.alive),n=live.length;
  const woundsBefore=live.reduce((s,u)=>s+u.step,0);
  const eligible=live.filter(u=>u.step>0&&u.debt<2).sort((a,b)=>a.wounds[0].at-b.wounds[0].at||a.id.localeCompare(b.id));
  const repair=((t<p.horizon||p.terminalRecovery)&&eligible.length&&depot>=2&&personnel>=1)?eligible[0]:null;
  let full=0,degraded=0,partialPaid=0,zeroPaid=0,power=0,actionQ=0,attempts=0,unitActions=[];
  const attackers=live.filter(u=>u!==repair).sort((a,b)=>a.id.localeCompare(b.id)).slice(0,p.targets);
  for(const u of attackers){const paid=Math.min(4,u.stock),f=Math.min(.5+.5*paid/4,u.debt>=2?.5:u.debt>=1?.75:1);if(f===1)full++;else degraded++;if(paid>0&&paid<4)partialPaid++;if(paid===0)zeroPaid++;const a={unit:u.id,step:u.step,stockBeforeQ:u.stock,debt:u.debt,paidQ:paid,factor:f,power:Math.ceil([5,4,3][u.step]*f)};unitActions.push(a);power+=a.power;u.stock-=paid;actionQ+=paid;attempts++;}
  let recovered=0,wait=null;
  if(repair){const w=repair.wounds.shift();repair.step--;depot-=2;personnel--;recovered=1;z.repair++;if(w.at>0){wait=t-w.at+1;z.repairWaits.push(wait);}}
  let formed=0;
  if(t<p.horizon&&p.formation&&n<p.formationLimit&&depot>=6&&personnel>=3){depot-=6;personnel-=3;formed=1;units.push(make('N'+String(++newId).padStart(2,'0'),t+1));z.new++;}
  let produced=0,purchased=0,salvaged=0,ship=0,arrival=0,spIn=0,maintenance=0,maintenanceDue=0,maintShort=0,desiredShip=0,desiredSP=0,cargo=0,used=0;
  if(t<p.horizon||p.terminalSettlement){
   produced=2*(p.baseE+(route==='B'&&t>=p.firstIndustry?p.extraE:0));purchased=route==='A'&&t===1?24:0;
   produced=Math.max(0,Math.min(produced,48-rear));rear+=produced+purchased;z.production+=produced;z.purchase+=purchased;
   if(route==='C'&&t>=p.firstFacility){salvaged=Math.min(2*p.salvageE,wreck,48-depot);wreck-=salvaged;depot+=salvaged;z.salvage+=salvaged;}
   cargo=4*(p.cargo+(route==='C'&&t>=p.firstFacility?p.extraCargo:0));live=units.filter(u=>u.alive);
   const need=live.reduce((s,u)=>s+Math.max(0,4-u.stock),0);
   desiredShip=Math.min(8,rear,Math.max(0,2*p.depotTarget-depot-inTransit.reduce((s,b)=>s+b.e,0)));
   ship=need>Math.min(4*p.sourceSP,cargo)?0:Math.min(desiredShip,Math.floor(Math.max(0,cargo-need)/2));rear-=ship;
   if(ship)inTransit.push({e:ship,due:t+p.transit-1});const due=inTransit.filter(b=>b.due<=t);arrival=due.reduce((s,b)=>s+b.e,0);depot+=arrival;inTransit=inTransit.filter(b=>b.due>t);
   let budget=Math.min(p.sourceSP*4,cargo-2*ship);desiredSP=live.reduce((s,u)=>s+Math.max(0,16-u.stock),0);
   const rotation=t%Math.max(1,live.length),ids=live.map(u=>u.id),rank=new Map(ids.slice(rotation).concat(ids.slice(0,rotation)).map((id,i)=>[id,i]));
   for(const target of [4,16])while(budget>0){const c=live.filter(u=>u.stock<target).sort((a,b)=>a.stock-b.stock||rank.get(a.id)-rank.get(b.id));if(!c.length)break;c[0].stock++;budget--;spIn++;}
   for(const u of live){const paid=Math.min(4,u.stock);u.stock-=paid;maintenance+=paid;maintenanceDue+=4;u.debt=paid===4?Math.max(0,u.debt-1):Math.min(3,u.debt+(4-paid)/4);if(u.debt===3&&paid<4)damage(u,'attritionLoss',t+1);}
   maintShort=maintenanceDue-maintenance;used=ship*2+spIn;if(used>cargo||spIn>p.sourceSP*4)throw Error('baseline capacity');
  }
  z.spIn+=spIn;z.spActions+=actionQ;z.spMaintenance+=maintenance;z.full+=full;z.degraded+=degraded;z.attackPower+=power;z.unitTurns+=n;z.damageStepTurns+=woundsBefore;
  const eTransit=inTransit.reduce((s,b)=>s+b.e,0),stock=units.reduce((s,u)=>s+u.stock,0);
  if(z.production+z.purchase+z.salvage!==rear+depot+eTransit+2*z.repair+6*z.new||60!==personnel+z.repair+3*z.new||p.initialOld*12+z.spIn!==stock+z.spActions+z.spMaintenance+z.spDestroyed||2+z.battleLoss+z.attritionLoss!==wreck+z.salvage)throw Error('baseline conservation');
  rows.push({turn:t,unitsAtAction:n,maintenanceNominal:n,damageBefore:woundsBefore,fullAttack:full,degradedAttack:degraded,conditionalAttacks:attempts,zeroPaid,partialPaid,attackPower:power,recoveryEligible:eligible.length,recoveryCapacity:Math.min(1,eligible.length,Math.floor((depot-arrival-salvaged+2*recovered+6*formed)/2),personnel+recovered+3*formed),recovered,repairWait:wait,newOrders:formed,newTotal:z.new,personnel,productionE:produced/2,purchaseE:purchased/2,reconditionE:salvaged/2,shippedE:ship/2,arrivedE:arrival/2,rearE:rear/2,depotE:depot/2,inTransitE:eTransit/2,wreckE:wreck/2,maintenanceDemand:maintenanceDue/4,maintenancePaid:maintenance/4,maintenanceShort:maintShort/4,spReceived:spIn/4,spActionCost:actionQ/4,spStock:stock/4,cargoCapacity:cargo/4,cargoUsed:used/4,desiredLoad:(2*desiredShip+desiredSP)/4,pressure:cargo?Number(((2*desiredShip+desiredSP)/cargo).toFixed(3)):null,damagedSteps:units.filter(u=>u.alive).reduce((s,u)=>s+u.step,0),debtUnits:units.filter(u=>u.alive&&u.debt>0).length,debtMax:Math.max(...units.map(u=>u.debt)),deaths:z.dead});
  trace.push({turn:t,repairUnit:repair?.id??null,unitActions,units:structuredClone(units),inTransit:structuredClone(inTransit)});
 }
 const summary={route,params:p,endingUnits:units.filter(u=>u.alive).length,newUnits:z.new,repaired:z.repair,unrepairedSteps:rows.at(-1).damagedSteps,personnel,producedE:z.production/2,purchasedE:z.purchase/2,reconditionedE:z.salvage/2,eRemaining:(rear+depot+inTransit.reduce((s,b)=>s+b.e,0))/2,spReceived:z.spIn/4,spMaintenance:z.spMaintenance/4,spActions:z.spActions/4,spDestroyed:z.spDestroyed/4,spRemaining:rows.at(-1).spStock,fullAttacks:z.full,degradedAttacks:z.degraded,conditionalAttacks:z.full+z.degraded,attackPowerSum:z.attackPower,unitTurns:z.unitTurns,damageStepTurns:z.damageStepTurns,meanRepairedWait:z.repairWaits.length?Number((z.repairWaits.reduce((a,b)=>a+b,0)/z.repairWaits.length).toFixed(3)):null,maxRepairedWait:z.repairWaits.length?Math.max(...z.repairWaits):null,repairWaits:z.repairWaits,maintenanceShort:rows.reduce((s,r)=>s+r.maintenanceShort,0),deaths:z.dead,actualBattleLoss:z.battleLoss,actualAttritionLoss:z.attritionLoss};
 return {summary,rows,trace};
}

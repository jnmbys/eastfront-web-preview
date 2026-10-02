import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {checkBaseline,hash,canonical} from './check-baseline.mjs';
import {candidate} from './candidate.mjs';
import {makeTables} from './make-tables.mjs';
const read=n=>readFileSync(new URL(n,import.meta.url));
const save=(n,x)=>writeFileSync(new URL(n,import.meta.url),JSON.stringify(x,null,2)+'\n');
const sources=JSON.parse(read('SOURCES.json'));
for(const s of sources.sources)assert.equal(hash(read(s.snapshot).toString('utf8').replaceAll('\r\n','\n')),s.normalizedSha256,'Pinned input changed: '+s.snapshot);
const {runs,evidence}=checkBaseline();
const profile=JSON.parse(read('PROFILE.json'));
assert.equal(profile.contractCommit,'9ed3f4f16450c2ff936de242b328c7ba30059dc5');
assert.equal(profile.nominalSourceSP,22);assert.equal(profile.horizon,24);
const results=profile.scenarios.flatMap(s=>runs.map(b=>candidate(b,profile,s)));
const forks=[];
for(const route of ['A','B','C','D']){
 const a=results.find(r=>r.summary.route===route&&r.summary.scenario==='arrears');
 const b=results.find(r=>r.summary.route===route&&r.summary.scenario==='uncommitted');
 assert.equal(a.fork.hash,b.fork.hash,'Must fork before declining orders, with previous commitments intact');
 forks.push({route,checkpointHash:a.fork.hash,phase:a.fork.phase,priorOrders:a.fork.state.orders.map(o=>o.id),samePreCommitState:true});
}
let rowChecks=0,ownerChecks=0,entryChecks=0;
for(const r of results){
 assert.equal(r.prefixRows.length+r.rows.length,24);assert.deepEqual([...r.prefixRows,...r.rows].map(x=>x.turn),Array.from({length:24},(_,i)=>i+1));
 for(let i=0;i<r.rows.length;i++){
  const x=r.rows[i],tr=r.trace[i];
  assert.equal(x.rearPaidSP+x.frontSourceAvailableSP,x.sourceCapSP);
  assert.equal(x.frontIssuedSP+x.sourceUnusedSP,x.frontSourceAvailableSP);
  assert.equal(x.shippedE+x.frontIssuedSP,x.cargoUsed);assert.ok(x.cargoUsed<=x.cargoCapacity);
  assert.equal(x.maintenanceDemand,x.maintenancePaid+x.maintenanceShort);
  assert.equal(tr.rearRows.reduce((s,m)=>s+m.paidArrearsQ+m.paidCurrentQ,0)/4,x.rearPaidSP);
  assert.equal(tr.maintRows.reduce((s,m)=>s+m.paidQ,0)/4,x.maintenancePaid);
  for(const m of tr.rearRows){assert.equal(m.arrearsBeforeQ+m.currentDueQ,m.paidArrearsQ+m.paidCurrentQ+m.arrearsAfterQ);assert.ok(m.paidCurrentQ===0||m.paidArrearsQ===m.arrearsBeforeQ);}
  const keys=tr.maintenanceOwners.map(m=>m.unit+':'+m.epoch);assert.equal(new Set(keys).size,keys.length);ownerChecks+=keys.length;
  for(const e of tr.entryRows.filter(e=>e.result==='CONDITIONAL_ACCEPTED')){const o=tr.orders.find(o=>o.id===e.order),a=tr.unitActions.find(a=>a.unit===o.unitId);assert.equal(e.stockQ,0);assert.equal(e.debt,0);assert.equal(e.resourceDeltaP,0);assert.equal(e.resourceDeltaE2,0);assert.equal(tr.maintenanceOwners.find(m=>m.unit===o.unitId).owner,'FRONT');assert.equal(a.stockBeforeQ,0);assert.equal(a.factor,.5);entryChecks++;}
  assert.ok(tr.batches.every(b=>b.receivedEpoch===null||b.availableFromTurn===b.receivedEpoch+1));
  rowChecks++;
 }
}
const deltas=results.filter(r=>r.summary.scenario==='open').map(r=>{
 const b=runs.find(b=>b.summary.route===r.summary.route).summary,s=r.summary;
 return {route:s.route,baseline:{endingUnits:b.endingUnits,committedNew:b.newUnits,maintenanceSP:b.spMaintenance,frontIssuedSP:b.spReceived,full:b.fullAttacks,reduced:b.degradedAttacks,actionPaidSP:b.spActions,eFree:b.eRemaining,personnel:b.personnel},candidate:s,delta:{endingUnits:s.endingUnits-b.endingUnits,acceptedOrders:s.acceptedOrders-b.newUnits,frontMaintenanceSP:s.frontMaintenanceSP-b.spMaintenance,rearAndFrontMaintenanceSP:s.rearPaidSP+s.frontMaintenanceSP-b.spMaintenance,frontIssuedSP:s.frontIssuedSP-b.spReceived,full:s.fullAttacks-b.fullAttacks,reduced:s.degradedAttacks-b.degradedAttacks,actionPaidSP:s.actionPaidSP-b.spActions,eFree:s.eFreeRemaining-b.eRemaining,personnel:s.personnel-b.personnel}};
});
writeFileSync(new URL('RESULTS.json',import.meta.url),JSON.stringify({profileHash:hash(canonical(profile)),contract:profile.contract,baselineInputSHA256:evidence.inputFileSHA256,results})+'\n');
save('DIFFERENCES.json',{deltas,forks,caseSummaries:results.map(r=>r.summary)});
makeTables(results);
save('AUDIT.json',{status:'PASS_OFFLINE_ACCOUNTING_NOT_RUNTIME',baselineExact:true,baselineRuns:4,baselineRows:96,candidateRuns:results.length,totalEpochRows:384,continuedEpochRows:rowChecks,maintenanceOwnerRows:ownerChecks,zeroStockEntriesChecked:entryChecks,forks,checks:['single E1..E24','exact saved baseline gate','saved snapshot continuation before first order','four ledgers including explicit physical equipment','P/E escrow once, completion no second charge','old arrears before current, rear before front','source/cargo conservation','unique maintenance owner','zero stock/D entry, no entry charge','arrival availability t+1','finite queue/waiter/entry caps','uncommitted fork includes all earlier commitments'],scopeLimits:['synthetic entry receipts, not Core legal events','single corridor allocator retained from 003, not actual optimizer','source-side assembly/recovery location is a disclosed diagnostic assumption','no VP/W/victory/survival prediction','no full sensitivity scan'],hashes:Object.fromEntries(['baseline.mjs','check-baseline.mjs','candidate.mjs','reproduce.mjs','make-tables.mjs','audit-saved.py','SOURCES.json','PROFILE.json','RESULTS.json','DIFFERENCES.json'].map(n=>[n,hash(read(n))]))});
console.log(JSON.stringify({baselineExact:true,summaries:results.map(r=>r.summary)},null,2));

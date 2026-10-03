import test from 'node:test';
import assert from 'node:assert/strict';
import {RECORDS_016 as a} from '../records-016.mjs';
import {mapForwardRecord as map,rational} from '../forward-adapter.mjs';
const raw=id=>structuredClone(a.records.find(r=>r.id===id));
const read=id=>map(raw(id),a);
test('016 provenance: pinned source/UI commits, 10 digests, 7 REAL and 5 SYNTHETIC, 48 original checks',()=>{
  assert.equal(a.sourceCommit,'15e4d13fa9423ddb474432719468a8a8409823e9');assert.equal(a.uiBaseCommit,'1519ab5138acbca7f5c3ee9f1e8f3e9ab84bc59d');
  assert.equal(Object.keys(a.sources).length,10);assert.equal(a.checks.length,48);assert(a.checks.every(c=>c.passed));
  assert.equal(a.records.filter(r=>r.origin==='REAL').length,7);assert.equal(a.records.filter(r=>r.origin==='SYNTHETIC').length,5);
  for(const r of a.records){const s=map(r,a);assert.equal(s.valid,true,r.id+JSON.stringify(s.errors));assert.deepEqual(s.view,r.view);assert.equal(s.action,null);}
});
test('saved received is actually preRecovery; E8 arrival comes from separate TRACE boundary',()=>{
  const arrive=read('received'),pre=read('preRecovery');
  assert.equal(arrive.record.savedViewKey,null);assert.match(arrive.record.tracePath,/records\[\d+\].afterBoundary/);
  assert.equal(arrive.view.gameRevision,149);assert.equal(arrive.view.phase,'GERMAN_SUPPLY_RAIL');
  assert.equal(pre.record.savedViewKey,'received');assert.equal(pre.view.gameRevision,152);assert.equal(pre.view.phase,'GERMAN_RECOVERY');
  assert.equal(arrive.view.turn,9);assert.equal(pre.view.turn,9);
});
test('five main checkpoints and two real controls have independent branch identities',()=>{
  assert.equal(a.records.filter(r=>r.branch==='main').length,5);
  assert.equal(read('controlExpired').record.branch,'control');assert.equal(read('unusedExpired').record.branch,'unused');
  assert.equal(read('controlExpired').view.turn,9);assert.equal(read('unusedExpired').view.turn,10);
  assert.equal(read('controlExpired').view.care,null);assert.equal(read('unusedExpired').view.recovery,null);
});
test('permanent sources remain original lots, not a completed training system',()=>{
  assert.equal(a.sourceAssumption.sourceKind,'SCENARIO_INITIAL_TRAINED_RESERVE_ASSUMPTION');assert.equal(a.sourceAssumption.actualTrainingReceipt,null);
  for(const r of a.records)for(const k of ['P','E2:L'])assert.equal(r.view.materials[k].id,raw('start').view.materials[k].id);
});
test('shipment E8/T9 overrides historical P E7/T8 and E2 E6/T7 only for this movement',()=>{
  const s=read('received');assert.equal(s.route,'A10 → B10 → C10');
  assert.deepEqual([s.view.shipment.dispatchEpoch,s.view.shipment.arrivalEpoch,s.view.shipment.availableFromTurn],[8,8,9]);
  assert.deepEqual(s.rows.map(r=>[r.historicalArrival,r.historicalAvailable]),[[7,8],[6,7]]);
  assert.deepEqual(s.rows.map(r=>r.available),[1,2]);
});
test('recovery consumes 1P + 2E2, step1 to0; RP8/12 and recovery W unchanged',()=>{
  const s=read('recovered'),r=s.view.recovery;
  assert.deepEqual([r.unitId,r.beforeStep,r.afterStep],['G-I-01',1,0]);assert.deepEqual(r.payment,{P:1,'E2:L':2,RP:0,extraW:0});
  assert.deepEqual(s.rows.map(r=>[r.quantity,r.consumed]),[[0,1],[0,2]]);
  assert.deepEqual(s.record.ledger.RP,read('preRecovery').record.ledger.RP);assert.deepEqual(s.record.ledger.RP,{GERMAN:8,SOVIET:12});
});
test('internal care transfer: equipment5 to4; personnel2I ledger unchanged; care receipt is not new grant',()=>{
  const before=read('start').view,after=read('carePaid').view;
  assert.equal(before.equipmentBudget.freeI,5);assert.equal(after.equipmentBudget.freeI,4);
  assert.equal(after.equipmentBudget.granted,10);assert.equal(after.equipmentBudget.careTransferOutI,1);
  assert.deepEqual(after.personnelBudget,before.personnelBudget);
  assert.deepEqual([after.care.receivedI,after.care.spentI,after.care.availableI],[1,1,0]);
  for(const item of a.records){const s=map(item,a),e=s.view.equipmentBudget;assert.equal(e.granted,e.freeI+e.productionSpent+e.handoffSpent+e.escrow+s.transfer);}
});
test('E8 capacities conserve with freight once; cargo and terminal8W are not additional charges',()=>{
  const s=read('recovered');const expected=[[40,32,8,0],[40,32,8,0],[2200,108,16,2076],[96,88,8,0]];
  assert.deepEqual(s.view.transport.map(r=>[r.originalCap,r.spUsed,r.freight,r.remaining]),expected);
  for(const r of s.view.transport)assert.equal(r.originalCap,r.spUsed+r.freight+r.reservation+r.remaining);
  assert.equal(s.view.terminal.paidW,8);assert.equal(s.view.terminal.extraRecoveryW,0);
  assert.equal(read('unusedExpired').view.transport.find(r=>r.id==='W:GH2').freight,8);
});
test('E8 cost comparison: REC maintenance minus0.5SP/D2 to2.5; infantry stock+1SP/tank-0.5SP',()=>{
  const units=read('recovered').impact.units;
  const rec=units.find(u=>u.id==='G-REC-02');
  assert.equal(rec.reductionQ/a.qPerSP,.5);assert.equal(rational(rec.reference.debt),2);assert.equal(rational(rec.alternative.debt),2.5);
  assert.equal(units.find(u=>u.id==='G-I-01').stockDeltaQ/a.qPerSP,1);assert.equal(units.find(u=>u.id==='G-PZ-01').stockDeltaQ/a.qPerSP,-.5);
  assert.equal(rec.actualCore.expSupply.attackFactor,.5);assert.equal(rec.actualCore.expSupply.movementCap,1);
  assert.equal(rec.additionalStepLoss,0);
});
test('no-care control quarantines only P at A10, not equipment; no charge or shipment',()=>{
  const s=read('controlExpired');assert.deepEqual(s.rows.map(r=>[r.location,r.quantity,r.available,r.quarantined]),[['A10',1,0,1],['A10',2,2,0]]);
  assert.equal(s.view.shipment,null);assert.equal(s.view.equipmentBudget.freeI,5);assert.equal(s.impact,null);assert.equal(s.e9,null);
});
test('real unused E9: front quarantine still occupies1P/2E2; actual losses, no matched E9 counterfactual',()=>{
  const s=read('unusedExpired');assert.deepEqual(s.rows.map(r=>[r.location,r.quantity,r.available,r.quarantined,r.consumed]),[['C10',1,0,1,0],['C10',2,0,2,0]]);
  assert.deepEqual(s.e9.sides.map(x=>x.units.reduce((n,u)=>n+u.maintenance,0)),[68,128]);
  assert.deepEqual(s.e9.sides.flatMap(x=>x.units.filter(u=>u.loss).map(u=>u.id)),['G-MOT-01','G-MOT-02','G-MOT-03','G-PZ-02','G-REC-02']);
  assert.match(s.e9.interpretation,/No matched E9 no-freight counterfactual/);assert.equal(s.impact,null);assert.equal(s.view.terminal.status,'EXPIRED_NO_REFUND');
});
test('rollback samples retain own precommit money, shipment and unconsumed lots',()=>{
  assert.equal(read('careFailed').view.equipmentBudget.freeI,5);
  assert.equal(read('E8Failed').view.equipmentBudget.freeI,4);assert.equal(read('E8Failed').view.transport,null);
  assert.equal(read('recoveryFailed').view.recovery,null);assert.deepEqual(read('recoveryFailed').rows.map(r=>r.quantity),[1,2]);
  for(const id of ['careFailed','E8Failed','recoveryFailed']){const s=read(id);assert.equal(s.record.origin,'SYNTHETIC');assert.equal(s.record.requestError.error,'REJECTED_UNCHANGED');assert.equal(s.impact,null);assert.equal(s.record.ledger,null);}
});
test('synthetic refusal retains in-transit material and reservation; expiry releases hold without new receipt',()=>{
  const held=read('held'),expired=read('heldExpired');
  assert.deepEqual(held.rows.map(r=>[r.location,r.quantity,r.available]),[['在途',1,0],['在途',2,0]]);
  assert.deepEqual(held.incoming,{P:1,'E2:L':2});assert.equal(held.view.terminal,null);assert.equal(held.view.shipment.arrivalEpoch,null);
  assert.deepEqual(expired.incoming,{P:0,'E2:L':0});assert.deepEqual(expired.rows.map(r=>r.quarantined),[1,2]);
  assert.equal(expired.view.transport.find(r=>r.id==='W:GH2').freight,8);assert.equal(expired.record.origin,'SYNTHETIC');assert.equal(expired.e9,null);
});
test('unknown schema, missing nullable fields and missing required quantities fail closed',()=>{
  const paths=['care','shipment','receiver','transport','materials.P.quantityP','materials.E2:L.quantityE2','equipmentBudget.freeI','equipmentBudget.careTransferOutI','care.spentI','terminal.paidW','recovery.payment.P','frontInventory.P'];
  const unknown=raw('recovered');unknown.view.schema='v999';assert.equal(map(unknown,a).valid,false);
  for(const path of paths){const r=raw('recovered'),keys=path.split('.'),last=keys.pop();let target=r.view;for(const key of keys)target=target[key];delete target[last];assert.equal(map(r,a).valid,false,path);}
});
test('counterfeit balances, double capacity charge, incorrect custody or premature availability rejected',()=>{
  const mutations=[
    v=>v.equipmentBudget.freeI++,v=>v.care.receivedI++,v=>v.transport[3].freight+=v.transport[3].cargo,
    v=>v.terminal.paidW=16,v=>v.frontInventory.P=2,v=>v.materials.P.quantityP=2,
    v=>v.availableFrontInventory.P=2,v=>v.shipment.arrivalEpoch=null,v=>v.shipment.availableFromTurn=10
  ];
  for(const mutate of mutations){const r=raw('received');mutate(r.view);assert.equal(map(r,a).valid,false);}
});
test('mapping cannot mutate static archive and never authorizes writes',()=>{
  const before=JSON.stringify(a),s=read('recovered');s.view.equipmentBudget.freeI=999;s.record.view.materials.P.quantityP=99;
  assert.equal(JSON.stringify(a),before);assert.equal(s.action,null);assert.equal(s.readOnly,true);
});


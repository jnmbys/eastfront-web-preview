import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RECORDS_012 as data} from '../records-012.mjs';
import {mapRecord,validateView} from '../record-adapter.mjs';
const record=label=>data.records.find(r=>r.label===label);
const mapped=label=>mapRecord(record(label),data.sourceCommit);
test('pinned source, R1 base and 6 REAL + 10 synthetic exported records',()=>{
  assert.equal(data.sourceCommit,'e64c0e11fb16b05cfe725240193e8590b4eefd88');
  assert.equal(data.uiBaseCommit,'00a97635d882509675fe4d5f6e789cdbc791fdc0');
  assert.equal(Object.keys(data.sources).length,9); assert.equal(data.records.length,16);
  assert.equal(data.records.filter(r=>r.view.origin==='REAL').length,6);
});
test('all pinned v1 records validate; no actions or invented quote/capacity/permissions',()=>{
  for(const r of data.records){const m=mapRecord(r,data.sourceCommit); assert.equal(m.valid,true,JSON.stringify(m.errors));
    assert.equal(m.action,null); assert.equal(m.readOnly,true);
    for(const k of ['quote','warehouseCapacity','productionCapacity','permissions'])assert.equal(m[k],null);
  }
});
test('initial/funded/accepted snapshots keep their own actual ledger and reservation',()=>{
  assert.equal(mapped('initial').view.budget.grantedI,0); assert.equal(mapped('initial').view.order,null);
  assert.equal(mapped('funded').view.budget.availableI,10); assert.equal(mapped('funded').view.order,null);
  const a=mapped('accepted').view; assert.equal(a.budget.availableI,5); assert.equal(a.budget.escrowI,2);
  assert.equal(a.order.workCompleted,0); assert.equal(a.equipment.productionReservedE2,2); assert.equal(a.equipment.producedE2,0);
});
test('E5 is T6; E6 is already T7 and available; no fabricated E6-unavailable record',()=>{
  const e5=mapped('E5').view,e6=mapped('E6').view,t7=mapped('T7').view;
  assert.equal(e5.turn,6); assert.equal(e5.order.workCompleted,1);
  assert.equal(e6.turn,7); assert.equal(e6.phase,'GERMAN_SUPPLY_RAIL'); assert.equal(e6.equipment.availableRearE2,2);
  assert.equal(e6.arrival.receivedEpoch,6); assert.equal(e6.arrival.availableFromTurn,7);
  assert.equal(t7.phase,'GERMAN_RECOVERY'); assert.equal(t7.equipment.availableRearE2,2);
  assert(!data.records.some(r=>r.view.origin==='REAL' && r.view.arrival?.receivedEpoch===6 && r.view.equipment.availableRearE2===0));
});
test('closed E5 remaining 4 is explicitly unusable; no capacity carry-forward',()=>{
  const row=mapped('E5').capacityRows[0]; assert.equal(row.remaining,4); assert.equal(row.epochClosed,true);
  assert.match(row.availability,/已关闭.*可用 0.*不结转/);
});
test('capacity blockers retain own store, escrow and origin; reservation is not equipment',()=>{
  for(const label of ['blocked_used_capacity','blocked_reserved_capacity','blocked_both_capacity','blocked_warehouse_hold']){
    const m=mapped(label),v=m.view;assert.equal(v.origin,'SYNTHETIC_FIXTURE');assert.equal(v.budget.escrowI,2);
    assert.equal(v.budget.handoffPaidI,0);assert.equal(v.equipment.productionStoreE2,2);assert.equal(v.equipment.rearE2,0);
    assert.equal(v.equipment.producedE2,2);assert(v.blockingReasons.length>0);
  }
  assert.equal(mapped('blocked_warehouse_hold').view.equipment.incomingReservedE2,1);
});
test('HELD keeps transit/hold but no receipt or rear stock, fee remains spent',()=>{
  const v=mapped('blocked_receipt').view;
  assert.equal(v.equipment.inTransitOrHeldE2,2);assert.equal(v.equipment.incomingReservedE2,2);
  assert.equal(v.equipment.rearE2,0);assert.equal(v.arrival.receiptId,null);
  assert.equal(v.budget.escrowI,0);assert.equal(v.budget.handoffPaidI,2);
});
test('all four commit failures retain pre-failure state rather than successful retry balances',()=>{
  for(const label of ['failure_after_output','failure_after_dispatch','failure_after_receipt','failure_before_commit']){
    const v=mapped(label).view;assert.equal(v.origin,'SYNTHETIC_FAULT_ON_REAL_REPLAY');
    assert.equal(v.turn,6);assert.equal(v.phase,'SOVIET_ENTRENCHMENT');assert.equal(v.order.workCompleted,1);
    assert.equal(v.budget.escrowI,2);assert.equal(v.budget.handoffPaidI,0);assert.equal(v.equipment.producedE2,0);
    assert.equal(v.equipment.rearE2,0);assert.equal(v.lastRequestError.error,'REJECTED_NO_DOMAIN_COMMIT');
  }
});
test('unknown schema and non-readonly exports fail closed',()=>{
  for(const change of [{schema:'industry-012-view.v999'},{readOnly:false}]){
    const r=structuredClone(record('T7'));Object.assign(r.view,change);const m=mapRecord(r,data.sourceCommit);
    assert.equal(m.valid,false);assert.equal(m.action,null);assert.equal(m.view,undefined);
  }
});
test('missing required fields, including nullable fields, fail closed without demo defaults',()=>{
  const baseline=record('T7');
  const paths=[...Object.keys(baseline.view),...Object.keys(baseline.view.budget).map(k=>'budget.'+k),
    ...Object.keys(baseline.view.equipment).map(k=>'equipment.'+k),...Object.keys(baseline.view.order).map(k=>'order.'+k),
    ...Object.keys(baseline.view.arrival).map(k=>'arrival.'+k),...Object.keys(baseline.view.externalCapacity[0]).map(k=>'externalCapacity.0.'+k)];
  for(const p of paths){const r=structuredClone(baseline),parts=p.split('.'),key=parts.pop();let target=r.view;
    for(const part of parts)target=target[part];delete target[key];const m=mapRecord(r,data.sourceCommit);
    assert.equal(m.valid,false,p);assert.equal(m.view,undefined,p);
  }
});
test('invalid conservation and speculative available inventory are rejected; mapping is immutable',()=>{
  const r=structuredClone(record('T7'));r.view.budget.availableI=999;assert(validateView(r.view).length>0);
  const fake=structuredClone(record('accepted'));fake.view.equipment.rearE2=2;fake.view.equipment.availableRearE2=2;fake.view.equipment.producedE2=2;
  assert(validateView(fake.view).length>0);
  const before=JSON.stringify(data),m=mapped('T7');m.view.budget.availableI=0;assert.equal(JSON.stringify(data),before);
});

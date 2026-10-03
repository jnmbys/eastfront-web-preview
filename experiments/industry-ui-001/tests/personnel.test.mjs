import test from 'node:test';
import assert from 'node:assert/strict';
import {RECORDS_013 as archive} from '../records-013.mjs';
import {RECORDS_012} from '../records-012.mjs';
import {mapPersonnelRecord as map} from '../personnel-adapter.mjs';
const record=id=>structuredClone(archive.records.find(r=>r.id===id));
const result=id=>map(record(id),archive.sourceCommit);
const sample=label=>result('sample:'+label);
const t8=()=>record('checkpoint:T8');
test('013 provenance: fixed commits, nine digests, 7 checkpoints and all 18 original labels',()=>{
  assert.equal(archive.sourceCommit,'2d04264a3f4ba6d38f76a99ae76821cc0a55abdb');
  assert.equal(archive.uiBaseCommit,'aeeceb9be390ec3a1c8d0f0711f4f63a66aa2f73');
  assert.equal(Object.keys(archive.sources).length,9);
  assert(archive.evidenceCases.every(c=>c.passed));
  assert.equal(archive.records.filter(r=>r.kind==='CHECKPOINT').length,7);
  assert.equal(archive.records.filter(r=>r.kind==='VIEWS_SAMPLE').length,18);
  assert.equal(new Set(archive.records.map(r=>r.id)).size,25);
  for(const r of archive.records){
    const mapped=map(r,archive.sourceCommit);assert.equal(mapped.valid,true,r.id+JSON.stringify(mapped.errors));
    assert.deepEqual(mapped.view,r.view);assert.equal(mapped.sourceLabel,r.sourceLabel);assert.equal(mapped.action,null);
  }
});
test('initial snapshot does not invent a personnel grant or imported person',()=>{
  const s=result('checkpoint:initial');assert.equal(s.view.source.imported,false);assert.equal(s.view.personnelBudget.grantedI,0);
  assert.equal(s.physicalP,0);assert.equal(s.view.source.actualTrainingReceipt,null);
});
test('T7 import and acceptance retain source assumption and separate fees',()=>{
  const imported=result('checkpoint:imported'),accepted=result('checkpoint:accepted');
  assert.equal(imported.view.source.kind,'SCENARIO_INITIAL_TRAINED_RESERVE_ASSUMPTION');
  assert.equal(imported.view.personnelBudget.availableI,2);assert.equal(imported.personnelSpentI,0);
  assert.equal(accepted.view.personnelBudget.escrowI,1);assert.equal(accepted.personnelSpentI,1);assert.equal(accepted.view.warehouse.residentP,0);
});
test('E7 receipt snapshot is already T8 available; expiry is E8, quota is spent once',()=>{
  const s=result('checkpoint:E7'),v=s.view;
  assert.equal(v.turn,8);assert.equal(v.phase,'GERMAN_SUPPLY_RAIL');assert.equal(v.receivedEpoch,7);assert.equal(v.availableFromTurn,8);
  assert.equal(v.careEndsAfterEpoch,8);assert.equal(v.warehouse.availableP,1);
  assert.deepEqual([v.service.quotaLQ,v.service.usedLQ,v.service.remainingLQ,v.service.renews],[4,4,0,false]);
  assert.equal(result('checkpoint:T8').view.service.usedLQ,4);
});
test('single warehouse counts 1P + 2E2 once, without historical 012 personnel override',()=>{
  const s=result('checkpoint:T8'),old=RECORDS_012.records.find(r=>r.label==='T7').view;
  assert.equal(old.equipment.P,0);assert.equal(old.equipment.rearE2,2);
  assert.equal(s.view.warehouse.residentP,1);assert.equal(s.view.warehouse.residentE2,2);assert.equal(s.occupiedP,1);
  assert.equal(s.view.warehouse.personnelAuthority,'personnel.package');assert.equal(s.view.warehouse.historical012PIsNotCurrentStock,true);
});
test('two accounts each conserve funds, including rollback and escrow refund samples',()=>{
  for(const r of archive.records){
    const s=map(r,archive.sourceCommit),p=s.view.personnelBudget,e=s.view.equipment012Budget;
    assert.equal(p.grantedI,p.availableI+p.escrowI+s.personnelSpentI);
    assert.deepEqual(e,{granted:10,freeI:5,productionSpent:3,handoffSpent:2,escrow:0});
  }
  const r=t8();r.view.personnelBudget.availableI+=1;r.view.equipment012Budget.freeI-=1;
  const s=map(r,archive.sourceCommit);assert.equal(s.valid,false);assert(s.errors.includes('人员账户不守恒'));assert(s.errors.includes('装备账户不守恒'));
});
test('HELD reserves space but no received stock; spent quota and carriage are retained',()=>{
  const s=sample('rejected_receipt_held'),v=s.view;
  assert.equal(v.origin,'SYNTHETIC_REFUSAL_ON_REAL_REPLAY');
  assert.deepEqual([v.custody.transitP,v.warehouse.residentP,v.warehouse.incomingHeldP,s.occupiedP],[1,0,1,1]);
  assert.equal(v.receivedEpoch,null);assert.equal(v.personnelBudget.carriageSpentI,1);assert.equal(v.service.usedLQ,4);
});
test('quarantine is a subset of one physical person and continues to occupy rear capacity',()=>{
  for(const label of ['E9_transit_expired','E8_unsent_expired','E8_unaccepted_pool_expired','end_T8_rear_care_expired','early_terminal_source','early_terminal_transit','early_terminal_rear']){
    const s=sample(label),v=s.view;assert.equal(s.physicalP,1);assert.equal(v.custody.quarantinedP,1);
    assert.equal(v.warehouse.availableP,0);assert.match(v.origin,/^SYNTHETIC_/);
    if(v.warehouse.residentP===1){assert.equal(s.occupiedP,1);assert.equal(v.warehouse.quarantinedResidentP,1);}
  }
});
test('expired source escrow refunds same account; expired transit does not refund carriage or quota',()=>{
  const a=sample('E8_unsent_expired').view,b=sample('E9_transit_expired').view;
  assert.deepEqual([a.personnelBudget.availableI,a.personnelBudget.escrowI,a.personnelBudget.acceptanceCareSpentI],[1,0,1]);
  assert.deepEqual([b.personnelBudget.availableI,b.personnelBudget.carriageSpentI,b.service.usedLQ,b.warehouse.incomingHeldP],[0,1,4,0]);
});
test('all four faults display precommit accepted ledger, not the E7 success balance',()=>{
  for(const label of ['failure_after_reserve','failure_after_dispatch','failure_after_receipt','failure_before_commit']){
    const v=sample(label).view;assert.equal(v.origin,'SYNTHETIC_FAULT_ON_REAL_REPLAY');
    assert.equal(v.turn,7);assert.equal(v.phase,'SOVIET_ENTRENCHMENT');
    assert.deepEqual([v.personnelBudget.escrowI,v.personnelBudget.carriageSpentI,v.warehouse.residentP,v.service.usedLQ],[1,0,0,0]);
    assert.equal(v.lastRequestError.error,'REJECTED_ALL_STATE_AND_RECEIPTS_UNCHANGED');
  }
});
test('quota used/held blockers and no-application control retain synthetic provenance',()=>{
  for(const label of ['quota_blocked_used','quota_blocked_held']){
    const v=sample(label).view;assert.equal(v.service.remainingLQ,3);assert.deepEqual(v.blockingReasons,['TOTAL_PERSONNEL_QUOTA_EXHAUSTED']);assert.equal(v.warehouse.residentP,0);
  }
  assert.equal(result('checkpoint:noApplicationT8').view.origin,'SYNTHETIC_NONMERGEABLE');
});
test('unknown schema and every missing exported field fail closed without default values',()=>{
  const r=t8();r.view.schema='industry-013-personnel-view.v2';assert.equal(map(r,archive.sourceCommit).valid,false);
  const paths=[];
  const walk=(obj,prefix='')=>{for(const [key,value] of Object.entries(obj)){const p=prefix?prefix+'.'+key:key;paths.push(p);if(value&&typeof value==='object'&&!Array.isArray(value))walk(value,p);}};
  walk(t8().view);
  for(const path of paths){const missing=t8(),keys=path.split('.'),last=keys.pop();let parent=missing.view;for(const key of keys)parent=parent[key];delete parent[last];
    const s=map(missing,archive.sourceCommit);assert.equal(s.valid,false,path);assert(s.errors.some(x=>x.includes('未提供')),path);}
});
test('contradictory subset, physical custody, warehouse alias, quota and expiry are rejected',()=>{
  const mutations=[
    v=>{v.custody.sourceP=1;},v=>{v.warehouse.quarantinedResidentP=1;},v=>{v.warehouse.residentP=0;},
    v=>{v.service.remainingLQ=4;},v=>{v.careEndsAfterEpoch=9;},v=>{v.service.renews=true;},
    v=>{v.warehouse.personnelAuthority='industry012';},v=>{v.forwardTransportRecoveryFormationAllowed=true;},
    v=>{v.source.actualTrainingReceipt='fake';},v=>{v.receivedEpoch=null;},v=>{v.turn=25;}
  ];
  for(const mutate of mutations){const r=t8();mutate(r.view);assert.equal(map(r,archive.sourceCommit).valid,false);}
});
test('mapping is isolated: input is unchanged; output mutation cannot alter static archive',()=>{
  const before=JSON.stringify(archive),s=result('checkpoint:T8');s.view.warehouse.residentP=99;
  assert.equal(JSON.stringify(archive),before);assert.equal(result('checkpoint:T8').view.warehouse.residentP,1);
  assert.equal(s.action,null);assert.equal(s.readOnly,true);
});


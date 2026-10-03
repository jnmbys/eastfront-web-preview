import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemoAdapter } from '../demo-adapter.mjs';
const make = () => createDemoAdapter({ wait: () => Promise.resolve() });
async function completeProduction(a) { await a.command('submit'); await a.command('advance'); await a.command('advance'); }
function balances(a, values) { const s=a.snapshot(); assert.deepEqual([s.freeI,s.escrowI,s.productionSpentI,s.handoffSpentI,s.buffer,s.transit,s.rear,s.rearHold,s.available],values); }
test('fixed quote, normal E5/E6/T7 flow and custody conservation', async () => {
  const a=make(); balances(a,[10,0,0,0,0,0,0,0,0]);
  assert.deepEqual(a.snapshot().quote,{initialI:10,costI:3,feeI:2,outputE2:2,boundaries:2,expectedTurn:7});
  await a.command('submit'); balances(a,[5,2,3,0,0,0,0,0,0]); assert.equal(a.snapshot().bufferHold,2);
  await a.command('advance'); assert.equal(a.snapshot().clock,'E5'); assert.equal(a.snapshot().progress,1); assert.equal(a.snapshot().produced,0);
  await a.command('advance'); assert.equal(a.snapshot().clock,'E6'); assert.equal(a.snapshot().status,'waiting'); balances(a,[5,2,3,0,2,0,0,0,0]);
  await a.command('dispatch'); balances(a,[5,0,3,2,0,2,0,2,0]);
  await a.command('receive'); balances(a,[5,0,3,2,0,0,2,0,0]); assert.equal(a.snapshot().availableFromTurn,7);
  await a.command('nextTurn'); balances(a,[5,0,3,2,0,0,2,0,2]); assert.equal(a.snapshot().clock,'T7'); assert.equal(a.snapshot().personnel,0);
});
test('pending submit leaves all accounts unchanged and blocks duplicate clicks', async () => {
  let resolve; const a=createDemoAdapter({wait:()=>new Promise(r=>resolve=r)});
  const pending=a.command('submit'); assert.equal(a.snapshot().status,'submitting'); balances(a,[10,0,0,0,0,0,0,0,0]);
  await a.command('submit'); await a.command('advance'); balances(a,[10,0,0,0,0,0,0,0,0]);
  resolve(); await pending; balances(a,[5,2,3,0,0,0,0,0,0]);
});
for (const [mode,status] of [['reject','rejected'],['unknown','unknown']]) test(`${mode}: no speculative accounts; retry keeps IDs`, async () => {
  const a=make(), id=a.snapshot().orderId; a.configure('response',mode); await a.command('submit');
  assert.equal(a.snapshot().status,status); balances(a,[10,0,0,0,0,0,0,0,0]);
  await a.command('submit'); assert.equal(a.snapshot().orderId,id); balances(a,[5,2,3,0,0,0,0,0,0]);
});
test('successful submit replay and duplicate receipt never charge or produce twice', async () => {
  const a=make(); await completeProduction(a); await a.command('submit'); balances(a,[5,2,3,0,2,0,0,0,0]);
  await a.command('dispatch'); await a.command('dispatch'); await a.command('receive');
  const before=a.snapshot(); await a.command('receive'); await a.command('advance'); assert.deepEqual(a.snapshot(),before);
  await a.command('nextTurn'); const final=a.snapshot(); await a.command('nextTurn'); await a.command('submit'); assert.deepEqual(a.snapshot(),final);
});
test('failed dispatch preserves escrow and production stock, later E7 retry -> T8', async () => {
  const a=make(); a.configure('handoffFault','dispatch'); await completeProduction(a); await a.command('dispatch');
  assert.equal(a.snapshot().status,'waiting'); balances(a,[5,2,3,0,2,0,0,0,0]); assert.match(a.snapshot().expected,/延期/);
  await a.command('dispatch'); assert.equal(a.snapshot().clock,'E7'); assert.equal(a.snapshot().expected,'T8（无阻塞）');
  await a.command('receive'); assert.equal(a.snapshot().availableFromTurn,8); balances(a,[5,0,3,2,0,0,2,0,0]);
});
test('HELD keeps transit and destination hold; E7 retry costs nothing; T8 available', async () => {
  const a=make(); a.configure('handoffFault','receipt'); await completeProduction(a); await a.command('dispatch'); await a.command('receive');
  assert.equal(a.snapshot().status,'held'); balances(a,[5,0,3,2,0,2,0,2,0]); const id=a.snapshot().receiptId;
  await a.command('nextTurn'); assert.equal(a.snapshot().available,0);
  await a.command('retryReceipt'); assert.equal(a.snapshot().clock,'E7'); assert.equal(a.snapshot().receiptId,id);
  balances(a,[5,0,3,2,0,0,2,0,0]); await a.command('nextTurn'); assert.equal(a.snapshot().clock,'T8'); assert.equal(a.snapshot().available,2);
});
test('multiple held epochs still produce once and availability follows actual receipt', async () => {
  const a=make(); await completeProduction(a); a.configure('handoffFault','receipt'); await a.command('dispatch'); await a.command('receive');
  a.configure('handoffFault','receipt'); await a.command('retryReceipt'); balances(a,[5,0,3,2,0,2,0,2,0]);
  await a.command('retryReceipt'); assert.equal(a.snapshot().availableFromTurn,9); assert.equal(a.snapshot().produced,2);
});
test('reset invalidates pending callback and snapshots cannot mutate adapter state', async () => {
  let resolve; const a=createDemoAdapter({wait:()=>new Promise(r=>resolve=r)}); const p=a.command('submit'); a.reset(); resolve(); await p;
  assert.equal(a.snapshot().status,'draft'); const copy=a.snapshot(); copy.freeI=0; copy.log.length=0; assert.equal(a.snapshot().freeI,10); assert.equal(a.snapshot().log.length,1);
});
test('illegal out-of-order commands cannot skip confirmation or settlement', async () => {
  const a=make(); for(const cmd of ['receive','dispatch','nextTurn','retryReceipt','advance']) await a.command(cmd);
  balances(a,[10,0,0,0,0,0,0,0,0]); await a.command('submit'); await a.command('receive'); await a.command('nextTurn'); assert.equal(a.snapshot().progress,0); assert.equal(a.snapshot().available,0);
});

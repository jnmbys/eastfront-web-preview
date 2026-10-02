// Fixed T5 checkpoint + bounded targeted calls, no campaign replay or parameter edits.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {RecoveryTransactions, snapshotHash} from './adapter.mjs';
import {executeOriginal, verifyRuntime, savedCheckpointJSON} from './authority.mjs';
import {loadCheckpoints, loadActions, gate, bytesHash} from './.runtime/planner/experiments/industry-integrate-005/inputs.mjs';

const python = process.env.INDUSTRY_PYTHON ?? 'python';
const cp = loadCheckpoints(), actions = loadActions(), start = cp.german_recovery_T5;
const startJSON = savedCheckpointJSON('german_recovery_T5');
assert.deepEqual(JSON.parse(startJSON), start);
const savedBefore = snapshotHash({cp, actions});
const historic = actions.find(a => a.label === 'actual_RP_repair');
const request = (id = historic.command.id, b = start) => ({requestId: id, controllerId: 'G-HUMAN-1',
  unitId: 'G-I-01', expectedRevision: b.revision, snapshotHash: snapshotHash(b), paymentMode: 'RP'});
const rows = [];
const audit = b => ({fullHash: snapshotHash(b), coreHash: snapshotHash(b.core), logisticsHash: snapshotHash(b.logistics),
  revision: b.revision, RP: b.core.rp, unit: b.core.units['G-I-01'], random: b.core.random,
  identityCounters: b.core.idCounters, actionCount: b.core.actionLog.length,
  recoveryCount: b.core.actionLog.filter(a => a.accepted && a.action.type === 'REPAIR_UNIT' && a.turn === b.core.turn).length,
  seenCount: Object.keys(b.seen).length, journalCount: b.journal.length});
function record(name, origin, store, before, detail) {
  rows.push({name, origin, before: audit(before), after: audit(store.snapshot()),
    afterSerializedHash: bytesHash(store.serializedSnapshot()),
    transactionMetadata: store.metadata(), detail});
}
function assertOnce(b) {
  assert.equal(b.revision, start.revision + 1);
  assert.equal(b.core.rp.GERMAN, start.core.rp.GERMAN - 1);
  assert.equal(b.core.units['G-I-01'].step, start.core.units['G-I-01'].step - 1);
  assert.equal(audit(b).recoveryCount, 1);
  assert.deepEqual(b.core.random, start.core.random);
  assert.deepEqual(b.logistics.units.map(u => ({id: u.id, stock: u.stock, debt: u.debt})),
    start.logistics.units.map(u => ({id: u.id, stock: u.stock, debt: u.debt})));
}
function assertGate(reply) {
  assert.equal(reply.runtimeGate.allowed, false);
  assert.deepEqual(reply.runtimeGate.blockers, gate.blockers);
  assert.equal(gate.blockers.length, 35);
}

// Control only: unchanged live.execute must match the already saved original full result.
const control = await executeOriginal(startJSON, historic.command, python);
assert.equal(control.ok, true, control.error);
assert.deepEqual(control.state, cp.repaired);
assert.equal(bytesHash(control.stateJSON), bytesHash(savedCheckpointJSON('repaired')), 'SAVED_RESULT_SERIALIZATION_DIFFERS');
const store = new RecoveryTransactions(startJSON, {python});
const input = request(), originalInput = structuredClone(input);
const first = await store.submit(input);
assert.equal(first.ok, true); assertGate(first);
assert.deepEqual(store.snapshot(), control.state); assert.deepEqual(input, originalInput);
assertOnce(store.snapshot());
record('full_original_result_control', 'REAL_T5_EXISTING_RP_CONTROL', store, start,
  {reply: first, fullResultEqualsOriginalExecute: true, fullResultEqualsSavedRepaired: true, serializedResultEqualsSavedRepaired: true,
    newContribution: 'Atomic publication and separate receipt; RP recovery itself is existing behavior.'});
const afterFirst = store.snapshot();
const retry = await store.submit(Object.fromEntries(Object.entries(input).reverse()));
assert.equal(retry.ok, true); assert.equal(retry.replayed, true);
assert.deepEqual(retry.receipt, first.receipt); assert.deepEqual(store.snapshot(), afterFirst);
assert.equal(store.serializedSnapshot(), control.stateJSON);
record('same_ID_same_content_retry', 'SYNTHETIC_REQUEST_SEQUENCE_REAL_T5', store, afterFirst, {reply: retry});
for (const change of [{unitId: 'G-I-02'}, {paymentMode: 'PE'}, {expectedRevision: 110}, {snapshotHash: 'other'}]) {
  const conflict = await store.submit({...input, ...change});
  assert.equal(conflict.error.code, 'REQUEST_ID_CONFLICT'); assert.deepEqual(store.snapshot(), afterFirst);
  record('ID_conflict_' + Object.keys(change)[0], 'SYNTHETIC_REQUEST_SEQUENCE_REAL_T5', store, afterFirst, {reply: conflict});
}

for (const [name, b, change, error] of [
  ['stale_revision', start, {expectedRevision: 108}, 'STALE_RECOVERY_CONTEXT'],
  ['stale_full_hash', start, {snapshotHash: 'stale'}, 'STALE_RECOVERY_CONTEXT'],
  ['no_base', cp.german_recovery_T2, {}, 'RECOVERY_NOT_ELIGIBLE'],
  ['already_recovered', cp.repaired, {}, 'RECOVERY_NOT_ELIGIBLE'],
  ['wrong_side', start, {controllerId: 'S-AI-1'}, 'RECOVERY_NOT_ELIGIBLE'],
  ['PE_no_RP_fallback', start, {paymentMode: 'PE'}, 'PE_OR_UNKNOWN_MODE_BLOCKED'],
  ['caller_quote_not_trusted', start, {quote: {RP: 0, commonEligible: true}}, 'INVALID_REQUEST_SCHEMA'],
  ['legacy_ID_collision', start, {requestId: Object.keys(start.seen)[0]}, 'LEGACY_REQUEST_ID_COLLISION'],
]) {
  const nameOfCheckpoint = b === start ? 'german_recovery_T5' : b === cp.repaired ? 'repaired' : 'german_recovery_T2';
  const s = new RecoveryTransactions(savedCheckpointJSON(nameOfCheckpoint), {python});
  const r = await s.submit({...request('006-' + name, b), ...change});
  assert.equal(r.ok, false); assert.equal(r.error.code, error); assertGate(r);
  assert.deepEqual(s.snapshot(), b);
  assert.equal(s.serializedSnapshot(), savedCheckpointJSON(nameOfCheckpoint));
  record(name, 'REAL_CHECKPOINT_SYNTHETIC_REQUEST', s, b, {reply: r, fullGameStateUnchanged: true});
}

// Failure before execute, after private execution, or immediately before publication.
for (const stage of ['before_execute', 'after_execute', 'before_commit']) {
  let armed = true;
  const s = new RecoveryTransactions(startJSON, {python, testMode: true, testFault: observed => {
    if (armed && observed === stage) { armed = false; throw Error('SYNTHETIC_FAILURE:' + stage); }
  }});
  const req = request('006-fault-' + stage);
  const rejected = await s.submit(req);
  assert.equal(rejected.error.code, 'PRECOMMIT_FAILURE'); assert.equal(rejected.retryable, true);
  assert.deepEqual(s.snapshot(), start);
  assert.equal(s.serializedSnapshot(), startJSON);
  assert.equal(s.metadata()[req.requestId].status, 'RETRYABLE');
  record('fault_' + stage, 'SYNTHETIC_FAULT_REAL_T5', s, start, {reply: rejected, noPartialCommit: true});
  const success = await s.submit(req);
  assert.equal(success.ok, true); assertOnce(s.snapshot());
  const committed = s.snapshot();
  assert.equal((await s.submit(req)).replayed, true); assert.deepEqual(s.snapshot(), committed);
  record('retry_after_' + stage, 'SYNTHETIC_FAULT_REAL_T5', s, start, {reply: success});
}

const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return {promise, resolve}; };
for (const sameId of [false, true]) {
  const entered = deferred(), release = deferred(); let executions = 0;
  const s = new RecoveryTransactions(startJSON, {python, testMode: true, testFault: async stage => {
    if (stage === 'before_execute') executions++;
    if (stage === 'after_execute') { entered.resolve(); await release.promise; }
  }});
  const a = request('006-race-A'), b = request(sameId ? '006-race-A' : '006-race-B');
  const pa = s.submit(a);
  await entered.promise;
  const pb = s.submit(b);
  // First candidate has executed privately. Neither it nor a second debit is visible yet.
  assert.deepEqual(s.snapshot(), start); assert.equal(executions, 1);
  release.resolve();
  const [ra, rb] = await Promise.all([pa, pb]);
  assert.equal(ra.ok, true); assertOnce(s.snapshot()); assert.equal(executions, 1);
  if (sameId) { assert.equal(rb.ok, true); assert.equal(rb.replayed, true); }
  else { assert.equal(rb.ok, false); assert.equal(rb.error.code, 'STALE_RECOVERY_CONTEXT'); }
  record(sameId ? 'concurrent_identical_retry' : 'two_requests_one_version', 'SYNTHETIC_CONCURRENCY_REAL_T5', s, start,
    {replies: [ra, rb], originalExecutions: executions, privateCandidateInvisibleBeforeCommit: true});
}

// Successful commit with lost reply, then a legitimate newer state through original END_PHASE.
let lost = true;
const lostStore = new RecoveryTransactions(startJSON, {python, testMode: true, testFault: stage => {
  if (lost && stage === 'after_commit_before_reply') { lost = false; throw Error('SYNTHETIC_REPLY_LOST'); }
}});
const lostRequest = request('006-lost-reply');
await assert.rejects(lostStore.submit(lostRequest), /SYNTHETIC_REPLY_LOST/);
assertOnce(lostStore.snapshot());
const receipt = lostStore.metadata()[lostRequest.requestId].receipt;
const lostRetry = await lostStore.submit(lostRequest);
assert.equal(lostRetry.ok, true); assert.equal(lostRetry.replayed, true);
record('retry_after_lost_reply', 'SYNTHETIC_ACK_LOSS_REAL_T5', lostStore, start, {reply: lostRetry});
const repairedJSONBeforeAdvance = lostStore.serializedSnapshot();
const phaseCommand = await lostStore.advancePhaseForTest();
const advanced = lostStore.snapshot();
const advancedJSON = lostStore.serializedSnapshot();
const directAdvance = await executeOriginal(repairedJSONBeforeAdvance, phaseCommand, python);
assert.equal(directAdvance.ok, true, directAdvance.error); assert.deepEqual(advanced, directAdvance.state);
assert.equal(advanced.revision, 111);
const lateRetry = await lostStore.submit(lostRequest);
assert.deepEqual(lateRetry.receipt, receipt); assert.equal(lateRetry.currentRevision, 111);
assert.equal(lateRetry.receipt.committedRevision, 110);
assert.deepEqual(lostStore.snapshot(), advanced);
assert.equal(lostStore.serializedSnapshot(), advancedJSON);
record('late_retry_preserves_newer_state', 'SYNTHETIC_REQUEST_SEQUENCE_ORIGINAL_PHASE_ADVANCE', lostStore, advanced,
  {reply: lateRetry, originalPhaseCommand: phaseCommand, fullContinuationEqualsOriginal: true});

assert.equal(snapshotHash({cp, actions}), savedBefore);
const manifest = verifyRuntime();
const implementation = Object.fromEntries(['prepare.py', 'live_bridge.py', 'authority.mjs', 'adapter.mjs', 'verify.mjs']
  .map(name => [name, bytesHash(fs.readFileSync(new URL(name, import.meta.url)))]));
const evidence = {status: 'PASS', cases: rows.length, originalGameSuccessIsControlOnly: true,
  fullCampaignReplayed: false, inputsUnchanged: true, savedInputHash: savedBefore,
  originalGateBlockers: gate.blockers, rows, implementation, dependencies: {
    base: manifest.base, runtime: manifest.core,
    rule: '7a970e020dc6ac104d44ac72a4a18508b10b1d2f', fixtures: '268ea7bd3d139936c4c6e52579cd4a84470e2611',
    versions: manifest.versions, manifestHash: bytesHash(fs.readFileSync(new URL('./.runtime/manifest.json', import.meta.url)))},
  scope: 'Single owner in one Node process; no durability, cross-process CAS, HTTP or deployment guarantee.'};
const text = JSON.stringify(evidence, null, 2) + '\n';
if (process.argv.includes('--write')) fs.writeFileSync(new URL('./EVIDENCE.json', import.meta.url), text);
else assert.equal(bytesHash(fs.readFileSync(new URL('./EVIDENCE.json', import.meta.url))), bytesHash(text), 'EVIDENCE_DIFFERS');
console.log(JSON.stringify({status: evidence.status, cases: rows.length, fullOriginalEquality: true,
  originalRuntimeBlockers: 35, scope: evidence.scope}, null, 2));

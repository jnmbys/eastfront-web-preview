import assert from 'node:assert/strict';
import {executeOriginal, verifyRuntime} from './authority.mjs';
import {planRecoveryPayment} from './.runtime/planner/experiments/industry-integrate-005/service.mjs';
import {snapshotHash, freeze, gate, bytesHash} from './.runtime/planner/experiments/industry-integrate-005/inputs.mjs';

export {snapshotHash};
const clone = structuredClone;
const fields = ['requestId', 'controllerId', 'unitId', 'expectedRevision', 'snapshotHash', 'paymentMode'];
const failure = (code, details = null) => ({code, details});

/** Single-owner, in-memory experimental store. No HTTP, disk commit or cross-process lock. */
export class RecoveryTransactions {
  #root;
  #tail = Promise.resolve();
  #python;
  #fault;
  #testMode;

  constructor(bundleJSON, {python, testMode = false, testFault = null} = {}) {
    verifyRuntime();
    assert.equal(typeof bundleJSON, 'string', 'LOSSLESS_SERIALIZED_BUNDLE_REQUIRED');
    this.#root = freeze({bundle: JSON.parse(bundleJSON), bundleJSON, records: Object.create(null)});
    this.#python = python;
    this.#testMode = testMode;
    if (testFault && !testMode) throw Error('FAULT_INJECTION_REQUIRES_TEST_MODE');
    // Test hook receives only a stage name; cannot edit private state or supply a candidate.
    this.#fault = testFault;
  }

  snapshot() { return clone(this.#root.bundle); }
  serializedSnapshot() { return this.#root.bundleJSON; }
  metadata() { return clone(this.#root.records); }

  // Necessary test-only continuation: create a genuinely newer state through the
  // original entry, without editing revision, units or supply to fabricate one.
  advancePhaseForTest() {
    if (!this.#testMode) throw Error('TEST_MODE_REQUIRED');
    const run = this.#tail.then(async () => {
      const current = this.#root.bundle;
      const controller = Object.values(current.core.controllers).find(c => c.side === current.core.activeSide);
      const command = {id: '006-test-phase-' + current.revision, revision: current.revision,
        action: {type: 'END_PHASE', controllerId: controller.id}};
      const result = await executeOriginal(this.#root.bundleJSON, command, this.#python);
      if (!result.ok || result.duplicate) throw Error('TEST_CONTINUATION_FAILED:' + result.error);
      this.#root = freeze({bundle: result.state, bundleJSON: result.stateJSON, records: this.#root.records});
      return clone(command);
    });
    this.#tail = run.catch(() => {});
    return run;
  }

  submit(request) {
    // Capture contents before queueing: caller mutations cannot change a waiting transaction.
    const captured = clone(request);
    const run = this.#tail.then(() => this.#submit(captured));
    this.#tail = run.catch(() => {});
    return run;
  }

  #reply(data) {
    return clone({...data, currentRevision: this.#root.bundle.revision,
      currentHash: snapshotHash(this.#root.bundle),
      currentSerializedHash: bytesHash(this.#root.bundleJSON),
      executionScope: 'ISOLATED_RP_EXPERIMENT_ONLY',
      runtimeGate: {allowed: false, blockers: gate.blockers}});
  }

  #record(id, value) {
    this.#root = freeze({...this.#root, records: {...this.#root.records, [id]: value}});
  }

  async #submit(request) {
    if (!request || typeof request !== 'object' || Array.isArray(request) ||
        Object.keys(request).length !== fields.length || fields.some(k => !Object.hasOwn(request, k)) ||
        fields.filter(k => k !== 'expectedRevision').some(k => typeof request[k] !== 'string' || !request[k]) ||
        !Number.isSafeInteger(request.expectedRevision) || request.expectedRevision < 0) {
      return this.#reply({ok: false, error: failure('INVALID_REQUEST_SCHEMA')});
    }
    const id = request.requestId, fingerprint = snapshotHash(request);
    const previous = Object.hasOwn(this.#root.records, id) ? this.#root.records[id] : null;
    if (previous) {
      if (previous.fingerprint !== fingerprint) return this.#reply({ok: false, error: failure('REQUEST_ID_CONFLICT')});
      // Replay before stale/eligibility checks: the original transaction has already committed.
      // Never reinstall the historical result bundle, even if current state is newer.
      if (previous.status === 'COMMITTED') return this.#reply({ok: true, replayed: true, receipt: previous.receipt});
      if (previous.status === 'REJECTED') return this.#reply({ok: false, replayed: true, error: previous.error});
    }
    const bound = {fingerprint, request: clone(request), status: 'RETRYABLE', receipt: null};
    this.#record(id, bound);
    const reject = error => {
      this.#record(id, {...bound, status: 'REJECTED', error});
      return this.#reply({ok: false, error});
    };
    if (request.paymentMode !== 'RP') return reject(failure('PE_OR_UNKNOWN_MODE_BLOCKED'));
    const current = this.#root.bundle;
    // Old live.execute deduplicates before revision checks. Never let a legacy seen ID
    // masquerade as a newly committed recovery in this adapter's separate receipt namespace.
    if (Object.hasOwn(current.seen, id)) return reject(failure('LEGACY_REQUEST_ID_COLLISION'));
    const beforeHash = snapshotHash(current);
    if (request.expectedRevision !== current.revision || request.snapshotHash !== beforeHash) return reject(failure('STALE_RECOVERY_CONTEXT'));
    const {requestId, ...query} = request;
    const plan = planRecoveryPayment(current, query);
    if (!plan.planAvailable) return reject(failure('RECOVERY_NOT_ELIGIBLE', {
      common: plan.commonEligibility.commonIssues, payment: plan.payment.errors}));
    // User authorization is limited to this isolated RP experiment. 005 gate is unchanged.
    assert.equal(plan.runtimeGate.allowed, false);
    assert.equal(plan.runtimeGate.blockers.length, 35);
    const command = {id, revision: current.revision, action: {
      type: 'REPAIR_UNIT', controllerId: request.controllerId, unitId: request.unitId}};
    let result, nextRoot, receipt;
    try {
      await this.#fault?.('before_execute');
      result = await executeOriginal(this.#root.bundleJSON, command, this.#python);
      if (!result.ok) return reject(failure('ORIGINAL_ENTRY_REJECTED', result.error));
      if (result.duplicate) throw Error('UNEXPECTED_ORIGINAL_DUPLICATE');
      await this.#fault?.('after_execute');
      // Lock covers every await. Verify state identity/version/hash/eligibility again at publication.
      assert.equal(this.#root.bundle, current);
      assert.equal(this.#root.bundle.revision, request.expectedRevision);
      assert.equal(snapshotHash(this.#root.bundle), request.snapshotHash);
      assert.equal(planRecoveryPayment(this.#root.bundle, query).planAvailable, true);
      assert.equal(result.state.revision, current.revision + 1);
      assert.deepEqual(JSON.parse(result.stateJSON), result.state);
      receipt = {requestId: id, fingerprint, beforeRevision: current.revision, beforeHash,
        beforeSerializedHash: bytesHash(this.#root.bundleJSON),
        committedRevision: result.state.revision, committedHash: snapshotHash(result.state),
        committedSerializedHash: bytesHash(result.stateJSON), command};
      // Build everything before publication; no state or receipt mutation after pointer swap.
      nextRoot = freeze({bundle: result.state, bundleJSON: result.stateJSON, records: {...this.#root.records,
        [id]: {...bound, status: 'COMMITTED', receipt}}});
      await this.#fault?.('before_commit');
    } catch (error) {
      this.#record(id, {...bound, status: 'RETRYABLE', error: failure('PRECOMMIT_FAILURE', String(error))});
      return this.#reply({ok: false, error: failure('PRECOMMIT_FAILURE', String(error)), retryable: true});
    }
    this.#root = nextRoot; // Sole game-state publication point, with receipt in same object.
    await this.#fault?.('after_commit_before_reply'); // Synthetic lost acknowledgement only.
    return this.#reply({ok: true, replayed: false, receipt});
  }
}

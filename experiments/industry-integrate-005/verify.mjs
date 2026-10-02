// Saved checkpoints only. Synthetic negative fixtures are separately labeled.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import * as core from './.runtime/core/index.js';
import {resolveService, queryRecoveryEligibility, planRecoveryPayment} from './service.mjs';
import {quoteMaterialLots} from './materials.mjs';
import {candidate, gate, mapData, loadCheckpoints, loadActions, snapshotHash, freeze, provenance, bytesHash} from './inputs.mjs';

const cp = loadCheckpoints(), actions = loadActions(), evidence = [];
const allInputsBefore = snapshotHash({cp, actions, candidate, gate, mapData});
const requestFor = b => ({controllerId: 'G-HUMAN-1', unitId: 'G-I-01', paymentMode: 'RP',
  receiverId: 'REC-G-C10', expectedRevision: b.revision, snapshotHash: snapshotHash(b)});
const has = (result, reason) => result.commonEligibility.commonIssues.some(i => i.code === reason || i.details?.reason === reason);
function audit(b) {
  return {fullHash: snapshotHash(b), coreHash: snapshotHash(b.core), inventoryHash: snapshotHash(b.logistics),
    revision: b.revision, random: b.core.random, idCounters: b.core.idCounters,
    actionCount: b.core.actionLog.length, acceptedRecoveries: b.core.actionLog.filter(e => e.accepted && e.action.type === 'REPAIR_UNIT').length,
    unitCount: Object.keys(b.core.units).length, journalCount: b.journal.length, seenCount: Object.keys(b.seen).length,
    rp: b.core.rp, materialLedgerPresent: false};
}
function query(name, b, overrides = {}, origin = 'REAL_SAVED_CHECKPOINT', checkpoint = null) {
  const req = {...requestFor(b), ...overrides};
  const original = structuredClone(b), reqCopy = structuredClone(req);
  freeze(b); freeze(req);
  const before = audit(b);
  // Exercise all three public interfaces independently, and twice for repeatability.
  const s = resolveService(b, req), e = queryRecoveryEligibility(b, req), r = planRecoveryPayment(b, req);
  assert.deepEqual(r.service, s); assert.deepEqual(r.commonEligibility, e);
  assert.deepEqual(planRecoveryPayment(b, req), r);
  assert.deepEqual(b, original); assert.deepEqual(req, reqCopy);
  const after = audit(b); assert.deepEqual(before, after);
  assert.equal(r.runtimeGate.allowed, false); assert.deepEqual(r.runtimeGate.blockers, gate.blockers);
  evidence.push({name, origin, checkpoint, request: req, before, after, unchanged: true, result: r});
  return r;
}
function exactSavedRejection(result, label) {
  const row = actions.find(a => a.label === label);
  assert.equal(row.accepted, false);
  assert.deepEqual(result.commonEligibility.recoveryIssues, JSON.parse(row.error.slice('Error: '.length)));
}
const noBase = query('no_base', cp.german_recovery_T2, {}, undefined, 'german_recovery_T2');
assert.equal(noBase.planAvailable, false); assert.ok(has(noBase, 'RECOVERY_BASE_TOO_FAR'));
exactSavedRejection(noBase, 'damaged_supplied_without_base_rejected');
const legal = query('valid_RP', cp.german_recovery_T5, {}, undefined, 'german_recovery_T5');
assert.equal(legal.commonEligibility.commonEligible, true);
assert.deepEqual(legal.payment.plan, {mode: 'RP', debits: [{resource: 'RP', side: 'GERMAN', amount: 1}]});
assert.equal(legal.service.space.key, '2,8');
const historicRepair = actions.find(a => a.label === 'actual_RP_repair');
assert.equal(historicRepair.before.rp.GERMAN - historicRepair.after.rp.GERMAN, 1);
const done = query('already_recovered', cp.repaired, {}, undefined, 'repaired');
assert.equal(done.planAvailable, false); assert.ok(has(done, 'UNIT_ALREADY_RECOVERED_THIS_TURN'));
exactSavedRejection(done, 'duplicate_repair_rejected');
const wrong = query('wrong_side_request', cp.german_recovery_T5, {controllerId: 'S-AI-1'}, undefined, 'german_recovery_T5');
assert.ok(has(wrong, 'WRONG_SIDE')); assert.ok(has(wrong, 'NOT_UNIT_CONTROLLER')); assert.equal(wrong.planAvailable, false);
for (const overrides of [{expectedRevision: 108}, {snapshotHash: 'stale'}]) {
  const stale = query('stale_' + Object.keys(overrides)[0], cp.german_recovery_T5, overrides, undefined, 'german_recovery_T5');
  assert.ok(has(stale, 'STALE_RECOVERY_CONTEXT')); assert.equal(stale.planAvailable, false);
}
const pe = query('PE_unapproved', cp.german_recovery_T5, {paymentMode: 'PE'}, undefined, 'german_recovery_T5');
assert.equal(pe.commonEligibility.commonEligible, true); assert.equal(pe.planAvailable, false);
assert.deepEqual(pe.payment.requirements, {P: 1, 'E2:L': 2});
for (const e of ['PE_RECIPE_OR_HOOK_UNAPPROVED', 'SERVICE_GRANT_UNRESOLVED', 'MATERIAL_SOURCE_OR_MANIFEST_UNRESOLVED', 'MATERIAL_LEDGER_UNAVAILABLE']) assert.ok(pe.payment.errors.includes(e));
assert.equal(pe.payment.plan, null); assert.equal(pe.payment.automaticFallback, false);
const wrongReceiver = query('wrong_side_receiver', cp.german_recovery_T5, {paymentMode: 'PE', receiverId: 'REC-S-AC10'}, undefined, 'german_recovery_T5');
assert.equal(wrongReceiver.service.materialService.receiverKey, '28,-5');
assert.ok(wrongReceiver.payment.errors.includes('RECEIVER_WRONG_SIDE'));
assert.ok(wrongReceiver.payment.errors.includes('MATERIAL_SERVICE_REQUIRES_SAME_HEX'));
const mixed = query('mixed_payment_request', cp.german_recovery_T5, {alsoDebitRP: 1}, undefined, 'german_recovery_T5');
assert.ok(has(mixed, 'UNKNOWN_OR_MIXED_PAYMENT_FIELDS')); assert.equal(mixed.planAvailable, false);
const duplicate = query('duplicate_canonical_action', cp.german_recovery_T5,
  {actionId: cp.german_recovery_T5.core.actionLog[0].actionId}, undefined, 'german_recovery_T5');
assert.ok(has(duplicate, 'ACTION_ID_DUPLICATE')); assert.equal(duplicate.planAvailable, false);
// Public CLI consumes the caller's exact revision/hash; stdin mode never refreshes them.
const cliRequest = {operation: 'plan', bundle: cp.german_recovery_T5, request: requestFor(cp.german_recovery_T5)};
const cli = JSON.parse(execFileSync(process.execPath, [fileURLToPath(new URL('./cli.mjs', import.meta.url)), '--stdin'],
  {input: JSON.stringify(cliRequest), maxBuffer: 20 * 1024 * 1024}));
assert.deepEqual(cli, legal);

// No saved pending checkpoint exists in CAMPAIGN-004. These are negative unit tests,
// NOT actions applied to a real campaign and NOT new received material records.
const synthetic = (name, mutate, expected) => {
  const b = structuredClone(cp.german_recovery_T5); mutate(b);
  const r = query(name, b, {}, 'SYNTHETIC_UNIT_TEST_FROM_T5');
  assert.ok(has(r, expected), name); assert.equal(r.planAvailable, false); return r;
};
synthetic('pending', b => { b.core.pendingDecision = {kind: 'LOSS_ALLOCATION', battleId: 'B-000001',
  side: 'GERMAN', lossSteps: 1, eligibleUnitIds: ['G-I-01'],
  decisionOwnerControllerId: 'G-HUMAN-1', eligibleControllerIds: ['G-HUMAN-1']}; }, 'PENDING_DECISION_BLOCKS_ACTION');
synthetic('controller_ready', b => { b.core.phaseReadyControllerIds = ['G-HUMAN-1']; }, 'CONTROLLER_ALREADY_READY');
synthetic('terminal', b => { b.core.phase = 'GAME_OVER'; }, 'WRONG_PHASE');
synthetic('deployment', b => { b.core.phase = 'GERMAN_DEPLOYMENT'; }, 'WRONG_PHASE');
synthetic('has_moved', b => { b.core.units['G-I-01'].hasMoved = true; }, 'MOVED_THIS_TURN');
synthetic('has_attacked', b => { b.core.units['G-I-01'].hasAttacked = true; }, 'UNIT_ALREADY_ATTACKED');
synthetic('artillery_support', b => { b.core.units['G-I-01'].artillerySupportUsed = true; }, 'ARTILLERY_USED_THIS_TURN');
synthetic('not_normal_supply', b => { b.core.units['G-I-01'].supplyState = 'OUT_OF_SUPPLY'; }, 'NORMAL_SUPPLY_REQUIRED');
synthetic('destroyed', b => { b.core.units['G-I-01'].alive = false; }, 'UNIT_DESTROYED');
synthetic('missing_template', b => { b.core.units['G-I-01'].templateId = 'TEST-MISSING'; }, 'UNIT_TEMPLATE_NOT_FOUND');
synthetic('physical_enemy_adjacency', b => { Object.values(b.core.units).find(u => u.side === 'SOVIET' && u.alive).hex = {q: 3, r: 8}; }, 'ENEMY_ADJACENT');
const low = structuredClone(cp.german_recovery_T5); low.core.rp.GERMAN = 0;
const lowResult = query('only_exact_RP_insufficiency', low, {}, 'SYNTHETIC_UNIT_TEST_FROM_T5');
assert.equal(lowResult.commonEligibility.commonEligible, true);
assert.equal(lowResult.commonEligibility.rpIssues.length, 1);
assert.equal(lowResult.commonEligibility.rpIssues[0].details.reason, 'INSUFFICIENT_RP');
assert.equal(lowResult.payment.conditionsSatisfied, false); assert.equal(lowResult.planAvailable, false);
const lowNoBase = structuredClone(cp.german_recovery_T1); lowNoBase.core.rp.GERMAN = 0;
const both = query('RP_and_other_INVALID_SUPPORT_preserved', lowNoBase, {paymentMode: 'PE'}, 'SYNTHETIC_UNIT_TEST_FROM_T1');
assert.ok(has(both, 'RECOVERY_BASE_TOO_FAR')); assert.equal(both.commonEligibility.rpIssues.length, 1);
assert.equal(both.commonEligibility.commonEligible, false);

// Space, transport, Core recovery base and industry are four distinct facts.
const spaceEvidence = [];
for (const nodeId of ['J7', 'M14', 'R9', 'AD9', 'AF10', 'AC10', 'C10']) {
  const req = {unitId: 'G-I-01', nodeId};
  const b = cp.german_recovery_T5, before = snapshotHash(b);
  const r = resolveService(b, req);
  assert.equal(snapshotHash(b), before); assert.equal(r.space.exists, true);
  assert.equal(r.space.key, core.hexKey(core.parsePaperHex(nodeId)));
  assert.equal(r.industry.productionCapability, null); assert.equal(r.industry.approved, false);
  if (candidate.visualOnlyNodes.includes(nodeId)) {
    assert.equal(r.transport.runtimeSourcesAtNode.length, 0);
    assert.equal(r.transport.existingHubs.length, 0);
    assert.equal(r.recovery.nodeIsCoreBase, false);
  }
  spaceEvidence.push(r);
}

const materialTests = [];
const context = {side: 'G', receiverId: 'SYNTHETIC-REC', sourceId: 'SYNTHETIC-SRC', turn: 5};
const recipe = {P: 1, 'E2:L': 2};
const lots = Object.entries(recipe).map(([material, quantity]) => ({lotId: 'SYNTHETIC-' + material, material,
  quantity, reserved: 0, side: 'G', receiverId: context.receiverId, sourceId: context.sourceId,
  receiptId: 'SYNTHETIC-RECEIPT-NOT-REAL', provenanceApproved: true, status: 'RECEIVED', receivedEpoch: 4, availableFromTurn: 5}));
const beforeLots = structuredClone(lots); freeze(lots);
const materialPlan = quoteMaterialLots(recipe, lots, context);
assert.deepEqual(materialPlan.errors, []); assert.equal(materialPlan.debits.reduce((n, d) => n + d.quantity, 0), 3);
assert.deepEqual(lots, beforeLots);
materialTests.push({origin: 'SYNTHETIC_MATERIAL_UNIT_TEST_ONLY', name: 'P_E_arithmetic', result: materialPlan});
for (const [name, mutate, expected] of [
  ['future', x => { x[0].receivedEpoch = 5; x[0].availableFromTurn = 6; }, 'MATERIAL_NOT_YET_AVAILABLE'],
  ['reserved', x => { x[0].reserved = 1; }, 'INSUFFICIENT_MATERIAL:P'],
  ['receipt_missing', x => { x[0].receiptId = null; }, 'MATERIAL_PROVENANCE_MISSING'],
  ['wrong_source', x => { x[0].sourceId = 'SYNTHETIC-OTHER'; }, 'MATERIAL_CUSTODY_OR_SOURCE_MISMATCH'],
  ['duplicate', x => { x.push(structuredClone(x[0])); }, 'DUPLICATE_MATERIAL_LOT'],
]) {
  const x = structuredClone(lots); mutate(x); const previous = structuredClone(x); freeze(x);
  const r = quoteMaterialLots(recipe, x, context); assert.ok(r.errors.includes(expected)); assert.equal(r.debits, null); assert.deepEqual(x, previous);
  materialTests.push({origin: 'SYNTHETIC_MATERIAL_UNIT_TEST_ONLY', name, result: r});
}

// Verify fixed source objects and the generated adapter are reproducible; no Engine.apply call.
for (const source of provenance.sources) {
  const raw = execFileSync('git', ['show', `${source.commit}:${source.path}`], {maxBuffer: 40 * 1024 * 1024});
  assert.equal(bytesHash(raw), source.sha256);
}
assert.equal(snapshotHash({cp, actions, candidate, gate, mapData}), allInputsBefore);
const summary = {status: 'PASS', refs: provenance.refs,
  queryCases: evidence.length, realSavedCheckpointCases: evidence.filter(x => x.origin === 'REAL_SAVED_CHECKPOINT').length,
  stdinCLIExactMatch: true,
  syntheticStateCases: evidence.filter(x => x.origin.startsWith('SYNTHETIC')).length,
  spaceCases: spaceEvidence.length, syntheticMaterialCases: materialTests.length,
  originalRuntimeBlockersRetained: gate.blockers.length, fullCampaignReplayed: false,
  recoveryActionsExecuted: 0, paymentActionsExecuted: 0, realMaterialReceiptsCreated: 0,
  allSavedInputsUnchanged: true, fullInputHashBefore: allInputsBefore,
  fullInputHashAfter: snapshotHash({cp, actions, candidate, gate, mapData}),
  limits: ['No HTTP, multiplayer/concurrency, transaction execution or deployment acceptance.',
    'Saved checkpoints contain no pending decision: pending coverage is explicitly synthetic.',
    'No approved real P/E ledger: PE allocation remains null, never zero-stock fiction.']};
const implementation = Object.fromEntries(['prepare.mjs', 'inputs.mjs', 'service.mjs', 'materials.mjs', 'cli.mjs', 'verify.mjs']
  .map(name => [name, bytesHash(fs.readFileSync(new URL(name, import.meta.url)))]));
const guardExtraction = JSON.parse(fs.readFileSync(new URL('./.runtime/guard-extraction.json', import.meta.url)));
const result = {summary, queries: evidence, spaceEvidence, materialTests, implementation, guardExtraction, provenance};
const serialized = JSON.stringify(result, null, 2) + '\n';
if (process.argv.includes('--write')) fs.writeFileSync(new URL('./EVIDENCE.json', import.meta.url), serialized);
else assert.equal(bytesHash(fs.readFileSync(new URL('./EVIDENCE.json', import.meta.url))), bytesHash(serialized), 'SAVED_EVIDENCE_BYTES_DIFFER');
console.log(JSON.stringify(summary, null, 2));

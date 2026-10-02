// Three in-process read-only interfaces. No Core apply(), logistics execute(), or writes.
import assert from 'node:assert/strict';
import * as core from './.runtime/core/index.js';
import {queryEnginePreconditions} from './.runtime/core/engine/readOnlyPreconditions.js';
import {candidate, mapData, gate, snapshotHash, freeze} from './inputs.mjs';
import {quoteMaterialLots} from './materials.mjs';

const rules = freeze(core.defaultRules), scenario = freeze(core.defaultScenario);
const nodes = new Map(mapData.nodes.map(n => [n.nodeId, n]));
for (const n of nodes.values()) {
  assert.equal(core.hexKey(core.parsePaperHex(n.nodeId)), n.key);
  assert.equal(core.axialToPaper(core.parsePaperHex(n.nodeId)).label, n.nodeId);
}
const shortSide = side => side === 'GERMAN' ? 'G' : side === 'SOVIET' ? 'S' : null;
const issue = (code, message) => ({code, message});
const isRP = i => i.code === 'INVALID_SUPPORT' && i.details?.reason === 'INSUFFICIENT_RP';
const unique = xs => [...new Map(xs.map(x => [JSON.stringify(x), x])).values()];

function readOnly(bundle, request, operation) {
  // Check entire object, not the historical hash_bundle subset. Return detached results.
  const before = JSON.stringify({bundle, request});
  const result = structuredClone(operation());
  assert.equal(JSON.stringify({bundle, request}), before, 'READ_ONLY_INVARIANT_FAILED');
  return result;
}

function service(bundle, request) {
  const state = bundle.core, unit = state.units[request.unitId];
  const label = request.nodeId ?? (unit ? core.axialToPaper(unit.hex).label : null);
  const node = nodes.get(label), current = node ? state.hexes[node.key] : null;
  const side = unit?.side ?? null, s = shortSide(side);
  const receiver = candidate.receivers.find(r => r.id === request.receiverId) ?? null;
  const depot = candidate.depots.find(d => d.id === receiver?.sourceDepotId) ?? null;
  const source = candidate.sources.find(x => x.id === depot?.sourceId) ?? null;
  const bases = side ? core.computeRecoveryBaseHexKeys(state, side, scenario) : [];
  const baseDistance = unit && bases.length ? Math.min(...bases.map(k => core.hexDistance(unit.hex, state.hexes[k].coord))) : null;
  const errors = [];
  if (!unit) errors.push('UNIT_NOT_FOUND');
  if (!node || !current) errors.push('MAP_NODE_NOT_FOUND');
  if (request.receiverId && !receiver) errors.push('RECEIVER_UNKNOWN');
  if (receiver && receiver.side !== s) errors.push('RECEIVER_WRONG_SIDE');
  const unitKey = unit ? core.hexKey(unit.hex) : null;
  const receiverKey = receiver ? nodes.get(receiver.node).key : null;
  if (receiver && unitKey !== receiverKey) errors.push('MATERIAL_SERVICE_REQUIRES_SAME_HEX');
  const occupiedByEnemy = receiver && side ? Object.values(state.units).some(u => u.alive && u.side !== side && core.hexKey(u.hex) === receiverKey) : null;
  const enemyZoc = receiver && side ? core.isInEnemyZoc(state, rules, side, core.parsePaperHex(receiver.node)) : null;
  return {
    errors,
    space: {nodeId: label, key: node?.key ?? null, exists: !!current, terrain: current?.terrain ?? null,
      control: current?.control ?? null, homeSide: null, objectiveId: null, visualOnly: candidate.visualOnlyNodes.includes(label)},
    transport: {candidateSourcesAtNode: candidate.sources.filter(x => x.node === label),
      runtimeSourcesAtNode: bundle.logistics.sources.filter(x => x.node === label),
      existingHubs: bundle.logistics.hubs.filter(h => h.node === label),
      routeWitness: receiver?.routeWitness ?? null, dynamicMaterialRouteVerified: false},
    recovery: {baseHexKeys: bases, baseLabels: bases.map(k => core.axialToPaper(state.hexes[k].coord).label),
      nodeIsCoreBase: !!node && bases.includes(node.key), distanceFromUnit: baseDistance,
      maxDistance: rules.recovery.maxDistanceFromBase},
    materialService: {receiver, receiverKey, depot, source, sameHex: receiver ? unitKey === receiverKey : null,
      occupiedByEnemy, enemyZoc, control: receiver ? state.hexes[receiverKey]?.control ?? null : null,
      authorized: false, stock: null, reason: 'CANDIDATE_AUTHORIZATION_AND_MATERIALS_UNRESOLVED'},
    industry: {productionCapability: null, approved: false},
  };
}

/** Spatial facts and existing Core bases do not authorize material service. */
export function resolveService(bundle, request) {
  return readOnly(bundle, request, () => service(bundle, request));
}

function eligibility(bundle, request) {
  const state = bundle.core;
  const requestIssues = [];
  const allowed = new Set(['controllerId', 'unitId', 'actionId', 'expectedRevision', 'snapshotHash', 'paymentMode', 'receiverId']);
  if (Object.keys(request).some(k => !allowed.has(k))) requestIssues.push(issue('UNKNOWN_OR_MIXED_PAYMENT_FIELDS', 'Only recovery query fields are accepted.'));
  if (!Number.isSafeInteger(request.expectedRevision) || request.expectedRevision !== bundle.revision || request.snapshotHash !== snapshotHash(bundle)) {
    requestIssues.push(issue('STALE_RECOVERY_CONTEXT', 'Revision and full snapshot hash must both match.'));
  }
  for (const k of ['controllerId', 'unitId']) if (typeof request[k] !== 'string' || !request[k]) requestIssues.push(issue('REQUEST_IDENTITY_INVALID', k + ' must be a nonempty string.'));
  if (request.actionId !== undefined && (typeof request.actionId !== 'string' || !request.actionId)) requestIssues.push(issue('REQUEST_IDENTITY_INVALID', 'actionId must be a nonempty string if supplied.'));
  if (!['RP', 'PE'].includes(request.paymentMode)) requestIssues.push(issue('EXPLICIT_PAYMENT_MODE_REQUIRED', 'Choose exactly RP or PE.'));
  const action = {type: 'REPAIR_UNIT', controllerId: request.controllerId, unitId: request.unitId,
    ...(typeof request.actionId === 'string' ? {actionId: request.actionId} : {})};
  const envelopeIssues = [];
  // Same active-controller selection as pinned live.execute, without executing an action.
  const active = state.pendingDecision?.decisionOwnerControllerId ?? Object.values(state.controllers).find(c => c.side === state.activeSide)?.id;
  if (request.controllerId !== active) envelopeIssues.push(issue('NOT_ACTIVE_CONTROLLER', 'not active controller'));
  if (state.phase === 'GAME_OVER') envelopeIssues.push(issue('CAMPAIGN_FINISHED', 'campaign finished'));
  const engine = queryEnginePreconditions(state, action);
  // Always evaluate direct recovery predicates for diagnostics, even if engine guards block.
  const recoveryIssues = core.validateRecoveryAction(state, rules, scenario, action);
  const integrityIssues = core.validateGameStateIntegrity(state, rules, scenario);
  const rpIssues = recoveryIssues.filter(isRP);
  const commonIssues = unique([...requestIssues, ...envelopeIssues, ...engine.issues,
    ...integrityIssues, ...recoveryIssues.filter(i => !isRP(i))]);
  const unit = state.units[request.unitId];
  return {
    commonEligible: commonIssues.length === 0, commonIssues, requestIssues, envelopeIssues,
    enginePreconditions: {passed: engine.issues.length === 0, issues: engine.issues},
    integrityIssues, recoveryIssues, rpIssues,
    target: unit ? {id: unit.id, side: unit.side, templateId: unit.templateId, step: unit.step,
      nodeId: core.axialToPaper(unit.hex).label, supplyState: unit.supplyState} : null,
    context: {revision: bundle.revision, snapshotHash: snapshotHash(bundle), turn: state.turn, phase: state.phase,
      recoveryCount: unit ? state.actionLog.filter(e => e.accepted && e.turn === state.turn &&
        e.phase === (unit.side === 'GERMAN' ? 'GERMAN_RECOVERY' : 'SOVIET_RECOVERY') && e.action.type === 'REPAIR_UNIT').length : null,
      recoveryLimit: unit ? core.getRecoveryUnitLimit(rules, unit.side, state.turn) : null},
  };
}

/** Original recovery validator + original engine preconditions; never tops up RP. */
export function queryRecoveryEligibility(bundle, request) {
  return readOnly(bundle, request, () => eligibility(bundle, request));
}

/** A quote is not an action, reservation, authorization or future payment guarantee. */
export function planRecoveryPayment(bundle, request) {
  return readOnly(bundle, request, () => {
    const resolved = service(bundle, request), common = eligibility(bundle, request);
    const unit = bundle.core.units[request.unitId], template = rules.unitTemplates[unit?.templateId];
    const errors = [], mode = request.paymentMode;
    let requirements = null, allocation = null;
    if (mode === 'RP') {
      const cost = template?.recoveryCostPerStep, available = unit ? bundle.core.rp[unit.side] : null;
      if (!Number.isSafeInteger(cost) || cost <= 0) errors.push('RP_PRICE_UNRESOLVED');
      if (!Number.isSafeInteger(available) || available < 0) errors.push('RP_BALANCE_INVALID');
      errors.push(...common.rpIssues.map(i => i.details.reason));
      requirements = {RP: {side: unit?.side ?? null, cost: cost ?? null, available}};
      if (!errors.length && common.commonEligible) allocation = {mode: 'RP', debits: [{resource: 'RP', side: unit.side, amount: cost}]};
    } else if (mode === 'PE') {
      const recipe = candidate.recovery.recipes[unit?.templateId] ?? null;
      requirements = recipe;
      errors.push(...resolved.errors);
      if (!recipe) errors.push('PE_TEMPLATE_UNRESOLVED');
      if (!candidate.recovery.recipeApprovalRef || !candidate.recovery.integrationHookApprovalRef) errors.push('PE_RECIPE_OR_HOOK_UNAPPROVED');
      const m = resolved.materialService;
      if (!m.receiver) errors.push('RECEIVER_UNKNOWN');
      if (!m.receiver?.grantRef || !m.depot?.grantRef) errors.push('SERVICE_GRANT_UNRESOLVED');
      if (!candidate.authorization.approvedNullControlPolicy || !candidate.authorization.nullControlApprovalRef) errors.push('NULL_CONTROL_POLICY_UNAPPROVED');
      if (m.occupiedByEnemy !== false || m.enemyZoc !== false) errors.push('HOSTILE_OR_UNKNOWN_ACCESS');
      if (!m.receiver?.transferPermissionRef || m.receiver.storageCapacityE2 == null || m.receiver.personnelCapacityP == null) errors.push('RECEIVING_SERVICE_UNRESOLVED');
      if (!m.source || !m.depot?.stockOriginManifest) errors.push('MATERIAL_SOURCE_OR_MANIFEST_UNRESOLVED');
      if (!candidate.transport.initialMaterialManifest || !candidate.transport.productionToDepotTransferApprovalRef) errors.push('MATERIAL_ORIGIN_UNAPPROVED');
      if (!candidate.transport.approvedEquipmentVectorRule || !candidate.transport.approvedPersonnelTransportRule || !candidate.transport.vectorRuleApprovalRef) errors.push('MATERIAL_TRANSPORT_UNAPPROVED');
      // There is no approved real lot ledger in this baseline. Never treat SP hubs or RP as P/E.
      const lots = quoteMaterialLots(recipe, null, {side: shortSide(unit?.side), receiverId: m.receiver?.id,
        sourceId: m.source?.id, turn: bundle.core.turn});
      errors.push(...lots.errors);
      // Frozen candidate cannot produce a payable PE allocation; no fallback to RP.
    } else errors.push('EXPLICIT_PAYMENT_MODE_REQUIRED');
    return {schema: 'INDUSTRY-INTEGRATE-005.read-only.1', queryOnly: true, executable: false,
      service: resolved, commonEligibility: common,
      payment: {mode, requirements, conditionsSatisfied: errors.length === 0,
        errors: [...new Set(errors)], plan: allocation, reservesNothing: true, automaticFallback: false},
      planAvailable: allocation !== null,
      runtimeGate: {allowed: false, decision: gate.runtimeDecision, blockers: gate.blockers,
        scope: 'Candidate integration; a valid RP quote does not approve this interface for runtime execution.'},
    };
  });
}

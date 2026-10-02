"""Read-only review validator. No game imports, simulation, network or writes.
Default: valid review document exits 0 even when runtime is explicitly blocked.
--runtime-gate: exits 2 for unresolved/unauthorized runtime configuration.
--self-test: only exercises this candidate's offline rejection/planning seams.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
PREDICATES = (
    'controllerExists', 'activeSide', 'permanentController', 'correctRecoveryPhase',
    'alive', 'damaged', 'templateExists', 'normalSupplied', 'notMoved', 'notAttacked',
    'notArtillerySupportUsed', 'notDedicatedRailRepair', 'noAdjacentLivingEnemy',
    'withinCoreRecoveryBaseDistance', 'notRecoveredThisTurn', 'sideRecoveryLimitAvailable',
    'noPendingDecision',
)


class Rejected(ValueError):
    pass


def need(value, reason):
    if not value:
        raise Rejected(reason)


def integer(value, positive=False):
    return type(value) is int and value >= (1 if positive else 0)


def read(name):
    return json.loads((ROOT / name).read_bytes())


def inspect(config, facts, map_data, profile):
    errors, blockers = [], []
    def require(value, code):
        if not value:
            errors.append(code)
    def unresolved(value, code):
        if value is None:
            blockers.append(code)
    require(config['runtimeEnabled'] is False, 'REVIEW_ARTIFACT_MUST_NOT_ENABLE_RUNTIME')
    blockers.append('RUNTIME_NOT_APPROVED')
    unresolved(config['runtimeApprovalRef'], 'MISSING_RUNTIME_DECISION')
    require(config['sources'] == facts['fixed_transport']['profile']['sources'], 'SOURCE_SET_OR_CAP_CHANGED')
    require(config['transport']['originalProfile'] == facts['fixed_transport']['profile'], 'TRANSPORT_PROFILE_CHANGED')
    require(config['industrialScalarInput']['sourceSP'] == profile['nominalSourceSP'] == 22,
            'SCALAR_INPUT_CHANGED')
    require(config['industrialScalarInput']['binding'] == 'REFERENCE_ONLY_NOT_ADDITIVE_NOT_POOL_ALIAS'
            and config['budget']['scalar22Additive'] is False, 'SCALAR22_CANNOT_BE_ADDED_OR_RELABELED')
    require(config['mapSha256'] == facts['map']['map_sha256'], 'MAP_VERSION_MISMATCH')
    require(config['transport']['maxTotalSeconds'] == 3, 'TIMEOUT_CHANGED')
    for k, v in [('boundaries', 'assemblyBoundaries'), ('queueCap', 'assemblyQueueCap'),
                 ('undeployedCap', 'undeployedOrderCap'), ('entryPerTurnCap', 'entryCapPerTurn')]:
        require(config['assembly'][k] == profile[v], 'OFFLINE_PROFILE_VALUE_CHANGED:' + k)
    nodes = {n['nodeId']: n for n in map_data['nodes']}
    require(len(nodes) == len(map_data['nodes']) == 640, 'MAP_NODE_SET_INVALID')
    sources = {s['id']: s for s in config['sources']}
    hubs = {h['id']: h for h in facts['fixed_transport']['hubs']}
    depots = {d['id']: d for d in config['depots']}
    registry_ids = [x['id'] for kind in ('depots', 'receivers', 'entries') for x in config[kind]]
    require(len(set(registry_ids)) == len(registry_ids), 'DUPLICATE_REGISTRY_ID')
    for kind in ('depots', 'receivers', 'entries'):
        for obj in config[kind]:
            node = obj.get('node', obj.get('anchorNode'))
            require(node in nodes, 'UNKNOWN_MAP_NODE:' + obj['id'])
            require(node not in config['visualOnlyNodes'], 'VISUAL_RESERVE_HAS_NO_FUNCTION:' + obj['id'])
            require(obj['side'] in ('G', 'S'), 'SIDE_INVALID:' + obj['id'])
            unresolved(obj['grantRef'], 'MISSING_SERVICE_GRANT:' + obj['id'])
    for d in config['depots']:
        s = sources.get(d['sourceId'])
        require(s is not None and s['side'] == d['side'] and s['node'] == d['anchorNode'],
                'SOURCE_DEPOT_BINDING_INVALID:' + d['id'])
        for k in ('storageCapacityE2', 'personnelCapacityP', 'stockOriginManifest'):
            unresolved(d[k], 'DEPOT_UNRESOLVED:' + d['id'] + ':' + k)
        require(all(d[k] is None or integer(d[k], True) for k in ('storageCapacityE2', 'personnelCapacityP')),
                'DEPOT_CAPACITY_INVALID')
        require(d['productionCapability'] is None, 'DEPOT_IS_NOT_APPROVED_FACTORY')
    for r in config['receivers']:
        h, d = hubs.get(r['hubRef']), depots.get(r['sourceDepotId'])
        require(h is not None and h['side'] == r['side'] and h['node'] == r['node'],
                'RECEIVER_HUB_NODE_MISMATCH:' + r['id'])
        require(d is not None and d['side'] == r['side'], 'RECEIVER_DEPOT_SIDE_MISMATCH')
        witness = r['routeWitness']
        rows = facts['topology'][witness['checkpoint']]['model_graph'][r['side']]['source_to_hub']
        matches = [x for x in rows if x['source'] == witness['sourceId'] and x['hub'] == r['hubRef']]
        require(bool(matches) and matches[0]['edges'] == witness['edges'], 'ROUTE_REFERENCE_MISMATCH')
        require(d is not None and witness['sourceId'] == d['sourceId'], 'ROUTE_SOURCE_MISMATCH')
        for k in ('storageCapacityE2', 'personnelCapacityP', 'transferPermissionRef', 'captureDisposition'):
            unresolved(r[k], 'RECEIVER_UNRESOLVED:' + r['id'] + ':' + k)
        require(all(r[k] is None or integer(r[k], True) for k in ('storageCapacityE2', 'personnelCapacityP')),
                'RECEIVER_CAPACITY_INVALID')
        require(r['industrialOutput'] is None, 'RECEIVER_IS_NOT_APPROVED_FACTORY')
    for entry in config['entries']:
        d = depots.get(entry['assemblyDepotId'])
        require(d is not None and d['side'] == entry['side'] and d['anchorNode'] == entry['node'],
                'ENTRY_DEPOT_BINDING_INVALID')
        phase = 'GERMAN_SUPPLY_RAIL' if entry['side'] == 'G' else 'SOVIET_REINFORCEMENT_SUPPLY'
        require(entry['phase'] == phase, 'ENTRY_PHASE_CHANGED')
        query = ('computeActiveGermanRailNetwork.entryHexKeys' if entry['side'] == 'G'
                 else 'computeActiveSovietRailNetwork.exitHexKeys')
        require(entry['activeBoundaryQuery'] == query and 'activeBoundaryRailEntry' in entry['requiredPredicates'],
                'ACTIVE_BOUNDARY_ENTRY_CHECK_MISSING')
        allowed = ('A5', 'A10', 'A16') if entry['side'] == 'G' else ('AF4', 'AF10', 'AF16')
        require(entry['node'] in allowed, 'ENTRY_NOT_BOUNDARY_CANDIDATE')
        require(entry['usesScenarioReinforcementSlots'] is False and entry['namespace'] == 'INDUSTRIAL_ORDER_ONLY',
                'SCENARIO_SLOT_CANNOT_BECOME_INDUSTRIAL')
        require(entry['stockOnEntry_q'] == entry['debtOnEntry'] == 0, 'FREE_ENTRY_STOCK_OR_DEBT_CHANGE')
        unresolved(entry['initializationApprovalRef'], 'ENTRY_INITIALIZATION_UNAPPROVED:' + entry['id'])
    for group, fields in {
        'authorization': ['approvedNullControlPolicy', 'nullControlApprovalRef'],
        'assembly': ['recipeCatalogApprovalRef'],
        'recovery': ['recipeApprovalRef', 'integrationHookApprovalRef'],
        'budget': ['policyApprovalRef'],
        'transport': ['approvedEquipmentVectorRule', 'approvedPersonnelTransportRule', 'vectorRuleApprovalRef',
                      'productionToDepotTransferApprovalRef', 'initialMaterialManifest'],
    }.items():
        for field in fields:
            unresolved(config[group][field], 'UNRESOLVED:' + group + '.' + field)
    require(config['recovery']['automaticFallback'] is False and config['recovery']['oneModePerAction'] is True
            and config['recovery']['sharedRecoveryCounter'] is True, 'PAYMENT_RESPONSIBILITY_AMBIGUOUS')
    require(config['recovery']['recipes'] == {'G-INF': {'P': 1, 'E2:L': 2}, 'S-INF': {'P': 1, 'E2:L': 2}},
            'CONDITIONAL_INFANTRY_RECIPE_CHANGED')
    require(config['budget']['sourceSelection'] == 'ORDER_BOUND_SOURCE_ONLY'
            and config['budget']['rearRate'] == 'TEMPLATE_B'
            and config['budget']['paymentOrder'] == ['OLD_ARREARS', 'CURRENT_REAR_B', 'FRONT_FROM_RESIDUAL_SOURCE'],
            'CANDIDATE_REAR_POLICY_CHANGED')
    require(all(v is None for v in config['score'].values()), 'UNAPPROVED_SCORING_OR_INDUSTRY')
    nominal = {s: sum(x['cap'] for x in config['sources'] if x['side'] == s) for s in ('G', 'S')}
    baseline = {s: {'maintenance_q': sum(x['B'] for x in facts['army'][s]['units']),
                    'source_q': nominal[s]} for s in ('G', 'S')}
    for s in baseline:
        baseline[s]['gap_q'] = baseline[s]['maintenance_q'] - baseline[s]['source_q']
    require(baseline['G']['gap_q'] == 36 and baseline['S']['gap_q'] == 56, 'BASELINE_DEFICIT_ERASED')
    return {'errors': errors, 'blockers': blockers, 'baseline': baseline,
            'runtimeDecision': 'REJECT', 'reviewStatus': 'VALID_CANDIDATE_WITH_BLOCKERS' if not errors else 'INVALID'}


def authorize(config, obj, context):
    need(obj['grantRef'] is not None, 'SERVICE_GRANT_UNRESOLVED')
    grant = context.get('serviceGrant')
    need(grant and grant.get('ref') == obj['grantRef'] and grant.get('objectId') == obj['id']
         and grant.get('side') == obj['side'] and grant.get('revision') == context.get('revision')
         and 'PE_RECOVERY' in grant.get('operations', []),
         'SERVICE_GRANT_SCOPE_OR_REVISION_INVALID')
    need(context.get('enemyOccupied') is False and context.get('enemyZoc') is False, 'HOSTILE_OR_UNKNOWN_ACCESS')
    control = context.get('control')
    if control is None:
        need(config['authorization']['approvedNullControlPolicy'] == 'REQUIRE_EXPLICIT_SCENARIO_SERVICE_GRANT'
             and config['authorization']['nullControlApprovalRef'], 'NULL_CONTROL_NOT_AUTHORIZED')
    else:
        need(control == obj['side'], 'HOSTILE_OR_NEUTRAL_CONTROL')


def repair_plan(config, request, context):
    """Checks GIVEN Core predicate receipts; never runs or substitutes Core validation."""
    need(set(request) <= {'actionId', 'unitId', 'paymentMode', 'receiverId', 'expectedRevision', 'snapshotHash'},
         'UNKNOWN_OR_MIXED_PAYMENT_FIELDS')
    need(isinstance(request.get('actionId'), str) and request['actionId']
         and request.get('unitId') == context.get('unitId') and isinstance(request.get('unitId'), str),
         'RECOVERY_ACTION_IDENTITY_MISSING')
    for key in PREDICATES:
        need(context.get('corePredicates', {}).get(key) is True, 'CORE_PREDICATE_FALSE_OR_UNKNOWN:' + key)
    need(integer(request.get('expectedRevision')) and isinstance(request.get('snapshotHash'), str)
         and request['snapshotHash'] and context.get('revision') == request.get('expectedRevision')
         and context.get('snapshotHash') == request.get('snapshotHash'), 'STALE_RECOVERY_CONTEXT')
    mode = request.get('paymentMode')
    need(mode in ('RP', 'PE'), 'EXPLICIT_PAYMENT_MODE_REQUIRED')
    if mode == 'RP':
        cost = context.get('templateRPCost')
        need(integer(cost, True) and context.get('RP', -1) >= cost, 'INSUFFICIENT_RP')
        return {'conditionalPlanOnly': True, 'rpDelta': -cost, 'materialDebits': [], 'stepDelta': -1}
    need(config['recovery']['recipeApprovalRef'] and config['recovery']['integrationHookApprovalRef'],
         'PE_RECIPE_OR_HOOK_UNAPPROVED')
    recipe = config['recovery']['recipes'].get(context.get('templateId'))
    need(recipe is not None, 'PE_TEMPLATE_UNRESOLVED')
    receiver = next((r for r in config['receivers'] if r['id'] == request.get('receiverId')), None)
    need(receiver is not None and receiver['side'] == context.get('side'), 'RECEIVER_UNKNOWN_OR_WRONG_SIDE')
    need(receiver['node'] == context.get('unitNode'), 'MATERIAL_SERVICE_REQUIRES_SAME_HEX')
    need(receiver['transferPermissionRef'] and receiver['storageCapacityE2'] is not None
         and receiver['personnelCapacityP'] is not None, 'RECEIVING_SERVICE_UNRESOLVED')
    authorize(config, receiver, context)
    lots = context.get('lots', [])
    need(len({l['lotId'] for l in lots}) == len(lots), 'DUPLICATE_MATERIAL_LOT')
    debits = []
    for material, cost in recipe.items():
        need(integer(cost, True), 'INVALID_RECIPE_COST')
        remaining = cost
        for lot in sorted(lots, key=lambda l: l['lotId']):
            if lot['material'] != material:
                continue
            need(lot.get('receiptId') and lot.get('provenanceApproved') is True, 'MATERIAL_PROVENANCE_MISSING')
            need(lot.get('side') == context['side'] and lot.get('receiverId') == receiver['id'], 'MATERIAL_CUSTODY_MISMATCH')
            need(lot.get('status') == 'RECEIVED' and integer(lot.get('receivedEpoch'))
                 and lot.get('availableFromTurn') == lot['receivedEpoch'] + 1, 'MATERIAL_AVAILABILITY_INVALID')
            need(lot['availableFromTurn'] <= context['turn'], 'MATERIAL_NOT_YET_AVAILABLE')
            need(integer(lot.get('quantity')) and integer(lot.get('reserved'))
                 and lot['quantity'] >= lot['reserved'], 'INVALID_OR_DOUBLE_RESERVED_MATERIAL')
            pay = min(remaining, lot['quantity'] - lot['reserved'])
            if pay:
                debits.append({'lotId': lot['lotId'], 'material': material, 'quantity': pay})
            remaining -= pay
        need(remaining == 0, 'INSUFFICIENT_MATERIAL:' + material)
    return {'conditionalPlanOnly': True, 'rpDelta': 0, 'materialDebits': debits, 'stepDelta': -1}


def rear_plan(config, effective_caps, orders, epoch, front_ids):
    """One conditional boundary only; no deliveries, RNG, attrition or campaign sim."""
    sources = {s['id']: s for s in config['sources']}
    need(integer(epoch, True) and epoch <= 24, 'EPOCH_INVALID')
    need(len({o['orderId'] for o in orders}) == len(orders), 'DUPLICATE_ORDER_ID')
    need(set(effective_caps) == set(sources), 'EFFECTIVE_SOURCE_SNAPSHOT_INCOMPLETE')
    need(all(integer(v) and v <= sources[k]['cap'] for k, v in effective_caps.items()), 'SOURCE_CAP_INCREASED')
    residual, rows, owners = dict(effective_caps), [], {(u, epoch) for u in front_ids}
    for o in sorted(orders, key=lambda x: (x['acceptedTurn'], x['orderId'])):
        need(integer(o['acceptedTurn'], True) and o['acceptedTurn'] <= epoch, 'ORDER_NOT_YET_ACCEPTED')
        key = (o['plannedUnitId'], epoch)
        need(key not in owners, 'DUPLICATE_MAINTENANCE_OWNER')
        owners.add(key)
        need(o['status'] in ('ASSEMBLING', 'WAITING_ENTRY'), 'NOT_A_REAR_ORDER')
        source = sources.get(o['sourceId'])
        need(source and source['side'] == o['side'], 'REAR_SOURCE_UNBOUND_OR_WRONG_SIDE')
        need(integer(o['B_q'], True) and integer(o['arrears_q']), 'REAR_AMOUNT_INVALID')
        paid = min(residual[o['sourceId']], o['B_q'] + o['arrears_q'])
        old = min(paid, o['arrears_q'])
        residual[o['sourceId']] -= paid
        rows.append({'orderId': o['orderId'], 'sourceId': o['sourceId'], 'paidArrears_q': old,
                     'paidCurrent_q': paid - old, 'arrearsAfter_q': o['arrears_q'] + o['B_q'] - paid})
    return {'conditionalBudgetOnly': True, 'rearRows': rows, 'frontSourceCaps_q': residual,
            'frontSourceTotal_q': {s: sum(v for k, v in residual.items() if sources[k]['side'] == s) for s in ('G', 'S')}}


def self_test(config, facts, nodes, profile):
    results = []
    def check(name, ok):
        need(ok, 'SELF_TEST_FAILED:' + name)
        results.append({'name': name, 'result': 'PASS'})
    def reject(name, operation):
        try:
            operation()
        except (Rejected, KeyError) as e:
            results.append({'name': name, 'result': 'EXPECTED_REJECTION', 'reason': str(e)})
        else:
            raise Rejected('negative control passed: ' + name)
    for name, mutate in (
        ('add source capacity', lambda c: c['sources'][0].__setitem__('cap', 33)),
        ('add industrial scalar22', lambda c: c['budget'].__setitem__('scalar22Additive', True)),
        ('use visual reserve as receiver', lambda c: c['receivers'][0].__setitem__('node', 'J7')),
        ('infer industrial yield', lambda c: c['receivers'][0].__setitem__('industrialOutput', 1)),
        ('steal Soviet scenario slots', lambda c: c['entries'][1].__setitem__('usesScenarioReinforcementSlots', True)),
    ):
        c = copy.deepcopy(config)
        mutate(c)
        check(name, bool(inspect(c, facts, nodes, profile)['errors']))
    caps = {s['id']: s['cap'] for s in config['sources']}
    order = {'orderId': 'TEST-O1', 'plannedUnitId': 'TEST-U1', 'acceptedTurn': 2, 'side': 'G',
             'sourceId': 'G-A10', 'status': 'WAITING_ENTRY', 'B_q': 4, 'arrears_q': 4}
    budget = rear_plan(config, caps, [order], 3, [])
    check('8q rear debit stays in G-A10; global baseline not increased',
          budget['frontSourceCaps_q']['G-A10'] == 24 and budget['frontSourceTotal_q'] == {'G': 88, 'S': 96})
    zero = dict(caps, **{'G-A10': 0})
    outage = rear_plan(config, zero, [order], 3, [])
    check('unavailable bound source cannot borrow other sources', outage['rearRows'][0]['arrearsAfter_q'] == 8
          and outage['frontSourceCaps_q']['G-A5'] == 32)
    reject('double rear/front Owner', lambda: rear_plan(config, caps, [order], 3, ['TEST-U1']))
    bad = dict(order, sourceId='SOURCE-003')
    reject('abstract source cannot pay map orders', lambda: rear_plan(config, caps, [bad], 3, []))
    # Test-only hypothetical approvals and receipts. Never persist these into candidate.json.
    c = copy.deepcopy(config)
    for key in ('recipeApprovalRef', 'integrationHookApprovalRef'):
        c['recovery'][key] = 'SYNTHETIC_OFFLINE_ONLY'
    r = c['receivers'][0]
    r.update(grantRef='SYNTHETIC_OFFLINE_ONLY', transferPermissionRef='SYNTHETIC_OFFLINE_ONLY',
             storageCapacityE2=2, personnelCapacityP=1)
    request = {'actionId': 'TEST-A1', 'unitId': 'TEST-G-INF', 'paymentMode': 'PE', 'receiverId': r['id'],
               'expectedRevision': 7, 'snapshotHash': 'TEST-HASH'}
    ctx = {'revision': 7, 'snapshotHash': 'TEST-HASH', 'corePredicates': {p: True for p in PREDICATES},
           'unitId': 'TEST-G-INF', 'side': 'G', 'turn': 5, 'unitNode': 'C10', 'templateId': 'G-INF', 'control': 'G',
           'enemyOccupied': False, 'enemyZoc': False, 'RP': 8, 'templateRPCost': 1,
           'serviceGrant': {'ref': r['grantRef'], 'objectId': r['id'], 'side': 'G', 'revision': 7,
                            'operations': ['PE_RECOVERY']},
           'lots': [{'lotId': 'P1', 'material': 'P', 'quantity': 1, 'reserved': 0},
                    {'lotId': 'E1', 'material': 'E2:L', 'quantity': 2, 'reserved': 0}]}
    for lot in ctx['lots']:
        lot.update(receiptId='SYNTHETIC_RECEIPT', provenanceApproved=True, side='G', receiverId=r['id'],
                   status='RECEIVED', receivedEpoch=4, availableFromTurn=5)
    original = copy.deepcopy(ctx)
    planned = repair_plan(c, request, ctx)
    check('PE plan pays 1P/2E2, zero RP; input remains unchanged',
          planned['rpDelta'] == 0 and [d['quantity'] for d in planned['materialDebits']] == [1, 2] and ctx == original)
    rp = repair_plan(config, dict(request, paymentMode='RP'), ctx)
    check('RP plan keeps all material untouched', rp['rpDelta'] == -1 and rp['materialDebits'] == [])
    reject('actual candidate has no PE approval', lambda: repair_plan(config, request, ctx))
    reject('mixed payment fields refused', lambda: repair_plan(c, dict(request, alsoDebitRP=1), ctx))
    for predicate in PREDICATES:
        x = copy.deepcopy(ctx)
        x['corePredicates'][predicate] = None
        reject('unknown Core check: ' + predicate, lambda x=x: repair_plan(c, request, x))
    for name, mutation in (
        ('future E24 delivery cannot fund T24', lambda x: (x.__setitem__('turn', 24), x['lots'][0].update(receivedEpoch=24, availableFromTurn=25))),
        ('source receipt missing', lambda x: x['lots'][0].__setitem__('receiptId', None)),
        ('material already reserved', lambda x: x['lots'][0].__setitem__('reserved', 1)),
        ('no free service across adjacent hex', lambda x: x.__setitem__('unitNode', 'B10')),
        ('null map control is not friendly', lambda x: x.__setitem__('control', None)),
        ('wrong-side warehouse stock', lambda x: x['lots'][0].__setitem__('side', 'S')),
        ('duplicate lot must not double-count', lambda x: x['lots'].append(copy.deepcopy(x['lots'][0]))),
        ('no PE fallback even when RP is rich', lambda x: x.__setitem__('lots', [])),
        ('grant cannot authorize another operation', lambda x: x['serviceGrant'].__setitem__('operations', ['INDUSTRIAL_ENTRY'])),
    ):
        x = copy.deepcopy(ctx)
        mutation(x)
        reject(name, lambda x=x: repair_plan(c, request, x))
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', type=Path, default=ROOT / 'candidate.json')
    parser.add_argument('--runtime-gate', action='store_true')
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    manifest = read('SOURCES.json')
    for row in manifest['inputs'] + manifest['derivedInputs']:
        need(hashlib.sha256((ROOT / row['file']).read_bytes()).hexdigest() == row['sha256'], 'FIXED_INPUT_CHANGED:' + row['file'])
    config = json.loads(args.config.read_bytes())
    need(config['refs'] == manifest['refs'], 'FIXED_COMMIT_REFS_CHANGED')
    facts, nodes, profile = read('inputs/FACTS.json'), read('inputs/MAP_NODES.json'), read('inputs/INDUSTRY_PROFILE.json')
    result = inspect(config, facts, nodes, profile)
    result.update(configSha256=hashlib.sha256(args.config.read_bytes()).hexdigest(),
                  validatorSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                  offlineChecks=self_test(config, facts, nodes, profile) if args.self_test and not result['errors'] else [],
                  notProven=['runtime authorization', 'Core eligibility execution', 'equipment routes/capacity',
                             'transaction idempotency', 'campaign balance', 'industrial order/deployment implementation'])
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if result['errors'] else 2 if args.runtime_gate else 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (Rejected, KeyError, TypeError, ValueError) as error:
        print(json.dumps({'reviewStatus': 'REJECT', 'error': str(error)}, ensure_ascii=False))
        sys.exit(1)

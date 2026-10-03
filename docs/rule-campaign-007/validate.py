"""Read-only candidate and SYNTHETIC ledger auditor. No Core imports or execution API."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]


class Rejected(ValueError):
    pass


def need(ok, reason):
    if not ok:
        raise Rejected(reason)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def positive(x):
    return type(x) is int and x > 0


def get(x, path):
    for key in path.split('.'):
        x = x[key]
    return x


def candidate_check(c, sources):
    need(c['refs'] == sources['refs'], 'REFS_CHANGED')
    need(c['runtimeEnabled'] is False and c['approval']['decisionRef'] is None,
         'NOT_REVIEW_ONLY')
    need(c['scope']['side'] == 'G' and c['scope']['materialType'] == 'E2:L'
         and c['scope']['maxOrders'] == c['scope']['maxBatches'] == 1, 'SCOPE')
    need(c['scope']['requestedOutputE2'] == c['production']['outputE2'] == 2,
         'OUTPUT_SCOPE')
    need(c['warehouse']['nodeId'] == 'A10' and c['warehouse']['coreKey'] == '0,9', 'MAP_BINDING')
    need(c['warehouse']['initialEquipmentE2'] == c['warehouse']['initialP'] == 0
         and c['warehouse']['oldGiftLotsAllowed'] is False, 'INITIAL_GIFT')
    need(c['production']['personnelOutputAllowed'] is False
         and c['custody']['PSource']['inScope'] is False, 'P_NOT_EQUIPMENT')
    for path in ('budget.initialAmountI', 'budget.productionCostI', 'budget.handoffFeeI',
                 'production.workBoundaries', 'handoff.latencyEpochs'):
        need(get(c, path) is None, 'UNREVIEWED_NUMERIC_VALUE:' + path)
    need(c['handoff']['capacityVector'] is None
         and c['handoff']['resourceSharingWithSP'] is None, 'UNREVIEWED_CAPACITY')
    need(c['warehouse']['capacityE2'] == c['production']['offmapBufferCapacityE2'] == 2,
         'PROPOSED_STORAGE_CHANGED')
    need(c['preserved'] == dict(globalBlockerCount=35, globalBlockersClosed=0,
         GermanSourceGapSP=9, SovietSourceGapSP=14, extra22SP=False,
         changesCoreMapControlHomeSideVP=False, **{'011KitFirstApprovalInherited': False}),
         'PRESERVED_BASELINES_CHANGED')
    need(c['atomicity']['deadlineSeconds'] == 3, 'DEADLINE_CHANGED')
    blobs = {}
    for s in sources['inputs']:
        need(s['commit'] == c['refs'][s['ref']], 'SOURCE_REF_MISMATCH')
        raw = subprocess.check_output(['git', 'show', s['commit'] + ':' + s['path']], cwd=ROOT)
        need(digest(raw) == s['sha256'], 'SOURCE_HASH:' + s['path'])
        blobs[s['path']] = raw
    original = json.loads(blobs['docs/rule-campaign-003/VALIDATION.json'])['blockers']
    need([b['blocker'] for b in c['blockerReview']] == original and len(original) == 35,
         'GLOBAL_BLOCKERS_CHANGED')
    need(all(b['globalResolved'] is False for b in c['blockerReview']), 'FALSE_CLOSURE')
    nodes = json.loads(blobs['docs/rule-campaign-003/inputs/MAP_NODES.json'])['nodes']
    a10 = [n for n in nodes if n['nodeId'] == 'A10']
    need(len(a10) == 1 and a10[0]['key'] == c['warehouse']['coreKey']
         and a10[0]['control'] is c['warehouse']['observedControl'] is None, 'MAP_SOURCE_MISMATCH')
    return len(blobs)


def audit(f):
    """Recompute balances from a supplied, purely hypothetical event trace."""
    need(f['kind'] == 'SYNTHETIC_ARITHMETIC_ONLY', 'NOT_A_RUNTIME_WITNESS')
    q = f['quote']
    for name in ('costI', 'feeI', 'duration', 'latency', 'yieldE2', 'workPerE2', 'workCap'):
        need(positive(q[name]), 'UNKNOWN_OR_FREE:' + name)
    need(q['authority'] == 'SYNTHETIC_ONLY', 'MISSING_AUTHORITY')
    need(q['side'] == 'G' and q['hex'] == 'A10' and q['key'] == '0,9', 'WRONG_SERVICE')
    need(q['nullPolicyApproved'] and not q['enemyOccupied'], 'NULL_OR_HOSTILE_CONTROL')
    need(q['yieldE2'] == 2 and q['POutput'] == 0, 'NOT_EQUIPMENT_ONLY')
    s = copy.deepcopy(f['before'])
    need(s['store'] == s['transit'] == s['rear'] == s['produced'] == s['P'] == 0, 'OLD_GIFT')
    need(s['escrow'] == s['productionSpent'] == s['handoffSpent'] == s['workUsed'] == 0,
         'DIRTY_START')
    initial = s['freeI']
    need(initial >= q['costI'] + q['feeI'], 'BUDGET_SHORT')
    receipts = {}
    accepted = False
    progress = set()
    dispatched = received = None
    last = (0, 0)
    snapshots = []
    for e in f['events']:
        raw = json.dumps(e, sort_keys=True)
        if e['id'] in receipts:
            need(raw == receipts[e['id']], 'ID_PAYLOAD_CONFLICT')
            snapshots.append(dict(event=e['id'], replay=True, after=copy.deepcopy(s)))
            continue
        need((e['turn'], e['stage']) >= last, 'EVENT_ORDER')
        need(1 <= e['turn'] <= 24, 'NO_T25')
        last = (e['turn'], e['stage'])
        t, k = e['turn'], e['kind']
        before = copy.deepcopy(s)
        if k == 'ACCEPT':
            need(not accepted, 'SECOND_ORDER')
            need(e['stage'] == 0 and e['phase'] == 'GERMAN_RECOVERY', 'ORDER_PHASE')
            need(q['bufferCap'] >= q['yieldE2'], 'PRODUCTION_STORAGE')
            accepted = t
            s['freeI'] -= q['costI'] + q['feeI']
            s['productionSpent'] += q['costI']
            s['escrow'] += q['feeI']
        elif k == 'PROGRESS':
            need(accepted and e['stage'] == 11 and t >= accepted, 'PROGRESS_PHASE')
            need(t not in progress, 'DOUBLE_PROGRESS')
            need(len(progress) < q['duration'] and s['produced'] == 0, 'PRODUCTION_ALREADY_COMPLETE')
            progress.add(t)
        elif k == 'OUTPUT':
            need(e['stage'] == 12 and t in progress and len(progress) >= q['duration'],
                 'EARLY_OUTPUT')
            need(s['produced'] == 0, 'DOUBLE_OUTPUT')
            s['store'] += q['yieldE2']
            s['produced'] += q['yieldE2']
        elif k == 'DISPATCH':
            need(e['stage'] == 14 and s['store'] == q['yieldE2'] and dispatched is None,
                 'DISPATCH_CUSTODY')
            need(s['workUsed'] + q['otherWork'] + q['yieldE2'] * q['workPerE2'] <= q['workCap'],
                 'HANDOFF_CAPACITY')
            need(s['rear'] + s['incomingHold'] + q['otherIncoming'] + q['yieldE2'] <= q['rearCap'],
                 'WAREHOUSE_CAPACITY')
            dispatched = t
            s['store'] -= q['yieldE2']
            s['transit'] += q['yieldE2']
            s['incomingHold'] += q['yieldE2']
            s['workUsed'] += q['yieldE2'] * q['workPerE2']
            s['escrow'] -= q['feeI']
            s['handoffSpent'] += q['feeI']
        elif k in ('RECEIVE', 'HOLD'):
            need(dispatched is not None and received is None and s['transit'] == q['yieldE2'],
                 'RECEIPT_CUSTODY')
            need(t >= dispatched + q['latency'] - 1, 'EARLY_ARRIVAL')
            need(e['stage'] == (15 if t == dispatched else 13), 'RECEIPT_STAGE')
            if k == 'RECEIVE':
                need(e['serviceEligible'], 'RECEIVER_INELIGIBLE')
                received = t
                s['transit'] -= q['yieldE2']
                s['incomingHold'] -= q['yieldE2']
                s['rear'] += q['yieldE2']
                s['availableFromTurn'] = s['shipEligibleEpoch'] = t + 1
                s['terminal'] = t == 24
            else:
                need(not e['serviceEligible'], 'FALSE_HOLD')
        elif k in ('CHECK_AVAILABLE', 'CHECK_FORWARD'):
            need(received is not None and t >= received + 1 and not s['terminal'], 'EARLY_REUSE')
        elif k == 'FAILED_TRANSACTION':
            # Audit a claimed rollback record, NOT a transaction/exception implementation.
            need(e['beforeHash'] == e['afterHash'] == digest(json.dumps(s, sort_keys=True).encode()),
                 'PARTIAL_ROLLBACK')
        else:
            raise Rejected('UNSUPPORTED_EVENT:' + k)
        need(initial == s['freeI'] + s['escrow'] + s['productionSpent'] + s['handoffSpent'],
             'I_CONSERVATION')
        need(s['produced'] == s['store'] + s['transit'] + s['rear'], 'E2_CONSERVATION')
        need(all(v >= 0 for v in s.values() if type(v) is int), 'NEGATIVE_ACCOUNT')
        receipts[e['id']] = raw
        delta = {key: s[key] - before[key] for key in s if type(s[key]) is int and type(before[key]) is int}
        snapshots.append(dict(event=e['id'], replay=False, before=before, delta=delta, after=copy.deepcopy(s)))
    return dict(after=s, events=snapshots)


def changed(f, changes):
    f = copy.deepcopy(f)
    for path, value in changes:
        obj = f
        parts = path.split('.')
        for part in parts[:-1]:
            obj = obj[int(part)] if isinstance(obj, list) else obj[part]
        key = int(parts[-1]) if isinstance(obj, list) else parts[-1]
        obj[key] = value
    return f


def self_test(fixtures):
    out = []
    base = fixtures['base']
    for case in fixtures['cases']:
        f = changed(base, case.get('changes', []))
        if 'append' in case:
            f['events'].extend(copy.deepcopy(case['append']))
        if 'duplicateIndex' in case:
            i = case['duplicateIndex']
            f['events'].insert(i + 1, copy.deepcopy(f['events'][i]))
        try:
            result = audit(f)
            need(case['expected'] == 'PASS', 'EXPECTED_REJECTION:' + case['expected'])
            if 'expectedAfter' in case:
                need(all(result['after'][k] == v for k, v in case['expectedAfter'].items()),
                     'WRONG_RECALCULATED_AFTER')
            out.append(dict(id=case['id'], outcome='PASS', recomputed=result))
        except Rejected as e:
            need(str(e) == case['expected'], 'WRONG_REJECTION:' + case['id'] + ':' + str(e))
            out.append(dict(id=case['id'], outcome='PASS', rejection=str(e)))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--self-test', action='store_true')
    ap.add_argument('--runtime-gate', action='store_true')
    args = ap.parse_args()
    try:
        c = json.loads((HERE / 'candidate.json').read_bytes())
        sources = json.loads((HERE / 'SOURCES.json').read_bytes())
        n = candidate_check(c, sources)
        results = self_test(json.loads((HERE / 'fixtures.json').read_bytes())) if args.self_test else []
        candidate_negatives = []
        if args.self_test:
            for path, value, expected in (
                ('budget.productionCostI', 0, 'UNREVIEWED_NUMERIC_VALUE:budget.productionCostI'),
                ('budget.handoffFeeI', 0, 'UNREVIEWED_NUMERIC_VALUE:budget.handoffFeeI'),
                ('production.workBoundaries', 1, 'UNREVIEWED_NUMERIC_VALUE:production.workBoundaries'),
                ('warehouse.coreKey', '0,10', 'MAP_BINDING'),
                ('production.personnelOutputAllowed', True, 'P_NOT_EQUIPMENT'),
                ('runtimeEnabled', True, 'NOT_REVIEW_ONLY'),
            ):
                try:
                    candidate_check(changed(c, [(path, value)]), sources)
                    raise Rejected('MUTATED_CANDIDATE_ACCEPTED:' + path)
                except Rejected as e:
                    need(str(e) == expected, 'CANDIDATE_TEST:' + str(e))
                    candidate_negatives.append(dict(field=path, value=value, rejection=str(e), outcome='PASS'))
        report = dict(status='VALID_CANDIDATE_ONLY', runtimeDecision='REJECT',
            sourcesVerified=n, globalBlockersRetained=[b['blocker'] for b in c['blockerReview']],
            globalBlockersClosed=0, localBlockers=sum(b['field'] is not None for b in c['blockerReview']),
            unresolved=c['newUnresolved'], checks=results, candidateNegativeChecks=candidate_negatives,
            fileHashes={f: digest((HERE / f).read_bytes()) for f in
                        ('candidate.json', 'SOURCES.json', 'fixtures.json', 'validate.py', 'DIFF.md')},
            notProven=c['notProven'])
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 2 if args.runtime_gate else 0
    except (Rejected, KeyError, TypeError, ValueError, OSError, subprocess.CalledProcessError) as e:
        print(json.dumps(dict(status='INVALID', error=str(e)), ensure_ascii=False))
        return 1


if __name__ == '__main__':
    sys.exit(main())

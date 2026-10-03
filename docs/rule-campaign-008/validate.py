"""Read-only RC008 contract/fixture auditor; no Core or transport execution."""
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


def need(ok, why):
    if not ok:
        raise Rejected(why)


def sha(x):
    return hashlib.sha256(x).hexdigest()


def state_hash(s):
    return sha(json.dumps(s, sort_keys=True).encode())


def changed(obj, edits):
    obj = copy.deepcopy(obj)
    for path, value in edits:
        parts = path.split('.')
        node = obj
        for k in parts[:-1]:
            node = node[int(k)] if isinstance(node, list) else node[k]
        node[int(parts[-1]) if isinstance(node, list) else parts[-1]] = value
    return obj


def sources_and_candidate(c, source):
    need(c['refs'] == source['refs'], 'REFS')
    need(c['runtimeEnabled'] is False and c['approval']['decisionRef'] is None, 'NOT_CANDIDATE_ONLY')
    for group, key in (('pool', 'sourceGrantRef'), ('budget', 'grantRef'),
                       ('budget', 'separateRegistryBindingRef'), ('warehouse', 'serviceGrantRef'),
                       ('transport', 'serviceApprovalRef'), ('transport', 'physicalResourceSeparationApprovalRef'),
                       ('scope', 'startTurn'), ('scope', 'startSnapshotHash')):
        need(c[group][key] is None, 'UNAPPROVED_BINDING:' + group + '.' + key)
    need((c['scope']['side'], c['scope']['quantityP'], c['scope']['maxApplications'],
          c['scope']['warehouseCount']) == ('G', 1, 1, 1), 'SCOPE')
    need(c['pool']['initialP'] == 1 and c['pool']['renewalAllowed'] is False, 'POOL')
    need(c['pool']['trainingEvidence']['actualTrainingReceiptRef'] is None
         and c['pool']['trainingEvidence']['assumptionApprovalRef'] is None, 'FALSE_TRAINING_CLAIM')
    b = c['budget']
    need((b['initialI'], b['feeI'], b['acceptanceCareFeeI'], b['carriageFeeI']) == (2, 2, 1, 1),
         'UNREVIEWED_PRICE')
    need(b['sameGrantOrAccountAs012Allowed'] is False and b['equipment012I'] == 10
         and b['combinedIfBothApprovedI'] == 12 and b['equipment012AccountId'] is None,
         '012_BUDGET')
    need(c['transport']['loadPerP_LQ'] == c['transport']['finiteQuotaLQ'] == 4
         and c['transport']['latencyEpochs'] == 1, 'TRANSPORT_PARAMETER')
    need(c['transport']['concurrent012ServiceAllowed'] is False
         and c['transport']['oldEquipmentOrC10ReceiptAllowed'] is False, 'BORROWED_SERVICE')
    w = c['warehouse']
    need((w['nodeId'], w['coreKey'], w['capacityP'], w['initialP']) == ('A10', '0,9', 1, 0), 'WAREHOUSE')
    need(w['mappingTo012WarehouseRef'] is None and w['nullControlApprovalRef'] is None, 'FALSE_BINDING')
    need(c['preserved'] == dict(globalBlockers=35, globalClosed=0, GermanGapSP=9,
         SovietGapSP=14, extra22SP=False, CoreMapControlHomeSideVPChanged=False,
         E2Granted=False, **{'012Changed': False}), 'BASELINES_CHANGED')
    need(c['atomicity']['deadlineSeconds'] == 3, 'DEADLINE_CHANGED')
    blobs = {}
    for src in source['inputs']:
        need(src['commit'] == c['refs'][src['ref']], 'SOURCE_REF')
        raw = subprocess.check_output(['git', 'show', src['commit'] + ':' + src['path']], cwd=ROOT)
        need(sha(raw) == src['sha256'], 'SOURCE_HASH:' + src['path'])
        blobs[src['path']] = raw
    old = json.loads(blobs['docs/rule-campaign-003/VALIDATION.json'])['blockers']
    need([r['blocker'] for r in c['blockerReview']] == old and len(old) == 35, 'BLOCKER_LIST')
    need(all(r['globalResolved'] is False for r in c['blockerReview']), 'FALSE_CLOSURE')
    nodes = json.loads(blobs['docs/rule-campaign-003/inputs/MAP_NODES.json'])['nodes']
    a10 = [x for x in nodes if x['nodeId'] == 'A10']
    need(len(a10) == 1 and a10[0]['key'] == '0,9' and a10[0]['control'] is None, 'A10_MAPPING')
    rate = json.loads(blobs['docs/rule-campaign-006/candidate.json'])['charges']['ratesLQ']['P']
    need(rate == c['transport']['loadPerP_LQ'], 'P_RATE_SOURCE')
    return len(blobs)


P_ACCOUNTS = ('pool', 'sourceEscrow', 'transit', 'rear', 'quarantineSource', 'quarantineTransit', 'quarantineRear')
I_ACCOUNTS = ('availableI', 'escrowI', 'careSpentI', 'carriageSpentI')


def audit(f):
    """Fold supplied synthetic events, not commands submitted to a game engine."""
    need(f['kind'] == 'SYNTHETIC_NOT_AUTHORIZATION', 'FIXTURE_ONLY')
    q = f['premises']
    need(q['approved'] and q['trainedAssumptionApproved'], 'MISSING_SOURCE_OR_TRAINING_APPROVAL')
    need(q['trainingKind'] == 'SCENARIO_ASSUMPTION', 'FABRICATED_TRAINING_RECEIPT')
    need((q['side'], q['hex'], q['key']) == ('G', 'A10', '0,9'), 'WRONG_SERVICE')
    need(q['nullPolicyApproved'] and not q['enemyOccupied'], 'CONTROL')
    need(q['budgetAccount'] != q['equipmentAccount'] and q['budgetGrant'] != q['equipmentGrant'], '012_REUSED')
    need(q['budgetAccount'] == 'RC008-I' and q['budgetGrant'] == 'RC008-IG', 'UNKNOWN_PERSONNEL_ACCOUNT')
    need(q['serviceId'] == 'RC008-EXTERNAL' and q['physicalSeparationApproved'], 'SERVICE_NOT_APPROVED')
    need(not q['concurrent012'], 'SHARED_PHYSICAL_SERVICE')
    for field in ('initialP', 'initialI', 'careFee', 'carriageFee', 'loadPerP', 'quota', 'capacityP'):
        need(type(q[field]) is int and q[field] > 0, 'UNKNOWN_OR_FREE:' + field)
    need(q['initialP'] == 1 and q['initialI'] == 2 and q['careFee'] == q['carriageFee'] == 1,
         'RECOMMENDED_SLICE_VALUES')
    need(q['loadPerP'] == q['quota'] == 4 and q['capacityP'] == 1, 'CAPACITY_PROFILE')
    need(1 <= q['startTurn'] <= 22, 'START_WINDOW')
    s = copy.deepcopy(f['before'])
    need(all(s[k] == 0 for k in P_ACCOUNTS + I_ACCOUNTS), 'OLD_GIFT_OR_BUDGET')
    need(s['equipmentI'] == 10 and s['equipmentE2'] == 0, '012_BEFORE')
    original = copy.deepcopy(f)
    imported = False
    accepted = False
    dispatched = received = None
    expired = False
    seen = {}
    last = (0, 0)
    rows = []
    for e in f['events']:
        payload = json.dumps(e, sort_keys=True)
        if e['id'] in seen:
            need(seen[e['id']] == payload, 'ID_CONFLICT')
            rows.append(dict(id=e['id'], replay=True, after=copy.deepcopy(s)))
            continue
        need(e['packageId'] == 'SOURCE-G/P-1', 'PACKAGE_MISMATCH')
        need((e['turn'], e['stage']) >= last, 'EVENT_ORDER')
        need(1 <= e['turn'] <= 24, 'NO_T25')
        last = (e['turn'], e['stage'])
        t, kind = e['turn'], e['kind']
        before = copy.deepcopy(s)
        a = q['startTurn']
        if kind == 'IMPORT':
            need(not imported, 'DUPLICATE_GRANT')
            need(t == a and e['stage'] == 0, 'IMPORT_WINDOW')
            imported = True
            s['pool'] += q['initialP']
            s['availableI'] += q['initialI']
        elif kind == 'ACCEPT':
            need(imported and not accepted and not expired, 'SECOND_OR_EXPIRED_APPLICATION')
            need(t == a and e['stage'] == 1 and e['phase'] == 'GERMAN_RECOVERY' and not e['pending'], 'ACCEPT_WINDOW')
            need(s['pool'] == 1 and s['availableI'] >= q['careFee'] + q['carriageFee'], 'SOURCE_SHORT')
            accepted = True
            s['pool'] -= 1
            s['sourceEscrow'] += 1
            s['availableI'] -= q['careFee'] + q['carriageFee']
            s['careSpentI'] += q['careFee']
            s['escrowI'] += q['carriageFee']
        elif kind == 'DISPATCH':
            need(accepted and not expired and s['sourceEscrow'] == 1 and dispatched is None, 'DISPATCH_CUSTODY')
            need(e['stage'] == 14 and a <= t <= a + 1, 'DISPATCH_WINDOW')
            need(e['eligible'], 'DISPATCH_INELIGIBLE')
            need(s['usedLQ'] + q['otherHoldsLQ'] + q['loadPerP'] <= q['quota'], 'TRANSPORT_FULL')
            need(s['rear'] + s['quarantineRear'] + s['incomingP'] + q['otherResidentP'] + 1 <= q['capacityP'], 'WAREHOUSE_FULL')
            dispatched = t
            s['sourceEscrow'] -= 1
            s['transit'] += 1
            s['incomingP'] += 1
            s['escrowI'] -= q['carriageFee']
            s['carriageSpentI'] += q['carriageFee']
            s['usedLQ'] += q['loadPerP']
        elif kind in ('RECEIVE', 'HOLD'):
            need(dispatched is not None and received is None and not expired and s['transit'] == 1, 'RECEIPT_CUSTODY')
            need(dispatched <= t <= a + 2, 'RECEIPT_WINDOW')
            need(e['stage'] == (15 if t == dispatched else 13), 'RECEIPT_STAGE')
            if kind == 'RECEIVE':
                need(e['eligible'], 'RECEIPT_INELIGIBLE')
                need(s['rear'] + s['quarantineRear'] + s['incomingP'] + e.get('otherResidentP', 0) <= q['capacityP'], 'RECEIPT_CAPACITY')
                received = t
                s['transit'] -= 1
                s['rear'] += 1
                s['incomingP'] -= 1
                s['availableFromTurn'] = t + 1
                s['shipEligibleEpoch'] = t + 1
            else:
                need(not e['eligible'], 'FALSE_HOLD')
        elif kind == 'CHECK_AVAILABLE':
            need(received is not None and not expired and t == received + 1 and e['stage'] == 1, 'NOT_AVAILABLE')
        elif kind == 'FORWARD':
            raise Rejected('FORWARD_OUT_OF_SCOPE')
        elif kind == 'EXPIRE':
            need(imported and not expired and e['stage'] == 16, 'EXPIRE_STAGE')
            if received is not None:
                need(t == min(received + 1, 24), 'EARLY_EXPIRY')
                s['quarantineRear'] += s['rear']
                s['rear'] = 0
            elif dispatched is not None:
                need(t == a + 2, 'EARLY_EXPIRY')
                s['quarantineTransit'] += s['transit']
                s['transit'] = 0
                s['incomingP'] = 0
            else:
                need(t == a + 1, 'EARLY_EXPIRY')
                s['quarantineSource'] += s['sourceEscrow'] + s['pool']
                s['sourceEscrow'] = s['pool'] = 0
                s['availableI'] += s['escrowI']
                s['escrowI'] = 0
            expired = True
        elif kind == 'FAILURE_RECORD':
            need(e['beforeHash'] == e['afterHash'] == state_hash(s), 'PARTIAL_ROLLBACK')
        else:
            raise Rejected('UNSUPPORTED:' + kind)
        need(sum(s[k] for k in P_ACCOUNTS) == (q['initialP'] if imported else 0), 'P_CONSERVATION')
        need(sum(s[k] for k in I_ACCOUNTS) == (q['initialI'] if imported else 0), 'I_CONSERVATION')
        need(s['equipmentI'] == 10 and s['equipmentE2'] == 0, '012_TOUCHED')
        need(all(v >= 0 for v in s.values() if type(v) is int), 'NEGATIVE')
        seen[e['id']] = payload
        rows.append(dict(id=e['id'], before=before,
            delta={k: s[k] - before[k] for k in s if type(s[k]) is int and type(before[k]) is int},
            after=copy.deepcopy(s)))
    need(original == f, 'INPUT_MUTATED')
    return dict(after=s, events=rows)


def self_test(fixture):
    results = []
    for case in fixture['cases']:
        f = changed(fixture['base'], case.get('changes', []))
        if 'duplicateIndex' in case:
            i = case['duplicateIndex']
            f['events'].insert(i + 1, copy.deepcopy(f['events'][i]))
        before = copy.deepcopy(f)
        try:
            out = audit(f)
            need(case['expected'] == 'PASS', 'EXPECTED_REJECT:' + case['expected'])
            need(all(out['after'][k] == v for k, v in case.get('expectedAfter', {}).items()), 'EXPECTED_AFTER')
            # Keep one detailed trace and every other recomputed final balance concise.
            results.append(dict(id=case['id'], outcome='PASS', recomputed=out if case['id'] == 'N01' else out['after']))
        except Rejected as ex:
            need(str(ex) == case['expected'], 'WRONG_REJECTION:' + case['id'] + ':' + str(ex))
            results.append(dict(id=case['id'], outcome='PASS', rejected=str(ex)))
        need(before == f, 'FIXTURE_MUTATED')
    return results


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--self-test', action='store_true')
    ap.add_argument('--runtime-gate', action='store_true')
    args = ap.parse_args()
    try:
        c = json.loads((HERE / 'candidate.json').read_bytes())
        source = json.loads((HERE / 'SOURCES.json').read_bytes())
        count = sources_and_candidate(c, source)
        tests = self_test(json.loads((HERE / 'fixtures.json').read_bytes())) if args.self_test else []
        print(json.dumps(dict(status='VALID_CANDIDATE_ONLY', runtimeDecision='REJECT',
            verifiedSources=count, checks=tests, blockers=c['blockerReview'], unresolved=c['newPending'],
            globalClosed=0, notProven=c['notProven'], hashes={f: sha((HERE / f).read_bytes()) for f in
                ('candidate.json', 'SOURCES.json', 'fixtures.json', 'validate.py', 'DIFF.md')}), ensure_ascii=False, indent=2))
        return 2 if args.runtime_gate else 0
    except (Rejected, KeyError, TypeError, ValueError, OSError, subprocess.CalledProcessError) as ex:
        print(json.dumps(dict(status='INVALID', error=str(ex)), ensure_ascii=False))
        return 1


if __name__ == '__main__':
    sys.exit(main())

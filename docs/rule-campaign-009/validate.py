"""Read-only fixed evidence and synthetic boundary ledger checks. No engine/solver."""
import argparse
import copy
import gzip
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


def sha(b):
    return hashlib.sha256(b).hexdigest()


def digest(v):
    return sha(json.dumps(v, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode())


def evidence(c, sources):
    need(c['runtimeEnabled'] is False and all(v is None for k, v in c['approval'].items()
         if k != 'inherits011013Or014Authorization'), 'PENDING_AUTHORITY_REQUIRED')
    need(c['approval']['inherits011013Or014Authorization'] is False, 'OLD_AUTHORITY')
    need(c['refs'] == sources['refs'], 'REFS')
    blobs = {}
    for src in sources['inputs']:
        need(src['commit'] == c['refs'][src['ref']], 'SOURCE_COMMIT')
        b = subprocess.check_output(['git', 'show', src['commit'] + ':' + src['path']], cwd=ROOT)
        need(sha(b) == src['sha256'], 'SOURCE_HASH:' + src['path'])
        blobs[src['path']] = b
    r = json.loads(gzip.decompress(blobs['experiments/industry-integrate-013/TRACE.json.gz']))['T8']
    need(digest(r) == c['start']['rootHash'], 'FULL_ROOT_HASH')
    need(r['revision'] == c['start']['rootRevision'] == 37 and
         r['bundle']['revision'] == c['start']['gameRevision'] == 142, 'REVISION')
    need(json.dumps(r['bundle'], ensure_ascii=False) == r['bundleJSON'], 'BUNDLE_JSON')
    need(len(r['receipts']) == c['start']['receiptsCount'] == 37 and
         digest(r['receipts']) == c['start']['receiptsHash'], 'OLD_RECEIPTS')
    need(r['personnel']['package'] == c['materials']['personnelPackage'] and
         r['personnel']['ids'] == c['materials']['personnelOriginIds'] and
         r['industry']['batch'] == c['materials']['equipmentBatch'], 'MATERIAL_ID_OR_STATE')
    need(r['industry']['budget'] == dict(granted=10, freeI=5, productionSpent=3, handoffSpent=2, escrow=0), 'SOURCE_BUDGET')
    need(r['continuation']['equipment012GrantId'] == c['care']['sourceGrantId'] == c['materials']['equipmentGrantId'], 'GRANT_ID')
    need(c['care']['personnelAccountImmutable'] == r['personnel']['account'], 'OLD_PERSONNEL_ACCOUNT')
    need(r['industry']['warehouse']['resident'] == 2 and r['industry']['warehouse']['P'] == 0,
         'SOURCE_STOCK')
    need(sum(r['personnel']['quota']['used'].values()) == 4, 'OLD_OFFMAP_USED')
    need(c['care']['feeI'] == 1 and c['care']['oldCareEndsEpoch'] == 8 and
         c['care']['newCareEndsEpoch'] == 9 and c['care']['sourceAccountRef'] == 'industry.budget.freeI', 'CARE_PROFILE')
    need(c['receiver']['capacity'] == {'P': 1, 'E2:L': 2} and c['receiver']['grantRef'] is None, 'RECEIVER_PROFILE')
    need(c['recovery']['price'] == {'P': 1, 'E2:L': 2} and c['atomicity']['deadlineSeconds'] == 3, 'RECOVERY_PROFILE')
    old = json.loads(blobs['docs/rule-campaign-003/VALIDATION.json'])['blockers']
    need(c['globalBlockersRetained'] == old and len(old) == 35 and c['preserved']['globalClosed'] == 0, 'BLOCKERS')
    need((c['preserved']['GermanGapSP'], c['preserved']['SovietGapSP'], c['preserved']['extra22SP']) == (9, 14, False), 'SP_BASELINE')
    plan = json.loads(blobs['experiments/industry-integrate-014/PLAN.json'])
    need(plan['startRootHash'] == digest(r) and plan['materials']['personnelPackage'] == r['personnel']['package'], '014_INPUT')
    need(c['route']['coreEdges'] == [x['coreKey'] for x in plan['route']['segments']], 'ROUTE')
    need([(x['node'], x['key']) for x in c['route']['nodes']] ==
         [(x['label'], x['key']) for x in plan['route']['nodes']], 'NODE_MAPPING')
    need(c['scope']['targetUnit'] == plan['route']['target'] == 'G-I-01', 'TARGET')
    need({x['id']: x['perBundle'] for x in c['capacity']['rows']} == plan['proposedResourceLoad'], 'CAPACITY_VECTOR')
    # Only re-add stored four-row evidence; no LP, no new priority/casualty calculation.
    recalculated = []
    for saved, row in zip(plan['capacity']['rows'], c['capacity']['rows']):
        need(saved['id'] == row['id'] and saved['cap'] == row['capReference'], 'CAP_CHANGED')
        remaining = saved['cap'] - saved['referenceSP'] - saved['existingMaterialReservations'] - row['perBundle']
        need(remaining == saved['remainingWithFrozenSP'], '014_ARITHMETIC')
        recalculated.append(dict(id=row['id'], referenceSP=saved['referenceSP'], cargo=row['perBundle'], remaining=remaining))
    need(plan['capacity']['status'] == 'INFEASIBLE' and recalculated[-1]['remaining'] == -8, '014_BLOCKER_LOST')
    return r, plan, len(blobs), recalculated


def audit(c, f, start):
    need(f['kind'] == 'SYNTHETIC_NOT_015_EVIDENCE', 'FIXTURE_ONLY')
    need(f['packageId'] == c['materials']['personnelPackage']['id'] and
         f['equipmentBatchId'] == c['materials']['equipmentBatch']['id'], 'WRONG_LOTS')
    s = dict(freeI=start['industry']['budget']['freeI'], transferOutI=0, careSpentI=0,
             aP=1, aE=2, tP=0, tE=0, cP=0, cE=0, usedP=0, usedE=0,
             sourceE2Resident=2, careActive=False, expired=False, terminalReceipt=False,
             receiptConsumed=False, incomingP=0, incomingE=0, commonCount=0, step=1, rp=8,
             oldPersonnelSpentI=2, oldOffmapUsedLQ=4, railAB=0, railBC=0, T=0, W=0,
             ownerStatus='A10_AVAILABLE', availableFromTurn=8)
    s.update(f.get('beforeOverride', {}))
    receipts = {}
    rows = []
    last = (0, 0)
    for e in f['events']:
        encoded = digest(e)
        if e['id'] in receipts:
            need(receipts[e['id']] == encoded, 'ID_PAYLOAD_CONFLICT')
            rows.append(dict(id=e['id'], replay=True, after=copy.deepcopy(s)))
            continue
        need((e['turn'], e['stage']) >= last, 'EVENT_ORDER')
        last = (e['turn'], e['stage'])
        before = copy.deepcopy(s)
        k = e['kind']
        if k == 'EXTEND':
            need(not s['careActive'] and s['transferOutI'] == 0, 'ALREADY_PAID')
            need(not s['expired'] and s['ownerStatus'] == 'A10_AVAILABLE' and e['turn'] == 8
                 and e['stage'] == 1 and e['phase'] == 'GERMAN_RECOVERY', 'LATE_OR_ISOLATED')
            need(e['approvedUseTransfer'] and e['sourceAccount'] == 'industry.budget.freeI', 'BUDGET_USE_NOT_APPROVED')
            need(s['freeI'] >= 1, 'NO_FREE_BUDGET')
            s['freeI'] -= 1
            s['transferOutI'] += 1
            s['careSpentI'] += 1
            s['careActive'] = True
        elif k == 'SHIP':
            need(s['careActive'] and not s['expired'], 'CARE_REQUIRED')
            need(e['turn'] == 8 and e['stage'] == 14, 'DISPATCH_WINDOW')
            need(s['aP'] == 1 and s['aE'] == 2 and s['sourceE2Resident'] == 2, 'SOURCE_CUSTODY')
            need(e['routeEligible'] and e['target'] == 'G-I-01', 'ROUTE_OR_TARGET')
            need(e['approvedCapacityPolicyWitness'], '015_APPROVAL_OR_WITNESS_MISSING')
            for row in c['capacity']['rows']:
                need(e['otherUsage'][row['id']] + row['perBundle'] <= row['capReference'], 'CAPACITY:' + row['id'])
            need(e['receiverFreeP'] >= 1 and e['receiverFreeE'] >= 2, 'MATERIAL_CAPACITY')
            s.update(aP=0, aE=0, sourceE2Resident=0, tP=1, tE=2, incomingP=1, incomingE=2,
                     railAB=8, railBC=8, T=16, W=8, ownerStatus='IN_TRANSIT', availableFromTurn=9)
        elif k in ('RECEIVE', 'REFUSE'):
            need(not s['expired'] and s['tP'] == 1 and s['tE'] == 2, 'RECEIPT_CUSTODY')
            need(e['turn'] == 8 and e['stage'] == 15, 'LATE_RECEIPT')
            if k == 'RECEIVE':
                need(e['eligible'] and e['target'] == 'G-I-01' and e['hex'] == 'C10', 'RECEIVER_ELIGIBILITY')
                need(e['freeP'] >= 1 and e['freeE'] >= 2, 'RECEIVER_CAPACITY')
                s.update(tP=0, tE=0, cP=1, cE=2, incomingP=0, incomingE=0,
                         terminalReceipt=True, ownerStatus='C10_UNAVAILABLE')
            else:
                need(not e['eligible'], 'FALSE_REFUSAL')
                s['ownerStatus'] = 'HELD'
        elif k == 'RECOVER':
            need(e['turn'] == 9 and e['stage'] == 1 and e['phase'] == 'GERMAN_RECOVERY', 'RECOVERY_WINDOW')
            need(s['careActive'] and not s['expired'] and s['cP'] == 1 and s['cE'] == 2, 'RECOVERY_CUSTODY')
            need(s['terminalReceipt'] and not s['receiptConsumed'] and s['W'] == 8, 'TERMINAL_RECEIPT')
            need(e['target'] == 'G-I-01' and e['hex'] == 'C10' and e['controller'] == 'G-HUMAN-1', 'RECOVERY_TARGET')
            need(e['mode'] == 'PE' and e['rpDebit'] == 0 and e['extraW'] == 0, 'DOUBLE_PAYMENT')
            need(e['commonEligible'] and s['commonCount'] < 1 and s['step'] > 0, 'CORE_COMMON_ELIGIBILITY')
            s.update(cP=0, cE=0, usedP=1, usedE=2, receiptConsumed=True, ownerStatus='CONSUMED')
            s['step'] -= 1
            s['commonCount'] += 1
        elif k == 'CLOSE':
            need(e['earlyGameOver'] or (e['turn'] == 9 and e['stage'] == 50), 'EARLY_CLOSE')
            s['expired'] = True
            s['careActive'] = False
            s['incomingP'] = s['incomingE'] = 0
            if s['usedP'] == 0:
                s['ownerStatus'] = 'QUARANTINED_' + ('A10' if s['aP'] else 'TRANSIT' if s['tP'] else 'C10')
        elif k == 'FAILURE_RECORD':
            need(e['beforeHash'] == e['afterHash'] == digest(s), 'PARTIAL_ROLLBACK')
        else:
            raise Rejected('UNSUPPORTED_EVENT')
        need(s['aP'] + s['tP'] + s['cP'] + s['usedP'] == 1 and
             s['aE'] + s['tE'] + s['cE'] + s['usedE'] == 2, 'DOUBLE_CUSTODY')
        need(s['sourceE2Resident'] == s['aE'], 'SOURCE_WAREHOUSE_DUPLICATION')
        need(s['freeI'] + 3 + 2 + s['transferOutI'] == 10 and s['transferOutI'] == s['careSpentI'], 'BUDGET_CONSERVATION')
        need(s['oldPersonnelSpentI'] == 2 and s['oldOffmapUsedLQ'] == 4, 'OLD_PAYMENTS_REUSED')
        need(s['rp'] == 8, 'RP_CHARGED')
        receipts[e['id']] = encoded
        rows.append(dict(id=e['id'], before=before, after=copy.deepcopy(s)))
    return dict(after=s, events=rows)


def tests(c, f, root):
    result = []
    for case in f['cases']:
        data = copy.deepcopy(f['base'])
        for path, value in case.get('edits', []):
            target = data
            parts = path.split('.')
            for part in parts[:-1]:
                target = target[int(part)] if isinstance(target, list) else target[part]
            target[int(parts[-1]) if isinstance(target, list) else parts[-1]] = value
        before = copy.deepcopy(data)
        try:
            out = audit(c, data, root)
            need(case['expect'] == 'PASS', 'EXPECTED_REJECTION')
            need(all(out['after'][k] == v for k, v in case.get('after', {}).items()), 'EXPECTED_BALANCE')
            result.append(dict(name=case['name'], outcome='PASS', calculated=out if case['name'] == 'normal' else out['after']))
        except Rejected as ex:
            need(str(ex) == case['expect'], 'WRONG_REJECTION:' + case['name'] + ':' + str(ex))
            result.append(dict(name=case['name'], outcome='PASS', reason=str(ex)))
        need(data == before, 'FIXTURE_MUTATED')
    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--self-test', action='store_true')
    ap.add_argument('--runtime-gate', action='store_true')
    args = ap.parse_args()
    try:
        c = json.loads((HERE / 'candidate.json').read_bytes())
        src = json.loads((HERE / 'SOURCES.json').read_bytes())
        root, plan, n, recalculated = evidence(c, src)
        checks = tests(c, json.loads((HERE / 'fixtures.json').read_bytes()), root) if args.self_test else []
        out = dict(status='VALID_CANDIDATE_ONLY', runtimeDecision='REJECT', sourcesVerified=n,
            rootHashVerified=digest(root), permanentReceiptsRetained=len(root['receipts']),
            known014Blockers=plan['blockers'], static014Rows=recalculated, checks=checks,
            globalBlockers=c['globalBlockersRetained'], globalClosed=0, pending=c['pending'],
            notProven=['015 costs or feasibility', 'Core/transport execution', 'runtime idempotency/rollback/crash safety'],
            fileHashes={name: sha((HERE / name).read_bytes()) for name in
                        ('candidate.json', 'SOURCES.json', 'fixtures.json', 'validate.py', 'DIFF.md')})
        print(json.dumps(out, ensure_ascii=False, indent=2))
        return 2 if args.runtime_gate else 0
    except (Rejected, KeyError, TypeError, ValueError, OSError, subprocess.CalledProcessError) as ex:
        print(json.dumps(dict(status='INVALID', error=str(ex)), ensure_ascii=False))
        return 1


if __name__ == '__main__':
    sys.exit(main())

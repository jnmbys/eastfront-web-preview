"""Read-only candidate/boundary checks. Never import materials, execute Core or recover a unit.
Requires existing fixed Git objects; no network, simulation or write operations.
Synthetic authorization/eligibility receipts in --self-test are GIVEN assumptions,
not verified grants, Core eligibility execution or runtime integration evidence.
"""
import argparse
import copy
import gzip
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent


def read(name):
    return json.loads((ROOT / name).read_bytes())


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()


class Reject(ValueError):
    pass


def need(ok, reason):
    if not ok:
        raise Reject(reason)


def load_fixed():
    sources = read('SOURCES.json')
    raw = {}
    for row in sources['inputs']:
        need(row['commit'] == sources['refs'][row['ref']], 'SOURCE_REF_MISMATCH')
        data = subprocess.check_output(['git', 'show', row['commit'] + ':' + row['path']], cwd=ROOT)
        need(hashlib.sha256(data).hexdigest() == row['sha256'], 'FIXED_SOURCE_HASH:' + row['path'])
        raw[row['path']] = data
    bundle = json.loads(gzip.decompress(raw['docs/campaign-004/CHECKPOINTS.json.gz']))['german_recovery_T5']
    previous = json.loads(raw['docs/rule-campaign-003/VALIDATION.json'])
    industry = json.loads(raw['experiments/industry-integrate-006/EVIDENCE.json'])
    need(previous['blockers'] == industry['originalGateBlockers'], 'INPUT_BLOCKER_DRIFT')
    return sources, raw, bundle, previous, industry


def review(c, fixed):
    sources, raw, bundle, previous, industry = fixed
    f = read('T5_FACTS.json')
    core, scope, service, manifest = bundle['core'], c['scope'], c['service'], c['initialManifest']
    need(c['refs'] == sources['refs'], 'CONFIG_REF_DRIFT')
    need(c['runtimeEnabled'] is False and c['status'] == 'LEADER_REVIEW_REQUIRED', 'CANDIDATE_CANNOT_ENABLE_RUNTIME')
    need(c['approval'] == {'decisionRef': None, 'approvedCandidateSha256': None, 'trustedGrantRef': None},
         'NO_ACTUAL_APPROVAL_IN_CANDIDATE')
    need(c['checkpoint'] == f['checkpointBinding'], 'CHECKPOINT_BINDING_DRIFT')
    need(hashlib.sha256(raw['docs/campaign-004/CHECKPOINTS.json.gz']).hexdigest() == c['checkpoint']['archiveSha256'],
         'CHECKPOINT_ARCHIVE_MISMATCH')
    need(hashlib.sha256(json.dumps(bundle, ensure_ascii=False).encode()).hexdigest() == c['checkpoint']['serializedSnapshotSha256'],
         'CHECKPOINT_SERIALIZED_MISMATCH')
    need(bundle['revision'] == 109 and core['turn'] == 5 and core['phase'] == 'GERMAN_RECOVERY', 'WRONG_FIXED_TIME')
    need(f['unit'] == core['units']['G-I-01'] and f['cell'] == core['hexes']['2,8'] and f['RP'] == core['rp']
         and f['random'] == core['random'], 'FACT_PROJECTION_MISMATCH')
    need(f['logisticsUnit'] == next(u for u in bundle['logistics']['units'] if u['id'] == 'G-I-01'), 'LOGISTICS_FACT_MISMATCH')
    map_node = next(n for n in json.loads(raw['docs/rule-campaign-003/inputs/MAP_NODES.json'])['nodes'] if n['nodeId'] == 'C10')
    need(map_node == {'nodeId':'C10','key':'2,8','terrain':f['cell']['terrain'],'control':f['cell']['control']}
         and f['unit']['hex'] == {'q':2,'r':8}, 'R1_CORE_TARGET_MAPPING_MISMATCH')
    control = industry['rows'][0]['before']
    need(f['recoveryCount'] == control['recoveryCount'] == 0 and f['germanRecoveryLimit'] == 1,
         'RECOVERY_COUNT_FACT_MISMATCH')
    need(c['checkpoint']['industry006FullValueHashReference'] == control['fullHash'], '006_REFERENCE_MISMATCH')
    for field, value in {'unitId':'G-I-01','templateId':'G-INF','controllerId':'G-HUMAN-1','side':'G',
                         'coreSide':'GERMAN','nodeId':'C10','coreKey':'2,8','turn':5,'phase':'GERMAN_RECOVERY',
                         'maxAcceptedRecoveries':1,'expiresOnAnyOtherAcceptedGameAction':True}.items():
        need(scope[field] == value, 'SCOPE_CHANGED:' + field)
    for obj in (service, manifest):
        need((obj['side'],obj['nodeId'],obj['coreKey'],obj['receiverId']) == ('G','C10','2,8','REC-G-C10'),
             'SERVICE_OR_MANIFEST_CUSTODY')
    need(service['capacity'] == manifest['quantities'] == c['payment']['recipe'] == {'P':1,'E2:L':2}, 'PRICE_OR_CAPACITY_CHANGED')
    need(all(type(v) is int and v > 0 for group in (service['capacity'], manifest['quantities'], c['payment']['recipe'])
             for v in group.values()), 'MATERIAL_INTEGER_UNITS_REQUIRED')
    need(service['nullControlPolicy'] == 'EXPLICIT_SCOPE_GRANT_ONLY_KEEP_NULL' and core['hexes']['2,8']['control'] is None,
         'NULL_CONTROL_NOT_OWNERSHIP')
    need(service['custody'] == 'DIRECT_INITIAL_RECEIVER_NO_DEPOT_OR_TRANSPORT' and service['capacitySharedWithSPHub'] is False,
         'NO_DEPOT_OR_SP_HUB_ALIAS')
    need(service['requireNoEnemyOccupancy'] is True and service['requireNoEnemyZoc'] is True, 'ACCESS_CHECKS_REQUIRED')
    need(manifest['origin'] == 'NEW_ISOLATED_EXPERIMENT_INITIAL_CONDITION' and manifest['isNewExperimentalInput'] is True
         and manifest['historicalReceiptClaim'] is False and manifest['conversionsAllowed'] == [], 'FALSE_HISTORICAL_OR_CONVERTED_MATERIAL')
    need(manifest['originSourceId'] == 'RC004-EXPERIMENT-ENDOWMENT', 'NO_SP_SOURCE_AS_MATERIAL_ORIGIN')
    need(manifest['oncePerIsolatedStore'] is True and manifest['journalRequired'] is True and manifest['retireAfterSpend'] is True
         and manifest['gameBundleMustRemainByteIdentical'] is True, 'IMPORT_DEDUP_AND_UNCHANGED_BUNDLE_REQUIRED')
    a = manifest['availability']
    need(a == {'kind':'EXPERIMENT_INITIAL_AT_CHECKPOINT','turn':5,'phase':'GERMAN_RECOVERY','gameRevision':109,
               'event':'AFTER_EXACT_CHECKPOINT_RESTORE_BEFORE_FIRST_GAME_ACTION','receivedEpoch':None,
               'transportReceiptId':None,'productionReceiptId':None}, 'INITIAL_IS_NOT_BACKDATED_DELIVERY')
    lots = manifest['lots']
    need(len(lots) == 2 and len({l['lotId'] for l in lots}) == 2, 'DUPLICATE_OR_WRONG_LOT_SET')
    need(all(isinstance(l['lotId'],str) and l['lotId'] and type(l['quantity']) is int and l['quantity'] > 0 for l in lots),
         'LOT_ID_AND_INTEGER_QUANTITY_REQUIRED')
    need({l['material']:l['quantity'] for l in lots} == {'P':1,'E2:L':2}, 'INITIAL_LOT_AMOUNTS')
    p = c['payment']
    need(p['selectedExperimentMode'] == 'PE' and p['explicitChoiceOnly'] == ['RP','PE'] and p['RPDeltaInPE'] == 0
         and p['SPDeltaForMaterialPayment'] == 0 and p['automaticFallback'] is False
         and p['callOriginalRPApplyThenRefund'] is False and p['sameRecoveryCounterAcrossModes'] is True,
         'EXCLUSIVE_PAYMENT_AND_SHARED_COUNT_REQUIRED')
    need(p['oneStepDelta'] == -1 and p['expectedTargetStepAfter'] == 0 and p['expectedMaterialAfter'] == {'P':0,'E2:L':0}
         and p['expectationOnlyNotExecuted'] is True, 'CONDITIONAL_EXPECTATION_CHANGED')
    need(c['preserved'] == {'globalRuntimeGate':'REJECT','globalBlockersClosed':0,'germanSourceGapSP':9,'sovietSourceGapSP':14,
                          'industrial22SPAdditive':False,'sourceOrMaintenanceChanges':False,'ordersDeliveryEntryImplemented':False},
         'GLOBAL_SCOPE_OR_DEFICIT_CHANGED')
    table = read('BLOCKERS.json')
    need([x['blocker'] for x in table['rows']] == previous['blockers'] and len(table['rows']) == 35, 'BLOCKER_COVERAGE')
    need(all(x['globalResolved'] is False for x in table['rows']) and table['globalResolved'] == 0, 'BLOCKER_FALSELY_CLOSED')
    need(sum(x['sliceDisposition'] == 'PROPOSED_FOR_REVIEW_NOT_RESOLVED' for x in table['rows']) == table['sliceProposals'] == 12
         and table['outsideSlice'] == 23, 'BLOCKER_SCOPE_COUNTS')
    return {'reviewStatus':'VALID_CANDIDATE_ONLY','runtimeDecision':'REJECT','approvalMissing':True,
            'originalBlockerCount':35,'globallyResolved':0,'sliceProposals':12,'outsideSlice':23,
            'checkpointReadOnly':True,'gameActionsExecuted':0,'materialsImported':0}


def boundary(c, ctx, operation):
    """Conditional on GIVEN verified receipts. Not an authentication or Core implementation."""
    before = digest(ctx)
    s, m = c['scope'], c['initialManifest']
    approval = ctx.get('verifiedLocalApproval')
    need(approval is not None, 'NO_VERIFIED_LOCAL_APPROVAL')
    need(approval.get('candidateDigest') == digest(c) and approval.get('experimentId') == s['experimentId']
         and approval.get('baseSnapshotSha256') == c['checkpoint']['serializedSnapshotSha256']
         and approval.get('grantProposalId') == c['service']['proposalId'] and approval.get('decisionRef'),
         'APPROVAL_SCOPE_OR_CONTENT_MISMATCH')
    need(ctx.get('experimentId') == s['experimentId'], 'EXPERIMENT_ID_MISMATCH')
    need(ctx.get('side') == s['side'] and ctx.get('controllerId') == s['controllerId'], 'WRONG_SIDE_OR_CONTROLLER')
    need((ctx.get('nodeId'),ctx.get('coreKey'),ctx.get('unitId')) == (s['nodeId'],s['coreKey'],s['unitId']), 'WRONG_HEX_OR_UNIT')
    need(ctx.get('control') is None and ctx.get('enemyOccupied') is False and ctx.get('enemyZoc') is False,
         'NULL_CONTROL_SCOPE_OR_HOSTILE_ACCESS')
    need(ctx.get('turn') == 5 and ctx.get('phase') == 'GERMAN_RECOVERY' and ctx.get('gameRevision') == 109
         and ctx.get('gameSnapshotSha256') == c['checkpoint']['serializedSnapshotSha256'], 'WRONG_TIME_OR_GAME_SNAPSHOT')
    need(ctx.get('manifestDigest') == digest(m), 'MANIFEST_CONTENT_MISMATCH')
    imports = ctx.get('imports', {})
    if operation == 'IMPORT_CHECK':
        if m['manifestId'] in imports:
            need(imports[m['manifestId']] == digest(m), 'MANIFEST_ID_CONFLICT')
            raise Reject('ALREADY_IMPORTED_NO_CREDIT')
        need(ctx.get('materialRevision') == 0 and ctx.get('existingLots') == [], 'INITIAL_LEDGER_NOT_EMPTY')
        need(not set(ctx.get('retiredLotIds', [])) & {l['lotId'] for l in m['lots']}, 'LOT_ID_ALREADY_USED')
    elif operation == 'RECOVERY_CHECK':
        need(ctx.get('paymentMode') in ('RP','PE') and ctx.get('alsoDebitRP') is None and ctx.get('quotedPrice') is None,
             'MIXED_PAYMENT_OR_CALLER_QUOTE')
        common = ctx.get('verifiedCommonEligibility')
        need(common and common.get('snapshotSha256') == ctx['gameSnapshotSha256'] and common.get('issues') == []
             and common.get('allOriginalNonPaymentChecks') is True, 'COMMON_ELIGIBILITY_FALSE_OR_UNKNOWN')
        need(ctx.get('acceptedRecoveryCount') == 0 and ctx.get('targetAlreadyRecovered') is False,
             'SHARED_RECOVERY_LIMIT_OR_ALREADY_USED')
        need(ctx['paymentMode'] == 'PE', 'RP_USE_UNCHANGED_RP_BRANCH_NOT_PE_SLICE')
        need(imports.get(m['manifestId']) == digest(m) and ctx.get('materialRevision') == 1,
             'INITIAL_MATERIAL_NOT_IMPORTED_OR_STALE')
        need(ctx.get('available') == {'P':1,'E2:L':2} and ctx.get('reserved') == {'P':0,'E2:L':0},
             'INSUFFICIENT_OR_RESERVED_MATERIAL')
        need(ctx.get('ledgerHashMatchesCurrent') is True, 'STALE_MATERIAL_LEDGER')
    else:
        raise Reject('UNKNOWN_CHECK')
    need(before == digest(ctx), 'READ_ONLY_INVARIANT')
    return {'conditionalChecksSatisfied':True,'executable':False,'operation':operation,'mutations':0}


def tests(c, fixed):
    # All contexts are synthetic envelopes/receipts. Never mutate the real T5 bundle.
    ctx = {'experimentId':c['scope']['experimentId'],'side':'G','controllerId':'G-HUMAN-1','unitId':'G-I-01',
           'nodeId':'C10','coreKey':'2,8','control':None,'enemyOccupied':False,'enemyZoc':False,
           'turn':5,'phase':'GERMAN_RECOVERY','gameRevision':109,'gameSnapshotSha256':c['checkpoint']['serializedSnapshotSha256'],
           'manifestDigest':digest(c['initialManifest']),'imports':{},'materialRevision':0,'existingLots':[], 'retiredLotIds':[]}
    rows=[]
    def expect(name, x, op, reason=None):
        before=copy.deepcopy(x)
        try:
            answer=boundary(c,x,op)
        except Reject as e:
            need(reason == str(e), 'UNEXPECTED_REJECTION:' + name + ':' + str(e))
            answer={'rejected':str(e),'mutations':0}
        else:
            need(reason is None, 'NEGATIVE_PASSED:' + name)
        need(before == x, 'TEST_MUTATED_INPUT:' + name)
        rows.append({'name':name,'basis':'SYNTHETIC_GIVEN_RECEIPTS_ONLY','result':answer})
    expect('actual approval absent',ctx,'IMPORT_CHECK','NO_VERIFIED_LOCAL_APPROVAL')
    ctx['verifiedLocalApproval']={'decisionRef':'SYNTHETIC_TEST_ONLY_NOT_LEADER_APPROVAL','candidateDigest':digest(c),
        'experimentId':c['scope']['experimentId'],'baseSnapshotSha256':c['checkpoint']['serializedSnapshotSha256'],
        'grantProposalId':c['service']['proposalId']}
    expect('conditional initial manifest shape',ctx,'IMPORT_CHECK')
    for name,field,value,reason in [
        ('wrong side','side','S','WRONG_SIDE_OR_CONTROLLER'),('wrong controller','controllerId','S-HUMAN-1','WRONG_SIDE_OR_CONTROLLER'),
        ('wrong hex','nodeId','B10','WRONG_HEX_OR_UNIT'),('wrong Core key','coreKey','2,9','WRONG_HEX_OR_UNIT'),
        ('wrong unit','unitId','G-I-02','WRONG_HEX_OR_UNIT'),('early turn','turn',4,'WRONG_TIME_OR_GAME_SNAPSHOT'),
        ('wrong phase','phase','GERMAN_MOVEMENT','WRONG_TIME_OR_GAME_SNAPSHOT'),
        ('late revision','gameRevision',110,'WRONG_TIME_OR_GAME_SNAPSHOT'),
        ('wrong saved snapshot','gameSnapshotSha256','bad','WRONG_TIME_OR_GAME_SNAPSHOT'),
        ('enemy access','enemyZoc',True,'NULL_CONTROL_SCOPE_OR_HOSTILE_ACCESS'),
        ('control edited to friendly','control','G','NULL_CONTROL_SCOPE_OR_HOSTILE_ACCESS'),
        ('material list changed','manifestDigest','bad','MANIFEST_CONTENT_MISMATCH'),
        ('lost journal cannot refill used ledger','materialRevision',2,'INITIAL_LEDGER_NOT_EMPTY')]:
        x=copy.deepcopy(ctx);x[field]=value;expect(name,x,'IMPORT_CHECK',reason)
    x=copy.deepcopy(ctx);x['verifiedLocalApproval']['candidateDigest']='bad'
    expect('approval does not bind candidate',x,'IMPORT_CHECK','APPROVAL_SCOPE_OR_CONTENT_MISMATCH')
    for name,value,reason in [('same manifest twice',digest(c['initialManifest']),'ALREADY_IMPORTED_NO_CREDIT'),
                              ('same ID different content','bad','MANIFEST_ID_CONFLICT')]:
        x=copy.deepcopy(ctx);x['imports'][c['initialManifest']['manifestId']]=value;expect(name,x,'IMPORT_CHECK',reason)
    x=copy.deepcopy(ctx);x['retiredLotIds']=[c['initialManifest']['lots'][0]['lotId']]
    expect('spent lot cannot reappear',x,'IMPORT_CHECK','LOT_ID_ALREADY_USED')
    ctx.update(paymentMode='PE',imports={c['initialManifest']['manifestId']:digest(c['initialManifest'])},materialRevision=1,
               available={'P':1,'E2:L':2},reserved={'P':0,'E2:L':0},ledgerHashMatchesCurrent=True,
               acceptedRecoveryCount=0,targetAlreadyRecovered=False,
               verifiedCommonEligibility={'snapshotSha256':ctx['gameSnapshotSha256'],'issues':[], 'allOriginalNonPaymentChecks':True})
    expect('conditional PE prerequisites only; no debit or recovery',ctx,'RECOVERY_CHECK')
    for name,field,value,reason in [
        ('RP choice stays separate','paymentMode','RP','RP_USE_UNCHANGED_RP_BRANCH_NOT_PE_SLICE'),
        ('mixed payment','alsoDebitRP',1,'MIXED_PAYMENT_OR_CALLER_QUOTE'),
        ('caller price','quotedPrice',{'P':0},'MIXED_PAYMENT_OR_CALLER_QUOTE'),
        ('missing common checks','verifiedCommonEligibility',None,'COMMON_ELIGIBILITY_FALSE_OR_UNKNOWN'),
        ('another RP recovery already counted','acceptedRecoveryCount',1,'SHARED_RECOVERY_LIMIT_OR_ALREADY_USED'),
        ('target recovered','targetAlreadyRecovered',True,'SHARED_RECOVERY_LIMIT_OR_ALREADY_USED'),
        ('no initial import','imports',{},'INITIAL_MATERIAL_NOT_IMPORTED_OR_STALE'),
        ('material spent','available',{'P':0,'E2:L':0},'INSUFFICIENT_OR_RESERVED_MATERIAL'),
        ('material reserved','reserved',{'P':1,'E2:L':0},'INSUFFICIENT_OR_RESERVED_MATERIAL'),
        ('stale material hash','ledgerHashMatchesCurrent',False,'STALE_MATERIAL_LEDGER')]:
        x=copy.deepcopy(ctx);x[field]=value;expect(name,x,'RECOVERY_CHECK',reason)
    x=copy.deepcopy(ctx);x['verifiedCommonEligibility']['issues']=['RECOVERY_BASE_TOO_FAR']
    expect('material does not waive base eligibility',x,'RECOVERY_CHECK','COMMON_ELIGIBILITY_FALSE_OR_UNKNOWN')
    for name, mutate, reason in [
        ('fake historical production',lambda x:x['initialManifest'].__setitem__('historicalReceiptClaim',True),'FALSE_HISTORICAL_OR_CONVERTED_MATERIAL'),
        ('SP conversion not an origin',lambda x:x['initialManifest'].__setitem__('originSourceId','G-A10'),'NO_SP_SOURCE_AS_MATERIAL_ORIGIN'),
        ('backdated E4 receipt refused',lambda x:x['initialManifest']['availability'].__setitem__('receivedEpoch',4),'INITIAL_IS_NOT_BACKDATED_DELIVERY'),
        ('duplicate lot in proposed list',lambda x:x['initialManifest']['lots'][1].__setitem__('lotId',x['initialManifest']['lots'][0]['lotId']),'DUPLICATE_OR_WRONG_LOT_SET'),
        ('RP debit and refund forbidden',lambda x:x['payment'].__setitem__('callOriginalRPApplyThenRefund',True),'EXCLUSIVE_PAYMENT_AND_SHARED_COUNT_REQUIRED')]:
        x=copy.deepcopy(c);mutate(x)
        try:
            review(x,fixed)
        except Reject as e:
            need(str(e)==reason,'CANDIDATE_NEGATIVE_WRONG_REASON:'+name)
        else:
            raise Reject('CANDIDATE_NEGATIVE_PASSED:'+name)
        rows.append({'name':name,'basis':'MUTATED_PROPOSAL_ONLY','result':{'rejected':reason,'mutationsToGame':0}})
    return rows


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config',type=Path,default=ROOT/'candidate.json')
    parser.add_argument('--self-test',action='store_true')
    parser.add_argument('--runtime-gate',action='store_true')
    args=parser.parse_args()
    fixed=load_fixed(); before=digest(fixed[2]); c=json.loads(args.config.read_bytes())
    result=review(c,fixed)
    result['boundaryChecks']=tests(c,fixed) if args.self_test else []
    need(before == digest(fixed[2]),'FIXED_BUNDLE_MUTATED')
    result.update(candidateSha256=hashlib.sha256(args.config.read_bytes()).hexdigest(),candidateValueDigest=digest(c),
                  manifestValueDigest=digest(c['initialManifest']),validatorSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                  fixedBundleUnchanged=True,notProven=['actual grant validity','new PE Core/effect seam','atomic material commit',
                  'importer persistence/idempotency','new runtime legality; boundary tests assume given eligibility receipts'])
    print(json.dumps(result,ensure_ascii=False,indent=2))
    return 2 if args.runtime_gate else 0


if __name__=='__main__':
    try:
        sys.exit(main())
    except (Reject,KeyError,TypeError,ValueError) as e:
        print(json.dumps({'reviewStatus':'REJECT','error':str(e)},ensure_ascii=False))
        sys.exit(1)

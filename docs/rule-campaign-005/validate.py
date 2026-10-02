"""Read-only proposal checks; no solver, transportation, recovery or game execution.
Boundary examples use synthetic E5 certificates, NEVER evidence of real E5 spare capacity.
007's approval cannot authorize this candidate. All returned plans remain non-executable.
"""
import argparse
import copy
import gzip
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parent


def read(name): return json.loads((ROOT/name).read_bytes())
def digest(obj): return hashlib.sha256(json.dumps(obj,sort_keys=True,separators=(',',':')).encode()).hexdigest()


class Rejected(ValueError): pass


def need(condition, reason):
    if not condition: raise Rejected(reason)


def natural(x): return type(x) is int and x >= 0


def fixed():
    manifest=read('SOURCES.json'); raw={}
    for r in manifest['inputs']:
        need(r['commit']==manifest['refs'][r['ref']],'SOURCE_REF_MISMATCH')
        b=subprocess.check_output(['git','show',r['commit']+':'+r['path']],cwd=ROOT)
        need(hashlib.sha256(b).hexdigest()==r['sha256'],'SOURCE_HASH_MISMATCH:'+r['path']);raw[r['path']]=b
    bundle=json.loads(gzip.decompress(raw['docs/campaign-004/CHECKPOINTS.json.gz']))['german_recovery_T5']
    return manifest,raw,bundle


def inspect(c, inputs):
    manifest,raw,b=inputs; s=b['logistics']; facts=read('T5_FACTS.json')
    need(c['refs']==manifest['refs'],'REFS_CHANGED')
    need(c['runtimeEnabled'] is False and c['status']=='LEADER_REVIEW_REQUIRED','NO_RUNTIME_APPROVAL')
    need(c['approval']=={'decisionRef':None,'candidateSha256':None,'transportGrantRef':None,
                         'T6RecoveryGrantRef':None,'inherit004or007Approval':False},'NEW_SCOPE_REQUIRES_NEW_APPROVAL')
    old=json.loads(raw['docs/rule-campaign-004/candidate.json'])
    need(c['checkpoint']==facts['checkpoint']==old['checkpoint'],'CHECKPOINT_CHANGED')
    need(hashlib.sha256(json.dumps(b,ensure_ascii=False).encode()).hexdigest()==c['checkpoint']['serializedSnapshotSha256'],
         'FIXED_BUNDLE_HASH')
    need((b['revision'],b['core']['turn'],s['tick'],s['epoch'])==(109,5,4,'L4'),'FIXED_CLOCK_MISMATCH')
    need(facts['completedEpochs']==list(s['done']) and 'L4' not in s['done'],'E5_NOT_YET_SETTLED')
    need(facts['E5JointPlanExists'] is False and facts['historicalLedgerIsNotE5Capacity'] is True,'FALSE_CURRENT_CAPACITY_CLAIM')
    nodes={n['nodeId']:n for n in json.loads(raw['docs/rule-campaign-003/inputs/MAP_NODES.json'])['nodes']}
    need(c['route']['nodes']==['A10','B10','C10'] and c['route']['coreKeys']==[nodes[k]['key'] for k in c['route']['nodes']],
         'ROUTE_CORE_PROJECTION')
    need(c['route']['edges']==['A10~B10','B10~C10'] and c['route']['coreEdges']==['0,9|1,9','1,9|2,8'], 'ROUTE_EDGE_BINDING')
    edges=[next(e for e in s['edges'] if e['id']==eid) for eid in c['route']['edges']]
    need(facts['edges']==edges and all(e['rail_cost']==1 and e['cap']==40 and e['bridge_cap'] is None
         and e['bridge'] is None and e['cut'] is False and e['core_railway']=={'present':True,'repairedBy':'GERMAN','destroyed':False} for e in edges),
         'FIXED_PATH_NOT_SUPPORTED')
    need(facts['mapNodes']==[nodes[k] for k in c['route']['nodes']]
         and facts['currentRouteNodes']==[next(n for n in s['nodes'] if n['id']==k) for k in c['route']['nodes']], 'PATH_FACTS_DRIFT')
    hub=next(h for h in s['hubs'] if h['id']=='GH2')
    need(facts['GH2']==hub and facts['sources']==s['sources'] and s['clock']=='full' and s['use_t'] is True,'FIXED_BUDGET_FACTS')
    need(c['cargo']['rates']=={'P':4,'E2:L':2} and all(type(v) is int for v in c['cargo']['rates'].values()),'POSITIVE_PERSONNEL_AND_EQUIPMENT_LOAD_REQUIRED')
    need(c['cargo']['kit']=={'P':1,'E2:L':2} and c['cargo']['kitLoadLQ']==8 and c['cargo']['partialShipment'] is False,'KIT_CHANGED')
    expected=[{'id':'rail:'+e['id'],'capAtT5':e['cap'],'perKit':8} for e in edges]
    expected += [{'id':'T','capAtT5':s['T'],'perKit':sum(e['rail_cost'] for e in edges)*8},
                 {'id':'W:GH2','capAtT5':hub['W'],'perKit':8}]
    need(c['capacity']['rows']==expected,'CAPACITY_VECTOR_NOT_REAL_ROWS')
    need(c['capacity']['historicalFlowAsResidual'] is False and c['capacity']['noNewCapacity'] is True,'FALSE_RESIDUAL_OR_NEW_CAPACITY')
    for kind,label in [('source','A10'),('receiver','C10')]:
        service=c['services'][kind]
        need(service['node']==label and service['coreKey']==nodes[label]['key'] and service['side']=='G'
             and service['capacity']=={'P':1,'E2:L':2},'SERVICE_BINDING_OR_CAPACITY')
    need(c['services']['homeSide'] is None and c['services']['nullControlPolicy']=='EXPLICIT_LOCAL_SERVICE_AND_ROUTE_GRANTS_KEEP_NULL',
         'NO_OWNER_INFERENCE')
    m=c['initialManifest']
    need(m['atService']==c['services']['source']['id'] and m['quantities']=={'P':1,'E2:L':2}
         and m['frontInitial']=={'P':0,'E2:L':0},'REAR_ONLY_NO_DOUBLE_ENDOWMENT')
    need(m['origin']=='NEW_EXPERIMENT_INITIAL_CONDITION_NOT_PRODUCTION' and not m['SPorRPConversion']
         and m['productionReceiptId'] is None and m['transportReceiptId'] is None,'NO_FAKE_MATERIAL_ORIGIN')
    need(m['forbiddenManifestIds']==['RC004-INITIAL-T5-C10-001'] and len(set(m['lotIds'].values()))==2,'MANIFEST_ISOLATION')
    need(c['scope']['dispatchBoundary']=='E5' and c['scope']['logisticsEpoch']=='L4' and c['scope']['recoveryTurn']==6
         and c['scope']['recoveryPhase']=='GERMAN_RECOVERY' and c['scope']['recoveryUnitId']=='G-I-01','NEW_SCOPE_CLOCK')
    need(c['recovery']['arrivalEpoch']==5 and c['recovery']['availableFromTurn']==6
         and c['recovery']['newGrantRequired'] is True and c['recovery']['004ApprovalReusable'] is False
         and c['recovery']['007ExpiryRuleReusable'] is False,'NO_E4_OR_T5_USE_OR_OLD_GRANT')
    need(c['maintenanceProtection']['policy']=='CONSERVATIVE_FREEZE_FULL_CURRENT_SP_PLAN_THEN_MATERIAL'
         and c['maintenanceProtection']['totalExistingTimeoutSeconds']==3
         and c['maintenanceProtection']['noExtraTimeoutPerStage'] is True,'SP_PROTECTION_OR_BUDGET_CHANGED')
    prior=json.loads(raw['docs/rule-campaign-003/VALIDATION.json'])['blockers']; table=c['blockerReview']
    need([r['blocker'] for r in table['rows']]==prior and len(prior)==35 and all(r['globalResolved'] is False for r in table['rows']),
         'BLOCKER_COVERAGE_OR_FALSE_CLOSE')
    need(sum(r['status']=='LOCAL_PROPOSAL_NOT_APPROVED' for r in table['rows'])==table['sliceProposals']==19
         and table['untouched']==16 and table['globalResolved']==0,'BLOCKER_COUNTS')
    need(c['preserved']=={'runtimeDecision':'REJECT','globalBlockersResolved':0,'germanSourceGapSP':9,'sovietSourceGapSP':14,
         'industrial22SPAdded':False,'SPSourceOrMaintenanceChanged':False,'productionOrdersEntryImplemented':False},'BASELINE_CHANGED')
    return {'reviewStatus':'VALID_CANDIDATE_ONLY','runtimeDecision':'REJECT','originalBlockers':35,
            'localProposalsPending':19,'untouched':16,'globallyResolved':0}


def certify_given(c,w):
    """Only arithmetic and identity checks on GIVEN certificates; not an optimizer or grant verifier.
    008 must establish full original feasibility/optimality, dynamic topology and trusted approval.
    This helper neither returns routes for runtime nor reserves any resource.
    """
    need(w['authorizationExperiment']==c['scope']['experimentId'],'NEW_TRANSPORT_GRANT_MISSING_OR_OLD_SCOPE')
    need(w['side']=='G' and w['receiverId']==c['services']['receiver']['id'],'WRONG_SIDE_OR_RECEIVER')
    if w['shipmentId'] in w['committed']:
        need(w['committed'][w['shipmentId']]==w['fingerprint'],'SHIPMENT_ID_CONFLICT')
        return {'result':'RECEIPT_REPLAY_ONLY','extraLoad':0,'extraMaterial':0,'executable':False}
    need(w['epoch']=='L4' and w['endingTurn']==5 and w['snapshotHash']==w['referenceSnapshotHash'],'WRONG_EPOCH_OR_SNAPSHOT')
    need(w['origin']=='CURRENT_BOUNDARY_CERTIFICATE' and w['exactVerified'] is True,'NO_CURRENT_EXACT_SP_CERTIFICATE')
    need(w['pathCurrentlyVerified'] is True,'DYNAMIC_PATH_NOT_VERIFIED')
    need(w['spAfter']==w['spReference'],'SP_REFERENCE_CHANGED')
    # Reconstruct the touched original rows from flow arcs; never take total historical flow as headroom.
    flows=w['spReference']['flows']; used={r['id']:0 for r in c['capacity']['rows']}
    for f in flows:
        need(natural(f['q']) and natural(f['cost']) and f['cost']>0,'INVALID_SP_ARC')
        if f['kind']=='rail':
            used['T']+=f['q']*f['cost']
            for eid in f['edges']:
                if 'rail:'+eid in used: used['rail:'+eid]+=f['q']
        elif f['kind']=='last' and f['hub']=='GH2': used['W:GH2']+=f['q']*f['cost']
    need(used==w['claimedSPUsage'],'SP_USAGE_NOT_DERIVED_FROM_ARCS')
    for unit in w['maintenance']:
        need(all(natural(unit[k]) for k in ('B','stockBefore','delivery','paid','net')),'INVALID_MAINTENANCE_UNITS')
        paid=min(unit['B'],unit['stockBefore']+unit['delivery'])
        need(unit['paid']==paid and unit['net']==max(0,paid-min(unit['B'],unit['stockBefore'])),'NET_MAINTENANCE_MISMATCH')
    if 'L4' in w['completedEpochs']: raise Rejected('EPOCH_ALREADY_COMMITTED')
    needs={r['id']:r['perKit'] for r in c['capacity']['rows']};remaining={}
    for r in c['capacity']['rows']:
        k=r['id']; cap=w['caps'][k]
        need(cap==r['capAtT5'],'CAP_OR_PROFILE_CHANGED_REVIEW_REQUIRED')
        h=w['otherHolds'][k]; committed=w['committedUsage'][k]
        need(natural(h) and natural(committed),'NEGATIVE_OR_NONINTEGER_HOLD')
        remaining[k]=cap-used[k]-h-committed
        need(remaining[k]>=0,'EXISTING_CAPACITY_OVERBOOKED')
    need(w['frontInitial']=={'P':0,'E2:L':0},'DOUBLE_FRONT_ENDOWMENT')
    need(w['sourceAvailable']=={'P':1,'E2:L':2} and w['receiverFree']=={'P':1,'E2:L':2},'MATERIAL_OR_RECEIVER_SPACE_UNAVAILABLE')
    fits=all(remaining[k]>=needs[k] for k in needs)
    return {'result':'CONDITIONAL_ONE_KIT' if fits else 'DEFERRED_ZERO_CARGO_SP_PLAN_PRESERVED',
            'reconstructedSPUsage':used,'remaining':remaining,'conditionalLoad':needs if fits else {k:0 for k in needs},'executable':False}


def custody_check(initial, buckets):
    # Buckets are mutually exclusive: reserved is a source status, AVAILABLE is a receiver status.
    need(set(buckets)=={'source','inTransit','receiver','spent','quarantined'},'NONEXCLUSIVE_CUSTODY_BUCKETS')
    for resource,amount in initial.items():
        need(all(natural(row[resource]) for row in buckets.values()),'BAD_CUSTODY_QUANTITY')
        need(sum(row[resource] for row in buckets.values())==amount,'MATERIAL_DUPLICATED_OR_LOST:'+resource)


def available_check(receipt, turn, phase, real_core_eligible):
    need(receipt['arrivalEpoch']==5 and receipt['availableFromTurn']==6,'BACKDATED_OR_EARLY_RECEIPT')
    need(turn==6 and phase=='GERMAN_RECOVERY','NOT_T6_RECOVERY_WINDOW')
    need(real_core_eligible is True,'CORE_ELIGIBILITY_FALSE_OR_UNKNOWN')


def release_check(before, after, owned_hold, committed=False):
    need(not committed,'COMMITTED_USE_CANNOT_BE_RELEASED')
    need(before['used']==after['used'],'RELEASE_CHANGED_CONSUMED_CAPACITY')
    need(set(before['holds'])==set(after['holds'])==set(owned_hold),'RELEASE_ROWS_INCOMPLETE')
    need(all(natural(owned_hold[k]) and natural(after['holds'][k])
             and before['holds'][k]-owned_hold[k]==after['holds'][k] for k in owned_hold),
         'RELEASE_WRONG_HOLD_OR_TWICE')


def self_test(c,inputs):
    rows=[]
    def run(name,fn,reason=None):
        try: output=fn()
        except Rejected as e:
            need(str(e)==reason,'UNEXPECTED_TEST_REJECTION:'+name+':'+str(e));output={'rejected':str(e)}
        else: need(reason is None,'NEGATIVE_ACCEPTED:'+name)
        rows.append({'name':name,'basis':'SYNTHETIC_BOUNDARY_ARITHMETIC_NOT_ACTUAL_E5','result':output or 'PASS'})
    ids=[r['id'] for r in c['capacity']['rows']]; zeros=dict.fromkeys(ids,0)
    # Illustrative 32 LQ per rail: this is NOT the T5/E4 ledger and NOT a solved E5 plan.
    sp={'flows':[{'kind':'rail','edges':['A10~B10'],'q':32,'cost':1},
                 {'kind':'rail','edges':['B10~C10'],'q':32,'cost':1},
                 {'kind':'last','hub':'GH2','edges':[],'q':32,'cost':1}],
        'deliveries':{'SYNTHETIC_UNIT':32},'hubs':{'GH2':0},'source_used':{'G-A10':32}}
    w={'authorizationExperiment':c['scope']['experimentId'],'side':'G','receiverId':c['services']['receiver']['id'],
       'epoch':'L4','endingTurn':5,'snapshotHash':'SYNTHETIC_CURRENT_E5','referenceSnapshotHash':'SYNTHETIC_CURRENT_E5',
       'origin':'CURRENT_BOUNDARY_CERTIFICATE','exactVerified':True,'pathCurrentlyVerified':True,'spReference':sp,'spAfter':copy.deepcopy(sp),
       'claimedSPUsage':dict(zip(ids,[32,32,64,32])),'caps':{r['id']:r['capAtT5'] for r in c['capacity']['rows']},
       'otherHolds':dict(zeros),'committedUsage':dict(zeros),'completedEpochs':[], 'shipmentId':'SYNTHETIC-SHIP-1',
       'committed':{},'fingerprint':'SYNTHETIC-REQUEST-HASH','sourceAvailable':{'P':1,'E2:L':2},
       'frontInitial':{'P':0,'E2:L':0},'receiverFree':{'P':1,'E2:L':2},
       'maintenance':[{'B':4,'stockBefore':3,'delivery':1,'paid':4,'net':1}]}
    untouched=copy.deepcopy(w)
    run('exactly 8 residual fits kit; personnel costs 4, equipment costs 4',lambda:certify_given(c,w))
    need(w==untouched,'CERTIFICATE_INPUT_MUTATED')
    for field,value,reason in [('authorizationExperiment','RC004-T5-C10-G-I-01-PE-ONCE','NEW_TRANSPORT_GRANT_MISSING_OR_OLD_SCOPE'),
        ('authorizationExperiment',None,'NEW_TRANSPORT_GRANT_MISSING_OR_OLD_SCOPE'),('side','S','WRONG_SIDE_OR_RECEIVER'),
        ('epoch','L3','WRONG_EPOCH_OR_SNAPSHOT'),('snapshotHash','old','WRONG_EPOCH_OR_SNAPSHOT'),
        ('origin','HISTORICAL_LEDGER','NO_CURRENT_EXACT_SP_CERTIFICATE'),('exactVerified',False,'NO_CURRENT_EXACT_SP_CERTIFICATE'),
        ('pathCurrentlyVerified',False,'DYNAMIC_PATH_NOT_VERIFIED'),('frontInitial',{'P':1,'E2:L':2},'DOUBLE_FRONT_ENDOWMENT')]:
        x=copy.deepcopy(w);x[field]=value;run(field+' invalid',lambda x=x:certify_given(c,x),reason)
    x=copy.deepcopy(w);x['spAfter']['deliveries']['SYNTHETIC_UNIT']=31
    run('material cannot displace SP reference',lambda:certify_given(c,x),'SP_REFERENCE_CHANGED')
    x=copy.deepcopy(w);x['claimedSPUsage']['rail:A10~B10']=0
    run('historical total cannot stand in for actual row use',lambda:certify_given(c,x),'SP_USAGE_NOT_DERIVED_FROM_ARCS')
    x=copy.deepcopy(w);x['maintenance'][0]['net']=4
    run('stock-funded maintenance is not net delivery',lambda:certify_given(c,x),'NET_MAINTENANCE_MISMATCH')
    for key,amount in [('rail:A10~B10',1),('rail:B10~C10',8),('T',2121),('W:GH2',57)]:
        x=copy.deepcopy(w);x['otherHolds'][key]=amount
        out=certify_given(c,x);need(out['result']=='DEFERRED_ZERO_CARGO_SP_PLAN_PRESERVED','ZERO_CAPACITY_NOT_DEFERRED')
        run('binding row '+key+' leaves no complete kit',lambda out=out:out)
    x=copy.deepcopy(w);x['otherHolds']['rail:A10~B10']=9
    run('preexisting overbook refused',lambda:certify_given(c,x),'EXISTING_CAPACITY_OVERBOOKED')
    x=copy.deepcopy(w);x['committed'][x['shipmentId']]=x['fingerprint'];x['completedEpochs']=['L4']
    run('duplicate committed shipment replays no cargo/no capacity',lambda:certify_given(c,x))
    late=copy.deepcopy(x);late['snapshotHash']='SYNTHETIC_NEWER_T6';late['epoch']='L5'
    run('late committed retry returns receipt without reinstalling old state',lambda:certify_given(c,late))
    x=copy.deepcopy(x);x['fingerprint']='different'
    run('same shipment ID different content',lambda:certify_given(c,x),'SHIPMENT_ID_CONFLICT')
    x=copy.deepcopy(w);x['completedEpochs']=['L4']
    run('second shipment cannot reuse committed E5',lambda:certify_given(c,x),'EPOCH_ALREADY_COMMITTED')
    own={r['id']:r['perKit'] for r in c['capacity']['rows']}
    before={'used':dict(zeros),'holds':{k:v+1 for k,v in own.items()}}
    after={'used':dict(zeros),'holds':dict.fromkeys(ids,1)}
    run('failed private dispatch releases only own holds',lambda:release_check(before,after,own))
    run('second release rejected',lambda:release_check(after,after,own),'RELEASE_WRONG_HOLD_OR_TWICE')
    run('lost receipt is not cancellation of consumed use',lambda:release_check(before,after,own,True),'COMMITTED_USE_CANNOT_BE_RELEASED')
    initial={'P':1,'E2:L':2}; empty={'P':0,'E2:L':0}
    for owner in ['source','inTransit','receiver','spent','quarantined']:
        buckets={k:dict(empty) for k in ['source','inTransit','receiver','spent','quarantined']};buckets[owner]=dict(initial)
        run('single custody '+owner,lambda b=buckets:custody_check(initial,b))
    buckets={k:dict(empty) for k in ['source','inTransit','receiver','spent','quarantined']};buckets['source']=dict(initial);buckets['receiver']=dict(initial)
    run('duplicate arrival or failed source debit',lambda:custody_check(initial,buckets),'MATERIAL_DUPLICATED_OR_LOST:P')
    receipt={'arrivalEpoch':5,'availableFromTurn':6}
    run('T5 use rejected',lambda:available_check(receipt,5,'GERMAN_RECOVERY',True),'NOT_T6_RECOVERY_WINDOW')
    run('T6 wrong phase rejected',lambda:available_check(receipt,6,'GERMAN_MOVEMENT',True),'NOT_T6_RECOVERY_WINDOW')
    run('T6 still needs actual Core eligibility',lambda:available_check(receipt,6,'GERMAN_RECOVERY',False),'CORE_ELIGIBILITY_FALSE_OR_UNKNOWN')
    run('conditional T6 availability only',lambda:available_check(receipt,6,'GERMAN_RECOVERY',True))
    run('E4 invented receipt rejected',lambda:available_check({'arrivalEpoch':4,'availableFromTurn':5},6,'GERMAN_RECOVERY',True),'BACKDATED_OR_EARLY_RECEIPT')
    for name,mutate,reason in [('free personnel',lambda x:x['cargo']['rates'].__setitem__('P',0),'POSITIVE_PERSONNEL_AND_EQUIPMENT_LOAD_REQUIRED'),
        ('extra rail capacity',lambda x:x['capacity']['rows'][0].__setitem__('capAtT5',48),'CAPACITY_VECTOR_NOT_REAL_ROWS'),
        ('front gifted as well',lambda x:x['initialManifest'].__setitem__('frontInitial',{'P':1,'E2:L':2}),'REAR_ONLY_NO_DOUBLE_ENDOWMENT')]:
        x=copy.deepcopy(c);mutate(x);run(name,lambda x=x:inspect(x,inputs),reason)
    return rows


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config',type=Path,default=ROOT/'candidate.json')
    parser.add_argument('--self-test',action='store_true');parser.add_argument('--runtime-gate',action='store_true')
    a=parser.parse_args();inputs=fixed();c=json.loads(a.config.read_bytes());before=digest(inputs[2])
    result=inspect(c,inputs);result['checks']=self_test(c,inputs) if a.self_test else []
    need(digest(inputs[2])==before,'FIXED_GAME_CHANGED')
    result.update(candidateSha256=hashlib.sha256(a.config.read_bytes()).hexdigest(),validatorSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        actualE5CapacityVerified=False,actualCargoMoved=0,materialsImported=0,gameActionsExecuted=0,checkpointUnchanged=True,
        notProven=['real E5 spare capacity or solver feasibility','trusted new approval','transport/reservation atomicity and idempotency',
                   'T6 actual recovery eligibility','same-boundary 3-second performance','persistent or cross-process ownership'])
    print(json.dumps(result,ensure_ascii=False,indent=2));return 2 if a.runtime_gate else 0


if __name__=='__main__':
    try: sys.exit(main())
    except (Rejected,ValueError,TypeError,KeyError) as e:
        print(json.dumps({'reviewStatus':'REJECT','error':str(e)}));sys.exit(1)

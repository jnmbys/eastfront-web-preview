"""Single canonical A10 view; 012 P=0 remains historical, never added as live stock."""
from copy import deepcopy
from config import digest
from personnel import counts
def export_view(root,*,origin=None,error=None):
    before=digest(root);p=root['personnel'];x=p['package'];app=p['application'];c=counts(p);q=p['quota']
    reasons=[]
    if 'QUARANTINED' in c['state']:reasons.append('SCOPE_EXPIRED_NO_REACTIVATION')
    elif c['state'] in ['HELD','SOURCE_ESCROW']:
        blocked=next((e for e in reversed(p['journal']) if e['kind'] in ['E14_DISPATCH_BLOCKED','E15_HELD','E13_HELD']),None)
        if blocked:
            d=blocked['details'];reasons.extend(d.get('eligibility',d).get('issues',[]))
            if d.get('usedLQ',0)+d.get('otherHoldsLQ',0)+d.get('requiredLQ',0)>4:reasons.append('TOTAL_PERSONNEL_QUOTA_EXHAUSTED')
            if d.get('residentP',0)+d.get('incomingP',0)+1>1:reasons.append('PERSONNEL_WAREHOUSE_FULL')
    result=dict(schema='industry-013-personnel-view.v1',readOnly=True,
        origin=origin or ('SYNTHETIC_NONMERGEABLE' if root['continuation']['syntheticNonmergeable'] else 'REAL'),
        rootRevision=root['revision'],gameRevision=root['bundle']['revision'],turn=root['bundle']['core']['turn'],phase=root['bundle']['core']['phase'],
        source=dict(kind='SCENARIO_INITIAL_TRAINED_RESERVE_ASSUMPTION',actualTrainingReceipt=None,imported=bool(p['importReceipt']),ids=deepcopy(p['ids'])),
        personnelBudget=deepcopy(p['account']),equipment012Budget=deepcopy(root['industry']['budget']),
        applicationStatus=app['status'] if app else 'NOT_APPLIED',custody={**c,'owner':x['owner'] if x else None},
        warehouse=dict(id='RC007-REAR-G-A10',node='A10',coreKey='0,9',capacityP=1,residentP=c['rearP'],availableP=c['availableRearP'],
            incomingHeldP=sum(p['incomingP'].values()),quarantinedResidentP=c['rearP'] if 'QUARANTINED' in c['state'] else 0,
            capacityE2=2,residentE2=root['industry']['warehouse']['resident'],personnelAuthority='personnel.package',historical012PIsNotCurrentStock=True),
        service=dict(quotaLQ=4,usedLQ=sum(q['used'].values()),heldLQ=sum(q['holds'].values()),remainingLQ=4-sum(q['used'].values())-sum(q['holds'].values()),renews=False,
            independentOfSPAnd012=True,dispatchEpochs=[7,8],lastReceiveEpoch=9),
        receivedEpoch=x['receivedEpoch'] if x else None,availableFromTurn=x['availableFromTurn'] if x else None,
        careEndsAfterEpoch=x['receivedEpoch']+1 if x and x['receivedEpoch'] is not None else None,
        blockingReasons=reasons,lastRequestError=deepcopy(error),forwardTransportRecoveryFormationAllowed=False,globalBlockersRetained=35,globalBlockersClosed=0)
    assert digest(root)==before
    return result

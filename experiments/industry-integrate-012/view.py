"""Read-only projection: no authorization, writes, imports or inventory setters."""
from copy import deepcopy
from config import digest

def export_view(root,*,origin='REAL',last_error=None):
    before=digest(root);i=root['industry'];b=i['budget'];o=i['order'];batch=i['batch'];c=root['bundle']['core']
    produced=batch['quantityE2'] if batch else 0;custody=batch['custody'] if batch else 'NOT_CREATED'
    blocking=[e for e in i['journal'] if e['kind'] in ['E14_DISPATCH_BLOCKED','E13_HELD','E15_HELD']]
    unresolved=blocking[-1] if blocking and custody in ['PRODUCTION_STORE','HELD'] else None
    reasons=[]
    if unresolved:
        reasons+=unresolved.get('eligibility',{}).get('issues',[])
        if unresolved['kind']=='E14_DISPATCH_BLOCKED':
            if unresolved['usedByAllCommittedTraffic']+unresolved['holdsByOtherRequests']+unresolved['requiredWork']>unresolved['finiteCap']:reasons.append('EXTERNAL_CAPACITY_INSUFFICIENT')
            if unresolved['freeWarehouseE2']<2:reasons.append('WAREHOUSE_CAPACITY_INSUFFICIENT')
    if custody in ['PRODUCTION_STORE','HELD'] and c['turn']>6:reasons.append('SERVICE_WINDOW_EXPIRED_NO_AUTOMATIC_RETRY')
    result=dict(schema='industry-012-view.v1',origin=origin,readOnly=True,rootRevision=root['revision'],gameRevision=root['bundle']['revision'],industryRevision=i['revision'],
        turn=c['turn'],phase=c['phase'],budget=dict(availableI=b['freeI'],escrowI=b['escrow'],productionPaidI=b['productionSpent'],handoffPaidI=b['handoffSpent'],grantedI=b['granted']),
        order=None if not o else dict(id=o['id'],status='AVAILABLE' if custody=='REAR_AVAILABLE' else 'HELD' if custody=='HELD' else 'WAITING_HANDOFF' if custody=='PRODUCTION_STORE' else o['status'],
            workCompleted=len(o['workEpochs']),workRequired=2,workEpochs=deepcopy(o['workEpochs']),expectedCompletionEpoch=o['acceptedTurn']+1,
            expectedCompletionIsConditional=True,completedEpoch=next((e['completedEpoch'] for e in i['journal'] if e['kind']=='E12_INDUSTRIAL_OUTPUT'),None)),
        equipment=dict(materialType='E2:L',producedE2=produced,productionStoreE2=produced if custody=='PRODUCTION_STORE' else 0,
            inTransitOrHeldE2=produced if custody in ['IN_TRANSIT','HELD'] else 0,rearE2=i['warehouse']['resident'],
            availableRearE2=i['warehouse']['resident'] if custody=='REAR_AVAILABLE' and c['turn']>=batch['availableFromTurn'] else 0,
            P=i['warehouse']['P'],productionReservedE2=i['productionHold'],incomingReservedE2=sum(i['warehouse']['incoming'].values()),custody=custody),
        arrival=None if not batch else dict(batchId=batch['id'],shipmentId=batch['shipmentId'],receivedEpoch=batch['receivedEpoch'],availableFromTurn=batch['availableFromTurn'],
            receiptId=batch['receiptId'] if batch['receivedEpoch'] is not None else None),
        externalCapacity=[dict(resourceId=r['resourceId'],epoch=r['epoch'],cap=r['finiteCap'],usedByAllCommittedTraffic=sum(r['used'].values()),
            reserved=sum(r['holds'].values()),remaining=r['finiteCap']-sum(r['used'].values())-sum(r['holds'].values()),
            epochClosed=r['epoch'] in i['epochs'],carryForward=False,independentOfSP=True) for r in i['external'].values()],
        blockingReasons=reasons,lastRequestError=deepcopy(last_error),globalBlockersRetained=35,globalBlockersClosed=0)
    assert digest(root)==before
    return result

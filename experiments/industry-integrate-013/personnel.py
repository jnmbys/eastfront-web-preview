"""Unique package custody; no second P inventory balance or training receipt."""
from copy import deepcopy
from config import digest,START_SHA

SOURCE='RC008-G-TRAINED-RESERVE';REAR='RC007-REAR-G-A10'
def initial(match,launch):
    prefix=launch['approval']['decisionRef']+'/'+match+'/G/personnel'
    ids=dict(sourceGrantId=prefix+'/source-0001',budgetGrantId=prefix+'/budget-0001',packageId=prefix+'/source-0001/P-0001',
        applicationId=prefix+'/source-0001/application-0001')
    ids['batchId']=ids['applicationId']+'/batch-0001';ids['shipmentId']=ids['batchId']+'/to-A10-0001';ids['receiptId']=ids['shipmentId']+'/received'
    return dict(revision=0,matchId=match,ids=ids,importReceipt=None,application=None,applicationReceipt=None,package=None,
        account=dict(id='RC008-G-PERSONNEL-SERVICE-I',grantedI=0,availableI=0,acceptanceCareSpentI=0,escrowI=0,carriageSpentI=0),
        quota=dict(id='RC008-OFFMAP-RESERVE-TO-A10',capLQ=4,used={},holds={},renews=False),incomingP={},epochs=[],events={},journal=[])
def event(p,kind,epoch,details):
    key=p['ids']['packageId']+'/'+kind+'/'+str(epoch);assert key not in p['events'],'DUPLICATE_PERSONNEL_EVENT'
    row=dict(id=key,kind=kind,epoch=epoch,details=deepcopy(details));p['events'][key]=row;p['journal'].append(row);return key
def counts(p):
    x=p['package'];state=x['custody'] if x else 'NOT_IMPORTED';q=x['quantityP'] if x else 0
    return dict(sourceP=q if x and x['owner']==SOURCE else 0,transitP=q if x and x['owner']==p['ids']['shipmentId'] else 0,
        rearP=q if x and x['owner']==REAR else 0,availableRearP=q if state=='REAR_AVAILABLE' else 0,
        quarantinedP=q if 'QUARANTINED' in state else 0,state=state)
def audit(p):
    b=p['account'];vals=[b[k] for k in ['grantedI','availableI','acceptanceCareSpentI','escrowI','carriageSpentI']]
    assert all(type(v) is int and v>=0 for v in vals)
    assert b['grantedI'] in [0,2] and b['grantedI']==sum(vals[1:])
    q=p['quota'];assert q['capLQ']==4 and q['renews'] is False
    assert all(type(v) is int and v>=0 for v in [*q['used'].values(),*q['holds'].values(),*p['incomingP'].values()])
    assert sum(q['used'].values())+sum(q['holds'].values())<=4
    c=counts(p);assert c['sourceP']+c['transitP']+c['rearP']==(1 if p['importReceipt'] else 0)
    assert c['rearP']+sum(p['incomingP'].values())<=1
    if p['package']:
        x=p['package'];assert x['quantityP']==1 and x['id']==p['ids']['packageId']
        if x['custody'] in ['IN_TRANSIT','HELD']:assert p['incomingP'].get(p['ids']['shipmentId'])==1
        if 'QUARANTINED' in x['custody']:assert not p['incomingP']
    return dict(custody=c,budget=deepcopy(b),quotaUsedLQ=sum(q['used'].values()),quotaHeldLQ=sum(q['holds'].values()))
def activate(p,registry,launch):
    assert not p['importReceipt'] and p['package'] is None
    ids=p['ids'];assert ids['sourceGrantId'] not in registry and ids['budgetGrantId'] not in registry
    receipt=dict(ids=deepcopy(ids),matchId=p['matchId'],side='G',P=1,personnelI=2,accountId=p['account']['id'],
        contractHash=launch['contractHash'],approvalHash=launch['approvalHash'],sourceSnapshotHash=START_SHA,
        sourceKind='SCENARIO_INITIAL_TRAINED_RESERVE_ASSUMPTION',actualTrainingReceipt=None)
    registry[ids['sourceGrantId']]=dict(kind='PERSONNEL_INITIAL_POOL',receipt=deepcopy(receipt))
    registry[ids['budgetGrantId']]=dict(kind='SEPARATE_PERSONNEL_I',receipt=deepcopy(receipt))
    p['importReceipt']=receipt;p['account'].update(grantedI=2,availableI=2)
    p['package']=dict(id=ids['packageId'],quantityP=1,owner=SOURCE,custody='SOURCE_AVAILABLE',receivedEpoch=None,availableFromTurn=None)
    p['revision']+=1;event(p,'SOURCE_AND_BUDGET_ACTIVATED','T7',receipt);audit(p)
def accept(p,launch):
    assert p['importReceipt'] and p['application'] is None and p['package']['custody']=='SOURCE_AVAILABLE'
    assert p['account']['availableI']==2
    p['account']['availableI']-=2;p['account']['acceptanceCareSpentI']+=1;p['account']['escrowI']+=1
    p['package']['custody']='SOURCE_ESCROW'
    fingerprint=dict(side='G',quantityP=1,packageId=p['ids']['packageId'],poolId=SOURCE,warehouseId=REAR,nodeId='A10',coreKey='0,9',
        budgetAccountId=p['account']['id'],feeI=2,loadLQ=4,quotaId=p['quota']['id'],window=dict(acceptT=7,dispatchE=[7,8],lastReceiveE=9),
        profileHash=launch['approval']['profileHash'],sourceSnapshotHash=START_SHA,trainingAssumptionGrantHash=launch['approvalHash'])
    p['application']=dict(id=p['ids']['applicationId'],fingerprint=fingerprint,fingerprintHash=digest(fingerprint),status='ACCEPTED',acceptedTurn=7)
    p['applicationReceipt']=deepcopy(p['application'])
    p['revision']+=1;event(p,'ACCEPTED_CARE_PAID_AND_ESCROW','T7',p['application']);audit(p)

def housekeeping(p,epoch,terminal=False):
    """Post-E15 bounded care/expiry. Synthetic tests may call this pure reducer explicitly."""
    x=p['package']
    if not x or 'QUARANTINED' in x['custody']:return
    why=None;state=x['custody']
    if x['owner']==SOURCE and (terminal or epoch>=8):
        refund=p['account']['escrowI'];p['account']['availableI']+=refund;p['account']['escrowI']=0
        x['custody']='SOURCE_QUARANTINED';why=dict(reason='UNSENT_OR_UNACCEPTED_SCOPE_END',refundToSameAccountI=refund)
    elif x['owner']==p['ids']['shipmentId'] and (terminal or epoch>=9):
        x['custody']='TRANSIT_QUARANTINED';p['incomingP'].pop(p['ids']['shipmentId'],None)
        why=dict(reason='TRANSIT_DEADLINE',refundI=0)
    elif x['owner']==REAR and (terminal or epoch==24 or epoch>=x['receivedEpoch']+1):
        x['custody']='TERMINAL_QUARANTINED' if epoch==24 or terminal else 'REAR_QUARANTINED'
        why=dict(reason='FIRST_USABLE_T_ENDED_OR_TERMINAL',stillOccupiesCapacityP=1,refundI=0)
    if why:
        if p['application']:p['application']['status']='EXPIRED'
        p['revision']+=1;event(p,'SCOPE_QUARANTINE',epoch,dict(before=state,after=x['custody'],earlyGameOver=terminal,**why))
    audit(p)

def boundary(p,epoch,bundle,qualify,fault):
    assert epoch not in p['epochs'];assert bundle['core']['turn']==epoch+1
    p['epochs'].append(epoch);p['revision']+=1;event(p,'BOUNDARY_OBSERVED',epoch,dict(gameRevision=bundle['revision']))
    x=p['package'];app=p['application'];sid=p['ids']['shipmentId'];quota=p['quota']
    def receive(stage):
        proof=qualify(bundle,epoch,'receipt')
        if not proof['eligible']:
            x['custody']='HELD';app['status']='HELD';event(p,stage+'_HELD',epoch,proof);return
        assert p['incomingP'].get(sid)==1 and counts(p)['rearP']+sum(p['incomingP'].values())<=1
        del p['incomingP'][sid]
        x.update(owner=REAR,custody='REAR_UNAVAILABLE',receivedEpoch=epoch,availableFromTurn=epoch+1)
        app['status']='RECEIVED'
        event(p,stage+'_RECEIVED',epoch,dict(receiptId=p['ids']['receiptId'],shipmentId=sid,quantityP=1,receivedEpoch=epoch,
            availableFromTurn=epoch+1,eligibility=proof,paidCarriageI=p['account']['carriageSpentI']))
        fault('after_receipt')
    if x and app:
        if x['custody'] in ['HELD','IN_TRANSIT'] and x['dueEpoch']<=epoch<=9:receive('E13')
        if x['custody']=='SOURCE_ESCROW' and epoch in [7,8]:
            proof=qualify(bundle,epoch,'dispatch');used=sum(quota['used'].values());holds=sum(quota['holds'].values())
            if not proof['eligible'] or used+holds+4>4 or counts(p)['rearP']+sum(p['incomingP'].values())+1>1:
                event(p,'E14_DISPATCH_BLOCKED',epoch,dict(eligibility=proof,usedLQ=used,otherHoldsLQ=holds,requiredLQ=4,
                    residentP=counts(p)['rearP'],incomingP=sum(p['incomingP'].values())))
            else:
                assert sid not in quota['used'] and sid not in quota['holds']
                quota['holds'][sid]=4;p['incomingP'][sid]=1;fault('after_reserve')
                p['account']['escrowI']-=1;p['account']['carriageSpentI']+=1
                x.update(owner=sid,custody='IN_TRANSIT',dispatchEpoch=epoch,dueEpoch=epoch);app['status']='IN_TRANSIT'
                quota['used'][sid]=quota['holds'].pop(sid)
                event(p,'E14_DISPATCHED',epoch,dict(shipmentId=sid,quotaUsedLQ=4,carriageSpentI=1,eligibility=proof))
                fault('after_dispatch');receive('E15')
        if x['custody']=='REAR_UNAVAILABLE' and bundle['core']['turn']>=x['availableFromTurn']:
            x['custody']='REAR_AVAILABLE';app['status']='AVAILABLE'
            event(p,'NEXT_T_AVAILABLE',epoch,dict(availableFromTurn=x['availableFromTurn'],onwardAuthority=False))
    housekeeping(p,epoch,bundle['core']['phase']=='GAME_OVER');audit(p)

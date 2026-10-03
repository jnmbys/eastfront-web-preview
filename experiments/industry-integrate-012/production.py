"""Private industrial reducer; caller epochs never enter the transaction API."""
from copy import deepcopy
from config import digest

def initial(instance,launch):
    ns=launch['approval']['matchId']+'/'+launch['contractHash']+'/'+instance
    return dict(revision=0,namespace=ns,budget=dict(granted=0,freeI=0,productionSpent=0,handoffSpent=0,escrow=0),
        grants={},order=None,batch=None,productionHold=0,warehouse=dict(resident=0,incoming={},P=0),
        external={},epochs=[],events={},journal=[])

def event(i,entity,kind,epoch,data):
    key=i['namespace']+'/'+entity+'/'+kind+'/'+str(epoch)
    assert key not in i['events'],'DUPLICATE_EVENT'
    e=dict(id=key,kind=kind,epoch=epoch,**deepcopy(data));i['events'][key]=e;i['journal'].append(e)
    return key

def audit(i,p):
    b=i['budget'];assert all(type(v) is int and v>=0 for v in b.values())
    assert b['granted'] in [0,p['initialI']] and b['granted']==b['freeI']+b['productionSpent']+b['handoffSpent']+b['escrow']
    batch=i['batch'];produced=batch['quantityE2'] if batch else 0
    stored=produced if batch and batch['custody']=='PRODUCTION_STORE' else 0
    transit=produced if batch and batch['custody'] in ['IN_TRANSIT','HELD'] else 0
    rear=i['warehouse']['resident']
    assert produced==stored+transit+rear and produced in [0,2] and i['warehouse']['P']==0
    assert stored+i['productionHold']<=p['productionBufferE2']
    assert rear+sum(i['warehouse']['incoming'].values())<=p['warehouseE2']
    if rear:assert batch and batch['custody'] in ['REAR_UNAVAILABLE','REAR_AVAILABLE'] and batch['owner']=='RC007-REAR-G-A10'
    if transit:assert i['warehouse']['incoming']=={batch['shipmentId']:2} and batch['owner']==batch['shipmentId']
    if stored:assert batch['owner']=='RC007-OFFMAP-G'
    for row in i['external'].values():
        assert row['finiteCap']==4 and row['perE2Work']==2
        assert all(type(v) is int and v>=0 for v in [*row['used'].values(),*row['holds'].values()])
        assert sum(row['used'].values())+sum(row['holds'].values())<=row['finiteCap']
    if i['order']:
        assert len(set(i['order']['workEpochs']))==len(i['order']['workEpochs'])<=2
        assert b['productionSpent']==3 and b['escrow']+b['handoffSpent']==2
    return dict(producedE2=produced,productionStoreE2=stored,inTransitOrHeldE2=transit,rearE2=rear,P=0,I=deepcopy(b))

def grant(i,launch):
    assert not i['grants'] and not i['order']
    key=i['namespace']+'/G/budget/0001';p=launch['parameters']
    receipt=dict(id=key,side='G',amountI=p['initialI'],openingBalanceI=0,contractHash=launch['contractHash'],grantHash=launch['approvalHash'])
    i['grants'][key]=receipt;i['budget']['granted']=i['budget']['freeI']=p['initialI'];i['revision']+=1
    event(i,'budget','ONE_TIME_I_GRANT','T5',dict(grantReceipt=receipt))

def accept(i,launch,bundle_hash):
    assert i['grants'] and not i['order'],'ORDER_ALREADY_ACCEPTED_OR_UNFUNDED'
    p=launch['parameters'];cost=p['productionI'];fee=p['handoffI'];b=i['budget']
    assert i['productionHold']==0 and i['batch'] is None and p['outputE2']<=p['productionBufferE2']
    assert b['freeI']>=cost+fee
    oid=i['namespace']+'/G/production/0001';bid=oid+'/E2L/0001';sid=bid+'/to-A10/0001'
    fingerprint=dict(side='G',orderId=oid,batchId=bid,recipeHash=digest(dict(recipe='RC007-E2L-ONE-ORDER',parameters=p)),
        outputE2=2,productionCostI=cost,handoffFeeI=fee,workBoundaries=2,warehouseId='RC007-REAR-G-A10',nodeId='A10',coreKey='0,9',
        grantHashes=[launch['approvalHash']],startSnapshotHash=launch['approval']['startSnapshotSha256'],contractHash=launch['contractHash'])
    b['freeI']-=cost+fee;b['productionSpent']+=cost;b['escrow']+=fee;i['productionHold']=2
    paid=event(i,'order','ORDER_ACCEPTED_AND_PAID','T5',dict(fingerprint=fingerprint,inputSnapshotHash=bundle_hash,productionPaidI=3,feeEscrowI=2))
    i['order']=dict(id=oid,batchId=bid,shipmentId=sid,receiptId=sid+'/received',acceptedTurn=5,workEpochs=[],status='WORKING',
        fingerprint=fingerprint,fingerprintHash=digest(fingerprint),paidProductionReceiptId=paid,contingentFreightBound=True)
    i['revision']+=1

def boundary(i,launch,epoch,bundle,input_hash,qualify,fault):
    """Only owner calls this after a verified real Core/SP boundary. Tests label private fixtures."""
    p=launch['parameters'];assert epoch not in i['epochs'] and epoch in [5,6]
    assert bundle['core']['turn']==epoch+1 and bundle['core']['phase']=='GERMAN_SUPPLY_RAIL'
    i['epochs'].append(epoch);i['revision']+=1
    row=i['external'].setdefault(str(epoch),dict(resourceId='EXTERNAL_G_A10',unit='workPoint',side='G',epoch=epoch,finiteCap=4,perE2Work=2,
        used={},holds={},sharingPolicyRef='INDEPENDENT_OF_SP_RAIL_T_W',authorityRef=launch['approval']['decisionRef']))
    event(i,'boundary','E00_OPEN',epoch,dict(inputSnapshotHash=input_hash,providerOperational=epoch>=p['producerOperationalFromE'],row=deepcopy(row)))
    o=i['order']
    if o and len(o['workEpochs'])<p['workBoundaries'] and epoch>=max(o['acceptedTurn'],p['producerOperationalFromE']):
        o['workEpochs'].append(epoch)
        event(i,'order','E11_WORK',epoch,dict(orderId=o['id'],workEpochs=deepcopy(o['workEpochs'])))
        if len(o['workEpochs'])==p['workBoundaries']:
            assert i['batch'] is None and i['productionHold']==2
            i['productionHold']=0;o['status']='COMPLETED'
            receipt=dict(orderId=o['id'],batchId=o['batchId'],side='G',materialType='E2:L',quantityE2=2,
                recipeHash=o['fingerprint']['recipeHash'],paidProductionReceiptId=o['paidProductionReceiptId'],completedEpoch=epoch,
                workEpochs=deepcopy(o['workEpochs']),producerGrantHash=launch['approvalHash'],inputSnapshotHash=input_hash,contractHash=launch['contractHash'])
            rid=event(i,'batch','E12_INDUSTRIAL_OUTPUT',epoch,receipt)
            i['batch']=dict(id=o['batchId'],shipmentId=o['shipmentId'],receiptId=o['receiptId'],quantityE2=2,materialType='E2:L',
                custody='PRODUCTION_STORE',owner='RC007-OFFMAP-G',productionReceiptId=rid,receivedEpoch=None,availableFromTurn=None)
            fault('after_output')
    batch=i['batch']
    def receive(stage):
        proof=qualify(bundle,epoch,'receipt')
        if not proof['eligible']:
            batch['custody']='HELD';event(i,'shipment',stage+'_HELD',epoch,dict(shipmentId=batch['shipmentId'],eligibility=proof));return
        assert i['warehouse']['incoming'].get(batch['shipmentId'])==2
        assert i['warehouse']['resident']+sum(i['warehouse']['incoming'].values())<=2
        del i['warehouse']['incoming'][batch['shipmentId']];i['warehouse']['resident']+=2
        batch.update(custody='REAR_UNAVAILABLE',owner='RC007-REAR-G-A10',receivedEpoch=epoch,availableFromTurn=epoch+1)
        event(i,'shipment',stage+'_RECEIVED',epoch,dict(receiptId=batch['receiptId'],batchId=batch['id'],quantityE2=2,availableFromTurn=epoch+1,eligibility=proof))
        fault('after_receipt')
    if batch and batch['custody'] in ['IN_TRANSIT','HELD'] and batch['dueEpoch']<=epoch:receive('E13')
    if batch and batch['custody']=='PRODUCTION_STORE':
        proof=qualify(bundle,epoch,'dispatch');sid=batch['shipmentId'];needed=2*row['perE2Work']
        used=sum(row['used'].values());other=sum(v for k,v in row['holds'].items() if k!=sid)
        freeWarehouse=2-i['warehouse']['resident']-sum(i['warehouse']['incoming'].values())
        if not proof['eligible'] or used+other+needed>row['finiteCap'] or freeWarehouse<2:
            event(i,'shipment','E14_DISPATCH_BLOCKED',epoch,dict(eligibility=proof,usedByAllCommittedTraffic=used,holdsByOtherRequests=other,
                requiredWork=needed,finiteCap=row['finiteCap'],freeWarehouseE2=freeWarehouse,owner=batch['owner'],escrowI=i['budget']['escrow']))
        else:
            assert sid not in row['used'] and sid not in row['holds'] and not i['warehouse']['incoming']
            row['holds'][sid]=needed;i['warehouse']['incoming'][sid]=2
            fault('after_dispatch_reserve')
            i['budget']['escrow']-=2;i['budget']['handoffSpent']+=2
            batch.update(custody='IN_TRANSIT',owner=sid,dispatchEpoch=epoch,dueEpoch=epoch+p['latencyE']-1)
            row['used'][sid]=row['holds'].pop(sid)
            event(i,'shipment','E14_DISPATCH',epoch,dict(shipmentId=sid,feeSpentI=2,work=needed,row=deepcopy(row),eligibility=proof))
            fault('after_dispatch')
            if p['latencyE']==1:receive('E15')
    if batch and batch['custody']=='REAR_UNAVAILABLE' and bundle['core']['turn']>=batch['availableFromTurn']:
        batch['custody']='REAR_AVAILABLE'
        event(i,'batch','NEXT_T_AVAILABLE',epoch,dict(turn=bundle['core']['turn'],batchId=batch['id'],noForwardDispatch=True))
    audit(i,p)

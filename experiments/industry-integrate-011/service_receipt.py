"""Owner-held, target-bound paid service. Caller IDs never create receipts."""
from copy import deepcopy
from config import digest

def payload(root,event,approval_hash):
    return dict(serviceReceiptId='011-service:'+event['shipmentId'],shipmentId=event['shipmentId'],
        manifestDigest=event['manifestDigest'],lotIdsAndQuantities={i:root['materials']['lots'][i]['initialQuantity'] for i in event['lotIds']},
        targetUnit='G-I-01',side='G',nodeId='C10',coreKey='2,8',paidEpoch=5,availableFromTurn=6,
        WConstraintId='W:GH2',paidW=8,materialRevision=2,jointSnapshotHash=event['jointInputHash'],
        requestFingerprint=event['requestFingerprint'],instanceId=root['materials']['instanceId'],approvalHash=approval_hash)

def issue_private(root,approval_hash):
    assert not root['services'] and root['boundary']['ship']
    assert root['materials']['revision']==2 and root['capacity']['used']['W:GH2']==8
    events=[e for e in root['materials']['journal'] if e['event']=='E5_TRANSFER'];assert len(events)==1
    p=payload(root,events[0],approval_hash)
    root['services'][p['serviceReceiptId']]=dict(payload=p,payloadDigest=digest(p),status='PAID',consumedBy=None)
    return deepcopy(p)

def check(root,request,approval_hash):
    errors=[];rid=request.get('serviceReceiptId');receipt=root['services'].get(rid)
    if not receipt:return ['UNKNOWN_PAID_SERVICE_RECEIPT']
    events=[e for e in root['materials']['journal'] if e['event']=='E5_TRANSFER']
    if len(events)!=1:return ['MISSING_UNIQUE_ARRIVAL']
    expected=payload(root,events[0],approval_hash)
    if receipt['payload']!=expected or receipt['payloadDigest']!=digest(expected) or rid!=expected['serviceReceiptId']:errors.append('SERVICE_BINDING_MISMATCH')
    if receipt['status']!='PAID' or receipt['consumedBy'] is not None:errors.append('SERVICE_ALREADY_USED_OR_EXPIRED')
    if request['action'].get('unitId')!=expected['targetUnit']:errors.append('SERVICE_TARGET_MISMATCH')
    u=root['bundle']['core']['units'].get(request['action'].get('unitId'),{})
    if u.get('hex')!={'q':2,'r':8} or u.get('side')!='GERMAN':errors.append('SERVICE_HEX_OR_SIDE_MISMATCH')
    if root['capacity']['used'].get('W:GH2')!=8 or root['epoch']!='L4':errors.append('SERVICE_PAYMENT_MISSING')
    return errors

def consume_private(root,request,approval_hash):
    # Validate against the pre-consumption root; the adapter rechecks before execution.
    receipt=root['services'][request['serviceReceiptId']]
    assert receipt['status']=='PAID' and receipt['consumedBy'] is None
    assert receipt['payload']['approvalHash']==approval_hash
    receipt.update(status='CONSUMED',consumedBy=request['id'])

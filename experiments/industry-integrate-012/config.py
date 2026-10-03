"""Trusted local approval, never caller-supplied authority or prices."""
import hashlib,json
from pathlib import Path
HERE=Path(__file__).resolve().parent;OUT=HERE/'.runtime'
BASE6=OUT/'base6/experiments/industry-integrate-006/.runtime'
LIVE=BASE6/'live/experiments/supply-exp-005'
RULE='90758efccda736e3524348d8876b892be3d7938f'
CANDIDATE_SHA='41b0443a602599c8da167d4e36e840e77daffad6a5996fe05b219055031a327d'
START_SHA='db9f91bb6394928bc670a812107310b53b2626c01d5e2371731dd069ae87a980'
def sha(b):return hashlib.sha256(b).hexdigest()
def serialized(v):return json.dumps(v,ensure_ascii=False)
def digest(v):return sha(json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode())
def start_json():return (BASE6/'checkpoints/german_recovery_T5.json').read_text(encoding='utf8')
def parameters():
    return dict(initialI=10,productionI=3,handoffI=2,outputE2=2,P=0,workBoundaries=2,productionBufferE2=2,warehouseE2=2,
        producerOperationalFromE=5,latencyE=1,external=dict(resourceId='EXTERNAL_G_A10',unit='workPoint',side='G',epochs=[5,6],cap=4,perE2=2,
            carry=False,sharing='INDEPENDENT_OF_SP_RAIL_T_W',operations=['factory_load','offmap_carriage','A10_receipt']),
        receiver=dict(side='G',node='A10',coreKey='0,9',allowNullControl=True,epochs=[5,6]),stop=dict(turn=7,phase='GERMAN_RECOVERY'))
def expected_approval():
    return dict(decisionRef='LEADER-INDUSTRY-INTEGRATE-012-20261003',ruleCommit=RULE,candidateSha256=CANDIDATE_SHA,
        industry011='1e7fba5fe234b2bd33f50237401868a314dfd0ea',core='813b4072568352e95d0726fe5fe04060c889c554',
        startSnapshotSha256=START_SHA,startCheckpoint='german_recovery_T5',startRevision=109,
        instanceId='012-main',matchId='EASTFRONT-012-ISOLATED',parameters=parameters(),parameterHash=digest(parameters()),
        globalBlockersClosed=0,productionRuntimeApproval=False,crashPersistence=False)
def load_launch(path=HERE/'launch.json'):
    path=Path(path);cfg=json.loads(path.read_bytes());assert set(cfg)=={'approvalFile','candidateFile'}
    raw=(path.parent/cfg['candidateFile']).read_bytes();assert sha(raw)==CANDIDATE_SHA,'CANDIDATE_HASH_MISMATCH'
    c=json.loads(raw);rawa=(path.parent/cfg['approvalFile']).read_bytes();a=json.loads(rawa)
    assert a==expected_approval(),'LOCAL_APPROVAL_INVALID'
    assert c['approval']==dict(decisionRef=None,inheritsPriorSliceApproval=False,parameterStatus='ALL_NEW_VALUES_AND_SEMANTICS_AWAIT_REVIEW')
    assert not c['runtimeEnabled'] and len(c['blockerReview'])==35
    assert sha(start_json().encode())==START_SHA
    return dict(candidate=c,approval=a,approvalHash=sha(rawa),parameters=a['parameters'],contractHash=digest(dict(candidateSha256=CANDIDATE_SHA,parameters=a['parameters'])))
def verify_runtime():
    m=json.loads((BASE6/'manifest.json').read_bytes())
    for n,h in m['files'].items():assert sha((BASE6/n).read_bytes())==h,'RUNTIME_CHANGED:'+n
    return m

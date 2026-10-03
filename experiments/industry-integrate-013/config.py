"""Pinned full-root continuation and separate trusted 013 grant."""
import gzip,json,hashlib
from pathlib import Path
HERE=Path(__file__).resolve().parent;OUT=HERE/'.runtime'
BASE6=OUT/'base6/experiments/industry-integrate-006/.runtime';LIVE=BASE6/'live/experiments/supply-exp-005'
BASE='e64c0e11fb16b05cfe725240193e8590b4eefd88';RULE='b3c18fa6daf0cf7409e0821918e7ffdd1dac4a51'
CANDIDATE_SHA='c12d6d020996652f5c8f44f4007c91ffe0523d7f4999a591e36271e911ed0223'
START_SHA='d623bf42b187ca4529ea676fe3963b1016bc82d3c93a28a78a67cabcf8abd5c7'
def sha(b):return hashlib.sha256(b).hexdigest()
def serialized(v):return json.dumps(v,ensure_ascii=False)
def digest(v):return sha(json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode())
def start_root():
    raw=gzip.decompress((OUT/'012-TRACE.json.gz').read_bytes());e=json.loads((OUT/'012-EVIDENCE.json').read_bytes())
    assert sha(raw)==e['traceSha256'];root=json.loads(raw)['T7'];assert digest(root)==START_SHA,'FULL_T7_ROOT_HASH_MISMATCH'
    assert root['bundle']['revision']==129 and root['bundle']['core']['turn']==7 and root['bundle']['core']['phase']=='GERMAN_RECOVERY'
    assert serialized(root['bundle'])==root['bundleJSON'] and root['industry']['warehouse']==dict(resident=2,incoming={},P=0)
    assert root['industry']['budget']==dict(granted=10,freeI=5,productionSpent=3,handoffSpent=2,escrow=0)
    return root
def profile():return dict(matchId='EASTFRONT-012-ISOLATED',instanceId='013-main',initialP=1,training='SCENARIO_TRAINED_RESERVE_ASSUMPTION',trainingReceipt=None,
    personnelI=2,acceptanceCareI=1,carriageI=1,warehouseId='RC007-REAR-G-A10',personnelAccountId='RC008-G-A10-P',
    capacityP=1,capacityE2=2,node='A10',coreKey='0,9',side='G',allowNullControl=True,quotaId='RC008-OFFMAP-RESERVE-TO-A10',
    totalQuotaLQ=4,perP_LQ=4,quotaRenews=False,physicalIndependence='SP_AND_012_EXTERNAL',concurrent012Allowed=False,
    acceptTurn=7,acceptPhase='GERMAN_RECOVERY',dispatchEpochs=[7,8],lastReceiveEpoch=9,latency=1,stopTurn=8,stopPhase='GERMAN_RECOVERY')
def expected():return dict(decisionRef='LEADER-INDUSTRY-INTEGRATE-013-20261003',base012=BASE,ruleCommit=RULE,candidateSha256=CANDIDATE_SHA,
    startRootHash=START_SHA,profile=profile(),profileHash=digest(profile()),globalBlockersClosed=0,runtimeDefaultApproved=False,crashPersistence=False)
def load_launch(path=HERE/'launch.json'):
    path=Path(path);cfg=json.loads(path.read_bytes());assert set(cfg)=={'approvalFile','candidateFile'}
    raw=(path.parent/cfg['candidateFile']).read_bytes();assert sha(raw)==CANDIDATE_SHA
    c=json.loads(raw);aRaw=(path.parent/cfg['approvalFile']).read_bytes();a=json.loads(aRaw);assert a==expected(),'LOCAL_APPROVAL_INVALID'
    assert c['approval']['decisionRef'] is None and not c['approval']['inherits007or012Approval'] and not c['runtimeEnabled']
    assert len(c['blockerReview'])==35;start_root()
    return dict(candidate=c,approval=a,approvalHash=sha(aRaw),profile=a['profile'],contractHash=digest(dict(candidateSha=CANDIDATE_SHA,profile=a['profile'])))
def verify_runtime():
    m=json.loads((BASE6/'manifest.json').read_bytes())
    for n,h in m['files'].items():assert sha((BASE6/n).read_bytes())==h,n

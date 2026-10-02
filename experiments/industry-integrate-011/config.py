"""Local startup configuration is trusted; requests cannot grant authority."""
import hashlib,json
from pathlib import Path
HERE=Path(__file__).resolve().parent
OUT=HERE/'.runtime'
CANDIDATE_SHA='65cb3f2a20262c82fdc7cd9a44f5c2d93a81c46c806e05e9524c0dc72060cef5'
RULE='f09911e4792bd1da33185807f03c68b2cd9565fe'
BASE='2e5e4b810a8ca1c088012381bd52c9870ad0198e'
POLICY_SHA='959157110a5b90ea2dca9fe1bc7aa6178f9a1102468f43338be5f963526c395f'
RULE_SHA='4fe43573896d7e7d3a4e5b0c320f822fe7ea7517fa283584408d56d71dca2eed'
def sha(raw):return hashlib.sha256(raw).hexdigest()
def digest(value):return sha(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode())
def serialized(value):return json.dumps(value,ensure_ascii=False)
def candidate():
    raw=(OUT/'rule/candidate.json').read_bytes();assert sha(raw)==CANDIDATE_SHA
    return json.loads(raw)
def initial_json():return (OUT/'base6/experiments/industry-integrate-006/.runtime/checkpoints/german_recovery_T5.json').read_text(encoding='utf8')
def load_launch(path=HERE/'launch.json'):
    path=Path(path);cfg=json.loads(path.read_bytes())
    assert set(cfg)=={'approvalFile','candidateFile','ruleFile','policyFile'},'STARTUP_CONFIG_SCHEMA'
    raw=(path.parent/cfg['candidateFile']).read_bytes();assert sha(raw)==CANDIDATE_SHA
    rawr=(path.parent/cfg['ruleFile']).read_bytes();assert sha(rawr)==RULE_SHA
    rawp=(path.parent/cfg['policyFile']).read_bytes();assert sha(rawp)==POLICY_SHA
    c=json.loads(raw);rule=json.loads(rawr)
    rawa=(path.parent/cfg['approvalFile']).read_bytes();a=json.loads(rawa)
    expected=dict(decisionRef='LEADER-INDUSTRY-INTEGRATE-011-20261002',industryCommit=BASE,
        transactionCommit='96bf1d7307063ecb6331fc44b28a832bb2aceac6',ruleCommit=RULE,
        policySha256=POLICY_SHA,rule006Sha256=RULE_SHA,routeCandidateSha256=CANDIDATE_SHA,
        baseSnapshotSha256=c['checkpoint']['serializedSnapshotSha256'],archiveSha256=c['checkpoint']['archiveSha256'],
        manifestDigest=digest(c['initialManifest']),routeDigest=digest(c['route']),
        scope=dict(instanceType='NEW_SINGLE_PROCESS_ISOLATED_T5_ONLY',source='A10',receiver='C10',targetUnit='G-I-01',
            controllerId='G-HUMAN-1',dispatch='E5',availableTurn=6,recoveryPhase='GERMAN_RECOVERY',kit={'P':1,'E2:L':2},singleUse=True),
        priority='KIT_FIRST_THEN_ORIGINAL_COMPLETE_PROGRESSIVE_AND_RESERVE_OBJECTIVES',
        terminalService='RECEIVE_STORE_AND_PREPARE_FOR_ONE_SAME_HEX_TARGET',globalBlockersClosed=0,productionRuntimeApproval=False,persistence=False)
    assert a==expected,'LOCAL_APPROVAL_INVALID'
    assert len(c['blockerReview']['rows'])==35 and not rule['runtimeEnabled']
    assert rule['approval']=={'decisionRef':None,'inherits005or008':False}
    assert all(v is None or v is False for v in c['approval'].values())
    assert rule['charges']['rows']==c['capacity']['rows']
    assert sha(initial_json().encode())==a['baseSnapshotSha256']
    archive=OUT/'base6/experiments/industry-integrate-006/.runtime/planner/experiments/industry-integrate-005/.runtime/fixtures/CHECKPOINTS.json.gz'
    assert sha(archive.read_bytes())==a['archiveSha256']
    return dict(candidate=c,rule=rule,approval=a,approvalHash=sha(rawa))
def verify_runtime():
    m=json.loads((OUT/'manifest.json').read_bytes());assert m['industry011Base']==BASE and m['industry011Rule']==RULE
    for name,h in m['files'].items():assert sha((OUT/name).read_bytes())==h,'RUNTIME_CHANGED:'+name
    assert sha((HERE/'freight_audit.py').read_bytes())==sha((OUT/'live/freight_audit.py').read_bytes())
    return m

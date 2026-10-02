"""Trusted startup files, not request-supplied grants. Filesystem is the trust boundary."""
import hashlib,json
from pathlib import Path
HERE=Path(__file__).resolve().parent
OUT=HERE/'.runtime'
CANDIDATE_SHA='65cb3f2a20262c82fdc7cd9a44f5c2d93a81c46c806e05e9524c0dc72060cef5'
RULE='e0c7fed6bfb2053b865f242fd4cf783a040eeb7f'
BASE='bad006249b81d07c6f63f8df4010ce4fcec51871'
def sha(raw):return hashlib.sha256(raw).hexdigest()
def digest(value):return sha(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode())
def serialized(value):return json.dumps(value,ensure_ascii=False)
def candidate():
    raw=(OUT/'rule/candidate.json').read_bytes()
    assert sha(raw)==CANDIDATE_SHA,'CANDIDATE_HASH_MISMATCH'
    return json.loads(raw)
def initial_json():return (OUT/'base6/experiments/industry-integrate-006/.runtime/checkpoints/german_recovery_T5.json').read_text(encoding='utf8')
def load_launch(path=HERE/'launch.json'):
    path=Path(path);cfg=json.loads(path.read_bytes())
    assert set(cfg)=={'approvalFile','candidateFile'},'STARTUP_CONFIG_SCHEMA'
    raw=(path.parent/cfg['candidateFile']).read_bytes();assert sha(raw)==CANDIDATE_SHA
    c=json.loads(raw);raw_a=(path.parent/cfg['approvalFile']).read_bytes();a=json.loads(raw_a)
    expected=dict(decisionRef='LEADER-RULE-CAMPAIGN-005-20261002',transportGrantRef='LEADER-RC005-TRANSPORT-20261002',
        T6RecoveryGrantRef='LEADER-RC005-RECOVERY-20261002',candidateSha256=CANDIDATE_SHA,ruleCommit=RULE,industryCommit=BASE,
        candidateDigest=digest(c),manifestDigest=digest(c['initialManifest']),baseSnapshotSha256=c['checkpoint']['serializedSnapshotSha256'],
        experimentId=c['scope']['experimentId'],approvedLocalBlockers=[r['blocker'] for r in c['blockerReview']['rows'] if r['status']=='LOCAL_PROPOSAL_NOT_APPROVED'],
        globalBlockersResolved=0,productionRuntimeApproval=False)
    assert a==expected,'LOCAL_APPROVAL_INVALID'
    assert len(a['approvedLocalBlockers'])==19 and len(c['blockerReview']['rows'])==35
    assert c['approval']==dict(decisionRef=None,candidateSha256=None,transportGrantRef=None,T6RecoveryGrantRef=None,inherit004or007Approval=False)
    assert sha(initial_json().encode())==a['baseSnapshotSha256']
    archive=OUT/'base6/experiments/industry-integrate-006/.runtime/planner/experiments/industry-integrate-005/.runtime/fixtures/CHECKPOINTS.json.gz'
    assert sha(archive.read_bytes())==c['checkpoint']['archiveSha256']
    return dict(candidate=c,approval=a,approvalHash=sha(raw_a))
def verify_runtime():
    m=json.loads((OUT/'manifest.json').read_bytes());assert m['base']==BASE and m['rule']==RULE
    for name,expected in m['files'].items():assert sha((OUT/name).read_bytes())==expected,'RUNTIME_CHANGED:'+name
    assert sha((HERE/'freight_audit.py').read_bytes())==sha((OUT/'live/freight_audit.py').read_bytes())
    return m

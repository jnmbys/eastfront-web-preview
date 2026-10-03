"""Trusted local launch; no caller-supplied approval or initial inventory."""
import gzip,hashlib,json
if not __debug__:raise RuntimeError('Optimized Python disables experiment guards; use ordinary Python.')
from pathlib import Path
HERE=Path(__file__).resolve().parent
OUT=HERE/'.runtime';LIVE=OUT/'live'
BASE6=OUT/'base6/experiments/industry-integrate-006/.runtime'
RULE='4a351226741457f57629963bfba99736807456b1'
BASE='2d04264a3f4ba6d38f76a99ae76821cc0a55abdb'
FIXED='fef6d57f8169fe981d3d13b16774b2503eb6dd9e'
START_SHA='759ac0d6510d7e0fad38be2c8464623c700d73afc172026faece84c6d6a3e09a'
CARGO={'rail:A10~B10':8,'rail:B10~C10':8,'T':16,'W:GH2':8}
PREFIX='EASTFRONT-012-ISOLATED/RC009/E8-G-I-01'
REAR='RC007-REAR-G-A10';FRONT='RC009-G-C10-GI01'
def sha(b):return hashlib.sha256(b).hexdigest()
def serialized(v):return json.dumps(v,ensure_ascii=False)
def digest(v):return sha(json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode())
def read(n):return json.loads((OUT/n).read_bytes())
def gz(n):return json.loads(gzip.decompress((OUT/n).read_bytes()))
def start_root():
    r=gz('013-TRACE.json.gz')['T8'];assert digest(r)==START_SHA
    assert r['revision']==37 and r['bundle']['revision']==142 and len(r['receipts'])==37
    assert serialized(r['bundle'])==r['bundleJSON']
    assert digest(r['receipts'])=='98cecbf73757dd34c9675d64bdd7cb7c292a2801fa14b4eb93b461775586d500'
    return r
def load():
    m=json.loads((HERE/'INPUTS.json').read_bytes())
    for p,h in m['files'].items():assert sha((OUT/p).read_bytes())==h,p
    a=json.loads((HERE/'APPROVAL.json').read_bytes());launch=json.loads((HERE/'launch.json').read_bytes())
    assert sha((HERE/'APPROVAL.json').read_bytes())==launch['approvalSha256'],'UNTRUSTED_LOCAL_APPROVAL'
    assert a['ruleCommit']==RULE and a['fixed015Commit']==FIXED and a['rootHash']==START_SHA
    assert a['candidateSha256']==sha((OUT/'candidate.json').read_bytes())
    candidate=read('candidate.json');assert candidate['runtimeEnabled'] is False
    result=gz('015-RESULT.json.gz');plan=gz('014-PLAN.json.gz');root=start_root()
    for key,expected in [('candidate','50c31db0bb29330b4a581e5c3bdec26190f6fd0d9d25f2918f9342ef58c5ac25'),('unitComparison','2ab35f4a4b81e6cd079324a0889c430c9f540714f394c11a95d680b74b626d4c'),('profile','761e1d28ff67084ddac4d1a3bc35b5a540fbf605c6732cccc3e09814a77a2c8c'),('sovietFrozen','4bdc6eb8db4a30aa9439df008d75677143bb3af737337008e0b7021189d6b57b')]:assert digest(result[key])==expected,key
    assert digest(plan['projection']['input'])==result['inputHash']=='c4e6c61b65d1f5254d35d153e65e1c3a51f95ae6f0f44c618f812006bedf6297'
    assert sha(gzip.decompress((OUT/'015-RESULT.json.gz').read_bytes()))=='f9af1d98b9ef07163a67a00e5e96d7d96f163260798fffb3c9940c782e18c3af'
    assert sha(gzip.decompress((OUT/'014-PLAN.json.gz').read_bytes()))=='65c52080f016e065e40ed707c61704ee119f7b01539b2759b0a6b486ec78d31c'
    assert a['permanentP']==root['personnel']['package']['id'] and a['permanentE2']==root['industry']['batch']['id']
    return dict(approval=a,approvalHash=launch['approvalSha256'],candidateHash=a['candidateSha256'],root=root,result=result,plan=plan)

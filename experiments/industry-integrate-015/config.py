import gzip,hashlib,json
from pathlib import Path
HERE=Path(__file__).resolve().parent;OUT=HERE/'.runtime'
BASE='9dcad639239ed7ed4081a473d78e9512cd212197'
ROOT_HASH='759ac0d6510d7e0fad38be2c8464623c700d73afc172026faece84c6d6a3e09a'
CARGO={'rail:A10~B10':8,'rail:B10~C10':8,'T':16,'W:GH2':8}
def sha(b):return hashlib.sha256(b).hexdigest()
def digest(v):return sha(json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode())
def load():
    manifest=json.loads((HERE/'INPUTS.json').read_bytes())
    for p,h in manifest['files'].items():assert sha((OUT/p).read_bytes())==h,p
    raw=gzip.decompress((OUT/'014-PLAN.json.gz').read_bytes());v=json.loads((OUT/'014-VERIFICATION.json').read_bytes())
    assert sha(raw)==v['planSha256'];plan=json.loads(raw)
    assert plan['startRootHash']==v['rootHash']==ROOT_HASH and plan['capacity']['status']=='INFEASIBLE'
    raw13=gzip.decompress((OUT/'013-TRACE.json.gz').read_bytes());e13=json.loads((OUT/'013-EVIDENCE.json').read_bytes())
    assert sha(raw13)==e13['traceSha256'];root=json.loads(raw13)['T8'];assert digest(root)==ROOT_HASH
    p=plan['projection'];assert digest(p['input'])==p['inputHash']==plan['capacity']['inputHash']
    assert p['boundaryEpoch']==8 and p['input']['epoch']=='L7' and p['input']['clock']=='full'
    assert plan['proposedResourceLoad']==CARGO
    return root,plan

"""Pinned, read-only continuation. No transport approval is created here."""
import gzip,hashlib,json
from pathlib import Path
HERE=Path(__file__).resolve().parent;OUT=HERE/'.runtime'
BASE='2d04264a3f4ba6d38f76a99ae76821cc0a55abdb'
START_SHA='759ac0d6510d7e0fad38be2c8464623c700d73afc172026faece84c6d6a3e09a'
BASE6=OUT/'base6/experiments/industry-integrate-006/.runtime'
LIVE=BASE6/'live/experiments/supply-exp-005'
def sha(b):return hashlib.sha256(b).hexdigest()
def serialized(v):return json.dumps(v,ensure_ascii=False)
def digest(v):return sha(json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode())
def load_root():
    raw=gzip.decompress((OUT/'013-TRACE.json.gz').read_bytes());e=json.loads((OUT/'013-EVIDENCE.json').read_bytes())
    assert sha(raw)==e['traceSha256'];r=json.loads(raw)['T8'];assert digest(r)==START_SHA,'PINNED_FULL_ROOT_MISMATCH'
    assert r['revision']==37 and r['bundle']['revision']==142
    assert r['bundle']['core']['turn']==8 and r['bundle']['core']['phase']=='GERMAN_RECOVERY'
    assert serialized(r['bundle'])==r['bundleJSON'];return r
def verify_inputs():
    m=json.loads((HERE/'INPUTS.json').read_bytes())
    for p,h in m['files'].items():assert sha((OUT/p).read_bytes())==h,p
    m=json.loads((BASE6/'manifest.json').read_bytes())
    for p,h in m['files'].items():assert sha((BASE6/p).read_bytes())==h,p
    load_root()

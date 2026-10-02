import gzip,json,hashlib,os
from pathlib import Path
HERE=Path(__file__).resolve().parent
OUT=HERE/'.runtime'
DATA=Path(os.environ.get('CAMPAIGN005_OUTPUT',str(HERE))).resolve()
assert DATA==HERE or DATA.is_relative_to((HERE/'.runtime').resolve()),'Output must stay in campaign-005'
DATA.mkdir(parents=True,exist_ok=True)
def owner(tag):return OUT/tag
def original():return owner('008')/'.runtime/base6/experiments/industry-integrate-006/.runtime/live/experiments/supply-exp-005'
def read(p):return json.loads(gzip.decompress(p.read_bytes()) if str(p).endswith('.gz') else p.read_bytes())
def encoded(x):return json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()
def digest(x):return hashlib.sha256(encoded(x)).hexdigest()
def save(p,x):
 raw=encoded(x)
 p.write_bytes(gzip.compress(raw,mtime=0) if str(p).endswith('.gz') else (json.dumps(x,ensure_ascii=False,indent=2)+'\n').encode())
def policy():
 import hashlib
 assert hashlib.sha256((HERE/'POLICY.json').read_bytes()).hexdigest()==read(HERE/'POLICY_LOCK.json')['sha256']
 return read(HERE/'POLICY.json')

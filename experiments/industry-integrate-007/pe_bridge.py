"""Execute the derived PE engine via unchanged live.execute. No game-field patching here."""
import hashlib,json,os,sys
from pathlib import Path
root=Path(__file__).resolve().parent/'.runtime'
for name,expected in json.loads((root/'manifest.json').read_bytes())['files'].items():
    if hashlib.sha256((root/name).read_bytes()).hexdigest()!=expected: raise RuntimeError('RUNTIME_CHANGED:'+name)
payload=json.load(sys.stdin)
if payload['command']['action']['type']!='REPAIR_UNIT': raise ValueError('PE_SEAM_RECOVERY_ONLY')
os.environ['INDUSTRY007_PAYMENT_MODE']='PE'
sys.path.insert(0,str(root/'pe-live'))
from live import execute
result=execute(json.loads(payload['bundleJSON']),payload['command'])
result['stateJSON']=json.dumps(result['state'],ensure_ascii=False)
json.dump(result,sys.stdout,ensure_ascii=False)

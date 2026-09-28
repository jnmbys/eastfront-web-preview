"""Full adapter replay, not Core-only replay that would omit logistics damage."""
from live import *
from bounded import warm_start,close_worker
import sys
if __name__=='__main__':
 warm_start();path=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'data/playable/restore-new.json';d=json.loads(path.read_text());b=d['initial'];base=len(b['journal']);times=[]
 for j in d['state']['journal'][base:]:
  r=execute(b,j['command']);assert r['ok'],r.get('error');b=r['state'];assert hash_bundle(b)==j['hash'];times.append(r['seconds'])
 assert hash_bundle(b)==hash_bundle(d['state']);print(json.dumps({'file':path.name,'replayed':len(times),'equal':True,'seconds':times},indent=2));close_worker()

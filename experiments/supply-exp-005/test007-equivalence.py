"""Compare original EXP006 HTTP handler vs UX007 on actual browser action sequences."""
import importlib.util,json,threading,urllib.request
from pathlib import Path
from copy import deepcopy
import server
from live import hash_bundle
from bounded import warm_start,close_worker
spec=importlib.util.spec_from_file_location('baseline_server',Path(__file__).parent/'evidence/baseline006-server.py');old=importlib.util.module_from_spec(spec);spec.loader.exec_module(old)
results=[]
if __name__=='__main__':
 warm_start()
 try:
  for clip in ['prepare','isolation','restore']:
   rec=json.loads((Path('evidence')/f'replay007-{clip}.json').read_text());commands=rec['state']['journal'][len(rec['initial']['journal']):];digests=[]
   for module in [old,server]:
    module.state=deepcopy(rec['initial']);module.initial=deepcopy(rec['initial']);module.error=None;module.receipt=None
    http=module.HTTPServer(('127.0.0.1',0),module.Handler);thread=threading.Thread(target=http.serve_forever,daemon=True);thread.start();hashes=[]
    try:
     for entry in commands:
      c=entry['command'];controller=module.state['core']['controllers'][c['action']['controllerId']];payload={'op':'action',**c,'viewer':module.ACTIVE[controller['side']]}
      request=urllib.request.Request('http://127.0.0.1:'+str(http.server_port)+'/api',data=json.dumps(payload).encode(),headers={'Content-Type':'application/json'})
      with urllib.request.urlopen(request) as r:reply=json.load(r)
      assert not reply['error'],reply['error'];h=hash_bundle(module.state);assert h==entry['hash'];hashes.append(h)
     digests.append(hashes)
    finally:http.shutdown();http.server_close();thread.join()
   assert digests[0]==digests[1];results.append({'clip':clip,'actions':len(commands),'every_state_equal':True,'final_hash':digests[0][-1]})
  Path('evidence/equivalence007.json').write_text(json.dumps(results,indent=2));print(results)
 finally:close_worker()

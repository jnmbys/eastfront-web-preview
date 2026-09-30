import sys,os,json,gzip,time,threading,subprocess
from pathlib import Path
from copy import deepcopy
from unittest.mock import patch
import service as s
from live import execute,hash_bundle
if __name__=='__main__':
 s.warm_start();out=Path(__file__).parent/'evidence';out.mkdir(exist_ok=True);results=[]
 read=lambda p:json.load(gzip.open(s.EXP/'evidence'/p,'rt'))
 base75=read('campaign011-final/checkpoint-75.json.gz')['state'];repeat=read('campaign011-final/reserve-recovery-repeat.json.gz')['records']
 move=deepcopy(base75)
 for j in repeat[:1]:
  r=execute(move,j['command']);assert r['ok'];move=r['state'];assert hash_bundle(move)==j['hash']
 combat=deepcopy(move)
 for j in repeat[1:3]:
  r=execute(combat,j['command']);assert r['ok'];combat=r['state'];assert hash_bundle(combat)==j['hash']
 cases={'deployment':s.create_campaign(),'lost-response':s.create_campaign(),'movement':move,'combat':combat,'advance-delivery':read('campaign011-close/checkpoint-66.json.gz')['state']}
 srv=s.online.Service(('127.0.0.1',0),s.Handler);threading.Thread(target=srv.serve_forever,daemon=True).start()
 for name,b in cases.items():
  if os.environ.get('TEST015_CASES') and name not in os.environ['TEST015_CASES'].split(','):continue
  s.SESSIONS.clear();s.CREATIONS.clear()
  with patch.object(s,'create_campaign',lambda mode:deepcopy(b)):
   p=subprocess.run(['node',str(Path(__file__).with_name('verify-ui.mjs'))],env={**os.environ,'TEST015_CASE':name,'TEST015_ORIGIN':f'http://127.0.0.1:{srv.server_port}'},capture_output=True,text=True,timeout=90,cwd=s.ROOT)
  item=dict(case=name,passed=p.returncode==0,stdout=p.stdout,stderr=p.stderr)
  if p.returncode==0:
   if name=='lost-response':
    item['closed_acknowledged']=not s.SESSIONS;results.append(item);print(name,item['passed'],flush=True);(out/'ui-bindings.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n');continue
   final=next(iter(s.SESSIONS.values()))['state'];reference=deepcopy(b)
   for j in final['journal'][b['revision']:]:
    r=execute(reference,j['command']);assert r['ok'];reference=r['state']
   item['sandbox_state_equal']=reference==final;item['final_hash']=hash_bundle(final);item['passed']&=reference==final
  results.append(item);print(name,item['passed'],p.stderr[-300:],flush=True)
  (out/'ui-bindings.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
 srv.shutdown();raise SystemExit(0 if all(x['passed'] for x in results) else 1)

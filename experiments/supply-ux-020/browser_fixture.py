"""Local-only test harness: reuse saved legal states; no HTTP injection surface."""
import os,sys,json,gzip,argparse
from pathlib import Path
from copy import deepcopy
ROOT=Path(__file__).resolve().parents[2]
os.environ.update(COOKIE_SECURE='0',BIND_HOST='127.0.0.1',PYTHONUTF8='1',OPENBLAS_NUM_THREADS='1')
sys.path.insert(0,str(ROOT/'experiments/supply-integrate-015'))
import service as s
from live import execute,hash_bundle
read=lambda p:json.load(gzip.open(s.EXP/'evidence'/p,'rt',encoding='utf-8'))
def step(b,a):
 c=next(c['id'] for c in b['core']['controllers'].values() if c['side']==b['core']['activeSide'])
 r=execute(b,{'id':'020-browser-'+str(b['revision']),'revision':b['revision'],'action':dict(a,controllerId=c)})
 assert r['ok'],r.get('error');return r['state']
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('case',choices=['movement','joint','clear']);p.add_argument('--port',type=int,required=True);args=p.parse_args();s.warm_start()
 if args.case=='clear':
  b=read('campaign011-close/checkpoint-128.json.gz')['state']
  for row in read('campaign011-close/recovered-unit-attack.json.gz')['records']:
   if row['command']['action']['type']=='ATTACK':break
   r=execute(b,row['command']);assert r['ok'];b=r['state'];assert hash_bundle(b)==row['hash']
 else:
  b=read('campaign011-final/checkpoint-75.json.gz')['state'];b=step(b,dict(type='END_PHASE'))
  if args.case=='joint':
   b=step(b,dict(type='MOVE',unitId='G-PZ-01',path=[{'q':4,'r':6}]))
   b=step(b,dict(type='MOVE',unitId='G-I-01',path=[{'q':4,'r':5}]))
   b=step(b,dict(type='END_PHASE'))
 s.create_campaign=lambda mode:deepcopy(b) if mode=='new' else (_ for _ in ()).throw(ValueError('fixture new only'))
 real=s.transact
 def observed(slot,cmd):
  out=real(slot,cmd);entry=slot['state']['journal'][-1]
  print(json.dumps(dict(action=cmd['action'],seconds=out['supply']['seconds'],charges=entry['charges'],hash=hash_bundle(slot['state'])),ensure_ascii=False),flush=True);return out
 s.transact=observed
 print('LOCAL_FIXTURE_READY '+args.case+' '+hash_bundle(b),flush=True)
 s.online.Service(('127.0.0.1',args.port),s.Handler).serve_forever()

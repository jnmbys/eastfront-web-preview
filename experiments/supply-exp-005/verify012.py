"""Targeted online seams. Legal checkpoint injection is TEST-ONLY, not an HTTP API.
Run in a fresh process, optionally in a 0.5 CPU/512 MiB container.
No full campaign replay; 117->128 uses eleven previously recorded Actions.
"""
import os
os.environ.update(ENABLE_CAMPAIGN='1',COOKIE_SECURE='0',PUBLIC_ORIGIN='')
import gzip,json,hashlib,http.cookiejar,threading,time,urllib.request,urllib.error,sys,traceback
from pathlib import Path
from copy import deepcopy
from unittest.mock import patch
import online,live
from live import ROOT,hash_bundle,audit
from bounded import warm_start,close_worker

def read(p):return json.loads(gzip.decompress(p.read_bytes()))
def fullhash(b):return hashlib.sha256(json.dumps(b,sort_keys=True).encode()).hexdigest()
def memory():
 p=Path('/sys/fs/cgroup/memory.peak');return int(p.read_text()) if p.exists() else None
class Client:
 def __init__(self,url):
  self.url=url;self.jar=http.cookiejar.CookieJar();self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
 def call(self,cmd=None,path='/api?viewer=S'):
  req=urllib.request.Request(self.url+path,data=json.dumps(cmd).encode() if cmd else None,headers={'Content-Type':'application/json','Origin':self.url})
  t=time.perf_counter()
  try:
   with self.opener.open(req,timeout=15) as r:status=r.status;raw=r.read()
  except urllib.error.HTTPError as e:status=e.code;raw=e.read()
  try:body=json.loads(raw)
  except ValueError:body={'raw':raw.decode()}
  return status,body,time.perf_counter()-t
 def token(self):return next(c.value for c in self.jar if c.name=='ef_supply')
 def slot(self):return online.SESSIONS[self.token()]
 def post(self,cmd):time.sleep(.16);return self.call(cmd,'/api')
 def act(self,cmd):
  b=self.slot()['state'];controller=cmd['action']['controllerId'];viewer={'GERMAN':'G','SOVIET':'S'}[b['core']['controllers'][controller]['side']]
  return self.post(dict(op='action',viewer=viewer,budget=3,**cmd))

def run(report):
 began=time.perf_counter();warm_start();srv=online.Service(('127.0.0.1',0),online.Handler);thread=threading.Thread(target=srv.serve_forever,daemon=True);thread.start();url='http://127.0.0.1:'+str(srv.server_port)
 report['harness_startup_seconds']=time.perf_counter()-began;clients=[Client(url) for _ in range(4)]
 try:
  for c in clients:
   code,r,_=c.call();assert code==200 and r['state']['clip']=='campaign' and r['state']['campaign']['deployment'];assert 'core' not in r['state'] and 'journal' not in r['state']
  assert len({c.token() for c in clients})==4
  assert Client(url).call()[0]==503
  report['four_campaign_sessions']=True
  c=clients[0];html=c.call(path='/')[1]['raw'];assert 'campaign-ui.js' in html and 'value="S" selected' in html
  assert c.call(path='/replay?debug=1')[0]==404
  initial=[fullhash(x.slot()['state']) for x in clients]
  for clip in ['prepare','isolation','restore','campaign']:
   code,r,_=c.post(dict(op='reset',viewer='S',clip=clip,mode='new'));assert code==200 and not r.get('error') and r['state']['clip']==clip
   assert ('campaign' in r['state'])==(clip=='campaign')
  assert [fullhash(x.slot()['state']) for x in clients[1:]]==initial[1:]
  report['short_clip_reset_compatibility']=True
  code,r,_=c.post(dict(op='reset',viewer='S',clip='campaign',mode='old'));assert not r['error'] and r['state']['mode']=='old'
  report['old_campaign_reset']=True
  cp=read(ROOT/'evidence/campaign011-close/checkpoint-117.json.gz');b=cp['state'];assert hash_bundle(b)==cp['hash']
  report['checkpoint']={'revision':117,'hash':cp['hash'],'source':'evidence/campaign011-close/checkpoint-117.json.gz','test_only_injection':True}
  for client in clients:
   slot=client.slot();slot.update(state=deepcopy(b),initial=deepcopy(b),error=None,receipt=None,last=0,base_revision=0)
  report['four_populated_sessions_peak_bytes']=memory()
  original=read(ROOT/'evidence/campaign011/run.json.gz')['records'][117:128]
  others=[fullhash(x.slot()['state']) for x in clients[1:]];report['actions']=[];last_result={};real=online.app.execute
  def observed(*args,**kwargs):
   r=real(*args,**kwargs);last_result.clear();last_result.update({k:v for k,v in r.items() if k!='state'});return r
  with patch.object(online.app,'execute',side_effect=observed):
   for row in original:
    before=fullhash(c.slot()['state']);code,r,dt=c.act(row['command']);accepted=code==200 and not r.get('error')
    entry=dict(revision=row['command']['revision']+1,action=row['command']['action']['type'],status=code,accepted=accepted,http_seconds=dt,transaction=deepcopy(last_result),error=r.get('error'));report['actions'].append(entry)
    if not accepted:
     entry['rollback']=fullhash(c.slot()['state'])==before;assert entry['rollback'];break
    state=c.slot()['state'];entry['hash_equal']=hash_bundle(state)==row['hash'];assert entry['hash_equal'];assert last_result['seconds']<=3;audit(state['logistics'])
    entry['settled']=state['journal'][-1]['settled']
  report['representative_delivery']=len(report['actions'])==11 and all(x['accepted'] for x in report['actions']) and report['actions'][-1].get('settled',False)
  report['session_isolation']=[fullhash(x.slot()['state']) for x in clients[1:]]==others;assert report['session_isolation']
  # Late artificial latency AFTER a real Core action, with the NORMAL three-second budget.
  # No state/RNG substitution. Busy request arrives while the same gate is owned.
  target=clients[1];before=deepcopy(target.slot()['state']);cmd=original[0]['command'];entered=threading.Event();realnode=live.node
  def slow(*args,**kw):
   r=realnode(*args,**kw)
   op=args[3] if len(args)>3 else kw.get('op','frame');deadline=args[4] if len(args)>4 else kw.get('deadline')
   if op=='frame' and deadline:
    entered.set();time.sleep(max(0,deadline-time.perf_counter())+.03)
   return r
  results=[]
  with patch('live.node',side_effect=slow):
   t=threading.Thread(target=lambda:results.append(target.act(cmd)));t.start();assert entered.wait(10)
   busy_before=fullhash(clients[2].slot()['state']);busy=clients[2].act(cmd);t.join(15);assert not t.is_alive()
  assert busy[0]==503 and fullhash(clients[2].slot()['state'])==busy_before
  code,r,dt=results[0];assert code==200 and r.get('error') and target.slot()['state']==before
  report['timeout_rollback']={'passed':True,'budget_seconds':3,'fault':'late frame latency after accepted Core Action','http_seconds':dt,'error':r['error'],'full_state_rng_journal_seen_unchanged':True}
  report['busy_rejected_without_commit']=True
  # Permission filtering on populated checkpoint, not merely empty deployment.
  for viewer in ['G','S']:
   code,r,_=c.call(path='/api?viewer='+viewer);assert code==200
   assert all(u['side']==viewer for u in r['state']['units']);assert not any(k in r['state'] for k in ['core','journal','random','combatTransactions'])
  report['information_filtering']=True
  code,r,_=c.post(dict(op='reset',viewer='S',clip='campaign',mode='new'));assert not r['error'] and r['state']['revision']==0 and c.slot()['state']['seen']=={}
  assert [fullhash(x.slot()['state']) for x in clients[1:]]==others
  report['reset_isolation']=True;report['final_peak_bytes']=memory()
 finally:srv.shutdown();srv.server_close();thread.join();close_worker()
if __name__=='__main__':
 out=Path(sys.argv[1] if len(sys.argv)>1 else 'evidence/campaign012/local.json');out.parent.mkdir(parents=True,exist_ok=True)
 report={'budget_seconds':3,'scope':'targeted 117->128, four sessions; not full campaign or Render validation','environment':{'python':sys.version,'cpu_max':Path('/sys/fs/cgroup/cpu.max').read_text().strip(),'memory_max':Path('/sys/fs/cgroup/memory.max').read_text().strip()},'passed':False}
 try:run(report);report['passed']=report.get('representative_delivery',False)
 except Exception:report['failure']=traceback.format_exc();print(report['failure'],flush=True)
 finally:out.write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False),flush=True)
 raise SystemExit(0 if report['passed'] else 1)

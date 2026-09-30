"""012 HTTP/cgroup acceptance adapted to 015 protocol. Test-only checkpoint hydration.
No runtime file edits, no public injection endpoint, no rule/RNG/budget substitution.
"""
import os,sys,json,gzip,hashlib,http.cookiejar,threading,time,urllib.request,urllib.error,traceback
from pathlib import Path
from copy import deepcopy
from unittest.mock import patch
os.environ.update(COOKIE_SECURE='0',PUBLIC_ORIGIN='')
sys.path.insert(0,'/app/experiments/supply-integrate-015')
import service as s
from live import hash_bundle,audit
from bounded import close_worker

def read(p):return json.load(gzip.open(p,'rt'))
def fullhash(b):return hashlib.sha256(json.dumps(b,sort_keys=True).encode()).hexdigest()
def memory():return int(Path('/sys/fs/cgroup/memory.peak').read_text())
def stable(slot):return {k:v for k,v in slot.items() if k!='touched'}
class Client:
 def __init__(self,url):self.url=url;self.jar=http.cookiejar.CookieJar();self.http=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
 def post(self,**cmd):
  req=urllib.request.Request(self.url+'/experiment',data=json.dumps(dict(version=s.VERSION,**cmd)).encode(),headers={'Content-Type':'application/json','Origin':self.url})
  t=time.perf_counter()
  try:
   with self.http.open(req,timeout=15) as r:code=r.status;data=json.load(r)
  except urllib.error.HTTPError as e:code=e.code;data=json.load(e)
  return code,data,time.perf_counter()-t
 def slot(self):return s.SESSIONS[next(c.value for c in self.jar if c.name=='ef_supply015')]
 def command(self,row):
  cmd=deepcopy(row['command']);side=self.slot()['state']['core']['controllers'][cmd['action'].pop('controllerId')]['side']
  if self.slot()['viewer']!=side:assert self.post(op='switch',viewer=side)[0]==200
  return cmd

def run(report):
 s.warm_start();srv=s.online.Service(('127.0.0.1',0),s.Handler);thread=threading.Thread(target=srv.serve_forever,daemon=True);thread.start();url='http://127.0.0.1:'+str(srv.server_port)
 try:
  clients=[Client(url) for _ in range(4)];report['session_open_seconds']=[]
  for c in clients:
   code,r,dt=c.post(op='open',mode='new');assert code==200,(code,r);report['session_open_seconds'].append(dt)
  assert len(s.SESSIONS)==4;assert Client(url).post(op='open',mode='new')[0]==503
  assert clients[0].post(op='open',mode='old')[0]==422;report['four_sessions_and_mode_lock']=True
  cp=read(s.EXP/'evidence/campaign011-close/checkpoint-66.json.gz');assert hash_bundle(cp['state'])==cp['hash']
  rows=read(s.EXP/'evidence/campaign011-close/advance-battle.json.gz')['records'][:9]
  report['checkpoint']=dict(revision=66,hash=cp['hash'],path='campaign011-close/checkpoint-66.json.gz',test_only=True)
  for c in clients:
   c.slot().update(state=deepcopy(cp['state']),memory={'GERMAN':[],'SOVIET':[]},receipt={},seconds=None,base_revision=0)
  report['four_populated_peak_bytes']=memory();others=[fullhash(c.slot()['state']) for c in clients[1:]];report['actions']=[];c=clients[0]
  for row in rows:
   cmd=c.command(row);before=fullhash(stable(c.slot()));code,r,dt=c.post(op='action',**cmd)
   entry=dict(revision=cmd['revision']+1,type=cmd['action']['type'],http_status=code,http_seconds=dt,transaction_seconds=r.get('supply',{}).get('seconds'),error=r.get('error'));report['actions'].append(entry)
   if code!=200:
    entry['rollback']=fullhash(stable(c.slot()))==before;raise AssertionError(entry)
   entry['hash_equal']=hash_bundle(c.slot()['state'])==row['hash'];entry['settled']=c.slot()['state']['journal'][-1]['settled']
   assert entry['hash_equal'];assert 0<entry['transaction_seconds']<=3;audit(c.slot()['state']['logistics'])
  assert report['actions'][-1]['settled'];report['representative_delivery']=True
  report['session_isolation']=[fullhash(x.slot()['state']) for x in clients[1:]]==others;assert report['session_isolation']
  # Real accepted action first, then fault only the post-action projection latency.
  target=clients[1];cmd=target.command(rows[0]);before=deepcopy(stable(target.slot()));busy_before=deepcopy(stable(clients[2].slot()));entered=threading.Event();orig=s.projection;results=[]
  def delayed(*a,**kw):
   p=orig(*a,**kw)
   if 'previous' in kw:
    entered.set();time.sleep(max(0,(kw.get('deadline') or a[3])-time.perf_counter())+.03)
   return p
  with patch.object(s,'projection',delayed):
   t=threading.Thread(target=lambda:results.append(target.post(op='action',**cmd)));t.start();assert entered.wait(10),'fault point not reached'
   busy=clients[2].post(op='query',revision=66);t.join(15);assert not t.is_alive()
  code,r,dt=results[0]
  report['busy']=dict(status=busy[0],http_seconds=busy[2],error=busy[1].get('error'),unchanged=stable(clients[2].slot())==busy_before)
  report['timeout']=dict(status=code,http_seconds=dt,error=r.get('error'),budget_seconds=3,rollback=stable(target.slot())==before,scope='all slot fields except HTTP last-touch timestamp: Core/RNG/inventory/seen/journal/receipt/memory/viewer/seconds',fault='post-action projection delayed until unchanged deadline + 0.03s after actual execution')
  assert busy[0]==503 and report['busy']['unchanged'];assert code==503 and '3秒' in r['error'] and report['timeout']['rollback']
  assert clients[2].post(op='query',revision=66)[0]==200;report['recovered_after_timeout']=True
  report['final_peak_bytes']=memory();report['passed']=True
 finally:srv.shutdown();srv.server_close();thread.join();close_worker()
if __name__=='__main__':
 report=dict(passed=False,budget_seconds=3,memory_scope='one constrained container: Python HTTP service + acceptance client/thread + four session states + checkpoint/reference/deepcopy test data + warm solver + transient Node projections; NOT service-only RSS',cgroup={p:Path('/sys/fs/cgroup/'+p).read_text().strip() for p in ['cpu.max','memory.max','memory.swap.max']})
 try:
  assert report['cgroup']['memory.max']=='536870912';assert report['cgroup']['memory.swap.max']=='0'
  quota,period=map(int,report['cgroup']['cpu.max'].split());assert quota/period==.5
  run(report)
 except Exception:report['failure']=traceback.format_exc();print(report['failure'],flush=True)
 finally:
  report['peak_bytes']=memory();Path(sys.argv[1]).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False),flush=True)
 raise SystemExit(0 if report['passed'] else 1)

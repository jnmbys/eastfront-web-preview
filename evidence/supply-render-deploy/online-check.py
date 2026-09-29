"""Reuse CI009 HTTP exercises against the real Render HTTPS service; no Docker."""
import importlib.util,json,time,datetime,urllib.request
from pathlib import Path
spec=importlib.util.spec_from_file_location('ci009', 'ci009/run.py'); ci=importlib.util.module_from_spec(spec);spec.loader.exec_module(ci)
ci.URL='https://eastfront-supply-sandbox.onrender.com'
ci.peak=lambda _:None # Target cgroup/Render metrics recorded separately, never substitute CI peak.
record={'source_sha':ci.BASE,'target':ci.URL,'environment':'Render Singapore 0.5c-512mb','started_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'requests':[]}
original=ci.Client.call
def traced(self,*args,**kwargs):
 result=original(self,*args,**kwargs)
 cmd=args[0] if args else kwargs.get('cmd')
 if cmd:record['requests'].append({'op':cmd.get('op'),'budget':cmd.get('budget'),'action':cmd.get('action'),'status':result[0],'seconds':result[2],'error':result[1].get('error')})
 return result
ci.Client.call=traced
try:
 r=urllib.request.urlopen(ci.URL+'/healthz',timeout=15)
 record['https_health']={'status':r.status,'response':r.read().decode()}
 ci.exercise('render',record)
 record['passed']=all(x.get('complete') for x in record['clips']) and record['busy_rejected_without_commit'] and record['timeout_rollback'] and record['reset_isolation']
except Exception as e:
 record['passed']=False;record['failure']=repr(e)
finally:
 record['finished_at']=datetime.datetime.now(datetime.timezone.utc).isoformat()
 Path('deploy011/online-results.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({k:v for k,v in record.items() if k not in ('requests','clips')},ensure_ascii=False))

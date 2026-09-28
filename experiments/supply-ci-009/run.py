"""Host orchestrator. Frozen Docker runtime, real HTTP and cgroup-v2 memory peak.
No external services, secrets, uploaded snapshots, images or game data artifacts.
"""
import re,argparse,concurrent.futures,hashlib,http.cookiejar,json,os,platform,subprocess,time,urllib.error,urllib.request
from pathlib import Path
BASE='9cf0e5fb7fac27e16b2700559716b590e81957b7'
PROFILES=[('512m-halfcpu','512m',.5),('2g-onecpu','2g',1),('512m-tenthcpu','512m',.1)]
URL='http://127.0.0.1:18765'
def shell(args,timeout=30):
 p=subprocess.run(args,capture_output=True,text=True,timeout=timeout)
 if p.returncode:raise RuntimeError(' '.join(args[:5])+': '+p.stderr[-1500:])
 return p.stdout

def state_hash(s):return hashlib.sha256(json.dumps(s,sort_keys=True).encode()).hexdigest()
class Client:
 def __init__(self):self.viewer='G';self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
 def call(self,cmd=None,path='/api',delay=.2):
  time.sleep(delay);t=time.perf_counter()
  req=urllib.request.Request(URL+path,data=json.dumps(cmd).encode() if cmd else None,headers={'Content-Type':'application/json','Origin':URL})
  try:
   with self.opener.open(req,timeout=12) as r:code=r.status;raw=r.read()
  except urllib.error.HTTPError as e:code=e.code;raw=e.read()
  try:data=json.loads(raw)
  except Exception:data={'error':raw.decode(errors='replace')[:200]}
  return code,data,time.perf_counter()-t
 def get(self):
  code,r,_=self.call(path='/api?viewer='+self.viewer);assert code==200 and 'state' in r,(code,r.get('error'));return r['state']
 def reset(self,clip):
  self.viewer='G'
  code,r,_=self.call(dict(op='reset',clip=clip,mode='new',viewer='G'));assert code==200 and not r.get('error'),r.get('error');return r['state']
 def action(self,s,action,budget=3,cid=None):
  self.viewer=s['decision_side']
  cmd=dict(op='action',id=cid or 'ci-'+str(time.time_ns()),revision=s['revision'],viewer=s['decision_side'],budget=budget,action=action)
  code,r,dt=self.call(cmd);return code,r,dt,cmd

def peak(name):
 return int(shell(['docker','exec',name,'cat','/sys/fs/cgroup/memory.peak']).strip())

def exercise(name,record):
 clients=[Client() for _ in range(4)]
 for c in clients:c.get()
 record['four_sessions_peak_bytes']=peak(name)
 baseline=[state_hash(c.get()) for c in clients]
 clients[0].reset('restore')
 assert all(state_hash(clients[i].get())==baseline[i] for i in [1,2,3]),'session/reset contamination'
 record['reset_isolation']=True
 # New-mode forced timeout: API projected ledger/resources/revision equal.
 c=clients[0];s=c.get();before=state_hash(s);code,r,dt,_=c.action(s,{'type':'END_SIDE'},budget=.001)
 assert code==200 and r.get('error') and state_hash(r['state'])==before,'timeout partially committed'
 record['timeout_rollback']=True
 record['clips']=[]
 for clip in ['prepare','isolation','restore']:
  for repeat in range(3):
   s=c.reset(clip);entry={'clip':clip,'repeat':repeat,'requests':[]};record['clips'].append(entry)
   plan=([{'type':'RAIL_REPAIR','repairPair':'C10 D10'}] if clip=='restore' else [])+[{'type':'END_SIDE'}]*4
   initial_tick=s['tick'];settlements=0
   for a in plan:
    c.viewer=s['decision_side'];s=c.get();before=state_hash(s);code,r,dt,cmd=c.action(s,a)
    accepted=code==200 and not r.get('error') and r.get('state',{}).get('revision')==s['revision']+1
    entry['requests'].append({'action':a['type'],'seconds':dt,'status':code,'accepted':accepted,'error':r.get('error'),'settled':bool(r.get('state',{}).get('feedback',{}).get('settled')) if r.get('state',{}).get('feedback') else False})
    if not accepted:
     assert state_hash(c.get())==before,'failed request altered state'
     entry['complete']=False;break
    s=r['state'];settlements+=int(bool(s.get('feedback',{}).get('settled')))
   else:
    entry['complete']=s['tick']==initial_tick+2 and settlements==2
    if clip=='restore':
     unit=next((u for u in s['units'] if u['id']=='G-PZ-02'),None);entry['observed_G_PZ_02_debt']=unit['debt'] if unit else None
   entry['cumulative_peak_bytes']=peak(name)
 # Reset after failed/finished segments is real and independently observed.
 s=c.reset('prepare');assert s['clip']=='prepare' and not s['feedback'];record['reset_after_trials']=True
 # Busy responses from the real service while another request owns the global solver lock.
 barrier=__import__('threading').Barrier(4)
 def simultaneous(i):
  st=clients[i].get();clients[i].viewer=st['decision_side'];st=clients[i].get();before=state_hash(st);barrier.wait();return i,clients[i].action(st,{'type':'END_SIDE'}),before
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:arr=list(pool.map(simultaneous,range(4)))
 busy=[]
 for i,(code,r,dt,cmd),before in arr:
  if code==503:assert state_hash(clients[i].get())==before,'busy committed';busy.append(i)
 record['concurrent_statuses']=[v[0] for _,v,_ in arr];record['busy_rejected_without_commit']=bool(busy)
 assert busy,'no actual busy response observed'
 record['served_workload_peak_bytes']=peak(name)

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--candidate',required=True);ap.add_argument('--out',required=True);args=ap.parse_args();root=Path(args.candidate).resolve();out=Path(args.out).resolve();out.mkdir(exist_ok=True)
 report={'source_sha':BASE,'workflow_sha':os.getenv('GITHUB_SHA'),'environment':'GitHub ubuntu-24.04; NOT Render measurements','profiles':[]};name=None
 try:
  assert shell(['git','-C',str(root),'rev-parse','HEAD']).strip()==BASE,'wrong candidate SHA'
  report['host']={'kernel':platform.release(),'machine':platform.machine(),'cpu':shell(['lscpu'])[:5000],'docker':shell(['docker','version'])[:3000],'cgroup':shell(['docker','info','--format','{{.CgroupVersion}}']).strip()}
  assert report['host']['cgroup']=='2','cgroup v2 required for memory.peak'
  context=root/'experiments/supply-exp-005';began=time.perf_counter()
  with (out/'build.log').open('w') as f:
   proc=subprocess.run(['docker','build','--pull','--progress=plain','-t','supply-ci009:candidate',str(context)],stdout=f,stderr=subprocess.STDOUT,timeout=900)
  assert proc.returncode==0,'Docker build failed (see build.log)'
  report['build_seconds']=time.perf_counter()-began
  report['image_id']=shell(['docker','image','inspect','supply-ci009:candidate','--format','{{.Id}}']).strip()
  report['base_image_digest_references']=sorted(set(re.findall(r'(?:docker.io/)?library/[^\s]+@sha256:[0-9a-f]{64}',(out/'build.log').read_text())))
  for label,memory,cpu in PROFILES:
   p={'label':label,'memory':memory,'cpu_quota':cpu,'swap_equals_memory':True,'pids_limit':128,'cold_starts':[]};report['profiles'].append(p)
   for cold in range(3):
    name='supply-ci009';rec={'cold':cold};p['cold_starts'].append(rec);t=time.perf_counter()
    try:
     shell(['docker','run','-d','--name',name,'--cpus',str(cpu),'--memory',memory,'--memory-swap',memory,'--pids-limit','128','-p','127.0.0.1:18765:10000','-e','PUBLIC_ORIGIN='+URL,'-e','COOKIE_SECURE=0','supply-ci009:candidate'])
     ready=False
     while time.perf_counter()-t<60:
      try:
       with urllib.request.urlopen(URL+'/healthz',timeout=2) as r:ready=r.status==200
      except Exception:pass
      if ready:break
      if shell(['docker','inspect',name,'--format','{{.State.Running}}']).strip()!='true':break
      time.sleep(.25)
     rec['startup_seconds']=time.perf_counter()-t;assert ready,'container never became ready'
     rec['startup_peak_bytes']=peak(name)
     if cold==0:
      exercise(name,rec)
      # Reuse original tests inside same resource limits; no server code changes.
      shell(['docker','cp',str(Path(__file__).with_name('test_in_container.py')),name+':/tmp/test_ci009.py'])
      with (out/(label+'-contracts.log')).open('w') as f:
       test=subprocess.run(['docker','exec','-e','PYTHONPATH=/app','-w','/app',name,'python','/tmp/test_ci009.py'],stdout=f,stderr=subprocess.STDOUT,timeout=180)
      rec['contract_exit']=test.returncode;rec['including_contract_tests_peak_bytes']=peak(name)
    except Exception as e:rec['failure']=str(e)[:2000]
    finally:
     try:
      inspection=json.loads(shell(['docker','inspect',name]))[0]
      rec['container_exit']={k:inspection['State'].get(k) for k in ['Running','ExitCode','OOMKilled','Error']}
      rec['applied_limits']={k:inspection['HostConfig'].get(k) for k in ['NanoCpus','Memory','MemorySwap','PidsLimit']}
      logs=subprocess.run(['docker','logs','--tail','80',name],capture_output=True,text=True);(out/(label+'-cold'+str(cold)+'.log')).write_text((logs.stdout+logs.stderr)[-12000:])
     except Exception as e:rec['inspection_error']=str(e)[:500]
     subprocess.run(['docker','rm','-f',name],capture_output=True);name=None
     (out/'report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False))
   first=p['cold_starts'][0]
   p['passed']=all('failure' not in x and not x.get('container_exit',{}).get('OOMKilled') for x in p['cold_starts']) and first.get('contract_exit')==0 and all(x.get('complete') for x in first.get('clips',[])) and len(first.get('clips',[]))==9 and first.get('busy_rejected_without_commit',False)
 except Exception as e:report['fatal_error']=str(e)[:2000]
 finally:
  if name:subprocess.run(['docker','rm','-f',name],capture_output=True)
  (out/'report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False))
  lines=['# SUPPLY-CI-009','Runtime SHA: '+BASE,'GitHub runner limits only; not Render performance.','', '| Profile | Passed | Cold starts (s) | Served workload peak MiB | Contracts |','|---|---|---|---|---|']
  for p in report['profiles']:
   first=p['cold_starts'][0];peak_b=first.get('served_workload_peak_bytes');lines.append(f"| {p['label']} | {p.get('passed',False)} | {', '.join(str(round(x.get('startup_seconds',0),3)) for x in p['cold_starts'])} | {round(peak_b/1048576,2) if peak_b else 'unmeasured'} | {first.get('contract_exit','not run')} |")
  if report.get('fatal_error'):lines+=['',report['fatal_error']]
  lines+=['','memory.peak includes all processes in the container cgroup, including small measurement commands. Separate peak including contract test process is retained in report.json. Three cold starts/profile; nine clip sequences and four live sessions on first cold start. Failures/timeouts retained.','No published image, service or cloud resource. Artifacts expire after 7 days.']
  (out/'SUMMARY.md').write_text('\n'.join(lines)+'\n');print('\n'.join(lines),flush=True)
 # Low-resource failures must remain red but cannot prevent higher profiles being tested.
 return 0 if report.get('profiles') and all(p.get('passed') for p in report['profiles']) and not report.get('fatal_error') else 1
if __name__=='__main__':raise SystemExit(main())

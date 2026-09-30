"""009 Docker/cgroup workflow, narrowed to one 0.5 CPU / 512 MiB profile.
Build immutable runtime; separate default-entry startup from targeted harness.
No publish, secrets, service, full game or old test matrix.
"""
import argparse,hashlib,json,os,platform,subprocess,time,urllib.request
from pathlib import Path

def shell(args,timeout=30):
 p=subprocess.run(args,capture_output=True,text=True,timeout=timeout)
 if p.returncode:raise RuntimeError(' '.join(args[:5])+': '+p.stderr[-1500:])
 return p.stdout

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--candidate',required=True);ap.add_argument('--sha',required=True);ap.add_argument('--out',required=True);args=ap.parse_args();root=Path(args.candidate).resolve();out=Path(args.out).resolve();out.mkdir(exist_ok=True)
 context=root/'experiments/supply-exp-005';name='supply-ci012';image='supply-ci012:candidate';url='http://127.0.0.1:18765'
 report={'source_sha':args.sha,'workflow_sha':os.getenv('GITHUB_SHA'),'environment':'GitHub ubuntu-24.04; NOT Render','limits':{'cpus':.5,'memory_bytes':536870912,'memory_swap_bytes':536870912,'pids':128},'budget_seconds':3,'passed':False}
 limits=['--cpus','.5','--memory','512m','--memory-swap','512m','--pids-limit','128']
 def inspect():
  d=json.loads(shell(['docker','inspect',name]))[0]
  return {'state':d['State'],'limits':{k:d['HostConfig'][k] for k in ['NanoCpus','Memory','MemorySwap','PidsLimit']}}
 try:
  assert shell(['git','-C',str(root),'rev-parse','HEAD']).strip()==args.sha
  report['host']={'kernel':platform.release(),'cpu':shell(['lscpu'])[:5000],'docker':shell(['docker','version'])[:3000]}
  assert shell(['docker','info','--format','{{.CgroupVersion}}']).strip()=='2'
  report['dockerfile_sha256']=hashlib.sha256((context/'Dockerfile').read_bytes()).hexdigest();report['dockerfile_blob']=shell(['git','-C',str(root),'rev-parse','HEAD:experiments/supply-exp-005/Dockerfile']).strip()
  t=time.perf_counter()
  with (out/'build.log').open('w') as f:p=subprocess.run(['docker','build','--pull','--progress=plain','-t',image,str(context)],stdout=f,stderr=subprocess.STDOUT,timeout=900)
  assert p.returncode==0,'build failed';report['build_seconds']=time.perf_counter()-t;report['image_id']=shell(['docker','image','inspect',image,'--format','{{.Id}}']).strip()
  # Exact default CMD online.py, campaign opt-in; no test endpoint installed.
  t=time.perf_counter();shell(['docker','run','-d','--name',name,*limits,'-p','127.0.0.1:18765:10000','-e','ENABLE_CAMPAIGN=1','-e','COOKIE_SECURE=0','-e','PUBLIC_ORIGIN='+url,image]);ready=False
  while time.perf_counter()-t<60:
   try:
    with urllib.request.urlopen(url+'/healthz',timeout=2) as r:ready=r.status==200
   except Exception:pass
   if ready:break
   time.sleep(.25)
  report['startup_seconds']=time.perf_counter()-t;assert ready,'startup timeout'
  report['startup_peak_bytes']=int(shell(['docker','exec',name,'cat','/sys/fs/cgroup/memory.peak']))
  clients=[]
  import http.cookiejar
  for _ in range(4):
   c=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()));clients.append(c)
   with c.open(url+'/api?viewer=S',timeout=15) as r:state=json.load(r)['state'];assert state['clip']=='campaign' and state['campaign']['deployment']
  report['four_empty_campaign_sessions_peak_bytes']=int(shell(['docker','exec',name,'cat','/sys/fs/cgroup/memory.peak']))
  report['startup_inspect']=inspect();shell(['docker','rm','-f',name])
  # Checkpoint hydration exists ONLY inside the test process. Mounted research
  # evidence is read-only and never published by Handler. No network egress.
  with (out/'targeted.log').open('w') as f:
   p=subprocess.run(['docker','run','--name',name,*limits,'--network','none','-v',str(context/'evidence')+':/app/evidence:ro',image,'python','verify012.py','/tmp/report012.json'],stdout=f,stderr=subprocess.STDOUT,timeout=240)
  report['targeted_exit']=p.returncode;report['targeted_inspect']=inspect()
  copied=subprocess.run(['docker','cp',name+':/tmp/report012.json',str(out/'targeted.json')],capture_output=True,text=True)
  if copied.returncode:report['copy_error']=copied.stderr
  if (out/'targeted.json').exists():
   target=json.loads((out/'targeted.json').read_text());report['targeted']=target
   report['passed']=p.returncode==0 and target['passed'] and not report['targeted_inspect']['state']['OOMKilled']
 except Exception as e:report['failure']=str(e)
 finally:
  subprocess.run(['docker','logs','--tail','60',name],stdout=(out/'container.log').open('w'),stderr=subprocess.STDOUT)
  subprocess.run(['docker','rm','-f',name],capture_output=True)
  (out/'report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False))
  brief={k:v for k,v in report.items() if k not in ['host','targeted']};target=report.get('targeted',{});brief['targeted_summary']={k:v for k,v in target.items() if k not in ['actions','environment']};brief['actions']=target.get('actions',[])
  summary='# SUPPLY-CAMPAIGN-012\n\nGitHub runner only, NOT Render. One cold start; fixed 0.5 CPU/512 MiB, no swap headroom, 3s transactions.\n\n```json\n'+json.dumps(brief,indent=2,ensure_ascii=False)+'\n```\n\nPopulated-session peak includes in-container test driver and checkpoint copies. No full-game replay.\n'
  (out/'SUMMARY.md').write_text(summary);print(summary,flush=True)
 return 0 if report['passed'] else 1
if __name__=='__main__':raise SystemExit(main())

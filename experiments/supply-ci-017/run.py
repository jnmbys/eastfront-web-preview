"""017: reuse 012 cgroup runner, fixed 016 root-context build; never deploy."""
import argparse, hashlib, json, os, platform, subprocess, time, urllib.request
from pathlib import Path

def shell(args,timeout=30):
 p=subprocess.run(args,capture_output=True,text=True,timeout=timeout)
 if p.returncode:raise RuntimeError(' '.join(args[:5])+': '+p.stderr[-1500:])
 return p.stdout

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--candidate',required=True);ap.add_argument('--sha',required=True);ap.add_argument('--out',required=True);a=ap.parse_args()
 root=Path(a.candidate).resolve();out=Path(a.out).resolve();out.mkdir(exist_ok=True)
 driver=Path(__file__).resolve().parent;name='supply-ci017';image='supply-ci017:candidate';url='http://127.0.0.1:18765'
 limits=['--cpus','.5','--memory','512m','--memory-swap','512m','--pids-limit','128']
 report=dict(source_sha=a.sha,workflow_sha=os.getenv('GITHUB_SHA'),environment='GitHub ubuntu-24.04; NOT Render',budget_seconds=3,limits=dict(cpus=.5,memory_bytes=536870912,memory_swap_bytes=536870912,pids=128),passed=False)
 def inspect():
  d=json.loads(shell(['docker','inspect',name]))[0]
  return dict(state=d['State'],limits={k:d['HostConfig'][k] for k in ['NanoCpus','Memory','MemorySwap','PidsLimit']})
 def log(file):
  with (out/file).open('w') as f:subprocess.run(['docker','logs',name],stdout=f,stderr=subprocess.STDOUT)
 try:
  assert a.sha=='813b4072568352e95d0726fe5fe04060c889c554'
  assert shell(['git','-C',str(root),'rev-parse','HEAD']).strip()==a.sha
  assert not shell(['git','-C',str(root),'status','--porcelain']).strip()
  report['host']=dict(kernel=platform.release(),cpu=shell(['lscpu']),docker=shell(['docker','version']))
  assert shell(['docker','info','--format','{{.CgroupVersion}}']).strip()=='2'
  dockerfile=root/'experiments/supply-integrate-015/Dockerfile'
  report['dockerfile_sha256']=hashlib.sha256(dockerfile.read_bytes()).hexdigest();report['build_context']='repository root'
  t=time.perf_counter()
  with (out/'build.log').open('w') as f:p=subprocess.run(['docker','build','--pull','--progress=plain','-f',str(dockerfile),'-t',image,str(root)],stdout=f,stderr=subprocess.STDOUT,timeout=900)
  assert p.returncode==0,'build failed; see build.log'
  report['build_seconds']=time.perf_counter()-t
  report['image']=json.loads(shell(['docker','image','inspect',image]))[0]
  report['image_id']=report['image']['Id']
  t=time.perf_counter();shell(['docker','run','-d','--name',name,*limits,'-p','127.0.0.1:18765:10000','-e','COOKIE_SECURE=0','-e','PUBLIC_ORIGIN='+url,image]);ready=False
  while time.perf_counter()-t<60:
   try:
    with urllib.request.urlopen(url+'/healthz',timeout=2) as r:health=json.load(r);ready=r.status==200 and health['version']=='SUPPLY-INTEGRATE-015-v1'
   except Exception:pass
   if ready:break
   time.sleep(.25)
  report['startup_seconds']=time.perf_counter()-t;assert ready,'startup timeout';report['health']=health
  report['assets']=[]
  for path in ['/?supply=experiment','/styles.css','/app/experimental/supplyClient.js']:
   t=time.perf_counter()
   with urllib.request.urlopen(url+path,timeout=10) as r:data=r.read();assert r.status==200
   report['assets'].append(dict(path=path,bytes=len(data),http_seconds=time.perf_counter()-t,sha256=hashlib.sha256(data).hexdigest()))
   if path.startswith('/?'):
    import re
    scripts=re.findall(r'<script[^>]+src=["\x27]([^"\x27]+)',data.decode())
    assert scripts
    for src in scripts:
     with urllib.request.urlopen(url+'/'+src.lstrip('./'),timeout=10) as r:assert r.status==200;report['assets'].append(dict(path=src,bytes=len(r.read())))
  report['service_only_peak_bytes']=int(shell(['docker','exec',name,'cat','/sys/fs/cgroup/memory.peak']))
  report['service_cgroup']={f:shell(['docker','exec',name,'cat','/sys/fs/cgroup/'+f]).strip() for f in ['memory.events','cpu.stat','cpu.max','memory.max','memory.swap.max']}
  report['service_memory_scope']='default service.py + warm solver + descendants; HTTP acceptance client runs on host outside cgroup; includes transient docker exec reader'
  report['startup_inspect']=inspect();log('startup.log');shell(['docker','stop','--time','10',name]);report['startup_stopped_inspect']=inspect();shell(['docker','rm',name])
  with (out/'targeted.log').open('w') as f:
   p=subprocess.run(['docker','run','--name',name,*limits,'--network','none','-e','COOKIE_SECURE=0','-e','PUBLIC_ORIGIN=','-v',str(driver)+':/validation:ro',image,'python','/validation/verify.py','/tmp/report017.json'],stdout=f,stderr=subprocess.STDOUT,timeout=240)
  report['targeted_exit']=p.returncode;report['targeted_inspect']=inspect();log('container.log')
  copied=subprocess.run(['docker','cp',name+':/tmp/report017.json',str(out/'targeted.json')],capture_output=True,text=True)
  if copied.returncode:report['copy_error']=copied.stderr
  if (out/'targeted.json').exists():
   report['targeted']=json.loads((out/'targeted.json').read_text());report['passed']=p.returncode==0 and report['targeted']['passed'] and not report['targeted_inspect']['state']['OOMKilled'] and not report['startup_inspect']['state']['OOMKilled']
 except Exception as e:report['failure']=repr(e)
 finally:
  try:report['final_inspect']=inspect();log('final-container.log')
  except Exception:pass
  subprocess.run(['docker','rm','-f',name],capture_output=True)
  (out/'report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
  brief={k:v for k,v in report.items() if k not in ['host','image','targeted']}
  summary='# SUPPLY-CI-017\n\nGitHub runner only, NOT Render. Fixed 0.5 CPU/512 MiB; no swap headroom; unchanged 3s budget.\n\n```json\n'+json.dumps(brief,indent=2,ensure_ascii=False)+'\n```\n'
  (out/'SUMMARY.md').write_text(summary);print(summary,flush=True)
 return 0 if report['passed'] else 1
if __name__=='__main__':raise SystemExit(main())

"""Run in the approved existing Render service Web Shell, cwd /app.
Reuse immutable verify012 without altering serving code; verify research inputs.
"""
import os,json,hashlib,urllib.request,subprocess,time,socket
from pathlib import Path
sha='aca1f4b9801ab7b7c7073ac7973bb028cd6df435'
assert os.environ.get('RENDER_GIT_COMMIT')==sha
checks={'verify012.py':'4f93069620bcd8492c77cff994f5c7aa9002921371f2bfa1de190bdde1b4f5d0','online.py':'baa8250175575ee296685cfa58978907430577e61348a842962ad4a8d7b9e46f'}
for f,h in checks.items():assert hashlib.sha256(Path(f).read_bytes()).hexdigest()==h,f
files={'evidence/campaign011-close/checkpoint-117.json.gz':'af0e1f5e2e0dfa62f93971f0d63677bebcdfb2689c00d15e709b6ab3536c23ef','evidence/campaign011/run.json.gz':'9d4dc26acdfe25948197ea376cb922273b3ef46a37a9c7aa694bbaf999d5c766'}
for f,h in files.items():
 d=urllib.request.urlopen('https://raw.githubusercontent.com/jnmbys/eastfront-web-preview/'+sha+'/experiments/supply-exp-005/'+f,timeout=20).read();assert hashlib.sha256(d).hexdigest()==h;Path(f).parent.mkdir(parents=True,exist_ok=True);Path(f).write_bytes(d)
def cg():return {x:Path('/sys/fs/cgroup/'+x).read_text().strip() for x in ['cpu.max','memory.max','memory.peak','memory.events','memory.swap.max','pids.max']}
r={'source_sha':sha,'host':socket.gethostname(),'environment':'ACTUAL Render instance; existing verify012 targeted loopback harness alongside public service; not CI','before':cg(),'env':{k:os.getenv(k) for k in ['ENABLE_CAMPAIGN','PORT','COOKIE_SECURE','PUBLIC_ORIGIN','WEB_CONCURRENCY']}}
t=time.perf_counter()
with open('/tmp/verify013.log','w') as f:p=subprocess.run(['python','verify012.py','/tmp/verify013.json'],stdout=f,stderr=subprocess.STDOUT,timeout=180)
r.update(exit=p.returncode,elapsed_seconds=time.perf_counter()-t,after=cg(),test=json.loads(Path('/tmp/verify013.json').read_text()))
Path('/tmp/render013.json').write_text(json.dumps(r,ensure_ascii=False,indent=2))
print('DEPLOY013_RESULT '+json.dumps(r,ensure_ascii=False),flush=True)
with open('/proc/1/fd/1','w') as log:print('DEPLOY013_RESULT '+json.dumps(r,ensure_ascii=False),file=log,flush=True)

"""Record local capability/timing evidence without treating it as a resource cap test."""
import json,os,platform,shutil,subprocess,time,urllib.request,hashlib
from pathlib import Path
import numpy,scipy
ROOT=Path(__file__).resolve().parents[2]
OUT=Path(__file__).parent/'evidence'
run=lambda *args:subprocess.run(args,cwd=ROOT,capture_output=True,text=True,check=True).stdout.strip()
began=time.perf_counter()
with urllib.request.urlopen('http://127.0.0.1:8765/healthz',timeout=5) as r:
    health={'status':r.status,'body':json.load(r),'request_seconds':time.perf_counter()-began}
rows=[a for f in OUT.glob('*-authority.json') for a in json.loads(f.read_text(encoding='utf-8'))['actions']]
report={
 'task':'SUPPLY-VERIFY-016','date':'2026-09-30','baseline_sha':'a3346e4c34567811fb07652cb26b706833daa183',
 'baseline_tree':'5ddc4217f059a8f0e8da302e73d7e7fe31eb0b03','branch':run('git','branch','--show-current'),
 'platform':platform.system()+' '+platform.release(),'python':platform.python_version(),'node':run('node','--version'),
 'numpy':numpy.__version__,'scipy':scipy.__version__,'logical_cpus':os.cpu_count(),
 'docker_on_path':shutil.which('docker'),'docker_standard_install':Path('C:/Program Files/Docker/Docker/resources/bin/docker.exe').exists(),
 'wsl_observation':'wsl --list --quiet exited 1: WSL not installed',
 'resource_validation':{'status':'BLOCKED','required_cpu':0.5,'required_memory_bytes':536870912,'budget_seconds':3,'container_started':False,'memory_peak_bytes':None,'reason':'No Docker executable, standard Docker installation or WSL runtime; no install or capacity change requested.'},
 'health':health,'startup':'Service printed SUPPLY-INTEGRATE-015 ready 127.0.0.1 8765; cold-start duration not instrumented.',
 'browser':'Codex in-app Chromium browser; real DOM clicks and screenshots; 1280x720 viewport; no touch/Huawei claim',
 'authority_observations':{'count':len(rows),'all_accepted':all(a['accepted'] for a in rows),'all_frozen_state_equal':all(a.get('sandbox_state_equal') for a in rows),'max_transaction_seconds':max(a.get('seconds',0) for a in rows),'all_within_3s':all(a.get('seconds',4)<=3 for a in rows)},
 'unmodified_runtime_diff':run('git','diff','--name-only','HEAD','--','src','server','vendor','experiments/supply-exp-005','experiments/supply-integrate-015'),
 'missing_governance_files':['PROJECT_STATE','WORKER_PROTOCOL','AGENTS.md'],
 'render_read':'list_services returned no workspace selected; no service mutation or deploy; plan uses versioned 013 evidence, not fresh live configuration.'
}
(OUT/'environment.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
manifest={str(f.relative_to(OUT)):hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(OUT.iterdir()) if f.is_file() and f.name!='SHA256.json'}
(OUT/'SHA256.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report['authority_observations'],indent=2))

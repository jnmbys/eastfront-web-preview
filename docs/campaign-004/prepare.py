"""Materialize the exact pinned runtime under this research directory; no runtime edits.
Usage: python docs/campaign-004/prepare.py --tsc /path/to/typescript/bin/tsc
Requires local Git objects, Node >=22, TypeScript, numpy==2.3.5, scipy==1.17.0.
No download, server, deployment, or production build is performed.
"""
import argparse, hashlib, io, json, subprocess, tarfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SOURCE = '813b4072568352e95d0726fe5fe04060c889c554'
INPUTS = {
 'industry004': ('46529bef14a331b07947cb9bb5e352825af6640b', 'docs/industry-contract-004'),
 'rule002r1': ('1fe5a2f342928fe9da0cd9f0aaaf825b993483e1', 'docs/rule-campaign-002'),
 'campaign003': ('559fb7df1e6ecbf357ee8f263dd1b2cfaa4105dd', 'docs/campaign-003'),
}
EXCERPTS = {
 'industry004': ['REPORT.md','PROFILE.json','DEPENDENCY_R1.md','inputs/CONTRACT.md','inputs/FIELDS.md'],
 'rule002r1': ['r1/REVIEW.md','r1/DECISION.json','r1/LAYOUT_REVIEW.md'],
 'campaign003': ['REPORT.md','SUMMARY.json'],
}

def git(*args):
 return subprocess.check_output(['git', *args], cwd=ROOT)

def sha(data): return hashlib.sha256(data).hexdigest()

def save(path, obj):
 path.write_bytes((json.dumps(obj, ensure_ascii=False, indent=2)+'\n').encode('utf8'))

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--tsc',required=True);a=p.parse_args()
 import numpy,scipy
 assert (numpy.__version__,scipy.__version__)==('2.3.5','1.17.0')
 assert git('rev-parse',SOURCE).decode().strip()==SOURCE
 runtime=HERE/'.runtime';runtime.mkdir(exist_ok=True)
 prefix='experiments/supply-exp-005'
 archive=git('archive',SOURCE,prefix)
 with tarfile.open(fileobj=io.BytesIO(archive)) as tf: tf.extractall(runtime,filter='data')
 exp=runtime/prefix
 hashes={}
 for path in git('ls-tree','-r','--name-only',SOURCE,'--',prefix).decode().splitlines():
  data=(runtime/path).read_bytes();assert data==git('show',SOURCE+':'+path)
  hashes[path]=sha(data)
 subprocess.run([__import__('sys').executable,str(exp/'restore-fixtures.py')],check=True,cwd=exp)
 subprocess.run(['node',a.tsc,'-p',str(exp/'core/tsconfig.json')],check=True,cwd=exp)
 inputs={}
 for label,(commit,path) in INPUTS.items():
  files={n:sha(git('show',commit+':'+n)) for n in git('ls-tree','-r','--name-only',commit,'--',path).decode().splitlines()}
  assert files
  inputs[label]={'commit':commit,'tree':git('rev-parse',commit+':'+path).decode().strip(),'files_sha256':files}
  for relative in EXCERPTS[label]:
   target=HERE/'inputs'/label/relative;target.parent.mkdir(parents=True,exist_ok=True)
   target.write_bytes(git('show',commit+':'+path+'/'+relative))
 # Preserve the fixed layout bytes referenced by R1, not a newer art working tree.
 layout=git('show',INPUTS['rule002r1'][0]+':docs/rule-campaign-002/r1/layout-source.json')
 (HERE/'layout-source.json').write_bytes(layout)
 save(HERE/'PROVENANCE.json',dict(runtime_source_commit=SOURCE,
  source_tree=git('rev-parse',SOURCE+':'+prefix).decode().strip(),runtime_files_sha256=hashes,
  fixtures_sha256=json.loads((exp/'fixtures-sha256.json').read_text()),
  compiled_sha256={str(f.relative_to(exp)):sha(f.read_bytes()) for f in sorted((exp/'core/dist').rglob('*.js'))},
  research_inputs=inputs,layout_sha256=sha(layout),
  versions={'python':__import__('sys').version,'node':subprocess.check_output(['node','--version'],text=True).strip(),
   'typescript':subprocess.check_output(['node',a.tsc,'--version'],text=True).strip(),
   'numpy':numpy.__version__,'scipy':scipy.__version__},
  authority='live.execute -> core-bridge RulesEngine.apply + bounded.transaction -> original solver',
  scope='Offline direct authority calls, not HTTP/server or deployment acceptance'))
 print('Pinned runtime, research inputs, fixtures, and compiled Core verified.')

if __name__=='__main__':main()

"""Pin/copy existing 008/011 sources and verified runtimes under this directory only.
--reuse-008/--reuse-011 take original prepared experiment directories, read-only.
Without reuse, verify an already prepared local copy. Never run historical verify.py.
"""
import argparse,subprocess,tarfile,io,os,sys,json,hashlib,shutil,gzip
from pathlib import Path
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1];OUT=HERE/'.runtime'
if os.name=='nt':OUT=Path('\\\\?\\'+str(OUT))
PINS={'008':'96bf1d7307063ecb6331fc44b28a832bb2aceac6','011':'1e7fba5fe234b2bd33f50237401868a314dfd0ea'}
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def sha(b):return hashlib.sha256(b).hexdigest()
def save(p,x):p.write_bytes((json.dumps(x,ensure_ascii=False,indent=2)+'\n').encode())
def main():
 p=argparse.ArgumentParser();p.add_argument('--reuse-008');p.add_argument('--reuse-011');a=p.parse_args()
 import numpy,scipy
 assert (numpy.__version__,scipy.__version__)==('2.3.5','1.17.0')
 policy=(HERE/'POLICY.json').read_bytes();lock=HERE/'POLICY_LOCK.json'
 if lock.exists():assert json.loads(lock.read_bytes())['sha256']==sha(policy),'Policy changed after preregistration'
 else:save(lock,dict(sha256=sha(policy),status='PRE_RUN_FIXED',no_arm_executed=True,policy='POLICY.json'))
 evidence={}
 for tag,commit in PINS.items():
  base=OUT/tag;base.mkdir(parents=True,exist_ok=True);prefix='experiments/industry-integrate-'+tag
  with tarfile.open(fileobj=io.BytesIO(git('archive',commit,prefix))) as tf:
   for member in tf.getmembers():
    if member.name.rstrip('/')=='experiments':continue
    assert not member.name.startswith('/') and '..' not in Path(member.name).parts
    target=base/Path(member.name).relative_to(prefix)
    if member.isdir():target.mkdir(parents=True,exist_ok=True)
    else:
     assert member.isfile()
     target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(tf.extractfile(member).read())
  dest=base;files={}
  for name in git('ls-tree','-r','--name-only',commit,'--',prefix).decode().splitlines():
   b=(base/Path(name).relative_to(prefix)).read_bytes();assert b==git('show',commit+':'+name);files[name]=sha(b)
  reuse=getattr(a,'reuse_'+tag)
  if reuse:
   src=Path(reuse)/'.runtime';manifest=json.loads((src/'manifest.json').read_bytes())
   if (HERE/'PROVENANCE.json').exists():
    expected=json.loads((HERE/'PROVENANCE.json').read_bytes())['inputs'][tag]['runtime_manifest_sha256']
    assert sha((src/'manifest.json').read_bytes())==expected,'PREPARED_INPUT_MANIFEST_VERSION_MISMATCH'
   for name,h in manifest['files'].items():
    raw=(src/name).read_bytes();assert sha(raw)==h,name
    target=dest/'.runtime'/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(raw)
   shutil.copyfile(src/'manifest.json',dest/'.runtime/manifest.json')
  else:
   assert (dest/'.runtime/manifest.json').exists(),'Supply --reuse-'+tag+' with the pinned prepared input; see README.md. No historical tests are needed.'
  manifest=json.loads((dest/'.runtime/manifest.json').read_bytes())
  if (HERE/'PROVENANCE.json').exists():
   assert sha((dest/'.runtime/manifest.json').read_bytes())==json.loads((HERE/'PROVENANCE.json').read_bytes())['inputs'][tag]['runtime_manifest_sha256']
  for name,h in manifest['files'].items():assert sha((dest/'.runtime'/name).read_bytes())==h,name
  # Pinned preparers may write patch evidence, but must reproduce original bytes exactly.
  for name,h in files.items():assert sha((base/Path(name).relative_to(prefix)).read_bytes())==h,name
  evidence[tag]=dict(commit=commit,files=files,runtime_manifest_sha256=sha((dest/'.runtime/manifest.json').read_bytes()),runtime_file_count=len(manifest['files']))
  print('Prepared',tag,'with all hashes verified; no old test suites run.',flush=True)
 t8=json.loads(gzip.decompress((OUT/'008/TRACE.json.gz').read_bytes()))
 t11=json.loads(gzip.decompress((OUT/'011/TRACE.json.gz').read_bytes()))
 assert t8['initial']['bundleJSON']==t11['initial']['bundleJSON']
 raw=t8['initial']['bundleJSON'].encode();(HERE/'START_T5.json.gz').write_bytes(gzip.compress(raw,mtime=0))
 candidate=json.loads((OUT/'011/.runtime/rule/candidate.json').read_bytes())
 assert len(candidate['blockerReview']['rows'])==35
 save(HERE/'BLOCKERS.json',dict(source='RULE-CAMPAIGN-005 candidate preserved via 011',rows=candidate['blockerReview']['rows'],closed=0,runtimeAllowed=False))
 save(HERE/'PROVENANCE.json',dict(inputs=evidence,policy_sha256=sha(policy),start_serialized_sha256=sha(raw),random=t8['initial']['bundle']['core']['random'],
  original_runtime_commit='813b4072568352e95d0726fe5fe04060c889c554',new_authority='Current CAMPAIGN-005 user instruction, offline only',
  historical_scope='008/011 owner APIs used unchanged only for their E5/T6 slices; no old grant extended to later combat',
  versions=dict(python=sys.version,numpy=numpy.__version__,scipy=scipy.__version__,node=subprocess.check_output(['node','--version'],text=True).strip())))
 print('Same real T5 and 35 preserved blockers verified. Policy locked before execution.')
if __name__=='__main__':main()

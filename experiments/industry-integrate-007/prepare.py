"""Restore 006 unchanged inside 007, then derive the minimal PE Core seam."""
import hashlib, io, json, os, subprocess, sys, tarfile
from pathlib import Path
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
OUT=HERE/'.runtime'
BASE='4ba4867862d54c3f436b7395fff3b52d38da7848'
RULE='24afa379ad98b8a62470f79bd65a210fd0df61ce'
def git(*a): return subprocess.check_output(['git',*a],cwd=ROOT)
def sha(b): return hashlib.sha256(b).hexdigest()
def main():
    target=OUT/'base';target.mkdir(parents=True,exist_ok=True)
    prefix='experiments/industry-integrate-006'
    with tarfile.open(fileobj=io.BytesIO(git('archive',BASE,prefix))) as tf: tf.extractall(target,filter='data')
    for p in git('ls-tree','-r','--name-only',BASE,'--',prefix).decode().splitlines():
        assert (target/p).read_bytes()==git('show',BASE+':'+p)
    env=dict(os.environ,GIT_DIR=git('rev-parse','--absolute-git-dir').decode().strip(),GIT_WORK_TREE=str(target))
    subprocess.run([sys.executable,str(target/prefix/'prepare.py')],check=True,env=env)
    (OUT/'rule').mkdir(exist_ok=True)
    for name in ['candidate.json','BLOCKERS.json','VALIDATION.json']:
        (OUT/'rule'/name).write_bytes(git('show',RULE+':docs/rule-campaign-004/'+name))
    assert sha((OUT/'rule/candidate.json').read_bytes())=='a80e32622ea28dc01472ca75a7c9d6ccb8cb9b03eed50e293a45f31fd4087038'
    subprocess.run(['node',str(HERE/'prepare-seam.mjs')],check=True)
    files={str(p.relative_to(OUT)).replace('\\','/'):sha(p.read_bytes()) for p in sorted(OUT.rglob('*'))
           if p.is_file() and '__pycache__' not in p.parts and 'test-inputs' not in p.parts and p!=OUT/'manifest.json'}
    (OUT/'manifest.json').write_bytes((json.dumps(dict(base=BASE,rule=RULE,files=files),indent=2)+'\n').encode())
    print(json.dumps(dict(status='PREPARED_007',files=len(files),campaignReplayed=False)))
if __name__=='__main__': main()

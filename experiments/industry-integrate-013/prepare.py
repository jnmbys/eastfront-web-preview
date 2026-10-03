"""Restore pinned original Core/live/SP; no production patch to any engine file."""
import io,json,os,subprocess,sys,tarfile,hashlib
from pathlib import Path
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1];OUT=HERE/'.runtime'
RULE='b3c18fa6daf0cf7409e0821918e7ffdd1dac4a51'
def sha(b):return hashlib.sha256(b).hexdigest()
def git(*a):return subprocess.check_output(['git',*a],cwd=ROOT)
def main():
    target=OUT/'base6';target.mkdir(parents=True,exist_ok=True);prefix='experiments/industry-integrate-006'
    if '--check-existing' not in sys.argv:
        with tarfile.open(fileobj=io.BytesIO(git('archive','4ba4867862d54c3f436b7395fff3b52d38da7848',prefix))) as tf:tf.extractall(target,filter='data')
        env=dict(os.environ,GIT_DIR=git('rev-parse','--absolute-git-dir').decode().strip(),GIT_WORK_TREE=str(target))
        subprocess.run([sys.executable,str(target/prefix/'prepare.py')],check=True,env=env)
    m=json.loads((target/prefix/'.runtime/manifest.json').read_bytes())
    for n,h in m['files'].items():assert sha((target/prefix/'.runtime'/n).read_bytes())==h,n
    raw=git('show',RULE+':docs/rule-campaign-008/candidate.json');assert sha(raw)=='c12d6d020996652f5c8f44f4007c91ffe0523d7f4999a591e36271e911ed0223'
    (OUT/'candidate.json').write_bytes(raw)
    for name in ['TRACE.json.gz','EVIDENCE.json']:
        (OUT/('012-'+name)).write_bytes(git('show','e64c0e11fb16b05cfe725240193e8590b4eefd88:experiments/industry-integrate-012/'+name))
    evidence=dict(ruleCommit=RULE,candidateSha256=sha(raw),originalCore=m['core'],original005=m['base'],
        originalEngineFilesUnmodified=True,patches=[],dependencyManifestSha256=sha((target/prefix/'.runtime/manifest.json').read_bytes()),
        versions=m['versions'],sourceFiles=m['inputs'])
    (HERE/'INPUTS.json').write_bytes((json.dumps(evidence,indent=2)+'\n').encode())
    print('PREPARED_013_ORIGINAL_ENGINE_NO_PATCH')
if __name__=='__main__':main()

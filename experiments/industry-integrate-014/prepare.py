"""Restore fixed original engine and the reviewed 009 offline solver seam only."""
import io,json,os,subprocess,sys,tarfile
from config import HERE,OUT,BASE,BASE6,sha
ROOT=HERE.parents[1]
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def main():
    target=OUT/'base6';target.mkdir(parents=True,exist_ok=True);prefix='experiments/industry-integrate-006'
    if '--check-existing' not in sys.argv:
        with tarfile.open(fileobj=io.BytesIO(git('archive','4ba4867862d54c3f436b7395fff3b52d38da7848',prefix))) as tf:tf.extractall(target,filter='data')
        env=dict(os.environ,GIT_DIR=git('rev-parse','--absolute-git-dir').decode().strip(),GIT_WORK_TREE=str(target))
        subprocess.run([sys.executable,str(target/prefix/'prepare.py')],env=env,check=True)
    m=json.loads((BASE6/'manifest.json').read_bytes())
    for p,h in m['files'].items():assert sha((BASE6/p).read_bytes())==h
    (OUT/'solver').mkdir(exist_ok=True);items=[]
    def restore(commit,path,dest):
        raw=git('show',commit+':'+path);(OUT/dest).write_bytes(raw)
        items.append(dict(commit=commit,path=path,destination=dest,sha256=sha(raw)));return raw
    for n in ['TRACE.json.gz','EVIDENCE.json','APPROVAL.json']:
        restore(BASE,'experiments/industry-integrate-013/'+n,'013-'+n)
    for n in ['model.py','signature_model.py','route_signatures.py']:
        restore('813b4072568352e95d0726fe5fe04060c889c554','experiments/supply-exp-005/'+n,'solver/'+n)
    ref='b5bc3e6f4400c6a91152d9170e420aa31dc51dcb'
    restore(ref,'experiments/industry-integrate-009/solver_audit.py','solver/solver_audit.py')
    restore(ref,'experiments/industry-integrate-009/experiment.py','solver/reference009.py')
    patch=restore(ref,'experiments/industry-integrate-009/SOLVER-SEAM.patch','solver.patch')
    subprocess.run(['git','apply','--directory=experiments/industry-integrate-014/.runtime/solver','-'],input=patch,check=True,cwd=ROOT)
    (HERE/'SOLVER-SEAM.patch').write_bytes(patch)
    old=json.loads(git('show',ref+':experiments/industry-integrate-009/INPUTS.json'))
    assert sha((OUT/'solver/signature_model.py').read_bytes())==old['signatureAfterSha256']
    for ref,path,dest in [('f09911e4792bd1da33185807f03c68b2cd9565fe','docs/rule-campaign-006/candidate.json','rule006.json'),
        ('b3c18fa6daf0cf7409e0821918e7ffdd1dac4a51','docs/rule-campaign-008/candidate.json','rule008.json')]:restore(ref,path,dest)
    manifest=dict(base013=BASE,originalEngineUnmodified=True,solverSeam='exact unchanged 009 maintenance-preserving feasibility model',
        productionOrTransportAuthorization=False,inputs=items,files={x['destination']:sha((OUT/x['destination']).read_bytes()) for x in items},versions=m['versions'])
    (HERE/'INPUTS.json').write_bytes((json.dumps(manifest,indent=2)+'\n').encode())
    print('PREPARED_014_NO_ENGINE_PATCH_NO_REPLAY')
if __name__=='__main__':main()

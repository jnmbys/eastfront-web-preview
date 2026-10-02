"""Pinned sources only; build all derived files below this experiment."""
import hashlib, io, json, os, subprocess, sys, tarfile, shutil, difflib
from pathlib import Path
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
OUT=HERE/'.runtime'
BASE='bad006249b81d07c6f63f8df4010ce4fcec51871'
RULE='e0c7fed6bfb2053b865f242fd4cf783a040eeb7f'
CANDIDATE_SHA='65cb3f2a20262c82fdc7cd9a44f5c2d93a81c46c806e05e9524c0dc72060cef5'
def git(*a):return subprocess.check_output(['git',*a],cwd=ROOT)
def sha(b):return hashlib.sha256(b).hexdigest()
def main():
    target=OUT/'base6';target.mkdir(parents=True,exist_ok=True)
    prefix='experiments/industry-integrate-006'
    if '--derive-only' not in sys.argv:
        with tarfile.open(fileobj=io.BytesIO(git('archive','4ba4867862d54c3f436b7395fff3b52d38da7848',prefix))) as tf:tf.extractall(target,filter='data')
        env=dict(os.environ,GIT_DIR=git('rev-parse','--absolute-git-dir').decode().strip(),GIT_WORK_TREE=str(target),INDUSTRY_PYTHON=sys.executable)
        subprocess.run([sys.executable,str(target/prefix/'prepare.py')],check=True,env=env)
    else:
        previous=json.loads((target/prefix/'.runtime/manifest.json').read_bytes())
        for name,h in previous['files'].items():assert sha((target/prefix/'.runtime'/name).read_bytes())==h
    (OUT/'rule').mkdir(exist_ok=True)
    for name in ['candidate.json','VALIDATION.json','T5_FACTS.json']:
        (OUT/'rule'/name).write_bytes(git('show',RULE+':docs/rule-campaign-005/'+name))
    assert sha((OUT/'rule/candidate.json').read_bytes())==CANDIDATE_SHA
    source=OUT/'pe-original';derived=OUT/'live'
    shutil.copytree(target/prefix/'.runtime/live/experiments/supply-exp-005',source,dirs_exist_ok=True)
    pe_patch=git('show',BASE+':experiments/industry-integrate-007/PE-SEAM.patch')
    subprocess.run(['git','apply','--directory=experiments/industry-integrate-008/.runtime/pe-original','-'],input=pe_patch,check=True,cwd=ROOT)
    subprocess.run(['node','--input-type=module','-e',"import fs from 'node:fs';import {stripTypeScriptTypes} from 'node:module';const d=process.argv[1];for(const n of ['rules/recovery','engine/RulesEngine'])fs.writeFileSync(d+'/core/dist/'+n+'.js',stripTypeScriptTypes(fs.readFileSync(d+'/core/src/'+n+'.ts','utf8'),{mode:'transform'}));",str(source)],check=True)
    pinned_pe=json.loads(git('show',BASE+':experiments/industry-integrate-007/SEAM-HASHES.json'))
    assert sha(pe_patch)==pinned_pe['patchSha256']
    for change in pinned_pe['changes']:
        assert sha((source/change['path']).read_bytes())==change['afterSha256']
        if change['compiledSha256']:
            compiled=change['path'].replace('core/src/','core/dist/').replace('.ts','.js')
            assert sha((source/compiled).read_bytes())==change['compiledSha256']
    shutil.copytree(source,derived,dirs_exist_ok=True)
    changes=[];patch=[]
    def edit(name,changeset):
        before=(source/name).read_text(encoding='utf8');after=before
        for old,new in changeset:
            assert after.count(old)==1,(name,old)
            after=after.replace(old,new)
        (derived/name).write_bytes(after.encode())
        changes.append(dict(path=name,beforeSha256=sha(before.encode()),afterSha256=sha(after.encode())))
        patch.extend(difflib.unified_diff(before.splitlines(True),after.splitlines(True),fromfile='a/'+name,tofile='b/'+name))
    # Sidecar witness only. Original execute phase transition, settlement, attrition,
    # sync, accepted action log, seen and journal all remain authoritative.
    edit('live.py',[
        ('began=time.perf_counter();deadline=began+seconds','began=time.perf_counter();deadline=began+seconds;boundary=None'),
        ("raise TimeoutError('supply unresolved')", "raise TimeoutError('supply unresolved: '+str(result.get('error')))"),
        ("s=result['state'];settled=True;losses=", "boundary=result['boundary'];boundary.update(coreSnapshot=deepcopy(newcore),jointSPInputHash=digest(dict(core=newcore,logistics=s)));s=result['state'];settled=True;losses="),
        ('return dict(ok=True,state=b,seconds=time.perf_counter()-began)', 'return dict(ok=True,state=b,seconds=time.perf_counter()-began,boundary=boundary)')])
    edit('bounded.py',[
        ('import multiprocessing as mp,time,atexit\n_WORKER=None','import multiprocessing as mp,time,atexit\n_WORKER=None\nCONTEXT=None'),
        ('s,op,deadline=job;', 's,op,deadline,context=job;boundary=None;'),
        ("if op=='settle':out,result,retry=model.settle(s,s['epoch'])", "if op=='settle':\n    import freight_audit\n    freight_audit.PROGRAMS.clear()\n    if context and context.get('testFault')=='solver_failure':raise ValueError('SYNTHETIC_SOLVER_FAILURE')\n    out,result,retry=model.settle(s,s['epoch'])\n    boundary=freight_audit.inspect(s,out,result,context,deadline)"),
        ("result=result,retry=retry,profile=list(model.PROFILE)", "result=result,retry=retry,profile=list(model.PROFILE),boundary=boundary"),
        ('conn.send((s,op,deadline))', 'conn.send((s,op,deadline,CONTEXT))')])
    # The exact solver already checks all rows/bounds and integrality each stage.
    # Retain a final independent full-program witness, including unnamed rows.
    edit('signature_model.py',[("r['solver_retries']=p.solver_retries", "r['solver_retries']=p.solver_retries\n import freight_audit\n freight_audit.capture_program(side,p,x)")])
    shutil.copyfile(HERE/'freight_audit.py',derived/'freight_audit.py')
    # Worker reads the same fixed candidate from disk, never a request certificate.
    shutil.copyfile(OUT/'rule/candidate.json',derived/'candidate008.json')
    (HERE/'SETTLEMENT-SEAM.patch').write_bytes(''.join(patch).encode())
    (HERE/'SEAM-HASHES.json').write_text(json.dumps(dict(base=BASE,changes=changes,patchSha256=sha(''.join(patch).encode()),PESeam=pinned_pe),indent=2)+'\n',encoding='utf8')
    files={str(p.relative_to(OUT)).replace('\\','/'):sha(p.read_bytes()) for folder in ['base6','pe-original','live','rule'] for p in sorted((OUT/folder).rglob('*')) if p.is_file() and '__pycache__' not in p.parts}
    (OUT/'manifest.json').write_text(json.dumps(dict(base=BASE,rule=RULE,files=files),indent=2)+'\n',encoding='utf8')
    print(json.dumps(dict(status='PREPARED_008',files=len(files),campaignReplayed=False)))
if __name__=='__main__':main()

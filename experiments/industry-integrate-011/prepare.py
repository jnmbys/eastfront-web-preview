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
    for commit,path,dest in [
        ('f09911e4792bd1da33185807f03c68b2cd9565fe','docs/rule-campaign-006/candidate.json','rule006.json'),
        ('2e5e4b810a8ca1c088012381bd52c9870ad0198e','experiments/industry-integrate-010/POLICY.json','POLICY010.json'),
        ('2e5e4b810a8ca1c088012381bd52c9870ad0198e','experiments/industry-integrate-010/RESULT.json','PREDICTION010.json'),
        ('96bf1d7307063ecb6331fc44b28a832bb2aceac6','experiments/industry-integrate-008/TRACE.json.gz','TRACE008.json.gz'),
        ('96bf1d7307063ecb6331fc44b28a832bb2aceac6','experiments/industry-integrate-008/EVIDENCE.json','EVIDENCE008.json')]:
        (OUT/'rule'/dest).write_bytes(git('show',commit+':'+path))
    assert sha((OUT/'rule/candidate.json').read_bytes())==CANDIDATE_SHA
    source=OUT/'pe-original';derived=OUT/'live'
    shutil.copytree(target/prefix/'.runtime/live/experiments/supply-exp-005',source,dirs_exist_ok=True)
    pe_patch=git('show',BASE+':experiments/industry-integrate-007/PE-SEAM.patch')
    subprocess.run(['git','apply','--directory=experiments/industry-integrate-011/.runtime/pe-original','-'],input=pe_patch,check=True,cwd=ROOT)
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
        ("if op=='settle':out,result,retry=model.settle(s,s['epoch'])", "if op=='settle':\n    import freight_audit\n    freight_audit.configure(s,context)\n    if context and context.get('testFault')=='solver_failure':raise ValueError('SYNTHETIC_SOLVER_FAILURE')\n    out,result,retry=model.settle(s,s['epoch'])\n    boundary=freight_audit.inspect(s,out,result,context,deadline)"),
        ("result=result,retry=retry,profile=list(model.PROFILE)", "result=result,retry=retry,profile=list(model.PROFILE),boundary=boundary"),
        ('conn.send((s,op,deadline))', 'conn.send((s,op,deadline,CONTEXT))')])
    # The exact solver already checks all rows/bounds and integrality each stage.
    # Retain a final independent full-program witness, including unnamed rows.
    edit('signature_model.py',[
        ("began=time.perf_counter();p=Program();groups={};", "import freight_audit\n cargo=freight_audit.reservation(side)\n began=time.perf_counter();p=Program();groups={};"),
        ("def row(a,hi,label):p.row(a,hi=hi,label=label);groups[label]=(a,hi)",
         "def row(a,hi,label):\n  bound=hi-cargo.get(label,0);assert bound>=0\n  p.row(a,hi=bound,label=label);groups[label]=(a,bound)"),
        ("r['solver_retries']=p.solver_retries", "r['solver_retries']=p.solver_retries\n freight_audit.capture_program(side,p,x,r,arcs)")])
    original=(source/'signature_model.py').read_text(encoding='utf8');modified=(derived/'signature_model.py').read_text(encoding='utf8')
    start=" if s.get('allocator')!='progressive':";end=' # Report actual arc flows'
    assert original[original.index(start):original.index(end)]==modified[modified.index(start):modified.index(end)]
    for name,dest in [('experiment.py','reference009.py'),('solver_audit.py','audit009.py')]:
        (derived/dest).write_bytes(git('show','b5bc3e6f4400c6a91152d9170e420aa31dc51dcb:experiments/industry-integrate-009/'+name))
    shutil.copyfile(HERE/'freight_audit.py',derived/'freight_audit.py')
    # Worker reads the same fixed candidate from disk, never a request certificate.
    shutil.copyfile(OUT/'rule/candidate.json',derived/'candidate008.json')
    for name in ['rule006.json','POLICY010.json']:
        shutil.copyfile(OUT/'rule'/name,derived/name)
    (HERE/'SETTLEMENT-SEAM.patch').write_bytes(''.join(patch).encode())
    (HERE/'SEAM-HASHES.json').write_text(json.dumps(dict(base=BASE,changes=changes,patchSha256=sha(''.join(patch).encode()),PESeam=pinned_pe),indent=2)+'\n',encoding='utf8')
    files={str(p.relative_to(OUT)).replace('\\','/'):sha(p.read_bytes()) for folder in ['base6','pe-original','live','rule'] for p in sorted((OUT/folder).rglob('*')) if p.is_file() and '__pycache__' not in p.parts}
    (OUT/'manifest.json').write_text(json.dumps(dict(base=BASE,rule=RULE,industry011Base='2e5e4b810a8ca1c088012381bd52c9870ad0198e',industry011Rule='f09911e4792bd1da33185807f03c68b2cd9565fe',files=files),indent=2)+'\n',encoding='utf8')
    # Explicit diff against the pinned 008 owner/audit/query/preparer, never edit those files.
    inheritance=[];lineage=[]
    for name in ['adapter.py','freight_audit.py','query.mjs','prepare.py','config.py']:
        old=git('show','96bf1d7307063ecb6331fc44b28a832bb2aceac6:experiments/industry-integrate-008/'+name).decode()
        new=(HERE/name).read_text(encoding='utf8')
        inheritance.extend(difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile='a/'+name,tofile='b/'+name))
        lineage.append(dict(path=name,baseline008Sha256=sha(old.encode()),derived011Sha256=sha(new.encode())))
    (HERE/'OWNER-SEAM.patch').write_bytes(''.join(inheritance).encode())
    (HERE/'LINEAGE.json').write_bytes((json.dumps(dict(changes=lineage,ownerPatchSha256=sha(''.join(inheritance).encode()),completeObjectivesPreserved=True),indent=2)+'\n').encode())
    print(json.dumps(dict(status='PREPARED_011',files=len(files),campaignReplayed=False)))
if __name__=='__main__':main()

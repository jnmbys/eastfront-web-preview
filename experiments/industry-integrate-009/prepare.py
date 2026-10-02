"""Restore only pinned inputs and solver modules; no Core or campaign execution."""
import hashlib,json,subprocess,difflib
from pathlib import Path
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
OUT=HERE/'.runtime'
BASE='96bf1d7307063ecb6331fc44b28a832bb2aceac6'
CORE='813b4072568352e95d0726fe5fe04060c889c554'
RULE='e0c7fed6bfb2053b865f242fd4cf783a040eeb7f'
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def sha(raw):return hashlib.sha256(raw).hexdigest()
def main():
    OUT.mkdir(exist_ok=True);(OUT/'solver').mkdir(exist_ok=True);inputs=[]
    for name in ['TRACE.json.gz','EVIDENCE.json']:
        path='experiments/industry-integrate-008/'+name;raw=git('show',BASE+':'+path)
        (OUT/name).write_bytes(raw);inputs.append(dict(commit=BASE,path=path,sha256=sha(raw)))
    raw=git('show',RULE+':docs/rule-campaign-005/candidate.json')
    assert sha(raw)=='65cb3f2a20262c82fdc7cd9a44f5c2d93a81c46c806e05e9524c0dc72060cef5'
    (OUT/'candidate.json').write_bytes(raw);inputs.append(dict(commit=RULE,path='docs/rule-campaign-005/candidate.json',sha256=sha(raw)))
    for name in ['model.py','signature_model.py','route_signatures.py']:
        path='experiments/supply-exp-005/'+name;raw=git('show',CORE+':'+path)
        (OUT/'solver'/name).write_bytes(raw);inputs.append(dict(commit=CORE,path=path,sha256=sha(raw)))
    path=OUT/'solver/signature_model.py';before=path.read_text(encoding='utf8');after=before
    def replace(old,new):
        nonlocal after
        assert after.count(old)==1,old
        after=after.replace(old,new)
    replace("def solve_network(s,side='G'):","def solve_network(s,reference,cargo,side='G'):\n assert side=='G', 'ONLY_GERMAN_ALTERNATIVE'\n reference={u['id']:u for u in reference}")
    replace("def row(a,hi,label):p.row(a,hi=hi,label=label);groups[label]=(a,hi)",
        "def row(a,hi,label):\n  # Fixed material load is a constant in the SAME original capacity row.\n  bound=hi-cargo.get(label,0);assert bound>=0\n  p.row(a,hi=bound,label=label);groups[label]=(a,bound)")
    anchor=' x=None;objectives=[]\n'
    begin=after.index(anchor);end=after.index(' # Report actual arc flows',begin)
    replacement=''' # Exact actual maintenance, not just an objective score or y lower bound.
 assert set(reference)=={u['id'] for u in units}
 for u in units:
  ref=reference[u['id']];b=budget(u['B'],s);paid=ref['maintenance']
  assert paid==min(b,u['stock']+ref['received']) and ref['before']==u['stock'] and ref['due']==b
  net=max(0,paid-min(b,u['stock']))
  p.row({ys[u['id']]:1},paid,paid,'fixed maintenance:'+u['id'])
  # A deficient unit cannot receive additional SP without changing actual payment.
  p.row(delivery[u['id']],net,net if paid<b else float('inf'),'fixed net maintenance:'+u['id'])
 p.stage_name='one_candidate_min_transport_work'
 from solver_audit import capture,register
 register(p)
 x,value=p.solve(work|lastwork,False,False)
 objectives=[['transport_work',value]]
 certificate=capture(p,x)
'''
    after=after[:begin]+replacement+after[end:]
    replace("flows=[{k:v for k,v in a.items() if k!='i'}|{'q':int(x[a['i']])}","flows=[{k:v for k,v in a.items() if k!='i'}|{'q':int(x[a['i']]),'variable':p.names[a['i']]}" )
    replace("r['solver_retries']=p.solver_retries", "r['solver_retries']=p.solver_retries\n r['certificate']=certificate")
    path.write_bytes(after.encode())
    patch=''.join(difflib.unified_diff(before.splitlines(True),after.splitlines(True),fromfile='a/signature_model.py',tofile='b/signature_model.py'))
    (HERE/'SOLVER-SEAM.patch').write_bytes(patch.encode())
    manifest=dict(base=BASE,core=CORE,rule=RULE,inputs=inputs,signatureBeforeSha256=sha(before.encode()),signatureAfterSha256=sha(after.encode()),patchSha256=sha(patch.encode()),
        files={str(p.relative_to(OUT)).replace('\\','/'):sha(p.read_bytes()) for p in [OUT/'TRACE.json.gz',OUT/'EVIDENCE.json',OUT/'candidate.json',*[OUT/'solver'/n for n in ['model.py','signature_model.py','route_signatures.py']]]})
    (HERE/'INPUTS.json').write_bytes((json.dumps(manifest,indent=2)+'\n').encode())
    print(json.dumps(dict(status='PREPARED_009',campaignReplayed=False,coreExecuted=False)))
if __name__=='__main__':main()

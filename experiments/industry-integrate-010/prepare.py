"""Restore pinned evidence/helpers and derive only fixed cargo capacity deductions."""
import hashlib,json,subprocess,difflib
from pathlib import Path
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
OUT=HERE/'.runtime'
BASE='b5bc3e6f4400c6a91152d9170e420aa31dc51dcb'
E5='96bf1d7307063ecb6331fc44b28a832bb2aceac6'
CORE='813b4072568352e95d0726fe5fe04060c889c554'
RULE='f09911e4792bd1da33185807f03c68b2cd9565fe'
RULE5='e0c7fed6bfb2053b865f242fd4cf783a040eeb7f'
def git(*a):return subprocess.check_output(['git',*a],cwd=ROOT)
def sha(b):return hashlib.sha256(b).hexdigest()
def main():
    (OUT/'solver').mkdir(parents=True,exist_ok=True);inputs=[]
    items=[(E5,'experiments/industry-integrate-008/'+n,n) for n in ['TRACE.json.gz','EVIDENCE.json']]
    items += [(BASE,'experiments/industry-integrate-009/experiment.py','reference009.py'),(BASE,'experiments/industry-integrate-009/solver_audit.py','audit009.py'),
              (RULE,'docs/rule-campaign-006/candidate.json','rule006.json'),(RULE5,'docs/rule-campaign-005/candidate.json','route005.json')]
    items += [(CORE,'experiments/supply-exp-005/'+n,'solver/'+n) for n in ['model.py','signature_model.py','route_signatures.py']]
    for commit,path,dest in items:
        raw=git('show',commit+':'+path);(OUT/dest).write_bytes(raw);inputs.append(dict(commit=commit,path=path,destination=dest,sha256=sha(raw)))
    path=OUT/'solver/signature_model.py';before=path.read_text(encoding='utf8');after=before
    def replace(old,new):
        nonlocal after
        assert after.count(old)==1,old
        after=after.replace(old,new)
    replace("def solve_network(s,side='G'):","def solve_network(s,cargo,side='G'):\n assert side=='G', 'ONLY_GERMAN_PRIORITY_CANDIDATE'")
    replace("def row(a,hi,label):p.row(a,hi=hi,label=label);groups[label]=(a,hi)",
        "def row(a,hi,label):\n  # Candidate reservation is a constant in the same original constraint.\n  bound=hi-cargo.get(label,0);assert bound>=0\n  p.row(a,hi=bound,label=label);groups[label]=(a,bound)")
    replace(' x=None;objectives=[]', ' from audit009 import register,capture\n register(p)\n x=None;objectives=[]')
    replace("flows=[{k:v for k,v in a.items() if k!='i'}|{'q':int(x[a['i']])}","flows=[{k:v for k,v in a.items() if k!='i'}|{'q':int(x[a['i']]),'variable':p.names[a['i']]}" )
    replace("r['solver_retries']=p.solver_retries", "r['solver_retries']=p.solver_retries\n r['certificate']=capture(p,x)")
    # Guard against silently replacing or dropping any original progressive/reserve objective.
    start=' if s.get(\'allocator\')!=\'progressive\':'
    end=' # Report actual arc flows'
    assert before[before.index(start):before.index(end)]==after[after.index(start):after.index(end)]
    path.write_bytes(after.encode())
    patch=''.join(difflib.unified_diff(before.splitlines(True),after.splitlines(True),fromfile='a/signature_model.py',tofile='b/signature_model.py'))
    (HERE/'SOLVER-SEAM.patch').write_bytes(patch.encode())
    manifest=dict(base=BASE,rule=RULE,baselineE5=E5,core=CORE,inputs=inputs,signatureBeforeSha256=sha(before.encode()),signatureAfterSha256=sha(after.encode()),patchSha256=sha(patch.encode()),
        completeOriginalObjectiveBlockPreserved=True,files={dest:sha((OUT/dest).read_bytes()) for _,_,dest in items})
    (HERE/'INPUTS.json').write_bytes((json.dumps(manifest,indent=2)+'\n').encode())
    print(json.dumps(dict(status='PREPARED_010',coreExecuted=False,campaignReplayed=False)))
if __name__=='__main__':main()

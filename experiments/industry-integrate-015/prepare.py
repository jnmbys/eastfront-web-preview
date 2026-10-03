"""Only fixed saved inputs and isolated solver derivation; no campaign execution."""
import ast,difflib,json,subprocess
from config import HERE,OUT,BASE,sha
ROOT=HERE.parents[1]
def git(*a):return subprocess.check_output(['git',*a],cwd=ROOT)
def main():
    (OUT/'solver').mkdir(parents=True,exist_ok=True);inputs=[]
    def restore(commit,path,dest):
        raw=git('show',commit+':'+path);(OUT/dest).write_bytes(raw);inputs.append(dict(commit=commit,path=path,destination=dest,sha256=sha(raw)));return raw
    for n in ['PLAN.json.gz','VERIFICATION.json','INPUTS.json']:restore(BASE,'experiments/industry-integrate-014/'+n,'014-'+n)
    for n in ['TRACE.json.gz','EVIDENCE.json']:restore('2d04264a3f4ba6d38f76a99ae76821cc0a55abdb','experiments/industry-integrate-013/'+n,'013-'+n)
    core='813b4072568352e95d0726fe5fe04060c889c554'
    for n in ['model.py','signature_model.py','route_signatures.py']:restore(core,'experiments/supply-exp-005/'+n,'solver/'+n)
    for n,dest in [('solver_audit.py','solver/solver_audit.py'),('experiment.py','solver/reference009.py')]:
        restore('b5bc3e6f4400c6a91152d9170e420aa31dc51dcb','experiments/industry-integrate-009/'+n,dest)
    patch=restore(BASE,'experiments/industry-integrate-014/SOLVER-SEAM.patch','014-SOLVER-SEAM.patch')
    subprocess.run(['git','apply','--directory=experiments/industry-integrate-015/.runtime/solver','-'],input=patch,check=True,cwd=ROOT)
    path=OUT/'solver/signature_model.py';before=path.read_text(encoding='utf8')
    prior=json.loads((OUT/'014-INPUTS.json').read_bytes());assert sha(before.encode())==prior['files']['solver/signature_model.py']
    begin=before.index(' # Exact actual maintenance,');end=before.index(' # Report actual arc flows',begin)
    seam=' from optimize import optimize\n x,objectives,certificate=optimize(p,s,units,reference,ys,delivery,work,lastwork,hub_end,arcs)\n'
    after=before[:begin]+seam+before[end:];path.write_bytes(after.encode())
    patch=''.join(difflib.unified_diff(before.splitlines(True),after.splitlines(True),fromfile='a/014-signature_model.py',tofile='b/015-signature_model.py'))
    (HERE/'SOLVER-SEAM.patch').write_bytes(patch.encode())
    # Verbatim original coefficient function. No Core effect application or log creation.
    live=restore(core,'experiments/supply-exp-005/live.py','original-live.py').decode()
    node=next(x for x in ast.parse(live).body if isinstance(x,ast.FunctionDef) and x.name=='effects')
    effect=ast.get_source_segment(live,node);(OUT/'solver/original_effects.py').write_bytes(('from fractions import Fraction\n'+effect+'\n').encode())
    files={x['destination']:sha((OUT/x['destination']).read_bytes()) for x in inputs}
    files['solver/original_effects.py']=sha((OUT/'solver/original_effects.py').read_bytes())
    m=dict(base014=BASE,inputs=inputs,files=files,originalNetworkPrefixUnchanged=True,originalReportingSuffixUnchanged=True,
        prefixSha256=sha(before[:begin].encode()),suffixSha256=sha(before[end:].encode()),patchSha256=sha(patch.encode()),
        actualEffectsSourceSha256=sha(effect.encode()),newRuntimeAuthority=False)
    (HERE/'INPUTS.json').write_bytes((json.dumps(m,indent=2)+'\n').encode());print('PREPARED_015_SAVED_E8_ONLY')
if __name__=='__main__':main()

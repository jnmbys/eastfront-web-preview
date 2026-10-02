"""Reproduce this one candidate; audit proof without another optimization."""
import json,sys,time
from copy import deepcopy
from experiment import HERE,OUT,load,run,digest,sha,project_unit,classify_failure
from solver_audit import infeasibility_witness
def main():
    manifest,trace,c=load();before=digest(trace)
    hashes={p:sha((OUT/p).read_bytes()) for p in manifest['files']}
    saved=json.loads((HERE/'RESULT.json').read_bytes());assert saved['status']=='INFEASIBLE'
    # Exact stored-original outcome arithmetic for all 60 units, neither settle nor apply.
    sys.path.insert(0,str(OUT/'solver'))
    w=trace['E5']['boundary'];s=w['inputSnapshot'];ref={u['id']:u for r in w['spResults'] for u in r['units']}
    for u in s['units']:
        if u['strength']<=0:continue
        calc=project_unit(u,ref[u['id']]['received'],s)
        for key in ['before','received','maintenance','due','after','debt','loss']:assert calc[key]==ref[u['id']][key]
        locked=next(x for x in saved['maintenanceLocks'] if x['id']==u['id'])
        assert calc['net']==locked['net']
    assert saved['sovietFrozen']==next(r for r in w['spResults'] if r['side']=='S')
    assert digest(saved['sovietFrozen'])==saved['sovietResultHash']
    # Check saved original four occupancies independently from actual arc quantities.
    german=next(r for r in w['spResults'] if r['side']=='G');flows=german['flows']
    used={**{'rail:'+e:sum(f['q'] for f in flows if f['kind']=='rail' and e in f['edges']) for e in c['route']['edges']},
          'T':sum(f['q']*f['cost'] for f in flows if f['kind']=='rail'),
          'W:GH2':sum(f['q']*f['cost'] for f in flows if f['kind']=='last' and f['hub']=='GH2')}
    assert used=={x['id']:x['spUsed'] for x in w['rows']}
    assert used=={'rail:A10~B10':32,'rail:B10~C10':32,'T':108,'W:GH2':96}
    proof=infeasibility_witness(saved['certificate']);assert proof==saved['infeasibilityProof']
    assert proof['GH2WorkLowerBound']==96 and proof['GH2SPWorkCap']==88
    assert len(saved['certificate']['rows'])==156 and len(saved['certificate']['columns'])==93
    assert saved['solverRetries'][0]['initial_status']==saved['solverRetries'][0]['final_status']==2
    # Pure certificate tamper checks; not alternative campaign or capacity experiments.
    mutated=deepcopy(saved['certificate']);next(r for r in mutated['rows'] if r['label']=='W:GH2')['hi']=96
    try:infeasibility_witness(mutated);raise RuntimeError('INVALID_CONTRADICTION_ACCEPTED')
    except AssertionError:pass
    mutated=deepcopy(saved['certificate']);next(r for r in mutated['rows'] if r['label']=='rail balance:A5')['lo']=-1
    try:infeasibility_witness(mutated);raise RuntimeError('INVALID_SOURCE_BOUND_ACCEPTED')
    except AssertionError:pass
    # Pure status tests, no solver or synthetic inventory injection.
    assert classify_failure([{'status':2}],False)=='INFEASIBLE'
    assert classify_failure([{'status':2}],True)=='TIMEOUT'
    assert classify_failure([{'status':1}],False)=='TIMEOUT'
    assert classify_failure([{'status':4}],False)=='UNRESOLVED_ERROR'
    assert classify_failure([],False)=='UNRESOLVED_ERROR'
    again=run(trace,c);assert again['status']=='INFEASIBLE',again
    for key in ['certificate','infeasibilityProof','capacity','cargo','maintenanceLocks','germanReference','sovietFrozen','sovietResultHash','referenceInventory','referenceHubs','inputHash','jointSPInputHash']:
        assert again[key]==saved[key],key
    assert digest(trace)==before and hashes=={p:sha((OUT/p).read_bytes()) for p in manifest['files']}
    assert again['seconds']<3 and again['globalBlockersRetained']==35 and not again['published']
    checks=['fixed_input_digests','all_60_original_unit_outcomes','S_complete_result_frozen','original_arc_four_row_recount',
            'full_93_variable_156_row_model_certificate','presolve_and_no_presolve_infeasible','independent_exact_algebraic_contradiction',
            'tampered_certificate_refused','timeout_not_infeasible','same_candidate_reproduced','no_input_or_saved_game_mutation','three_second_total_budget']
    evidence=dict(status='PASS',checks=checks,syntheticScope='Certificate/status unit tests only; no synthetic game, alternative candidate or extra solve',
        resultSha256=sha((HERE/'RESULT.json').read_bytes()),candidateCount=1,reproductionSeconds=again['seconds'],globalBlockersRetained=35)
    (HERE/'VERIFICATION.json').write_bytes((json.dumps(evidence,indent=2)+'\n').encode())
    print(json.dumps(dict(status='PASS',checks=len(checks),result=again['status'],seconds=again['seconds'],GH2Required=96,GH2Available=88)))
if __name__=='__main__':main()

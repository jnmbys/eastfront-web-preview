"""Targeted repeatability, physical certificate and lexicographic checks only."""
import gzip,json,sys
from copy import deepcopy
from fractions import Fraction
from config import HERE,OUT,load,digest,sha,ROOT_HASH,CARGO
from experiment import execute,run,write

def main():
    cases=[]
    def check(name,details=None,synthetic=False):
        cases.append(dict(name=name,origin='SYNTHETIC_UNIT_TEST' if synthetic else 'SAVED_REAL_E8_OFFLINE',passed=True,details=details))
        print(json.dumps(dict(check=len(cases),name=name,passed=True)),flush=True)
    root,plan=load();before=digest(root);pBefore=digest(plan);r=execute()
    assert r['status']=='OPTIMAL_LEXICOGRAPHIC_CANDIDATE',r
    assert r['candidateReductionQ']==r['provedLowerBoundQ']==2 and r['candidateReductionSP']=='1/2'
    assert r['primaryMinimumProven'] and r['optimization']['complete']
    assert all(x['optimal'] and x['solverStatus']==0 for x in r['optimization']['stages'])
    assert r['independentLowerBound']['lowerBoundQ']==2
    check('minimum_2q_proved_by_MILP_and_independent_new_E8_row_lower_bound',r['optimization']['stages'][:3])
    sys.path.insert(0,str(OUT/'solver'));import reference009,model,optimize
    s=plan['projection']['input'];refG=next(x for x in plan['projection']['reference'] if x['side']=='G')
    assert model.Q==4 and Fraction(r['candidateReductionSP'])==Fraction(2,model.Q)
    rows=reference009.audit_flows(s,r['candidate'],CARGO);assert rows==r['allCapacityRows']
    certificate=r['candidate']['certificate'];columns=certificate['columns'];x=[c['value'] for c in columns]
    for c in columns:
        assert (c['lo'] is None or c['value']>=c['lo']-1e-5) and (c['hi'] is None or c['value']<=c['hi']+1e-5)
        if c['integer']:assert abs(c['value']-round(c['value']))<1e-5
    for row in certificate['rows']:
        value=sum(x[i]*v for i,v in row['coefficients']);assert abs(value-row['value'])<1e-5
        assert (row['lo'] is None or value>=row['lo']-1e-5) and (row['hi'] is None or value<=row['hi']+1e-5)
    check('all_original_network_capacity_flow_source_warehouse_bounds_and_integrality',dict(columns=len(columns),rows=len(certificate['rows']),shared=r['capacity']))
    for side in ['G','S']:
        for outcome in r['conservation'][side].values():assert outcome['openingQ']+outcome['sourceQ']==outcome['maintenanceQ']+outcome['closingQ']
    assert r['sovietFrozen']==next(x for x in plan['projection']['reference'] if x['side']=='S')
    assert digest(r['sovietFrozen'])==r['sovietHash']
    check('both_sides_SP_conservation_and_complete_Soviet_result_frozen',r['conservation'])
    german=[u for u in r['unitComparison'] if u['side']=='G'];reduced=[u for u in german if u['reductionQ']]
    assert [(u['id'],u['reductionQ']) for u in reduced]==[('G-REC-02',2)]
    assert sum(u['additionalStepLoss'] for u in german)==0
    assert sum(bool(u['crossedThresholds']) for u in german)==16
    assert sum(bool(u['newlyWorsenedThresholds']) for u in german)==0
    for row in r['unitComparison']:
        alt=row['alternative'];assert alt['maintenance']==min(alt['due'],alt['before']+alt['received'])
    assert reduced[0]['referenceCoreSupplyEffects']==reduced[0]['alternativeCoreSupplyEffects']==dict(factor=.5,cap=1,exhausted=True)
    check('actual_min_payment_projection_and_unique_selected_cost',reduced)
    # Cover exact min envelope on all finite paid/stock/delivery possibilities in
    # this real model; synthetic enumeration never supplies a candidate state.
    for u in s['units']:
        if u['side']!='G' or u['strength']<=0:continue
        b=model.budget(u['B'],s);cap=max(0,min(u['cap'],u['target'])-u['stock']);M=max(0,cap+u['stock']-b)
        for d in range(cap+1):
            admitted=[]
            for k in range(min(b,u['stock']),b+1):
                if k<=u['stock']+d and d-k-M*int(k==b)<=-u['stock']:admitted.append(k)
            assert admitted==[min(b,u['stock']+d)]
    check('exact_actual_payment_envelope_not_only_y_objective',synthetic=True)
    u=deepcopy(next(u for u in s['units'] if u['id']=='G-REC-02'));ref=next(x for x in refG['units'] if x['id']==u['id'])
    o=optimize.outcomes(u,0,s,ref);assert o['reduction']==2 and o['newLoss']==0 and o['penaltyCrossing']==1 and o['newPenalty']==0
    u['debt']='5/2';o=optimize.outcomes(u,0,s,ref);assert o['newLoss']==1
    u['debt']='0';o=optimize.outcomes(u,4,s,ref);assert o['reduction']==0,'Increases must not offset another unit loss'
    check('loss_threshold_and_gross_reduction_coefficients',synthetic=True)
    # A stopped tie-break must not be represented as a fully proved selection.
    partial=run(plan,testStop='minimum_total_maintenance_reduction_q')
    assert partial['status']=='FEASIBLE_PARTIAL_TIEBREAK_UNPROVEN' and partial['primaryMinimumProven']
    assert not partial['optimization']['complete'] and partial['candidateReductionQ']==2
    check('interrupted_tie_break_retains_only_proved_minimum_and_valid_candidate',dict(status=partial['status'],lower=partial['provedLowerBoundQ']),True)
    second=execute()
    assert second['status']==r['status'] and second['unitComparison']==r['unitComparison']
    for key in ['flows','deliveries','hubs','source_used','certificate','objectives']:assert second['candidate'][key]==r['candidate'][key],key
    assert second['optimization']['stages']==r['optimization']['stages']
    check('independent_repeat_same_unique_unit_and_arc_candidate')
    assert digest(root)==before==ROOT_HASH and digest(plan)==pBefore
    assert all(v==0 for v in r['actualTransactions'].values()) and not r['published']
    assert r['globalBlockersRetained']==35 and r['globalBlockersClosed']==0
    check('full_root_materials_budget_receipts_revision_RNG_unchanged_no_transactions')
    if '--write' in sys.argv:
        write(r);savedRaw=gzip.decompress((HERE/'RESULT.json.gz').read_bytes())
        (HERE/'VERIFICATION.json').write_bytes((json.dumps(dict(task='INDUSTRY-INTEGRATE-015',cases=cases,resultSha256=sha(savedRaw),rootHash=ROOT_HASH),ensure_ascii=False,indent=2)+'\n').encode())
    else:
        v=json.loads((HERE/'VERIFICATION.json').read_bytes());raw=gzip.decompress((HERE/'RESULT.json.gz').read_bytes());assert sha(raw)==v['resultSha256']
        old=json.loads(raw);assert old['unitComparison']==r['unitComparison'] and old['candidate']['certificate']==r['candidate']['certificate']
        assert [x['name'] for x in v['cases']]==[x['name'] for x in cases]
    print(json.dumps(dict(status='PASS',checks=len(cases),minimumQ=2,minimumSP='1/2',unit='G-REC-02')))
if __name__=='__main__':main()

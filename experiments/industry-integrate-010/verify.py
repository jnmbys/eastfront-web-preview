"""Same candidate rerun plus independent matrix, arithmetic and immutability checks."""
import json,math
from fractions import Fraction
from experiment import HERE,OUT,load,run,digest,sha,helpers,classify
def verify_certificate(cert):
    cols=cert['columns']
    for c in cols:
        x=c['value'];assert x is not None and math.isfinite(x)
        assert (c['lo'] is None or x>=c['lo']-1e-5) and (c['hi'] is None or x<=c['hi']+1e-5)
        assert not c['integer'] or abs(x-round(x))<1e-5
    for row in cert['rows']:
        value=sum(cols[i]['value']*v for i,v in row['coefficients'])
        assert abs(value-row['value'])<1e-5
        assert (row['lo'] is None or value>=row['lo']-1e-5) and (row['hi'] is None or value<=row['hi']+1e-5)
def main():
    m,t,c,policy=load();saved=json.loads((HERE/'RESULT.json').read_bytes());before=digest(t)
    hashes={p:sha((OUT/p).read_bytes()) for p in m['files']}
    assert saved['status']=='FEASIBLE_OPTIMAL_ALL_ORIGINAL_STAGES' and saved['seconds']<3
    ref,audit,model,solver=helpers();w=t['E5']['boundary'];s=w['inputSnapshot']
    cert=saved['germanAlternative']['certificate'];verify_certificate(cert)
    assert len(cert['columns'])==213 and len(cert['rows'])==360
    assert ref.audit_flows(s,saved['germanAlternative'],policy['cargoReservation'])==saved['allCapacityRows']
    assert [x['remaining'] for x in saved['capacity']]==[0,0,2076,0]
    assert [x[0] for x in saved['germanAlternative']['objectives']]==[x[0] for x in saved['germanReference']['objectives']]
    assert len(saved['objectiveComparison'])==16 and all(p.get('status',0)==0 for p in saved['profile'])
    assert saved['sovietFrozen']==next(x for x in w['spResults'] if x['side']=='S')
    assert digest(saved['sovietFrozen'])==saved['sovietResultHash']
    # Independently reproduce original maintenance/debt/attrition expressions.
    for item in saved['unitComparison']:
        u=next(u for u in s['units'] if u['id']==item['id'])
        for mode in ['reference','alternative']:
            p=item[mode];paid=min(u['B'],u['stock']+p['received']);D=Fraction(u['debt'])
            D=max(0,D-1) if paid==u['B'] else min(3,D+Fraction(u['B']-paid,u['B']))
            a=Fraction(u['attrition'])+(1 if D==3 and paid<u['B'] else 0);loss=int(a)
            assert paid==p['maintenance'] and p['after']==u['stock']+p['received']-paid
            assert D==Fraction(p['debt']) and loss==p['loss'] and a-loss==Fraction(p['attrition'])
        if item['side']=='S':assert item['reference']==item['alternative']
    affected=saved['affectedUnits'];assert [x['id'] for x in affected]==['G-PZ-02','G-PZ-03']
    assert all(x['delta']['received']==x['delta']['maintenance']==-1 and x['delta']['after']==x['delta']['loss']==0 for x in affected)
    assert affected[0]['additionalDebtThresholds']==[] and affected[1]['additionalDebtThresholds']==[1]
    assert saved['totals']['G']['delta']['maintenance']==-2 and saved['totals']['G']['delta']['hubStock']==2
    assert saved['additionalDamageSteps']==0 and all(h['delta']==0 for h in saved['hubComparison'] if h['id']!='GH2')
    assert saved['globalBlockersRetained']==35 and saved['globalBlockersClosed']==0
    assert not saved['published'] and not saved['transportExecuted'] and not saved['recoveryExecuted']
    # Pure status tests only; no alternate scenario, rates, inventory, or candidate.
    assert classify([{'status':2}],False)=='INFEASIBLE'
    assert classify([{'status':0},{'status':2}],False)=='UNPROVEN'
    assert classify([{'status':1}],False)=='TIMEOUT'
    assert classify([{'status':2}],True)=='TIMEOUT'
    assert classify([{'status':4}],False)=='UNPROVEN'
    again=run(t,c,policy);assert again['status']==saved['status'],again
    for key in ['capacity','allCapacityRows','unitComparison','affectedUnits','hubComparison','sourceComparison','totals','additionalDamageSteps','newThresholdCrossings','objectiveComparison','sovietFrozen']:
        assert again[key]==saved[key],key
    assert again['germanAlternative']['flows']==saved['germanAlternative']['flows']
    verify_certificate(again['germanAlternative']['certificate'])
    assert digest(t)==before and hashes=={p:sha((OUT/p).read_bytes()) for p in m['files']}
    checks=['pinned_008_input_and_006_semantics','complete_original_16_objective_stages','213_variables_360_constraints',
        'four_reserved_rows_and_all_flow_source_storage_balances','all_60_original_formula_projections','complete_S_result_frozen',
        'two_affected_units_and_exact_total_cost','new_D1_crossing_distinguished_from_existing_crossing','no_added_damage_steps_this_projection',
        'infeasible_timeout_unproven_distinct','same_candidate_full_rerun','input_unchanged_no_publication_no_receipts']
    out=dict(status='PASS',checks=checks,resultSha256=sha((HERE/'RESULT.json').read_bytes()),candidateCount=1,
        rerunSeconds=again['seconds'],syntheticTests='Status classification only; no synthetic game data or material import',globalBlockersRetained=35)
    (HERE/'VERIFICATION.json').write_bytes((json.dumps(out,indent=2)+'\n').encode())
    print(json.dumps(dict(status='PASS',checks=len(checks),seconds=again['seconds'],maintenanceCostQ=2,additionalDamageSteps=0,newD1Unit='G-PZ-03')))
if __name__=='__main__':main()

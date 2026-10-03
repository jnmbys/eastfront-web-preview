"""Independent physical witness + actual original settlement comparison; no optimization."""
import sys
from copy import deepcopy
from config import OUT,CARGO,digest
def fixed_settlement(s,approved,deadline):
    import model
    sys.path.insert(0,str(OUT/'audit')) if str(OUT/'audit') not in sys.path else None
    import reference009
    assert digest(s)==approved['inputHash'],'E8_INPUT_MISMATCH_NO_SUBSTITUTION'
    r=approved['candidate'];rows=reference009.audit_flows(s,r,CARGO)
    assert rows==approved['allCapacityRows']
    cs=r['certificate']['columns'];values=[c['value'] for c in cs]
    for c in cs:
        v=c['value'];assert (c['lo'] is None or v>=c['lo']-1e-5) and (c['hi'] is None or v<=c['hi']+1e-5)
        assert not c['integer'] or abs(v-round(v))<1e-5
    for row in r['certificate']['rows']:
        v=sum(values[i]*a for i,a in row['coefficients']);assert abs(v-row['value'])<1e-5
        assert (row['lo'] is None or v>=row['lo']-1e-5) and (row['hi'] is None or v<=row['hi']+1e-5)
    oldsolve=model.solve;olddeadline=model.DEADLINE;calls=[]
    def fixed(current,side):
        assert digest(current)==approved['inputHash'] and side not in calls
        calls.append(side)
        return deepcopy(r if side=='G' else approved['sovietFrozen'])
    try:
        model.solve=fixed;model.DEADLINE=deadline
        out,results,retry=model.settle(s,s['epoch']);model.check_budget()
    finally:model.solve=oldsolve;model.DEADLINE=olddeadline
    assert calls==['G','S'] and not retry
    by={u['id']:u for side in results for u in side['units']};units={u['id']:u for u in out['units']}
    assert len(by)==len(approved['unitComparison'])==63
    for row in approved['unitComparison']:
        actual=by[row['id']];expected=row['alternative'];unit=units[row['id']]
        for k,v in actual.items():assert expected[k]==v,(row['id'],k,v,expected[k])
        assert actual['maintenance']==min(actual['due'],actual['before']+actual['received'])
        for k in ['attrition','strength']:assert unit[k]==expected[k],(row['id'],k)
    assert next(x for x in results if x['side']=='S')==approved['sovietFrozen'],'SOVIET_NOT_FROZEN'
    for side in results:
        opening=sum(u['stock'] for u in s['units'] if u['side']==side['side'])+sum(h['stock'] for h in s['hubs'] if h['side']==side['side'])
        closing=sum(u['stock'] for u in out['units'] if u['side']==side['side'])+sum(h['stock'] for h in out['hubs'] if h['side']==side['side'])
        assert opening+sum(side['source_used'].values())==sum(u['maintenance'] for u in side['units'])+closing
    return dict(ok=True,state=out,result=results,retry=False,profile=[],witness=dict(inputHash=digest(s),
        candidateHash=digest(r),unitComparisonHash=digest(approved['unitComparison']),capacity=rows,units=deepcopy(approved['unitComparison']),
        sourceComparison=approved['sourceComparison'],hubComparison=approved['hubComparison'],conservation=approved['conservation'],
        sovietHash=digest(approved['sovietFrozen']),fixedPlanApplications=calls,newSolverCalls=0))

def route_check(bundle,query):
    import model
    assert not query['map']['integrity'],'CORE_INTEGRITY'
    assert query['map']['targetHex']=={'q':2,'r':8},'TARGET_MOVED'
    target=bundle['core']['units']['G-I-01'];assert target['alive'] and target['side']=='GERMAN'
    assert [(n['label'],n['key']) for n in query['map']['nodes']]==[('A10','0,9'),('B10','1,9'),('C10','2,8')]
    for n in query['map']['nodes']:
        assert n['exists'] and not n['issues'] and n['control'] in [None,'GERMAN'],'SERVICE_CONTROL_OCCUPATION_ZOC'
    s=bundle['logistics'];adj=model.adjacency(s,'rail','G');edges={e['id']:e for e in s['edges']}
    for seg,key in zip(query['map']['edges'],['0,9|1,9','1,9|2,8']):
        assert seg['coreKey']==key and seg['distance']==1
        edge=edges[seg['from']+'~'+seg['to']];ce=seg['coreEdge']
        assert ce['railway']==edge['core_railway'] and ce['railway']==dict(present=True,destroyed=False,repairedBy='GERMAN')
        assert ce['bridge'] is None and not edge['cut'] and edge['rail_cost']==1
        assert any(n==seg['to'] and e['id']==edge['id'] for n,e in adj[seg['from']])
    hub=next(h for h in s['hubs'] if h['id']=='GH2')
    assert hub['node']=='C10' and hub['side']=='G' and not hub.get('inactive')
    return deepcopy(query['map'])

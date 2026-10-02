"""Complete row/variable certificate, also retained if the solver rejects a model."""
import math
CURRENT=None
def finite(v):return float(v) if math.isfinite(v) else None
def register(p):
    global CURRENT
    CURRENT=p
def capture(p,x=None):
    columns=[dict(name=name,lo=finite(lo),hi=finite(hi),integer=bool(integer),value=None if x is None else float(x[i]))
             for i,(name,lo,hi,integer) in enumerate(zip(p.names,p.lo,p.hi,p.integer))]
    rows=[]
    for label,(a,lo,hi) in zip(p.labels,p.rows):
        value=None if x is None else sum(float(x[i])*coef for i,coef in a.items())
        if x is not None:assert lo-1e-5<=value<=hi+1e-5,(label,lo,value,hi)
        rows.append(dict(label=label,coefficients=[[i,v] for i,v in sorted(a.items())],lo=finite(lo),hi=finite(hi),value=value))
    if x is not None:
        for i,v in enumerate(x):
            assert p.lo[i]-1e-5<=v<=p.hi[i]+1e-5
            assert not p.integer[i] or abs(v-round(v))<1e-5
    return dict(columns=columns,rows=rows,allRowsBoundsIntegralityVerified=x is not None)

def infeasibility_witness(certificate):
    """Exact algebra on saved constraint rows, NOT a second optimization or sweep.

    Prove a lower bound on GH2 work using the GH1 source/hub balance and
    upper bounds on the cheapest GH2 destinations. Refuse if this structure drifts.
    """
    rows=certificate['rows'];columns=certificate['columns'];names={x['name']:i for i,x in enumerate(columns)}
    def row(label):return next(x for x in rows if x['label']==label)
    unload=names['unload:GH1'];local=names['localrail:G-A5:GH1']
    rail=row('rail balance:A5');assert rail['lo']==rail['hi']==0 and rail['coefficients']==[[unload,-1]]
    source=next(x for x in rows if x['label']=='source:G-A5' and [local,1] in x['coefficients'])
    assert all(v>=0 and columns[i]['lo']>=0 for i,v in source['coefficients'])
    hub=row('hub:GH1');a=dict(hub['coefficients']);assert a[unload]==a[local]==1 and hub['lo']==0
    gh1_routes={i for i,v in a.items() if v==-1}
    assert set(a)==gh1_routes|{unload,local} and all(columns[i]['name'].startswith('route:GH1:') for i in gh1_routes)
    w=row('W:GH2');costs=dict(w['coefficients']);required=[]
    assert all(v>=0 and columns[i]['lo']>=0 for i,v in costs.items())
    for fixed in rows:
        if not fixed['label'].startswith('fixed net maintenance:') or fixed['lo']<=0:continue
        assert fixed['hi']==fixed['lo'],'Proof expects bounded deficient-unit deliveries'
        ids=[i for i,v in fixed['coefficients']];assert all(v==1 for i,v in fixed['coefficients'])
        assert all(i in gh1_routes or i in costs for i in ids),'Additional legal supply hub invalidates this proof'
        gh2=[i for i in ids if i in costs]
        required.append(dict(unit=fixed['label'].split(':',1)[1],net=fixed['lo'],row=fixed['label'],
            routeVariables=[columns[i]['name'] for i in ids],GH2MinimumCost=min(costs[i] for i in gh2) if gh2 else None))
    total=sum(x['net'] for x in required);cap=source['hi'];min_q=total-cap
    # The pivot 5 is an algebraic multiplier, not a capacity/rate or changed parameter.
    pivot=5;cheap=[x for x in required if x['GH2MinimumCost'] is not None and x['GH2MinimumCost']<pivot]
    discount=sum((pivot-x['GH2MinimumCost'])*x['net'] for x in cheap)
    lower=pivot*min_q-discount
    assert lower>w['hi']
    return dict(kind='EXACT_ROW_ALGEBRA_NO_ADDITIONAL_SOLVE',requiredNetDelivery=total,
        GH1MaximumDelivery=cap,GH1ProofRows=[rail['label'],hub['label'],source['label']],GH2MinimumRequiredDelivery=min_q,
        multiplier=pivot,cheapDestinationUpperBounds=cheap,discountUpperBound=discount,
        GH2WorkLowerBound=lower,GH2SPWorkCap=w['hi'],contradiction=lower-w['hi'],requiredUnits=required,
        formula=f'{pivot}*({total}-{cap})-{discount}={lower}>{w["hi"]}',
        validForContinuousRelaxationToo=True)

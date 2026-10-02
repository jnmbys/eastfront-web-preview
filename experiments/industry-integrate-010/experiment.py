"""Single offline kit-first candidate, all original SP objectives, no game writes."""
import os
os.environ['OPENBLAS_NUM_THREADS']='1'
import gzip,json,sys,time,hashlib,multiprocessing as mp
from copy import deepcopy
from fractions import Fraction
from pathlib import Path
HERE=Path(__file__).resolve().parent
OUT=HERE/'.runtime'
def sha(b):return hashlib.sha256(b).hexdigest()
def digest(v):return sha(json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode())
def classify(profile,expired):
    if expired or (profile and profile[-1].get('status')==1):return 'TIMEOUT'
    if profile and profile[-1].get('status')==2:
        # Earlier feasible stages prevent treating a later stage failure as a
        # proof that the original physical candidate itself is infeasible.
        return 'UNPROVEN' if any(p.get('status')==0 for p in profile[:-1]) else 'INFEASIBLE'
    return 'UNPROVEN' if profile and profile[-1].get('status') not in [None,0] else 'UNRESOLVED_ERROR'
def helpers():
    for p in [str(OUT),str(OUT/'solver')]:
        if p not in sys.path:sys.path.insert(0,p)
    import reference009,audit009,model,signature_model
    return reference009,audit009,model,signature_model
def load():
    m=json.loads((HERE/'INPUTS.json').read_bytes());assert m['base']=='b5bc3e6f4400c6a91152d9170e420aa31dc51dcb' and m['rule']=='f09911e4792bd1da33185807f03c68b2cd9565fe'
    for p,h in m['files'].items():assert sha((OUT/p).read_bytes())==h,p
    raw=gzip.decompress((OUT/'TRACE.json.gz').read_bytes());e=json.loads((OUT/'EVIDENCE.json').read_bytes());assert sha(raw)==e['audit']['traceSha256']
    t=json.loads(raw);w=t['E5']['boundary'];assert digest(w['inputSnapshot'])==w['inputHash']
    assert digest(dict(core=w['coreSnapshot'],logistics=w['inputSnapshot']))==w['jointSPInputHash']
    c=json.loads((OUT/'route005.json').read_bytes());rule=json.loads((OUT/'rule006.json').read_bytes());policy=json.loads((HERE/'POLICY.json').read_bytes())
    assert rule['charges']['rows']==c['capacity']['rows']
    assert rule['charges']['ratesLQ']==c['cargo']['rates'] and rule['charges']['kit']==c['cargo']['kit']
    assert rule['charges']['terminalBundle']['feePerKit']==8 and rule['charges']['terminalBundle']['chargeConstraint']=='W:GH2'
    assert rule['recommendation']=='RETAIN_SHARED_W_AS_BUNDLED_SAME_HEX_TERMINAL_SERVICE' and not rule['runtimeEnabled']
    assert rule['approval']['decisionRef'] is None and not policy['runtimePolicySwitchApproved'] and not policy['actualTransportApproved']
    assert policy['cargoReservation']=={x['id']:x['perKit'] for x in rule['charges']['rows']}
    assert policy['seconds']==3 and policy['candidateCount']==1
    return m,t,c,policy

def compare_unit(before,reference,alternative):
    oldD,newD=Fraction(reference['debt']),Fraction(alternative['debt']);startD=Fraction(before['debt'])
    delta={k:alternative[k]-reference[k] for k in ['received','maintenance','net','after','loss','strength']}
    delta.update(debt=str(newD-oldD),attrition=str(Fraction(alternative['attrition'])-Fraction(reference['attrition'])),
        unpaid=(alternative['due']-alternative['maintenance'])-(reference['due']-reference['maintenance']))
    return dict(side=before['side'],id=before['id'],openingDebt=str(startD),reference={**reference,'unpaid':reference['due']-reference['maintenance']},
        alternative={**alternative,'unpaid':alternative['due']-alternative['maintenance']},delta=delta,
        additionalDebtThresholds=[v for v in [1,2,3] if oldD<v<=newD],removedDebtThresholds=[v for v in [1,2,3] if newD<v<=oldD],
        candidateCrossingsFromOpening=[v for v in [1,2,3] if startD<v<=newD],
        additionalDamageSteps=max(0,delta['loss']),projectionOnly=True)

def solve_one(t,c,policy,deadline):
    ref,audit,model,solver=helpers();model.DEADLINE=deadline;model.PROFILE.clear();audit.CURRENT=None
    originalHash=digest(t);w=t['E5']['boundary'];s=w['inputSnapshot'];cargo=ref.route_and_cargo(t,c)
    assert cargo==policy['cargoReservation']
    oldG=next(r for r in w['spResults'] if r['side']=='G');oldS=next(r for r in w['spResults'] if r['side']=='S')
    try:
        r=solver.solve_network(s,cargo,'G')
        rows=ref.audit_flows(s,r,cargo);comparison=[]
        oldEnd={u['id']:u for u in t['E5']['bundle']['logistics']['units']}
        for u in s['units']:
            if u['strength']<=0:continue
            old=next(x for x in (oldG if u['side']=='G' else oldS)['units'] if x['id']==u['id'])
            baseline=ref.project_unit(u,old['received'],s)
            projected=ref.project_unit(u,r['deliveries'][u['id']] if u['side']=='G' else old['received'],s)
            for key in ['before','received','maintenance','due','after','debt','loss']:assert baseline[key]==old[key]
            assert baseline['attrition']==oldEnd[u['id']]['attrition']
            assert projected['before']+projected['received']==projected['maintenance']+projected['after']
            assert 0<=projected['after']<=u['cap']
            item=compare_unit(u,baseline,projected);comparison.append(item)
            if u['side']=='S':assert baseline==projected
        affected=[x for x in comparison if any(Fraction(v)!=0 for v in x['delta'].values())]
        hubs=[dict(side=h['side'],id=h['id'],before=h['stock'],reference=(oldG if h['side']=='G' else oldS)['hubs'][h['id']],
            alternative=(r if h['side']=='G' else oldS)['hubs'][h['id']]) for h in s['hubs']]
        for h in hubs:h['delta']=h['alternative']-h['reference']
        sources=[dict(side=side,id=k,cap=next(a['cap'] for a in s['sources'] if a['id']==k),reference=old['source_used'][k],alternative=v,delta=v-old['source_used'][k])
            for side,old,new in [('G',oldG,r),('S',oldS,oldS)] for k,v in new['source_used'].items()]
        totals={}
        for side in ['G','S']:
            units=[x for x in comparison if x['side']==side];sideh=[h for h in hubs if h['side']==side]
            totals[side]={}
            for mode in ['reference','alternative']:
                d={k:sum(x[mode][k] for x in units) for k in ['received','maintenance','due','unpaid','after','loss']}
                d.update(debtSum=str(sum((Fraction(x[mode]['debt']) for x in units),Fraction(0))),hubStock=sum(h[mode] for h in sideh),
                    sourceInjection=sum(x[mode] for x in sources if x['side']==side))
                opening=sum(u['stock'] for u in s['units'] if u['side']==side)+sum(h['before'] for h in sideh)
                assert opening+d['sourceInjection']==d['maintenance']+d['after']+d['hubStock']
                totals[side][mode]=d
            totals[side]['delta']={k:str(Fraction(totals[side]['alternative'][k])-Fraction(totals[side]['reference'][k])) if k=='debtSum' else totals[side]['alternative'][k]-totals[side]['reference'][k] for k in totals[side]['reference']}
            totals[side]['grossMaintenanceLoss']=sum(max(0,-x['delta']['maintenance']) for x in units)
            totals[side]['grossMaintenanceGain']=sum(max(0,x['delta']['maintenance']) for x in units)
        # Entire original stage order is preserved, including skipped constant stages.
        assert [x[0] for x in r['objectives']]==[x[0] for x in oldG['objectives']]
        assert all(p.get('status',0)==0 for p in model.PROFILE)
        model.check_budget();assert digest(t)==originalHash
        return dict(status='FEASIBLE_OPTIMAL_ALL_ORIGINAL_STAGES',candidateCount=1,capacity=[x for x in rows if x['id'] in cargo],allCapacityRows=rows,
            germanReference=deepcopy(oldG),germanAlternative=r,sovietFrozen=deepcopy(oldS),sovietResultHash=digest(oldS),
            unitComparison=comparison,affectedUnits=affected,hubComparison=hubs,sourceComparison=sources,totals=totals,
            additionalDamageSteps=sum(x['additionalDamageSteps'] for x in comparison),newThresholdCrossings=[dict(id=x['id'],thresholds=x['additionalDebtThresholds']) for x in comparison if x['additionalDebtThresholds']],
            objectiveComparison=[dict(name=a[0],reference=b[1],alternative=a[1]) for a,b in zip(r['objectives'],oldG['objectives'])],
            inputHash=w['inputHash'],jointSPInputHash=w['jointSPInputHash'],inputUnchanged=True,profile=deepcopy(model.PROFILE),
            semantics='W8 is reserved bundled terminal service; no paid service or arrival receipt exists',
            materialLoadOnly=True,published=False,transportExecuted=False,recoveryExecuted=False,globalBlockersRetained=35,globalBlockersClosed=0)
    except Exception as e:
        assert digest(t)==originalHash
        return dict(status=classify(model.PROFILE,time.perf_counter()>=deadline),error=str(e),profile=deepcopy(model.PROFILE),
            certificate=audit.capture(audit.CURRENT) if audit.CURRENT else None,
            solverRetries=deepcopy(audit.CURRENT.solver_retries) if audit.CURRENT else [],published=False,transportExecuted=False,recoveryExecuted=False,
            globalBlockersRetained=35,globalBlockersClosed=0)

def worker(conn):
    helpers();conn.send('READY');t,c,policy,deadline=conn.recv()
    try:r=solve_one(t,c,policy,deadline)
    except Exception as e:r=dict(status='TIMEOUT' if time.perf_counter()>=deadline else 'UNRESOLVED_ERROR',error=str(e),published=False)
    r['completedBeforeDeadline']=time.perf_counter()<deadline;conn.send(r);conn.close()
def run(t,c,policy):
    ctx=mp.get_context('spawn');parent,child=ctx.Pipe();p=ctx.Process(target=worker,args=(child,),daemon=True);p.start();child.close()
    try:
        if not parent.poll(15) or parent.recv()!='READY':raise RuntimeError('SOLVER_STARTUP_FAILED')
        began=time.perf_counter();deadline=began+3;parent.send((t,c,policy,deadline))
        if not parent.poll(max(0,deadline-time.perf_counter())):return dict(status='TIMEOUT',error='TOTAL_3_SECOND_BUDGET',published=False)
        result=parent.recv();seconds=time.perf_counter()-began
        if seconds>=3 or not result['completedBeforeDeadline']:return dict(status='TIMEOUT',error='AFTER_DEADLINE_NO_CONCLUSION',seconds=seconds,published=False)
        result.update(seconds=seconds,budgetSeconds=3,startupExcluded='Only fixed solver module imports; no optimization/model construction before deadline')
        return result
    finally:
        if p.is_alive():p.terminate()
        p.join(timeout=.2)
        if p.is_alive():p.kill();p.join()
        parent.close()
def main():
    m,t,c,policy=load();before=digest(t);r=run(t,c,policy);assert digest(t)==before
    r['provenance']=dict(base=m['base'],rule=m['rule'],inputHash=t['E5']['boundary']['inputHash'],jointSPInputHash=t['E5']['boundary']['jointSPInputHash'],
        policySha256=sha((HERE/'POLICY.json').read_bytes()),rule006Sha256=sha((OUT/'rule006.json').read_bytes()),traceSha256=sha(gzip.decompress((OUT/'TRACE.json.gz').read_bytes())))
    (HERE/'RESULT.json').write_bytes((json.dumps(r,ensure_ascii=False,indent=2)+'\n').encode())
    print(json.dumps({k:r[k] for k in ['status','seconds','capacity','totals','additionalDamageSteps','newThresholdCrossings','error'] if k in r},ensure_ascii=False))
if __name__=='__main__':main()

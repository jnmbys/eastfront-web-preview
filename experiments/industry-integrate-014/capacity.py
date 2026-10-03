"""One exact maintenance-preserving feasibility candidate; no priority fallback."""
import os
os.environ['OPENBLAS_NUM_THREADS']='1'
import multiprocessing as mp,sys,time
from copy import deepcopy
from config import OUT,digest

def reference_rows(s,reference,cargo):
    """Recompute all rail work, including localrail, from the actual new SP solve."""
    result=[];flows=reference['flows'];computed={k:0 for k in cargo}
    for f in flows:
        if f['kind']=='rail':
            computed['T']+=f['q']*f['cost']
            for edge in f['edges']:
                if 'rail:'+edge in computed:computed['rail:'+edge]+=f['q']
        elif f['kind']=='last' and 'W:'+f['hub'] in computed:computed['W:'+f['hub']]+=f['q']*f['cost']
    for key,load in cargo.items():
        row=next(x for x in reference['constraints'] if x['id']==key)
        assert computed[key]==row['used'],(key,computed[key],row)
        result.append(dict(id=key,cap=row['cap'],referenceSP=computed[key],existingMaterialReservations=0,
            proposedCargo=load,remainingWithFrozenSP=row['cap']-computed[key]-load,
            publishedReservation=0,publishedCargo=0,referenceConstraint=deepcopy(row)))
    return result

def worker(conn):
    sys.path.insert(0,str(OUT/'solver'))
    import model,signature_model,solver_audit,reference009
    conn.send('READY');s,refs,cargo,deadline,fault=conn.recv();before=digest(s)
    model.DEADLINE=deadline;model.PROFILE.clear();solver_audit.CURRENT=None
    g=next(r for r in refs if r['side']=='G');sov=next(r for r in refs if r['side']=='S')
    try:
        if fault=='timeout':time.sleep(3.1)
        r=signature_model.solve_network(s,g['units'],cargo,'G')
        rows=reference009.audit_flows(s,r,cargo);comparison=[]
        for u in s['units']:
            if u['strength']<=0:continue
            old=next(x for x in (g if u['side']=='G' else sov)['units'] if x['id']==u['id'])
            ref=reference009.project_unit(u,old['received'],s)
            alt=reference009.project_unit(u,r['deliveries'][u['id']] if u['side']=='G' else old['received'],s)
            for k in ['maintenance','net','debt','loss','attrition','strength']:assert ref[k]==alt[k],(u['id'],k)
            comparison.append(dict(id=u['id'],side=u['side'],reference=ref,alternative=alt,
                deliveryDelta=alt['received']-ref['received'],stockDelta=alt['after']-ref['after']))
        result=dict(status='FEASIBLE',germanAlternative=r,allCapacityRows=rows,unitComparison=comparison,
            sourceComparison=[dict(id=k,reference=g['source_used'][k],alternative=v,delta=v-g['source_used'][k]) for k,v in r['source_used'].items()],
            hubComparison=[dict(id=h['id'],reference=g['hubs'][h['id']],alternative=r['hubs'][h['id']],delta=r['hubs'][h['id']]-g['hubs'][h['id']]) for h in s['hubs'] if h['side']=='G'],
            maintenanceDelta=0,interpretation='Exact old actual maintenance/net/debt/loss fixed; reserves/routes may change. Not a gameplay policy.')
    except Exception as e:
        status=reference009.classify_failure(model.PROFILE,time.perf_counter()>=deadline)
        certificate=solver_audit.capture(solver_audit.CURRENT) if solver_audit.CURRENT else None
        proof=None;proofError=None
        if status=='INFEASIBLE' and certificate:
            try:proof=solver_audit.infeasibility_witness(certificate)
            except Exception as x:proofError=str(x) or type(x).__name__
        result=dict(status=status,error=str(e),certificate=certificate,infeasibilityProof=proof,proofUnavailable=proofError,
            maintenanceDelta=None,unitComparison=None,noLowerMaintenanceCandidateRun=True)
    assert digest(s)==before
    result.update(profile=deepcopy(model.PROFILE),sovietFrozen=deepcopy(sov),sovietHash=digest(sov),candidateCount=1,
        inputHash=before,completedBeforeDeadline=time.perf_counter()<deadline,published=False)
    conn.send(result);conn.close()

def run(s,refs,cargo,*,syntheticFault=None):
    rows=reference_rows(s,next(r for r in refs if r['side']=='G'),cargo)
    if any(x['cap']<x['proposedCargo'] for x in rows):
        return dict(status='INFEASIBLE_CAPACITY_BOUND',rows=rows,candidateCount=0,published=False,
                    proof='Cargo alone exceeds an unchanged capacity upper bound.')
    ctx=mp.get_context('spawn');parent,child=ctx.Pipe();proc=ctx.Process(target=worker,args=(child,),daemon=True);proc.start();child.close()
    try:
        if not parent.poll(15) or parent.recv()!='READY':return dict(status='UNRESOLVED_STARTUP',published=False)
        began=time.perf_counter();deadline=began+3;parent.send((s,refs,cargo,deadline,syntheticFault))
        if not parent.poll(max(0,deadline-time.perf_counter())):return dict(status='TIMEOUT',budgetSeconds=3,published=False,rows=rows)
        r=parent.recv();elapsed=time.perf_counter()-began
        if elapsed>=3 or not r['completedBeforeDeadline']:return dict(status='TIMEOUT',budgetSeconds=3,published=False,rows=rows)
        r.update(seconds=elapsed,budgetSeconds=3,rows=rows,startupExcluded='module import only; no model construction or solve')
        return r
    finally:
        if proc.is_alive():proc.terminate()
        proc.join(.2)
        if proc.is_alive():proc.kill();proc.join()
        parent.close()

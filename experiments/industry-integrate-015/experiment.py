"""Saved E8 solve and arithmetic projections only. No live/Core execution."""
import os
os.environ['OPENBLAS_NUM_THREADS']='1'
import gzip,json,multiprocessing as mp,sys,time
from copy import deepcopy
from fractions import Fraction
from config import HERE,OUT,CARGO,ROOT_HASH,BASE,load,digest,sha

def worker(conn):
    sys.path.insert(0,str(OUT/'solver'))
    import model,signature_model,reference009,solver_audit,optimize
    from original_effects import effects
    conn.send('READY');s,refs,deadline,testStop=conn.recv();model.DEADLINE=deadline-.2;model.PROFILE.clear();optimize.TEST_STOP_AFTER=testStop
    before=digest(dict(s=s,refs=refs));g=next(r for r in refs if r['side']=='G');sov=next(r for r in refs if r['side']=='S')
    try:
        r=signature_model.solve_network(s,g['units'],CARGO,'G')
        rows=reference009.audit_flows(s,r,CARGO);comparison=[];column={x['name']:x['value'] for x in r['certificate']['columns']}
        refState=deepcopy(s);altState=deepcopy(s)
        for u in s['units']:
            if u['strength']<=0:continue
            old=next(x for x in (g if u['side']=='G' else sov)['units'] if x['id']==u['id'])
            ref=reference009.project_unit(u,old['received'],s)
            alt=reference009.project_unit(u,r['deliveries'][u['id']] if u['side']=='G' else old['received'],s)
            for k in ['before','received','maintenance','due','after','debt','loss']:assert ref[k]==old[k],(u['id'],k)
            if u['side']=='G':
                assert alt['maintenance']==min(alt['due'],u['stock']+r['deliveries'][u['id']])==column['maintenance:'+u['id']]
                chosen=[x for x in optimize.STATE['oneHotStates'][u['id']] if column[x['variable']]==1]
                assert len(chosen)==1 and chosen[0]['paid']==alt['maintenance']
                for k in ['debt','loss','attrition','strength']:assert chosen[0]['projection'][k]==alt[k],(u['id'],k)
            else:assert alt==ref
            for target,value in [(refState,ref),(altState,alt)]:
                dest=next(x for x in target['units'] if x['id']==u['id']);dest.update(stock=value['after'],debt=value['debt'],attrition=value['attrition'],strength=value['strength'])
            comparison.append(dict(id=u['id'],side=u['side'],reference=ref,alternative=alt,
                deliveryDeltaQ=alt['received']-ref['received'],maintenanceDeltaQ=alt['maintenance']-ref['maintenance'],
                reductionQ=max(0,ref['maintenance']-alt['maintenance']),reductionSP=str(Fraction(max(0,ref['maintenance']-alt['maintenance']),4)),
                stockDeltaQ=alt['after']-ref['after'],openingDebt=u['debt'],additionalStepLoss=max(0,alt['loss']-ref['loss']),
                crossedThresholds=[t for t in [1,2] if Fraction(u['debt'])<t<=Fraction(alt['debt'])],
                newlyWorsenedThresholds=[t for t in [1,2] if Fraction(ref['debt'])<t<=Fraction(alt['debt'])]))
        openingFx,refFx,altFx=effects(s),effects(refState),effects(altState)
        for row in comparison:row.update(openingCoreSupplyEffects=openingFx[row['id']],referenceCoreSupplyEffects=refFx[row['id']],alternativeCoreSupplyEffects=altFx[row['id']])
        german=[x for x in comparison if x['side']=='G'];reduction=sum(x['reductionQ'] for x in german)
        stages={x['name']:x['value'] for x in optimize.STATE['stages']}
        if optimize.STATE['primaryProven']:assert stages['minimum_total_maintenance_reduction_q']==reduction
        if 'minimum_additional_step_losses' in stages:assert stages['minimum_additional_step_losses']==sum(x['additionalStepLoss'] for x in german)
        if 'minimum_penalty_crossing_units' in stages:assert stages['minimum_penalty_crossing_units']==sum(bool(x['crossedThresholds']) for x in german)
        def totals(side,alt):
            rr=[x['alternative' if alt else 'reference'] for x in comparison if x['side']==side]
            src=r['source_used'] if alt and side=='G' else (g if side=='G' else sov)['source_used']
            hubs=r['hubs'] if alt and side=='G' else (g if side=='G' else sov)['hubs']
            opening=sum(u['stock'] for u in s['units'] if u['side']==side and u['strength']>0)+sum(h['stock'] for h in s['hubs'] if h['side']==side)
            paid=sum(x['maintenance'] for x in rr);closing=sum(x['after'] for x in rr)+sum(hubs.values())
            assert opening+sum(src.values())==paid+closing
            return dict(openingQ=opening,sourceQ=sum(src.values()),maintenanceQ=paid,closingQ=closing,balanced=True)
        state=deepcopy(optimize.STATE)
        result=dict(status='OPTIMAL_LEXICOGRAPHIC_CANDIDATE' if state['complete'] else 'FEASIBLE_PARTIAL_TIEBREAK_UNPROVEN',
            primaryMinimumProven=state['primaryProven'],provedLowerBoundQ=state.get('minimumReductionQ',1),candidateReductionQ=reduction,candidateReductionSP=str(Fraction(reduction,4)),
            candidate=r,optimization=state,unitComparison=comparison,changedUnits=[x for x in german if x['reference']!=x['alternative']],
            capacity=[x for x in rows if x['id'] in CARGO],allCapacityRows=rows,
            sourceComparison=[dict(id=k,reference=g['source_used'][k],alternative=v,deltaQ=v-g['source_used'][k]) for k,v in r['source_used'].items()],
            hubComparison=[dict(id=h['id'],reference=g['hubs'][h['id']],alternative=r['hubs'][h['id']],deltaQ=r['hubs'][h['id']]-g['hubs'][h['id']]) for h in s['hubs'] if h['side']=='G'],
            conservation={side:{'reference':totals(side,False),'alternative':totals(side,True)} for side in ['G','S']},
            sovietFrozen=deepcopy(sov),sovietHash=digest(sov),oneQInSP='1/4',effectsMeaning='Verbatim original live.effects output; no Core apply, battle or recovery executed.')
    except Exception as e:
        result=dict(status='TIMEOUT_NO_CANDIDATE' if time.perf_counter()>=model.DEADLINE else 'UNRESOLVED_NO_CANDIDATE',error=str(e),
            primaryMinimumProven=False,provedLowerBoundQ=1,lowerBoundBasis='014 exact no-reduction infeasibility and integer q',candidateReductionQ=None)
    assert digest(dict(s=s,refs=refs))==before
    result.update(profile=deepcopy(model.PROFILE),completedBeforeDeadline=time.perf_counter()<deadline,inputUnchanged=True,published=False)
    conn.send(result);conn.close()

def run(plan,*,testStop=None):
    ctx=mp.get_context('spawn');parent,child=ctx.Pipe();proc=ctx.Process(target=worker,args=(child,),daemon=True);proc.start();child.close()
    try:
        if not parent.poll(15) or parent.recv()!='READY':return dict(status='UNRESOLVED_STARTUP',primaryMinimumProven=False)
        began=time.perf_counter();deadline=began+3
        parent.send((plan['projection']['input'],plan['projection']['reference'],deadline,testStop))
        if not parent.poll(max(0,deadline-time.perf_counter())):return dict(status='TIMEOUT_NO_CANDIDATE',provedLowerBoundQ=1,primaryMinimumProven=False,published=False)
        r=parent.recv();elapsed=time.perf_counter()-began
        if elapsed>=3 or not r['completedBeforeDeadline']:return dict(status='TIMEOUT_NO_CANDIDATE',provedLowerBoundQ=1,primaryMinimumProven=False,published=False)
        r.update(seconds=elapsed,budgetSeconds=3,solverBudgetSeconds=2.8,startupExcluded='module import only')
        return r
    finally:
        if proc.is_alive():proc.terminate()
        proc.join(.2)
        if proc.is_alive():proc.kill();proc.join()
        parent.close()

def execute():
    root,plan=load();rh=digest(root);ph=digest(plan);r=run(plan)
    assert digest(root)==rh==ROOT_HASH and digest(plan)==ph
    proof=plan['capacity']['infeasibilityProof']
    assert proof['GH2WorkLowerBound']==96 and proof['GH2SPWorkCap']==88 and proof['multiplier']==5
    # Retain the mandatory portion of each original maintenance delivery. A
    # gross reduction R can remove at most R q of this demand; additional paid
    # maintenance cannot offset R or enlarge the original cheap-demand discount.
    from math import ceil
    lower=ceil((proof['GH2WorkLowerBound']-proof['GH2SPWorkCap'])/proof['multiplier'])
    r['provedLowerBoundQ']=max(r.get('provedLowerBoundQ',0),lower)
    r['independentLowerBound']=dict(source014Proof=proof,formula='W >= 5*(56-R-32)-24 = 96-5R; W <= 88; integer R >= 2',
        lowerBoundQ=lower,meaning='R is gross per-unit maintenance reduction, not netting against increases; extra delivery has nonnegative work.')
    r.update(task='INDUSTRY-INTEGRATE-015',base014=BASE,rootUnchanged=True,rootHash=rh,inputHash=plan['projection']['inputHash'],
        plan014Sha256=sha(gzip.decompress((OUT/'014-PLAN.json.gz').read_bytes())),cargo=CARGO,
        actualTransactions=dict(settlements=0,shipments=0,materialDebits=0,payments=0,recoveries=0,oldOffmapCapacityRefreshed=0),
        independentBlockers=['PERSONNEL_CARE_EXPIRES_END_E8','TRANSIT_AND_FRONT_CARE_FEES_UNAPPROVED',
            'NEW_E8_TRANSPORT_AND_C10_TARGET_SERVICE_UNAUTHORIZED','T9_PE_RECOVERY_SCOPE_UNAUTHORIZED'],
        globalBlockersRetained=35,globalBlockersClosed=0)
    return r

def write(r):
    raw=json.dumps(r,ensure_ascii=False).encode();(HERE/'RESULT.json.gz').write_bytes(gzip.compress(raw,mtime=0))
    summary={k:v for k,v in r.items() if k not in ['candidate','optimization','sovietFrozen','unitComparison','profile']}
    if 'optimization' in r:summary['objectives']=r['optimization']['stages'][:3]
    summary['fullResultSha256']=sha(raw)
    (HERE/'RESULT.json').write_bytes((json.dumps(summary,ensure_ascii=False,indent=2)+'\n').encode())
def main():
    r=execute()
    if '--write' in sys.argv:write(r)
    print(json.dumps({k:r[k] for k in ['status','candidateReductionQ','candidateReductionSP','provedLowerBoundQ','seconds','error'] if k in r}))
if __name__=='__main__':main()

"""Targeted real read-only checks and explicitly synthetic counterexamples."""
import gzip,json,sys
from copy import deepcopy
from config import HERE,START_SHA,digest,serialized,sha
from planner import Planner,material_facts,route_facts,core_query,CARGO
from capacity import run as solve_capacity

def main():
    cases=[]
    def record(name,detail=None,synthetic=False):
        cases.append(dict(name=name,origin='SYNTHETIC_COUNTEREXAMPLE' if synthetic else 'REAL_PINNED_T8_READ_ONLY',passed=True,detail=detail))
        print(json.dumps(dict(check=len(cases),name=name,passed=True)),flush=True)
    p=Planner();before=p.snapshot();raw=serialized(before);plan=p.query()
    assert plan['status']=='BLOCKED_READ_ONLY_PLAN',plan.get('detail')
    assert digest(before)==START_SHA and serialized(p.snapshot())==raw
    assert not plan['materials']['errors'];record('complete_root_permanent_receipts_unique_lot_ownership_and_spent_grants',dict(rootHash=START_SHA,receipts=37))
    again=p.query();assert again==plan;again['materials']['personnelPackage']['quantityP']=99
    assert p.query()==plan and serialized(p.snapshot())==raw
    record('repeat_queries_and_return_value_mutation_do_not_modify_any_authoritative_field')
    assert p.query('0'*64)['status']=='STALE_START' and serialized(p.snapshot())==raw
    record('stale_start_hash_rejected_before_projection',synthetic=True)
    assert plan['route']['materialTransportAuthorized'] is False and all(x['existingSPRailEligible'] for x in plan['route']['segments'])
    assert [x['key'] for x in plan['route']['nodes']]==['0,9','1,9','2,8']
    assert plan['currentRecovery']['commonEligible'] and plan['currentRecovery']['context']['recoveryCount']==0
    assert plan['currentRecovery']['context']['recoveryLimit']==1
    assert plan['currentRPQuote']['plan']['mode']=='RP' and all(x['resource']=='RP' for x in plan['currentRPQuote']['plan']['debits'])
    assert plan['payment']['actualDebits']==[] and not plan['executable']
    record('current_Core_eligibility_corrected_route_RP_only_quote_and_no_PE_authorization',plan['currentRecovery'])
    projection=plan['projection'];cap=plan['capacity'];proof=cap['infeasibilityProof']
    assert projection['boundaryEpoch']==8 and projection['input']['epoch']=='L7' and len(projection['commands'])==10
    assert projection['futureBundle']['revision']==152 and projection['futureCommon']['commonEligible']
    assert projection['futureBundle']['core']['random']==before['bundle']['core']['random']
    assert cap['status']=='INFEASIBLE' and cap['profile'][-1]['status']==2
    assert proof['GH2WorkLowerBound']==96 and proof['GH2SPWorkCap']==88 and proof['contradiction']==8
    assert cap['sovietFrozen']==next(x for x in projection['reference'] if x['side']=='S')
    assert [x['referenceSP'] for x in cap['rows']]==[32,32,108,96]
    assert cap['seconds']<3
    record('new_private_E8_reference_and_exact_maintenance_preserving_infeasibility',dict(rows=cap['rows'],proof=proof,solverStatus=2))
    assert plan['timing']['earliestConditionalAvailableTurn']==9 and plan['materials']['careDeadlineEndEpoch']==8
    assert any('CARE' in x for x in plan['blockers']) and plan['timing']['committedSchedule'] is None
    assert plan['materials']['historicalOffmap']['remainingLQ']==0 and not plan['route']['terminalOnly']['receiptPresent']
    record('care_expiry_old_offmap_quota_and_terminal_receipt_do_not_authorize_new_transport')
    for resource in ['P','E2']:
        root=deepcopy(before)
        if resource=='P':root['personnel']['package']['quantityP']=0
        else:root['industry']['batch']['quantityE2']=1;root['industry']['warehouse']['resident']=1
        snap=serialized(root);facts=material_facts(root);assert 'INSUFFICIENT_'+resource in facts['errors'] and serialized(root)==snap
        record('material_shortage_'+resource,facts['errors'],True)
    root=deepcopy(before);root['personnel']['package']['owner']='FORGED_SECOND_A10_WAREHOUSE'
    assert 'OWNER_NOT_A10' in material_facts(root)['errors'];record('forged_owner_not_an_alternative_stock',synthetic=True)
    root=deepcopy(before);root['personnel']['package']['custody']='REAR_QUARANTINED'
    assert 'PERSONNEL_EXPIRED_OR_UNAVAILABLE' in material_facts(root)['errors'];record('expired_personnel_not_reactivated_by_plan',synthetic=True)
    root=deepcopy(before);root['bundle']['core']['turn']=9
    assert 'PERSONNEL_CARE_EXPIRED' in material_facts(root)['errors'];record('care_expired_even_if_stale_available_flag_remains',synthetic=True)
    bundle=deepcopy(before['bundle']);cq=core_query(bundle);edgekey=cq['map']['edges'][0]['coreKey']
    bundle['core']['edges'][edgekey]['railway']['destroyed']=True
    edge=next(x for x in bundle['logistics']['edges'] if x['id']=='A10~B10');edge['core_railway']['destroyed']=True;edge['cut']=True
    snap=serialized(bundle);bad=route_facts(bundle,core_query(bundle));assert any(x.startswith('PATH_NOT_LEGAL') for x in bad['errors']) and serialized(bundle)==snap
    record('broken_real_rail_edge_rejected',bad['errors'],True)
    bundle=deepcopy(before['bundle']);bundle['core']['units']['G-I-01']['hex']={'q':3,'r':8}
    assert 'TARGET_NOT_AT_C10_NO_RETARGETED_SERVICE' in route_facts(bundle,core_query(bundle))['errors']
    record('target_moved_no_retarget_of_same_hex_service',synthetic=True)
    bundle=deepcopy(before['bundle']);bundle['core']['hexes']['1,9']['control']='SOVIET'
    assert 'ENEMY_CONTROL' in route_facts(bundle,core_query(bundle))['errors'];record('hostile_route_control_rejected',synthetic=True)
    bundle=deepcopy(before['bundle']);bundle['core']['rp']['GERMAN']=0;check=core_query(bundle)['common']
    assert check['commonEligible'] and len(check['rpIssues'])==1 and check['rpIssues'][0]['details']['reason']=='INSUFFICIENT_RP'
    record('only_exact_RP_insufficiency_excluded_from_common_eligibility',check,True)
    bundle['core']['units']['G-I-01']['step']=0;check=core_query(bundle)['common']
    assert not check['commonEligible'] and any(x.get('details',{}).get('reason')=='UNIT_NOT_DAMAGED' for x in check['commonIssues'])
    record('other_INVALID_SUPPORT_recovery_error_preserved',check,True)
    bundle=deepcopy(before['bundle']);log=deepcopy(bundle['core']['actionLog'][-1]);log.update(accepted=True,turn=8,phase='GERMAN_RECOVERY')
    log['action']={'type':'REPAIR_UNIT','controllerId':'G-HUMAN-1','unitId':'G-I-02'};bundle['core']['actionLog'].append(log)
    check=core_query(bundle)['common'];assert not check['commonEligible'] and check['context']['recoveryCount']==1
    assert any('LIMIT' in x.get('details',{}).get('reason','') for x in check['commonIssues'])
    record('original_shared_recovery_limit_preserved_synthetic_accepted_log_fixture',check,True)
    bundle=deepcopy(before['bundle']);bundle['core']['pendingDecision']=dict(kind='DEFENDER_REACTION',battleId='SYNTHETIC',decisionOwnerControllerId='G-HUMAN-1',eligibleControllerIds=['G-HUMAN-1'])
    check=core_query(bundle)['common'];assert not check['commonEligible'] and any(x['code']=='PENDING_DECISION_BLOCKS_ACTION' for x in check['commonIssues'])
    record('original_pending_decision_guard_preserved',check,True)
    assert p.query(controllerId='S-AI-1')['status']=='BLOCKED_INPUT_OR_QUALIFICATION';record('wrong_controller_blocked',synthetic=True)
    huge={**CARGO,'W:GH2':97};c=solve_capacity(projection['input'],projection['reference'],huge)
    assert c['status']=='INFEASIBLE_CAPACITY_BOUND';record('cargo_alone_exceeds_capacity_not_timeout',c,True)
    timeout=solve_capacity(projection['input'],projection['reference'],CARGO,syntheticFault='timeout')
    assert timeout['status']=='TIMEOUT';record('timeout_never_reported_as_infeasible',timeout,True)
    assert serialized(p.snapshot())==raw and digest(p.snapshot())==START_SHA
    record('all_queries_leave_full_root_inventory_budget_receipts_revision_RNG_unchanged')
    rawplan=serialized(plan).encode()
    result=dict(task='INDUSTRY-INTEGRATE-014',cases=cases,rootHash=START_SHA,rootUnchanged=True,planSha256=sha(rawplan),globalBlockersRetained=35,globalBlockersClosed=0)
    if '--write' in sys.argv:
        (HERE/'PLAN.json.gz').write_bytes(gzip.compress(rawplan,mtime=0))
        concise={k:v for k,v in plan.items() if k not in ['projection','capacity']}
        concise['capacity']={k:v for k,v in cap.items() if k in ['status','rows','seconds','budgetSeconds','infeasibilityProof','maintenanceDelta']}
        concise['projectedRecovery']=projection['futureCommon']
        (HERE/'PLAN.json').write_bytes((json.dumps(concise,ensure_ascii=False,indent=2)+'\n').encode())
        (HERE/'VERIFICATION.json').write_bytes((json.dumps(result,ensure_ascii=False,indent=2)+'\n').encode())
    else:
        saved=json.loads((HERE/'VERIFICATION.json').read_bytes());assert saved['rootHash']==START_SHA
        assert sha(gzip.decompress((HERE/'PLAN.json.gz').read_bytes()))==saved['planSha256']
        assert [(x['name'],x['passed']) for x in saved['cases']]==[(x['name'],x['passed']) for x in cases]
        old=json.loads(gzip.decompress((HERE/'PLAN.json.gz').read_bytes()))
        assert old['capacity']['infeasibilityProof']==proof and old['capacity']['rows']==cap['rows']
        assert old['projection']['futureBundle']==projection['futureBundle']
    print(json.dumps(dict(status='PASS',checks=len(cases),capacity=cap['status'],unchangedRoot=START_SHA)))
if __name__=='__main__':main()

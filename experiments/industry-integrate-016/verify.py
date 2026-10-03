"""016-only verification. Faults/races use exact saved checkpoints as labelled test fixtures.

The fixture helper is test-local: it neither edits a checkpoint nor exposes an
advanced-state import API. Actual main/control/expiry execution is in run.py.
"""
import gzip,json,time,sys
from copy import deepcopy
from concurrent.futures import ThreadPoolExecutor
from config import *
from adapter import Transactions,query,runtime,audit_root,material
def main():
    raw=gzip.decompress((HERE/'TRACE.json.gz').read_bytes());trace=json.loads(raw);meta=json.loads((HERE/'RUN.json').read_bytes())
    assert sha(raw)==meta['traceSha256'];config=load();checks=[];views={};counter=0
    def record(name,details=None,synthetic=False):
        checks.append(dict(name=name,origin='SYNTHETIC_FAULT_OR_CHECKPOINT_REPLAY' if synthetic else 'REAL_LEGAL_EXECUTION',passed=True,details=details))
        print(json.dumps(dict(check=len(checks),name=name)),flush=True)
    def fixture(root,label):
        nonlocal counter
        counter+=1;tx=Transactions(test_label=label+'-'+str(counter))
        tx._root=deepcopy(root) # Exact real saved root, test-only fork; no material/budget edit.
        audit_root(tx.snapshot(),trace['start']);assert digest(tx.snapshot())==digest(root)
        return tx
    def reject(tx,q,contains=None):
        before=digest(tx.snapshot());r=tx.submit(q)
        assert not r['ok'] and digest(tx.snapshot())==before,r
        if contains:assert contains in serialized(r),(contains,r)
        return r
    def success(tx,q):
        r=tx.submit(q);assert r['ok'] and not r.get('replayed'),r;assert r['seconds']<3;return r
    start=trace['start'];pre=trace['preRecovery'];end=trace['recovered'];control=trace['control']['root'];expired=trace['unusedEndE9']['root']
    assert digest(start)==START_SHA
    for r in [trace['care'],pre,end,control,trace['unusedT9'],expired]:audit_root(r,start)
    assert end['industry']['budget']==dict(granted=10,freeI=4,productionSpent=3,handoffSpent=2,escrow=0,careTransferOutI=1)
    assert end['personnel']['account']==start['personnel']['account']
    record('complete_013_root_all_009_hashes_37_receipts_original_two_budgets_and_nonrefundable_care',dict(startHash=START_SHA,equipmentBudget=end['industry']['budget'],personnelBudget=end['personnel']['account']))
    e8=next(r for r in trace['records'] if r['result'].get('boundary'));w=e8['result']['boundary'];b8=e8['afterBoundary']['bundle']
    assert w['inputHash']==config['result']['inputHash'] and w['newSolverCalls']==0
    assert w['units']==config['result']['unitComparison'] and w['candidateHash']==digest(config['result']['candidate'])
    actual={u['id']:u for u in b8['logistics']['units']}
    for row in w['units']:
        expected=row['alternative'];core=b8['core']['units'][row['id']]
        if row['id'] not in actual:
            assert expected['strength']==0 and not core['alive']
            continue # Original Core legitimately retires baseline attrition deaths.
        u=actual[row['id']]
        assert u['stock']==expected['after'] and u['debt']==expected['debt'] and u['attrition']==expected['attrition'] and u['strength']==expected['strength']
        core=b8['core']['units'][row['id']];effect=expectedEffect=row['alternativeCoreSupplyEffects']
        assert core['expSupply']==dict(attackFactor=effect['factor'],movementCap=effect['cap'])
        assert core['supplyState']==('OUT_OF_SUPPLY' if effect['exhausted'] else 'SUPPLIED')
    assert next(r for r in w['results'] if r['side']=='S')==config['result']['sovietFrozen']
    assert w['capacity']==config['result']['allCapacityRows']
    record('actual_E8_input_fixed_arc_plan_all_63_units_Soviet_sources_hubs_and_Core_effects_match_015',dict(inputHash=w['inputHash'],candidateHash=w['candidateHash'],comparisonHash=digest(w['units']),capacity=e8['afterBoundary']['forward']['capacity'],conservation=w['conservation']))
    assert control['bundle']==config['plan']['projection']['futureBundle'],'NO_OPERATION_GAME_DIFFERS_FROM_014'
    assert control['personnel']['package']['custody']=='REAR_QUARANTINED'
    assert control['industry']==start['industry'] and control['personnel']['account']==start['personnel']['account']
    record('same_start_no_operation_control_exact_original_game_SP_RNG_and_013_E8_expiry',dict(gameHash=digest(control['bundle']),personnel=control['personnel']['package']))
    assert trace['commonBefore']['common']['context']['recoveryCount']==0 and trace['commonAfter']['common']['context']['recoveryCount']==1
    assert pre['bundle']['revision']==152 and end['bundle']['revision']==153 and end['revision']==49
    assert pre['forward']['materialRevision']==1 and end['forward']['materialRevision']==2
    assert end['bundle']['core']['rp']==pre['bundle']['core']['rp']=={'GERMAN':8,'SOVIET':12}
    assert end['bundle']['core']['random']==start['bundle']['core']['random']
    assert [(x['quantityP'] if i==0 else x['quantityE2']) for i,x in enumerate(material(end))]==[0,0]
    assert end['forward']['capacity']==pre['forward']['capacity']
    reasons=[x.get('details',{}).get('reason') for x in trace['commonAfter']['common']['recoveryIssues']]
    assert 'RECOVERY_UNIT_LIMIT_REACHED' in reasons and 'UNIT_ALREADY_RECOVERED_THIS_TURN' in reasons
    record('actual_PE_consumes_original_lots_once_RP_RNG_SP_unchanged_original_Core_count_0_to_1',dict(recovery=end['forward']['recovery'],CoreRejectionReasons=reasons,materialRevisions=[1,2],gameRevisions=[152,153]))
    assert expired['bundle']['core']['turn']==10 and expired['bundle']['core']['phase']=='GERMAN_SUPPLY_RAIL'
    assert expired['forward']['epochs']==[8,9] and expired['forward']['closed']
    assert all(x['custody']=='FRONT_QUARANTINED' and x['owner']==FRONT for x in material(expired))
    assert not expired['forward']['receiver']['incoming'] and expired['forward']['care']['status']=='EXPIRED_PAID_NO_REFUND'
    e9=next(r for r in trace['unusedEndE9']['records'] if (r['result'].get('boundary') or {}).get('epoch')==9)
    assert e9['result']['boundary']['newSolverCalls']=='ORIGINAL_COMPLETE_TWO_SIDE_SETTLEMENT'
    losses=[dict(side=s['side'],**u) for s in e9['result']['boundary']['results'] for u in s['units'] if u['loss']]
    record('actual_unused_branch_normal_E9_maintenance_then_quarantine_ownership_capacity_no_refund',dict(gameRevision=expired['bundle']['revision'],materialRevision=expired['forward']['materialRevision'],events=expired['forward']['events'][-1],actualE9Losses=losses))
    operations=[('care',start,{'type':'PAY_CARE'},['after_care_payment','after_execute','before_commit']),
        ('E8',e8['beforeBoundary'],e8['request']['action'],['after_fixed_settlement','after_reserve','after_dispatch','after_transfer','after_execute','before_commit']),
        ('recovery',pre,dict(type='REPAIR_UNIT',controllerId='G-HUMAN-1',unitId='G-I-01'),['after_material_payment','after_execute','before_commit'])]
    for name,root,action,stages in operations:
        for stage in stages:
            tx=fixture(root,name+'-'+stage);q=tx.request('test-'+name+'-'+stage,action)
            def fault(current,target=stage):
                if current==target:raise RuntimeError('SYNTHETIC_PRECOMMIT:'+target)
            tx._fault=fault;failure=reject(tx,q,'SYNTHETIC_PRECOMMIT')
            views[name+'Failed']=dict(origin='SYNTHETIC_FAULT_ON_REAL_CHECKPOINT',error=failure,view=tx.view())
            record(name+'_atomic_rollback_'+stage,failure,True)
        tx=fixture(root,name+'-race');a=tx.request('race-a',action);b=tx.request('race-b',action)
        with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(tx.submit,[a,b]))
        assert sum(bool(x['ok']) for x in results)==1 and tx.snapshot()['revision']==root['revision']+1
        winner=a if results[0]['ok'] else b;committed=digest(tx.snapshot())
        assert tx.submit(winner)['replayed'] and digest(tx.snapshot())==committed
        different=deepcopy(winner);different['action']={'type':'IMPORT'};reject(tx,different,'REQUEST_ID_CONFLICT')
        record(name+'_same_version_race_one_commit_duplicate_and_conflicting_ID',[{k:v for k,v in r.items() if k!='boundary'} for r in results],True)
        tx=fixture(root,name+'-lost-ack');q=tx.request('lost-ack-'+name,action)
        def lose(stage):
            if stage=='after_commit_before_reply':raise RuntimeError('SYNTHETIC_ACK_LOST_AFTER_PUBLISH')
        tx._fault=lose
        try:tx.submit(q)
        except RuntimeError as ex:assert 'ACK_LOST' in str(ex)
        else:raise AssertionError('ACK_NOT_LOST')
        tx._fault=None;committed=digest(tx.snapshot());assert tx.submit(q)['replayed'] and digest(tx.snapshot())==committed
        newer=success(tx,tx.phase_request());newhash=digest(tx.snapshot())
        assert tx.submit(q)['replayed'] and digest(tx.snapshot())==newhash
        record(name+'_committed_lost_receipt_and_late_retry_never_revert_newer_root',dict(committedHash=committed,newerHash=newhash,newerRevision=tx.snapshot()['revision']),True)
    tx=fixture(start,'forged-bindings')
    for field in ['approvalHash','candidateHash','fixed015Hash','materialHash','rootHash']:
        q=tx.request('bad-'+field,{'type':'PAY_CARE'});q[field]='0'*64
        record('reject_'+field,reject(tx,q,'STALE_OR_AUTHORITY'),True)
    for action in [{'type':'IMPORT'},{'type':'ACTIVATE_PERSONNEL'},{'type':'TRANSPORT'},{'type':'PAY_CARE','approved':True}]:
        record('reject_override_'+digest(action)[:8],reject(tx,tx.request('bad-'+digest(action),action)),True)
    tx=fixture(trace['care'],'no-recharge');record('reject_second_care_new_ID',reject(tx,tx.request('care-again',{'type':'PAY_CARE'}),'CARE_ALREADY'),True)
    tx=fixture(pre,'no-late-ship');record('reject_explicit_duplicate_transport',reject(tx,tx.request('ship-again',{'type':'TRANSPORT'})),True)
    record('reject_cross_phase_care',reject(tx,tx.request('late-care',{'type':'PAY_CARE'})),True)
    tx=fixture(start,'cross-phase-repair');record('reject_T8_PE',reject(tx,tx.request('early-repair',dict(type='REPAIR_UNIT',controllerId='G-HUMAN-1',unitId='G-I-01')),'T9_RECOVERY_ONLY'),True)
    tx=fixture(end,'Core-double-repair');record('reject_second_PE_via_original_Core_shared_limit',reject(tx,tx.request('repair-again',dict(type='REPAIR_UNIT',controllerId='G-HUMAN-1',unitId='G-I-01')),'RECOVERY_UNIT_LIMIT_REACHED'),True)
    tx=fixture(expired,'expired');record('reject_E9_expired_front_inventory',reject(tx,tx.request('expired-repair',dict(type='REPAIR_UNIT',controllerId='G-HUMAN-1',unitId='G-I-01')),'OUTSIDE_016_WINDOW'),True)
    tx=fixture(pre,'forged-terminal')
    for field,value in [('status','CONSUMED'),('unitId','G-PZ-01'),('paidW',0),('approvalHash','forged')]:
        forged=deepcopy(pre);forged['forward']['terminal'][field]=value
        try:tx.check_service(forged)
        except AssertionError:pass
        else:raise AssertionError('FORGED_SERVICE_ACCEPTED')
        record('reject_service_'+field,dict(test='Pure validation of labelled tampered copy; no commit',replacement=value),True)
    tx=fixture(e8['beforeBoundary'],'actual-input-mismatch');live,_=runtime();original=live.sync
    def changed_input(s,f):
        out=original(s,f)
        if out['core_turn']==9:out['T']+=1
        return out
    try:
        live.sync=changed_input
        record('reject_real_boundary_input_mismatch_rolls_back_all',reject(tx,tx.request('mismatch',e8['request']['action']),'E8_INPUT_MISMATCH'),True)
    finally:live.sync=original
    # Explicit rejection, not timeout-as-infeasible or zero-freight success.
    tx=fixture(e8['beforeBoundary'],'timeout')
    def timeout(stage):
        if stage=='after_fixed_settlement':raise TimeoutError('SYNTHETIC_TOTAL_BUDGET_EXHAUSTED')
    tx._fault=timeout;record('deadline_failure_rolls_back_not_zero_shipment',reject(tx,tx.request('timeout',e8['request']['action']),'BUDGET_EXHAUSTED'),True)
    tx=fixture(e8['beforeBoundary'],'receiver-refusal')
    def refuse(stage):
        if stage=='synthetic_refuse_receipt':raise RuntimeError('SYNTHETIC_REFUSAL')
    tx._fault=refuse;success(tx,tx.request('refusal',e8['request']['action']));held=tx.snapshot()
    assert held['forward']['terminal'] is None and held['forward']['shipment']['status']=='HELD'
    assert all(x['owner']==PREFIX+'/shipment-0001' and x['custody']=='HELD' for x in material(held))
    assert held['forward']['receiver']['incoming'] and held['industry']['budget']['freeI']==4
    views['held']=dict(origin='SYNTHETIC_RECEIVER_REFUSAL_ON_REAL_BOUNDARY',view=tx.view())
    tx._fault=None
    from run import advance
    continuation=[];advance(tx,10,'GERMAN_SUPPLY_RAIL',continuation);closed=tx.snapshot()
    assert all(x['owner']==PREFIX+'/shipment-0001' and x['custody']=='TRANSIT_QUARANTINED' for x in material(closed))
    assert not closed['forward']['receiver']['incoming'] and closed['forward']['capacity']==held['forward']['capacity']
    views['heldExpired']=dict(origin='SYNTHETIC_REFUSAL_FOLLOWED_BY_LEGAL_E9_CONTINUATION',view=tx.view())
    record('refused_receipt_retains_transit_owner_spent_capacity_no_terminal_then_E9_isolates_releases_hold',dict(heldHash=digest(held),expiredHash=digest(closed),capacity=closed['forward']['capacity']),True)
    tx=fixture(pre,'readonly');before=digest(tx.snapshot());v=tx.view();assert tx.view()==v;v['equipmentBudget']['freeI']=100
    assert digest(tx.snapshot())==before and tx.view()['equipmentBudget']['freeI']==4
    record('readonly_export_repeated_and_detached_full_root_inventory_receipts_revision_RNG_unchanged',dict(rootHash=before))
    try:Transactions(test_label=tx.test_label)
    except AssertionError as ex:assert 'ALREADY_OWNED' in str(ex)
    else:raise AssertionError('MATCH_REIMPORT_ALLOWED')
    record('same_match_owner_reimport_rejected',synthetic=True)
    # Original RP execution counterfactual, no publication into any owner.
    b=deepcopy(pre['bundle']);action=dict(type='REPAIR_UNIT',controllerId='G-HUMAN-1',unitId='G-I-01')
    rp=live.execute(b,dict(id='016-unit-test-original-RP',revision=b['revision'],action=action),seconds=3)
    assert rp['ok'];q=query(rp['state'],time.perf_counter()+3)
    assert 'RECOVERY_UNIT_LIMIT_REACHED' in [i.get('details',{}).get('reason') for i in q['common']['recoveryIssues']]
    assert digest(b)==digest(pre['bundle'])
    record('original_RP_counterfactual_also_blocks_PE_by_real_shared_Core_limit',dict(RPafter=rp['state']['core']['rp'],CoreIssues=q['common']['recoveryIssues']),True)
    output=dict(task='INDUSTRY-INTEGRATE-016',status='PASS',traceSha256=sha(raw),checks=checks,globalBlockersRetained=35,globalBlockersClosed=0,
        sourceGapSP={'G':9,'S':14},singleProcess=True,crashDurability=False,syntheticViewsHash=digest(views))
    (HERE/'VERIFICATION.json').write_bytes((json.dumps(output,ensure_ascii=False,indent=2)+'\n').encode())
    (HERE/'SYNTHETIC-VIEWS.json').write_bytes((json.dumps(views,ensure_ascii=False,indent=2)+'\n').encode())
    print(json.dumps(dict(status='PASS',checks=len(checks))))
if __name__=='__main__':main()

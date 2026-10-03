"""013 short real continuation + labelled targeted synthetic tests; no old suite replay."""
import gzip,json,sys,time
from copy import deepcopy
from concurrent.futures import ThreadPoolExecutor
from config import HERE,OUT,serialized,sha,digest,start_root,START_SHA,load_launch
from adapter import Transactions,current_eligibility
from view import export_view
import personnel
CASES=[];TRACE={};VIEWS=[];INDEX=0
def record(name,detail=None,synthetic=False):
    CASES.append(dict(name=name,origin='SYNTHETIC_TEST' if synthetic else 'REAL_T7_T8',passed=True,detail=detail))
    print(json.dumps(dict(check=len(CASES),name=name,passed=True)),flush=True)
def new(**kw):
    global INDEX
    INDEX+=1
    return Transactions('013-main' if INDEX==1 else '013-test-'+str(INDEX),test_mode=INDEX>1,**kw)
def request(s,id,kind):return s.request(id,dict(type=kind))
def setup(s,apply=True):
    r=s.submit(request(s,'013-import','ACTIVATE_PERSONNEL'));assert r['ok'],r
    if apply:r=s.submit(request(s,'013-apply','APPLY_PERSONNEL'));assert r['ok'],r
def move_to(s,target):
    for _ in range(64):
        c=s.snapshot()['bundle']['core']
        if (c['turn'],c['phase'])==target:return
        r=s.submit(s.phase_request());assert r['ok'],r
    raise AssertionError('SHORT_SLICE_GUARD')
def sample(label,root,origin=None,error=None):
    before=serialized(root);v=export_view(root,origin=origin,error=error);assert serialized(root)==before
    VIEWS.append(dict(label=label,view=v));return v
def arm(stage):
    b={'on':False,'triggered':False}
    def f(at):
        if b['on'] and at==stage and not b['triggered']:b['triggered']=True;raise RuntimeError('SYNTHETIC:'+stage)
    return b,f

def real():
    s=new();base=start_root();initial=s.snapshot();assert digest(base)==START_SHA
    assert all(initial[k]==v for k,v in base.items()),'FULL_012_ROOT_NOT_PRESERVED'
    imported_q=request(s,'013-import','ACTIVATE_PERSONNEL');r=s.submit(imported_q);assert r['ok'],r;imported=s.snapshot()
    assert imported['bundleJSON']==base['bundleJSON'] and imported['industry']==base['industry']
    sample('T7_pool_assumption_imported',imported)
    apply_q=request(s,'013-apply','APPLY_PERSONNEL');r=s.submit(apply_q);assert r['ok'],r;accepted=s.snapshot();sample('T7_accepted_waiting',accepted)
    p=accepted['personnel'];assert p['package']['custody']=='SOURCE_ESCROW'
    assert p['account']['availableI']==0 and p['account']['acceptanceCareSpentI']==p['account']['escrowI']==1
    record('full_012_T7_root_and_receipts_restored_new_source_assumption_separate_accounts',dict(baseRootHash=START_SHA,baseRevision=base['revision'],
        gameRevision=129,originalReceipts=len(base['receipts']),equipmentBudget=base['industry']['budget'],equipmentE2=2,personnel=personnel.audit(p)))
    control=new();setup(control,apply=False);commands=[];pre=None;e7=None
    for _ in range(64):
        now=s.snapshot();c=now['bundle']['core']
        if (c['turn'],c['phase'])==(8,'GERMAN_RECOVERY'):break
        if (c['turn'],c['phase'])==(7,'SOVIET_ENTRENCHMENT'):pre=now
        q=s.phase_request();cq=control.request(q['id'],q['action']);r=s.submit(q);cr=control.submit(cq)
        assert r['ok'] and cr['ok'],(r,cr)
        after=s.snapshot();assert after['bundleJSON']==control.snapshot()['bundleJSON'],'PERSONNEL_CHANGED_GAME_SP_RNG'
        assert after['industry']==base['industry'] and after['bundle']['core']['random']==base['bundle']['core']['random']
        assert all(after['receipts'][k]==v for k,v in base['receipts'].items())
        commands.append(dict(request=q,seconds=r['seconds'],fullGameHash=sha(after['bundleJSON'].encode()),controlHash=sha(control.snapshot()['bundleJSON'].encode())))
        if r['receipt']['boundaryEpoch']==7:
            e7=after;assert personnel.counts(e7['personnel'])['rearP']==1 and e7['personnel']['package']['receivedEpoch']==7
            assert e7['personnel']['package']['availableFromTurn']==8 and sum(e7['personnel']['quota']['used'].values())==4
            assert e7['personnel']['account']['carriageSpentI']==1 and e7['personnel']['account']['escrowI']==0
            assert not e7['personnel']['incomingP'];sample('E7_received_T8_available',e7)
            record('actual_E7_dispatch_receive_single_4LQ_quota',dict(seconds=r['seconds'],audit=personnel.audit(e7['personnel'])))
    else:raise AssertionError('T8_NOT_REACHED')
    final=s.snapshot();assert final['bundle']['revision']==129+len(commands)
    assert s.read_view()==export_view(final);assert final['industry']==base['industry']
    assert s.read_view()['warehouse']['residentP']==s.read_view()['warehouse']['availableP']==1
    assert s.read_view()['warehouse']['residentE2']==2
    sample('T8_German_recovery_success',final)
    record('legal_commands_full_game_SP_RNG_equal_no_application_control_012_frozen',dict(commands=len(commands),gameRevision=final['bundle']['revision'],
        scheduledReinforcements=[x['request']['action'] for x in commands if x['request']['action']['type']=='DEPLOY_REINFORCEMENT'],
        fullGameHash=sha(final['bundleJSON'].encode()),equipmentLedgerHash=digest(final['industry']),onlyOneCanonicalWarehouse=len(final['warehouseRegistry'])))
    assert sum(x['request']['action']['type']=='END_PHASE' for x in commands)==10
    TRACE.update(base012=base,initial=initial,imported=imported,accepted=accepted,preE7=pre,E7=e7,T8=final,noApplicationT8=control.snapshot(),commands=commands)
    before=s.snapshot();assert s.submit(imported_q)['replayed'] and s.submit(apply_q)['replayed'];assert s.snapshot()==before
    fresh=request(s,'013-new-import-envelope','ACTIVATE_PERSONNEL');assert s.submit(fresh)['replayed'];assert s.snapshot()==before
    extra={**fresh,'id':'013-forged','action':{'type':'ACTIVATE_PERSONNEL','quantityP':2}};assert not s.submit(extra)['ok'];assert s.snapshot()==before
    conflict={**apply_q,'action':{'type':'APPLY_PERSONNEL','feeI':0}};assert not s.submit(conflict)['ok'];assert s.snapshot()==before
    for kind in ['ALLOCATE_I','PLACE_ORDER','REPAIR_UNIT','FORWARD_TO_C10']:
        assert not s.submit(request(s,'013-denied-'+kind,kind))['ok'];assert s.snapshot()==before
    try:Transactions('renamed-instance');raise RuntimeError('DUPLICATE_MATCH_ACCEPTED')
    except AssertionError as ex:assert 'MATCH_ALREADY_HAS_OWNER' in str(ex)
    record('same_match_registry_blocks_instance_rename_duplicates_old_grants_and_forward_actions',synthetic=True)
    return s

def synthetic(s):
    launch=s.launch;pre=TRACE['preE7'];actual=TRACE['E7']['bundle'];proof=current_eligibility(actual,7,'dispatch',time.perf_counter()+3);assert proof['eligible']
    def qualify(b,e,stage):return deepcopy(proof)
    # Import and acceptance payments must also roll back their registry and receipts.
    for kind in ['ACTIVATE_PERSONNEL','APPLY_PERSONNEL']:
        box,fn=arm('after_personnel_payment');owner=new(test_fault=fn)
        if kind=='APPLY_PERSONNEL':setup(owner,apply=False)
        before=owner.snapshot();q=request(owner,'finance-fault-'+kind,kind);box['on']=True;fail=owner.submit(q)
        assert not fail['ok'] and box['triggered'] and owner.snapshot()==before
        assert owner.submit(q)['ok'] and owner.submit(q)['replayed']
        expectedEscrow=1 if kind=='APPLY_PERSONNEL' else 0
        assert owner.snapshot()['personnel']['account']['escrowI']==expectedEscrow
        record('registry_payment_receipts_rollback_'+kind,fail,True)
    # Mutated copies only: never committed game states or real arrival evidence.
    for label in ['enemy_control','enemy_occupation','enemy_zoc','unknown_control']:
        b=deepcopy(actual);core=b['core']
        if label=='enemy_control':core['hexes']['0,9']['control']='SOVIET'
        elif label=='unknown_control':del core['hexes']['0,9']['control']
        else:
            unit=next(u for u in core['units'].values() if u['alive'] and u['side']=='SOVIET' and u['type']=='INFANTRY')
            unit['hex']={'q':0 if label=='enemy_occupation' else 1,'r':9}
        before=deepcopy(b);denied=current_eligibility(b,7,'dispatch',time.perf_counter()+3)
        assert not denied['eligible'] and b==before,(label,denied)
        expected={'enemy_control':'ENEMY_OR_UNKNOWN_CONTROL','unknown_control':'UNKNOWN_RECEIVER',
                  'enemy_occupation':'ENEMY_OCCUPATION','enemy_zoc':'ENEMY_ZOC'}[label]
        assert expected in denied['issues'],denied
        record('actual_Core_service_query_rejects_'+label,denied,True)
    # Capacity/refusal/expiry arithmetic fixtures do not enter the main root.
    for label,used,held in [('used',1,0),('held',0,1)]:
        root=deepcopy(pre);root['bundle']=deepcopy(actual);root['bundleJSON']=serialized(actual);p=root['personnel']
        p['quota']['used']={'SYNTHETIC_OTHER':used} if used else {};p['quota']['holds']={'SYNTHETIC_OTHER':held} if held else {}
        personnel.boundary(p,7,actual,qualify,lambda _:None)
        assert p['package']['custody']=='SOURCE_ESCROW' and p['account']['escrowI']==1
        sample('quota_blocked_'+label,root,'SYNTHETIC_FIXTURE');record('total_quota_counts_other_'+label,personnel.audit(p),True)
    # Real refusal branch: same Core input, synthetic negative service signal only.
    def deny(stage):
        if stage=='deny_receipt':raise RuntimeError('SYNTHETIC_REFUSAL')
    owner=new(test_fault=deny);setup(owner);move_to(owner,(8,'GERMAN_RECOVERY'));heldroot=owner.snapshot();hp=heldroot['personnel']
    assert hp['package']['custody']=='HELD' and sum(hp['incomingP'].values())==1 and hp['account']['carriageSpentI']==1
    sample('rejected_receipt_held',heldroot,'SYNTHETIC_REFUSAL_ON_REAL_REPLAY')
    record('receipt_refusal_retains_transit_owner_hold_fees_and_used_quota',personnel.audit(hp),True)
    # Remaining time windows are synthetic boundary fixtures, not additional legal campaign runs.
    root=deepcopy(heldroot);personnel.housekeeping(root['personnel'],9);p=root['personnel']
    assert p['package']['custody']=='TRANSIT_QUARANTINED' and not p['incomingP'] and sum(p['quota']['used'].values())==4 and p['account']['availableI']==0
    sample('E9_transit_expired',root,'SYNTHETIC_BOUNDARY_E9');record('E9_transit_expiry_no_refund_hold_released',personnel.audit(p),True)
    root=deepcopy(TRACE['accepted']);personnel.housekeeping(root['personnel'],8);p=root['personnel']
    assert p['package']['custody']=='SOURCE_QUARANTINED' and p['account']['availableI']==1 and p['account']['escrowI']==0 and p['account']['acceptanceCareSpentI']==1
    sample('E8_unsent_expired',root,'SYNTHETIC_BOUNDARY_E8');record('E8_unsent_only_unspent_escrow_refunded_same_account',personnel.audit(p),True)
    root=deepcopy(TRACE['imported']);personnel.housekeeping(root['personnel'],8)
    assert root['personnel']['account']['availableI']==2 and root['personnel']['package']['custody']=='SOURCE_QUARANTINED'
    sample('E8_unaccepted_pool_expired',root,'SYNTHETIC_BOUNDARY_E8');record('unaccepted_pool_expires_without_spending_budget',synthetic=True)
    root=deepcopy(TRACE['T8']);personnel.housekeeping(root['personnel'],8);p=root['personnel']
    assert p['package']['custody']=='REAR_QUARANTINED' and personnel.counts(p)['rearP']==1 and personnel.counts(p)['availableRearP']==0
    sample('end_T8_rear_care_expired',root,'SYNTHETIC_BOUNDARY_E8');record('rear_first_usable_turn_end_quarantine_still_occupies_P_capacity',personnel.audit(p),True)
    for label,fixture in [('source',TRACE['accepted']),('transit',heldroot),('rear',TRACE['T8'])]:
        root=deepcopy(fixture);personnel.housekeeping(root['personnel'],7,terminal=True)
        assert 'QUARANTINED' in root['personnel']['package']['custody'];personnel.audit(root['personnel'])
        sample('early_terminal_'+label,root,'SYNTHETIC_EARLY_GAME_OVER');record('early_terminal_'+label+'_keeps_personnel_not_false_death',synthetic=True)
    # E24 is outside approved actual scope: isolated housekeeping unit fixture only.
    p=deepcopy(TRACE['T8']['personnel']);p['package'].update(receivedEpoch=24,availableFromTurn=25,custody='REAR_UNAVAILABLE')
    personnel.housekeeping(p,24);assert p['package']['custody']=='TERMINAL_QUARANTINED' and personnel.counts(p)['availableRearP']==0
    record('synthetic_E24_never_exposes_usable_T25',personnel.audit(p),True)
    # All failure points start from the verified T7 continuation; no checkpoint injection.
    for stage in ['after_reserve','after_dispatch','after_receipt','before_commit']:
        box,fn=arm(stage);owner=new(test_fault=fn);setup(owner);move_to(owner,(7,'SOVIET_ENTRENCHMENT'))
        q=owner.phase_request();before=owner.snapshot();box['on']=True;fail=owner.submit(q)
        assert not fail['ok'] and box['triggered'] and owner.snapshot()==before,(stage,fail)
        sample('failure_'+stage,owner.snapshot(),'SYNTHETIC_FAULT_ON_REAL_REPLAY',fail)
        retry=owner.submit(q);assert retry['ok'],retry;assert owner.submit(q)['replayed']
        assert personnel.counts(owner.snapshot()['personnel'])['rearP']==1
        record('E7_all_state_and_receipts_rollback_'+stage,fail,True)
    # Simultaneous activation/application envelopes share permanent per-match identities.
    owner=new();a=request(owner,'import-a','ACTIVATE_PERSONNEL');b={**a,'id':'import-b'}
    with ThreadPoolExecutor(max_workers=2) as pool:rr=list(pool.map(owner.submit,[a,b]))
    assert sum(r['ok'] and not r.get('replayed') for r in rr)==1 and owner.snapshot()['personnel']['account']['grantedI']==2
    a=request(owner,'apply-a','APPLY_PERSONNEL');b={**a,'id':'apply-b'}
    with ThreadPoolExecutor(max_workers=2) as pool:rr=list(pool.map(owner.submit,[a,b]))
    assert sum(r['ok'] and not r.get('replayed') for r in rr)==1 and owner.snapshot()['personnel']['account']['acceptanceCareSpentI']==1
    record('concurrent_permanent_grant_and_application_one_commit_each',synthetic=True)
    move_to(owner,(7,'SOVIET_ENTRENCHMENT'));a=owner.phase_request('race-E7-a');b={**a,'id':'race-E7-b'}
    beforeRevision=owner.snapshot()['bundle']['revision']
    with ThreadPoolExecutor(max_workers=2) as pool:rr=list(pool.map(owner.submit,[a,b]))
    assert sum(r['ok'] for r in rr)==1 and owner.snapshot()['bundle']['revision']==beforeRevision+1
    record('same_version_E7_only_one_commit',synthetic=True)
    box,fn=arm('after_commit_before_reply');owner=new(test_fault=fn);setup(owner);move_to(owner,(7,'SOVIET_ENTRENCHMENT'));q=owner.phase_request();box['on']=True
    try:owner.submit(q);raise AssertionError('FAULT_MISSING')
    except RuntimeError as ex:assert 'SYNTHETIC' in str(ex)
    assert owner.submit(q)['replayed'];move_to(owner,(8,'GERMAN_RECOVERY'));before=owner.snapshot();assert owner.submit(q)['replayed']
    assert owner.submit(request(owner,'late-import-new-id','ACTIVATE_PERSONNEL'))['replayed'] and owner.snapshot()==before
    record('lost_ack_and_late_retry_no_personnel_refill_or_older_root_restore',synthetic=True)
    owner=new();q=request(owner,'stale-import','ACTIVATE_PERSONNEL');q['fullRootHash']='0'*64;before=owner.snapshot()
    assert not owner.submit(q)['ok'] and owner.snapshot()==before
    q=request(owner,'request-self-approval','ACTIVATE_PERSONNEL');q['approvalHash']='0'*64
    assert not owner.submit(q)['ok'] and owner.snapshot()==before
    record('stale_full_root_and_request_self_authorization_rejected',synthetic=True)
    # Deliberate wall-time failure at the commit seam, no game/SP execution needed.
    def slow(stage):
        if stage=='before_commit':time.sleep(3.05)
    owner=new(test_fault=slow);before=owner.snapshot();fail=owner.submit(request(owner,'timeout-import','ACTIVATE_PERSONNEL'))
    assert not fail['ok'] and 'TOTAL_3_SECOND_BUDGET' in fail['detail'] and owner.snapshot()==before
    record('three_second_total_budget_rolls_back_grant_and_receipt',fail,True)
    # Tampered trusted configuration cannot fill the original candidate approval fields.
    td=OUT/'test-inputs';td.mkdir(exist_ok=True)
    for label in ['approval_missing','profile_changed','candidate_changed']:
        d=td/label;d.mkdir(exist_ok=True);a=json.loads((HERE/'APPROVAL.json').read_bytes());raw=(OUT/'candidate.json').read_bytes()
        if label=='approval_missing':a={}
        if label=='profile_changed':a['profile']['initialP']=2
        if label=='candidate_changed':raw+=b' '
        (d/'approval.json').write_bytes(serialized(a).encode());(d/'candidate.json').write_bytes(raw);(d/'launch.json').write_bytes(b'{"approvalFile":"approval.json","candidateFile":"candidate.json"}')
        try:load_launch(d/'launch.json');raise RuntimeError('TAMPER_ACCEPTED')
        except AssertionError:pass
        record(label+'_rejected',synthetic=True)

def main():
    s=real()
    if '--probe' not in sys.argv:synthetic(s)
    report=dict(task='INDUSTRY-INTEGRATE-013',status='PASS_REAL_E7_PERSONNEL_RECEIVED_T8_AVAILABLE',cases=CASES,final=export_view(TRACE['T8']),
        personnelLedger=TRACE['T8']['personnel']['journal'],baseRootHash=START_SHA,traceSha256=sha(serialized(TRACE).encode()),viewsSha256=sha(serialized(VIEWS).encode()),
        globalBlockersRetained=35,globalBlockersClosed=0,singleProcessOnly=True,crashPersistence=False)
    if '--write' in sys.argv:
        (HERE/'EVIDENCE.json').write_bytes((json.dumps(report,ensure_ascii=False,indent=2)+'\n').encode())
        (HERE/'TRACE.json.gz').write_bytes(gzip.compress(serialized(TRACE).encode(),mtime=0))
        (HERE/'VIEWS.json').write_bytes((json.dumps(VIEWS,ensure_ascii=False,indent=2)+'\n').encode())
    elif '--probe' in sys.argv:(OUT/'probe.json').write_bytes((json.dumps(report,ensure_ascii=False,indent=2)+'\n').encode())
    else:
        saved=json.loads((HERE/'EVIDENCE.json').read_bytes())
        def stable(v):
            if isinstance(v,dict):return {k:stable(x) for k,x in v.items() if k not in ['seconds','traceSha256']}
            if isinstance(v,list):return [stable(x) for x in v]
            return v
        assert stable(saved)==stable(report),'SAVED_EVIDENCE_DIFFERS'
        assert sha(gzip.decompress((HERE/'TRACE.json.gz').read_bytes()))==saved['traceSha256']
        assert json.loads((HERE/'VIEWS.json').read_bytes())==VIEWS
    print(json.dumps(dict(status=report['status'],tests=len(CASES),warehouse=report['final']['warehouse'],budget=report['final']['personnelBudget'])))
if __name__=='__main__':main()

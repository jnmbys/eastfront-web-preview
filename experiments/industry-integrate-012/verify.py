"""012 targeted tests only. Original 011 test suite is not replayed."""
import gzip,json,sys,time
from copy import deepcopy
from concurrent.futures import ThreadPoolExecutor
from config import HERE,OUT,serialized,digest,sha,start_json,load_launch
from adapter import Transactions,current_eligibility
from view import export_view
import production

CASES=[];TRACE={};VIEWS=[];INDEX=0
def record(name,detail=None,synthetic=False):
    CASES.append(dict(name=name,origin='SYNTHETIC_TEST' if synthetic else 'REAL_T5_T7',passed=True,detail=detail))
    print(json.dumps(dict(check=len(CASES),name=name,passed=True)),flush=True)
def new(**kw):
    global INDEX
    INDEX+=1
    return Transactions('012-main' if INDEX==1 else '012-test-'+str(INDEX),test_mode=INDEX>1,**kw)
def domain(s):return {k:v for k,v in s.snapshot().items() if k!='receipts'}
def unchanged(s,old):assert domain(s)==old,'PARTIAL_COMMIT'
def act(s,id,kind):return s.request(id,dict(type=kind))
def funded(s,order=True):
    assert s.submit(act(s,'012-grant','ALLOCATE_I'))['ok']
    if order:assert s.submit(act(s,'012-order','PLACE_ORDER'))['ok']
def move_to(s,target):
    for _ in range(40):
        c=s.snapshot()['bundle']['core']
        if (c['turn'],c['phase'])==target:return
        r=s.submit(s.phase_request());assert r['ok'],r
    raise AssertionError('SLICE_GUARD')
def sample(label,root,origin='REAL',error=None):
    before=serialized(root);v=export_view(root,origin=origin,last_error=error);assert serialized(root)==before
    VIEWS.append(dict(label=label,view=v));return v
def arm(stage):
    b={'on':False,'triggered':False}
    def f(at):
        if b['on'] and at==stage and not b['triggered']:b['triggered']=True;raise RuntimeError('SYNTHETIC:'+stage)
    return b,f

def real_path():
    s=new();start=s.snapshot();assert sha(start['bundleJSON'].encode())==s.launch['approval']['startSnapshotSha256']
    grant=act(s,'012-grant','ALLOCATE_I');reply=s.submit(grant);assert reply['ok'],reply;fundedroot=s.snapshot()
    order=act(s,'012-order','PLACE_ORDER');reply=s.submit(order);assert reply['ok'],reply;accepted=s.snapshot()
    assert accepted['bundleJSON']==start['bundleJSON'] and accepted['industry']['budget']==dict(granted=10,freeI=5,productionSpent=3,handoffSpent=0,escrow=2)
    sample('accepted_waiting_E5',accepted)
    record('fixed_real_T5_grant_and_paid_order_no_game_change',accepted['industry']['budget'])
    control=new();funded(control,order=False);trace=[];e5=None;pre6=None;e6=None
    for _ in range(40):
        root=s.snapshot();c=root['bundle']['core']
        if (c['turn'],c['phase'])==(7,'GERMAN_RECOVERY'):break
        if (c['turn'],c['phase'])==(6,'SOVIET_ENTRENCHMENT'):pre6=root
        q=s.phase_request();cq=control.request(q['id'],q['action']);r=s.submit(q);cr=control.submit(cq)
        assert r['ok'] and cr['ok'],(r,cr)
        now=s.snapshot();ctrl=control.snapshot();assert now['bundleJSON']==ctrl['bundleJSON'],'ORDER_CHANGED_CORE_SP_OR_RNG'
        assert now['bundle']['core']['random']==start['bundle']['core']['random']
        entry=dict(command=deepcopy(q),seconds=r['seconds'],gameHash=sha(now['bundleJSON'].encode()),controlGameHash=sha(ctrl['bundleJSON'].encode()),view=export_view(now));trace.append(entry)
        if r['receipt']['boundaryEpoch']==5:
            e5=now;assert e5['industry']['order']['workEpochs']==[5] and e5['industry']['batch'] is None
            sample('E5_one_of_two_waiting',e5);record('real_E5_one_work_no_output',entry)
        if r['receipt']['boundaryEpoch']==6:
            e6=now;assert e6['industry']['order']['workEpochs']==[5,6]
            assert e6['industry']['batch']['receivedEpoch']==6 and e6['industry']['batch']['availableFromTurn']==7
            assert e6['industry']['warehouse']==dict(resident=2,incoming={},P=0)
            assert e6['industry']['budget']==dict(granted=10,freeI=5,productionSpent=3,handoffSpent=2,escrow=0)
            sample('E6_received_T7_available',e6);record('real_E6_unique_output_external_handoff_and_receipt',entry)
    else:raise AssertionError('NO_T7_RECOVERY')
    final=s.snapshot();assert final['bundle']['core']['turn']==7 and final['bundle']['core']['phase']=='GERMAN_RECOVERY'
    assert final['bundleJSON']==control.snapshot()['bundleJSON']
    assert all(x['action']['type']=='END_PHASE' for x in [row['command'] for row in trace])
    assert len([e for e in final['industry']['journal'] if e['kind']=='E12_INDUSTRIAL_OUTPUT'])==1
    assert len([e for e in final['industry']['journal'] if e['kind']=='E15_RECEIVED'])==1
    assert sum(final['industry']['external']['5']['used'].values())==0 and sum(final['industry']['external']['6']['used'].values())==4
    assert not final['industry']['external']['6']['holds']
    sample('T7_German_recovery_success',final)
    old=serialized(s.snapshot());assert s.read_view()==export_view(final);assert serialized(s.snapshot())==old
    record('all_commands_full_game_SP_RNG_equal_no_order_control',dict(commands=len(trace),startRevision=109,finalRevision=final['bundle']['revision'],
        E5gameRevision=e5['bundle']['revision'],E6gameRevision=e6['bundle']['revision'],allGameBytesEqual=True,RNGUnchanged=True,
        budget=final['industry']['budget'],conservation=production.audit(final['industry'],s.launch['parameters'])))
    TRACE.update(initial=start,funded=fundedroot,accepted=accepted,E5=e5,preE6=pre6,E6=e6,T7=final,noOrderT7=control.snapshot(),commands=trace)
    before=domain(s);assert s.submit(grant)['replayed'] and s.submit(order)['replayed'];unchanged(s,before)
    conflict=deepcopy(order);conflict['action']['priceI']=0;assert not s.submit(conflict)['ok'];unchanged(s,before)
    record('late_grant_order_retries_no_new_I_equipment_or_rollback',synthetic=True)
    return s

def synthetic(s):
    # Pure reducer fixtures derived from saved real E5/pre-E6/E6 bundles; never main-game events.
    launch=s.launch;pre=TRACE['preE6'];actual=TRACE['E6']['bundle'];epoch=actual['core']['turn']-1
    proof=current_eligibility(actual,epoch,launch,time.perf_counter()+3);assert proof['eligible']
    def qualify(b,e,stage):return deepcopy(proof)
    for label,used,holds in [('used_capacity',1,0),('reserved_capacity',0,1),('both_capacity',1,1)]:
        root=deepcopy(pre);i=root['industry'];i['external']['6']=dict(resourceId='EXTERNAL_G_A10',unit='workPoint',side='G',epoch=6,finiteCap=4,perE2Work=2,
            used={'SYNTHETIC_OTHER_TRAFFIC':used} if used else {},holds={'SYNTHETIC_OTHER_HOLD':holds} if holds else {},
            sharingPolicyRef='INDEPENDENT_OF_SP_RAIL_T_W',authorityRef=launch['approval']['decisionRef'])
        root['bundle']=deepcopy(actual);root['bundleJSON']=serialized(actual)
        production.boundary(i,launch,epoch,actual,sha(pre['bundleJSON'].encode()),qualify,lambda x:None)
        assert i['batch']['custody']=='PRODUCTION_STORE' and i['budget']['escrow']==2 and i['budget']['handoffSpent']==0
        assert not i['warehouse']['incoming'] and i['warehouse']['resident']==0
        sample('blocked_'+label,root,'SYNTHETIC_FIXTURE');record('capacity_counts_'+label,production.audit(i,launch['parameters']),True)
    # A warehouse incoming hold counts as capacity, never as already received equipment.
    root=deepcopy(pre);root['bundle']=deepcopy(actual);root['bundleJSON']=serialized(actual)
    root['industry']['warehouse']['incoming']['SYNTHETIC_OTHER_INCOMING']=1
    production.boundary(root['industry'],launch,epoch,actual,sha(pre['bundleJSON'].encode()),qualify,lambda x:None)
    assert root['industry']['batch']['custody']=='PRODUCTION_STORE' and root['industry']['budget']['escrow']==2
    sample('blocked_warehouse_hold',root,'SYNTHETIC_FIXTURE');record('incoming_warehouse_hold_counts_without_double_stock',synthetic=True)
    for stage in ['dispatch','receipt']:
        root=deepcopy(pre);root['bundle']=deepcopy(actual);root['bundleJSON']=serialized(actual)
        def deny(b,e,at):return {**proof,'eligible':False,'issues':['SYNTHETIC_RECEIVER_BLOCK']} if at==stage else deepcopy(proof)
        production.boundary(root['industry'],launch,epoch,actual,sha(pre['bundleJSON'].encode()),deny,lambda x:None)
        i=root['industry'];batch=i['batch']
        assert batch['custody']==('PRODUCTION_STORE' if stage=='dispatch' else 'HELD')
        assert i['budget']['escrow']==(2 if stage=='dispatch' else 0) and i['budget']['handoffSpent']==(0 if stage=='dispatch' else 2)
        assert sum(i['warehouse']['incoming'].values())==(0 if stage=='dispatch' else 2) and i['warehouse']['resident']==0
        sample('blocked_'+stage,root,'SYNTHETIC_FIXTURE');record('blocked_'+stage+'_correct_owner_escrow_capacity',production.audit(i,launch['parameters']),True)
    # Qualification negative fixtures never enter an owner; original Core evaluates them.
    for label in ['enemy_control','enemy_occupation','enemy_zoc','unknown_control']:
        b=deepcopy(actual)
        if label=='enemy_control':b['core']['hexes']['0,9']['control']='SOVIET'
        elif label=='unknown_control':del b['core']['hexes']['0,9']['control']
        else:
            u=next(x for x in b['core']['units'].values() if x['side']=='SOVIET' and x['alive'] and x['type']=='INFANTRY')
            u['hex']={'q':0 if label=='enemy_occupation' else 1,'r':9}
        result=current_eligibility(b,6,launch,time.perf_counter()+3);assert not result['eligible'],label
        record('Core_receiver_'+label+'_rejected',result,True)
    # Targeted transaction rollback: all replicas legally advance from T5, no state loading API.
    for stage in ['after_output','after_dispatch','after_receipt','before_commit']:
        box,fn=arm(stage);owner=new(test_fault=fn);funded(owner);move_to(owner,(6,'SOVIET_ENTRENCHMENT'));q=owner.phase_request();before=domain(owner);box['on']=True
        fail=owner.submit(q);assert not fail['ok'] and box['triggered'];unchanged(owner,before)
        sample('failure_'+stage,owner.snapshot(),'SYNTHETIC_FAULT_ON_REAL_REPLAY',fail)
        retry=owner.submit(q);assert retry['ok'],retry;assert owner.snapshot()['industry']['warehouse']['resident']==2
        assert owner.submit(q)['replayed'];record('E6_all_root_rollback_'+stage,fail,True)
    owner=new();assert owner.submit(act(owner,'grant','ALLOCATE_I'))['ok']
    a=act(owner,'order-a','PLACE_ORDER');b={**a,'id':'order-b'}
    with ThreadPoolExecutor(max_workers=2) as pool:rs=list(pool.map(owner.submit,[a,b]))
    assert sum(r['ok'] for r in rs)==1 and owner.snapshot()['industry']['budget']['productionSpent']==3
    before=domain(owner);assert not owner.submit(act(owner,'order-c','PLACE_ORDER'))['ok'];unchanged(owner,before)
    record('same_version_order_competition_and_single_order_limit',dict(commits=1),True)
    # Reuse this legitimately advanced replica for boundary competition.
    move_to(owner,(6,'SOVIET_ENTRENCHMENT'));a=owner.phase_request('boundary-a');b={**a,'id':'boundary-b'}
    with ThreadPoolExecutor(max_workers=2) as pool:rs=list(pool.map(owner.submit,[a,b]))
    assert sum(r['ok'] for r in rs)==1 and owner.snapshot()['industry']['warehouse']['resident']==2
    record('same_version_E6_competition_one_output_receipt',dict(commits=1),True)
    box,fn=arm('after_commit_before_reply');owner=new(test_fault=fn);funded(owner);move_to(owner,(6,'SOVIET_ENTRENCHMENT'));q=owner.phase_request();box['on']=True
    try:owner.submit(q);raise AssertionError('FAULT_MISSING')
    except RuntimeError as e:assert 'SYNTHETIC' in str(e)
    assert owner.submit(q)['replayed'];move_to(owner,(7,'GERMAN_RECOVERY'));before=domain(owner);assert owner.submit(q)['replayed'];unchanged(owner,before)
    record('lost_E6_ack_late_retry_no_restock_or_rollback',dict(revision=owner.snapshot()['bundle']['revision']),True)
    # Grant/parameter tamper is tested at trusted local startup, never changed in original files.
    td=OUT/'test-inputs';td.mkdir(exist_ok=True)
    for label in ['no_approval','parameter_tamper','candidate_tamper']:
        d=td/label;d.mkdir(exist_ok=True);a=json.loads((HERE/'APPROVAL.json').read_bytes());raw=(OUT/'candidate.json').read_bytes()
        if label=='no_approval':a={}
        if label=='parameter_tamper':a['parameters']['initialI']=100
        if label=='candidate_tamper':raw+=b' '
        (d/'candidate.json').write_bytes(raw);(d/'approval.json').write_bytes(serialized(a).encode());(d/'launch.json').write_bytes(b'{"approvalFile":"approval.json","candidateFile":"candidate.json"}')
        try:load_launch(d/'launch.json');raise RuntimeError('UNAPPROVED_CONFIG_ACCEPTED')
        except AssertionError:pass
        record(label+'_startup_reject',synthetic=True)

def main():
    s=real_path()
    if '--probe' not in sys.argv:synthetic(s)
    report=dict(task='INDUSTRY-INTEGRATE-012',status='PASS_REAL_PRODUCTION_TO_A10_T7_AVAILABLE',cases=CASES,
        final=export_view(TRACE['T7']),ledger=TRACE['T7']['industry']['journal'],globalBlockersRetained=35,globalBlockersClosed=0,
        traceSha256=sha(serialized(TRACE).encode()),viewsSha256=sha(serialized(VIEWS).encode()),onlySingleProcessGuarantee=True)
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
    print(json.dumps(dict(status=report['status'],tests=len(CASES),final=report['final'])))
if __name__=='__main__':main()

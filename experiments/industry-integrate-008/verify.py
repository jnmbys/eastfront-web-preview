"""Real slice and separately labelled synthetic request/fault/reducer tests."""
import gzip,json,sys,time,subprocess,threading
from pathlib import Path
from copy import deepcopy
from concurrent.futures import ThreadPoolExecutor
from adapter import Transactions,phase_action,common_query,custody_audit,transfer_private
from config import HERE,OUT,initial_json,serialized,digest,sha,candidate,load_launch,verify_runtime

ROWS=[];TRACE={};INDEX=0
def record(name,detail=None,synthetic=False):
    ROWS.append(dict(name=name,origin='SYNTHETIC_TEST' if synthetic else 'REAL_T5_E5_T6',passed=True,detail=detail))
def new(**kw):
    global INDEX
    INDEX+=1
    return Transactions('008-test-'+str(INDEX),**kw)
def domain(s):return {k:v for k,v in s.snapshot().items() if k!='receipts'}
def assert_same(s,before):assert domain(s)==before,'PARTIAL_DOMAIN_PUBLICATION'
def progression(s,target,log=None):
    for i in range(16):
        b=s.snapshot()['bundle'];c=b['core']
        if (c['turn'],c['phase'])==target:return
        request=s.request('008-phase-'+str(b['revision']),phase_action(s));reply=s.submit(request)
        assert reply['ok'],reply
        if log is not None:log.append(dict(request=request,reply=reply,stateJSON=s.snapshot()['bundleJSON']))
    raise AssertionError('PROGRESSION_GUARD')
def before_e5(s):progression(s,(5,'SOVIET_ENTRENCHMENT'))
def e5_request(s,id='008-phase-115'):return s.request(id,phase_action(s))
def pe_request(s,id='008-pe',mode='PE'):return s.request(id,dict(type='REPAIR_UNIT',controllerId='G-HUMAN-1',unitId='G-I-01'),mode)
def arm(stage):
    box={'armed':False,'triggered':False}
    def fault(at):
        if box['armed'] and at==stage and not box['triggered']:
            box['triggered']=True;raise RuntimeError('SYNTHETIC:'+stage)
    return box,fault
def reference(raw,commands):
    p=subprocess.run([sys.executable,str(HERE/'reference.py')],input=serialized(dict(bundleJSON=raw,commands=commands)),text=True,encoding='utf8',capture_output=True,timeout=30)
    assert p.returncode==0,p.stderr
    return json.loads(p.stdout)

def main(write=False):
    verify_runtime();c=candidate();assert len(c['blockerReview']['rows'])==35
    s=new();initial=s.snapshot();imported=s.import_initial();assert imported['ok'];assert s.snapshot()['bundleJSON']==initial_json()
    assert {l['owner'] for l in s.snapshot()['materials']['lots'].values()}=={c['services']['source']['id']}
    record('rear_once_front_zero_bundle_byte_identical',dict(initialHash=sha(initial_json().encode()),manifestDigest=digest(c['initialManifest'])))
    saved=domain(s);assert s.import_initial()['replayed'];assert_same(s,saved)
    bad=deepcopy(c['initialManifest']);bad['quantities']['P']=2
    assert s.import_initial(bad)['error']=='MANIFEST_ID_CONFLICT';assert_same(s,saved)
    record('duplicate_and_conflicting_import_no_credit',synthetic=True)
    old=deepcopy(c['initialManifest']);old['id']='RC004-INITIAL-T5-C10-001'
    assert s.import_initial(old)['error']=='MANIFEST_CONTENT_MISMATCH';assert_same(s,saved)
    record('007_front_endowment_rejected',synthetic=True)
    request=pe_request(s,'008-too-early');before=domain(s);p=s.plan(request);assert not p['ok'] and p['common']['commonEligible'];assert_same(s,before)
    assert not s.submit(request)['ok'];assert_same(s,before)
    record('T5_cannot_consume_rear_material',p)
    log=[];before_e5(s)
    # Reconstruct exact legal command sequence from accepted journal, not handwritten state.
    new_journal=s.snapshot()['bundle']['journal'][len(initial['bundle']['journal']):]
    prefix_commands=[x['command'] for x in new_journal]
    pre=s.snapshot();req=e5_request(s);before=domain(s);plan=s.plan(req);assert plan['ok'];assert_same(s,before)
    reply=s.submit(req);assert reply['ok'],reply
    e5=s.snapshot();w=e5['boundary'];assert w and not w['ship'] and not w['fits']
    expected=[('rail:A10~B10',40,32,0,0,8),('rail:B10~C10',40,32,0,0,8),('T',2200,108,0,0,2092),('W:GH2',96,96,0,0,0)]
    assert [(x['id'],x['cap'],x['spUsed'],x['reservation'],x['freight'],x['remaining']) for x in w['rows']]==expected
    assert w['localRailWorkIncludedInT']==44
    assert e5['bundle']['revision']==116 and e5['bundle']['logistics']['epoch']=='L5' and e5['epoch']=='L4'
    assert e5['materials']['revision']==2 and all(l['status']=='QUARANTINED' for l in e5['materials']['lots'].values())
    assert custody_audit(e5['materials'])=={'P':1,'E2:L':2}
    record('actual_E5_zero_shipment_W_saturated',dict(rows=w['rows'],localRailWorkIncludedInT=w['localRailWorkIncludedInT'],seconds=reply['seconds'],budgetSeconds=3,solveCount=w['solveCount'],extraSolveForCargo=0))
    after_e5_commands=[];progression(s,(6,'GERMAN_RECOVERY'),after_e5_commands)
    t6=s.snapshot();assert t6['bundle']['revision']==119
    blocked_request=pe_request(s);before=domain(s);blocked=s.plan(blocked_request);assert blocked['common']['commonEligible'] and not blocked['ok'];assert_same(s,before)
    denied=s.submit(blocked_request);assert not denied['ok'];assert_same(s,before)
    record('real_T6_common_eligible_but_PE_no_arrival',blocked)
    before=domain(s);assert s.import_initial()['replayed'];assert s.submit(req)['replayed'];assert_same(s,before)
    assert not s.submit({**req,'paymentMode':'PE'})['ok'];assert_same(s,before)
    record('late_E5_receipt_retry_does_not_rollback_T6_or_refill',dict(currentRevision=119,receiptRevision=116),True)
    commands=prefix_commands+[reply['receipt']['command']]+[x['reply']['receipt']['command'] for x in after_e5_commands]
    control=new();no_material_log=[];progression(control,(6,'GERMAN_RECOVERY'),no_material_log)
    assert control.snapshot()['bundleJSON']==t6['bundleJSON']
    cw=control.snapshot()['boundary']
    for field in ['inputSnapshot','coreSnapshot','jointSPInputHash','spResults','fullProgramAudit','maintenance','settledSPHash']:
        assert cw[field]==w[field],field
    record('no_material_control_full_game_and_each_unit_maintenance_identical',dict(units=len(w['maintenance']),G=sum(u['maintenance'] for u in w['maintenance'] if u['side']=='G'),S=sum(u['maintenance'] for u in w['maintenance'] if u['side']=='S')))
    original=reference(initial_json(),commands)
    assert original['final']==t6['bundleJSON'],'ORIGINAL_EXECUTE_FULL_RESULT_MISMATCH'
    assert original['states'][len(prefix_commands)]==e5['bundleJSON']
    record('unchanged_original_live_execute_full_E5_and_T6_control',dict(commands=len(commands),allCommandsLegal=True,pendingDecisionsEncountered=0))
    TRACE.update(initial=initial,preE5=pre,E5=e5,T6=t6,blockedPlan=blocked,commands=commands,noMaterialT6=control.snapshot(),originalStateHashes=[sha(x.encode()) for x in original['states']])
    # Current RP still runs through unchanged mode; this is a control, not freight success.
    rp_req=pe_request(control,'008-RP-control','RP');rp_before=control.snapshot();rp_reply=control.submit(rp_req);assert rp_reply['ok'],rp_reply
    rp_original=reference(rp_before['bundleJSON'],[rp_reply['receipt']['command']]);assert rp_original['final']==control.snapshot()['bundleJSON']
    common=common_query(control.snapshot()['bundle'],'PE');assert any(i.get('details',{}).get('reason')=='UNIT_ALREADY_RECOVERED_THIS_TURN' for i in common['commonIssues'])
    record('T6_original_RP_control_and_real_shared_Core_limit',dict(common=common))
    # Wrong hashes/identity/self-certified grants are synthetic requests against real T6.
    for label,change in [('stale_material_hash',dict(materialHash='stale')),('stale_game_hash',dict(gameHash='stale')),('stale_joint_hash',dict(jointHash='stale')),('self_verified_authority',dict(verified=True))]:
        before=domain(s);r=s.submit({**pe_request(s,'008-'+label),**change});assert not r['ok'];assert_same(s,before);record(label,r,True)
    # Faults at a real E5. Every replay continues through original entry; no injected state.
    fault_rows=[]
    for stage in ['before_execute','after_execute','before_commit','inject_unknown_route','inject_missing_audit','inject_solver_failure','inject_timeout']:
        box,fn=arm(stage);owner=new(test_mode=True,test_fault=fn);owner.import_initial();before_e5(owner);request=e5_request(owner,'008-fault-'+stage);before=domain(owner);box['armed']=True
        fail=owner.submit(request);assert not fail['ok'] and box['triggered'],(stage,fail);assert_same(owner,before)
        success=owner.submit(request);assert success['ok'];assert owner.snapshot()['epoch']=='L4';assert owner.submit(request)['replayed']
        record('E5_atomic_rollback_'+stage,dict(failure=fail,retryRevision=owner.snapshot()['bundle']['revision']),True)
        fault_rows.append(dict(stage=stage,failure=fail,receipt=success['receipt']))
    # A real deadline expiry (synthetic scheduling delay) must also roll back all effects.
    box={'on':False}
    def delay(stage):
        if box['on'] and stage=='before_commit':time.sleep(3.01)
    owner=new(test_mode=True,test_fault=delay);owner.import_initial();before_e5(owner);before=domain(owner);request=e5_request(owner,'008-actual-timeout');box['on']=True
    fail=owner.submit(request);assert not fail['ok'] and 'TOTAL_3_SECOND' in fail['detail'];assert_same(owner,before)
    record('actual_total_deadline_rejects_late_publication',fail,True)
    # Competing IDs and same-ID requests share the exact owner lock and root.
    for same_id in [False,True]:
        owner=new();owner.import_initial();before_e5(owner);a=e5_request(owner,'008-race-a');b=deepcopy(a) if same_id else {**a,'id':'008-race-b'}
        with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(owner.submit,[a,b]))
        assert sum(r['ok'] and not r.get('replayed') for r in results)==1
        assert sum(r['ok'] for r in results)==(2 if same_id else 1)
        assert owner.snapshot()['bundle']['revision']==116 and owner.snapshot()['materials']['revision']==2
        record('same_ID_single_commit' if same_id else 'same_version_one_winner',dict(results=results),True)
    # Observe the public root while private SP settlement has completed but not published.
    entered=threading.Event();release=threading.Event();box={'on':False}
    def barrier(stage):
        if box['on'] and stage=='after_execute':entered.set();assert release.wait(1)
    owner=new(test_mode=True,test_fault=barrier);owner.import_initial();before_e5(owner);before=domain(owner);box['on']=True
    with ThreadPoolExecutor(max_workers=1) as pool:
        job=pool.submit(owner.submit,e5_request(owner,'008-visible-root'));assert entered.wait(2);assert_same(owner,before);release.set();assert job.result()['ok']
    record('private_execution_not_public_until_single_root_swap',synthetic=True)
    box,fn=arm('after_commit_before_reply');owner=new(test_mode=True,test_fault=fn);owner.import_initial();before_e5(owner);request=e5_request(owner,'008-lost-ack');box['armed']=True
    try:owner.submit(request);raise AssertionError('FAULT_NOT_RAISED')
    except RuntimeError as e:assert 'SYNTHETIC' in str(e)
    assert owner.snapshot()['bundle']['revision']==116;assert owner.submit(request)['replayed']
    progression(owner,(6,'GERMAN_RECOVERY'));before=domain(owner);assert owner.submit(request)['replayed'];assert owner.import_initial()['replayed'];assert_same(owner,before)
    record('lost_ack_then_late_retry_no_rollback_or_refill',dict(currentRevision=119),True)
    for stage in ['before_import_commit','after_import_commit_before_reply']:
        box,fn=arm(stage);owner=new(test_mode=True,test_fault=fn);before=domain(owner);box['armed']=True
        try:res=owner.import_initial()
        except RuntimeError:res=None
        if stage=='before_import_commit':assert not res['ok'];assert_same(owner,before)
        else:assert owner.snapshot()['materials']['revision']==1
        assert owner.import_initial()['ok'];assert owner.snapshot()['materials']['revision']==1;record(stage,synthetic=True)
    owner=new()
    with ThreadPoolExecutor(max_workers=2) as pool:imports=list(pool.map(lambda _:owner.import_initial(),range(2)))
    assert sum(not r['replayed'] for r in imports)==1 and owner.snapshot()['materials']['revision']==1
    record('concurrent_import_single_credit',synthetic=True)
    # Local config tampering uses separate files; pinned candidate/approval never edited.
    td=OUT/'test-inputs';td.mkdir(exist_ok=True)
    startup=json.loads((HERE/'APPROVAL.json').read_bytes())
    for label in ['no_approval','old004_approval','candidate_tamper','manifest_tamper']:
        folder=td/label;folder.mkdir(exist_ok=True);a=deepcopy(startup);raw=(OUT/'rule/candidate.json').read_bytes()
        if label=='no_approval':a={}
        if label=='old004_approval':a['decisionRef']='LEADER-RULE-CAMPAIGN-004-20261002'
        if label=='candidate_tamper':raw+=b' '
        if label=='manifest_tamper':z=json.loads(raw);z['initialManifest']['quantities']['P']=2;raw=serialized(z).encode()
        (folder/'candidate.json').write_bytes(raw);(folder/'approval.json').write_text(serialized(a),encoding='utf8');(folder/'launch.json').write_text(serialized(dict(candidateFile='candidate.json',approvalFile='approval.json')),encoding='utf8')
        try:load_launch(folder/'launch.json');raise RuntimeError('TAMPER_ACCEPTED')
        except AssertionError:pass
        record(label+'_startup_rejected',synthetic=True)
    before=domain(s);expiry=s.submit(s.request('008-expire',phase_action(s)));assert expiry['ok'];assert s.snapshot()['bundle']['core']['phase']=='GERMAN_ENTRENCHMENT'
    expired=s.submit(pe_request(s,'008-expired'));assert not expired['ok'];assert s.snapshot()['materials']['lots']==before['materials']['lots']
    record('expired_scope_no_E6_retry_and_material_stays_quarantined',expired)
    # Synthetic positive reducer: exercises private custody/capacity mechanics only.
    # It cannot enter a live owner or establish a real arrival/recovery certificate.
    from freight_audit import allocate
    free=deepcopy(w['rows'])
    for row in free:row['spUsed']=0
    for i in range(4):
        short=deepcopy(free);short[i]['spUsed']=short[i]['cap']-short[i]['perKit']+1
        allocated,fits,ship=allocate(short,True)
        assert not fits and not ship and all(row['freight']==0 and row['privateReservation']==0 for row in allocated)
    record('synthetic_each_of_four_capacity_rows_short_means_all_zero',synthetic=True)
    synth=deepcopy(pre);synth['bundle']=deepcopy(e5['bundle']);sw=deepcopy(w);sw.update(ship=True,fits=True,reason='SYNTHETIC_UNIT_FIXTURE')
    sw['rows'],sw['fits'],sw['ship']=allocate(free,True)
    history=transfer_private(synth,sw,c,req,lambda stage:None)
    assert [x['stage'] for x in history]==['SOURCE_RESERVED','IN_TRANSIT','RECEIVED_LOCKED','AVAILABLE_AT_T6_PUBLICATION']
    assert not synth['capacity']['holds'];assert all(r['reservation']==0 and r['freight']==r['perKit'] for r in synth['capacity']['rows'])
    assert custody_audit(synth['materials'])=={'P':1,'E2:L':2}
    for stage in ['after_reserve','after_transfer']:
        private=deepcopy(pre);private['bundle']=deepcopy(e5['bundle']);published=deepcopy(pre)
        def stop(at):
            if at==stage:raise RuntimeError('SYNTHETIC_REDUCER_FAULT')
        try:transfer_private(private,sw,c,req,stop);raise AssertionError('FAULT_MISSING')
        except RuntimeError:pass
        assert pre==published
        record('synthetic_private_transfer_'+stage+'_no_publication',synthetic=True)
    record('synthetic_positive_custody_reservation_reducer_only',dict(noRealShipmentOrRecoveryClaim=True,history=history),True)
    TRACE['faults']=fault_rows
    report=dict(task='INDUSTRY-INTEGRATE-008',status='PASS_WITH_REAL_TRANSPORT_BLOCKED',candidateSha256=sha((OUT/'rule/candidate.json').read_bytes()),
        capacity=w['rows'],actualShipment=0,T6CoreEligible=True,T6PERestored=False,reason='GH2 W: 96/96 SP; kit needs 8',
        cases=ROWS,globalBlockers=35,outOfSliceBlockers=16,localApprovedItems=19,globalBlockersClosed=0,
        singleProcessOwnerOnly=True,crashPersistence=False,referenceCommands=len(commands))
    report['audit']=dict(maintenance=w['maintenance'],sources={r['side']:r['source_used'] for r in w['spResults']},
        fullProgramRowCounts={k:len(v['rows']) for k,v in w['fullProgramAudit'].items()},traceSha256=sha(serialized(TRACE).encode()))
    if write:
        (HERE/'EVIDENCE.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
        (HERE/'TRACE.json.gz').write_bytes(gzip.compress(serialized(TRACE).encode(),mtime=0))
    else:
        saved=json.loads((HERE/'EVIDENCE.json').read_bytes())
        def stable(value):
            if isinstance(value,dict):return {k:stable(v) for k,v in value.items() if k not in ['seconds','traceSha256']}
            if isinstance(value,list):return [stable(v) for v in value]
            return value
        assert stable(saved)==stable(report),'RECOMPUTED_EVIDENCE_DIFFERS_EXCEPT_MEASURED_TIMING'
        assert sha(gzip.decompress((HERE/'TRACE.json.gz').read_bytes()))==saved['audit']['traceSha256']
    print(json.dumps(dict(status=report['status'],tests=len(ROWS),actualShipment=0,T6CoreEligible=True,globalBlockersRetained=35)))
if __name__=='__main__':main('--write' in sys.argv)

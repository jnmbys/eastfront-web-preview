"""Actual fixed T5 -> E5 -> T6, followed by labelled synthetic transaction tests."""
import gzip,json,sys,time,threading
from copy import deepcopy
from concurrent.futures import ThreadPoolExecutor
from adapter import Transactions,phase_action,common_query,custody_audit
from config import HERE,OUT,initial_json,serialized,digest,sha,candidate,load_launch,verify_runtime

CASES=[];TRACE={};INDEX=0
def record(name,detail=None,synthetic=False):
    CASES.append(dict(name=name,origin='SYNTHETIC_TEST' if synthetic else 'REAL_T5_E5_T6',passed=True,detail=detail))
    print(json.dumps(dict(check=len(CASES),name=name,passed=True)),flush=True)
def new(**kw):
    global INDEX
    INDEX+=1
    if INDEX>1:kw.setdefault('test_mode',True)
    return Transactions('011-main' if INDEX==1 else '011-synthetic-replica-'+str(INDEX),**kw)
def domain(s):return {k:v for k,v in s.snapshot().items() if k!='receipts'}
def unchanged(s,before):assert domain(s)==before,'PARTIAL_DOMAIN_PUBLICATION'
def oldtrace():return json.loads(gzip.decompress((OUT/'rule/TRACE008.json.gz').read_bytes()))
def advance(s,revision):
    for cmd in oldtrace()['commands']:
        if s.snapshot()['bundle']['revision']>=revision:return
        if cmd['revision']<s.snapshot()['bundle']['revision']:continue
        assert cmd['revision']==s.snapshot()['bundle']['revision']
        assert cmd['action']==phase_action(s),'SAVED_SEQUENCE_NO_LONGER_LEGAL'
        reply=s.submit(s.request(cmd['id'],cmd['action']));assert reply['ok'],reply
    assert s.snapshot()['bundle']['revision']==revision
def e5(s,id='008-phase-115'):return s.request(id,phase_action(s))
def pe(s,id='011-recover',mode='PE',unit='G-I-01'):
    return s.request(id,dict(type='REPAIR_UNIT',controllerId='G-HUMAN-1',unitId=unit),mode)
def arm(stage):
    box={'armed':False,'triggered':False}
    def fn(at):
        if box['armed'] and at==stage and not box['triggered']:
            box['triggered']=True;raise RuntimeError('SYNTHETIC:'+stage)
    return box,fn
def at_boundary(**kw):
    s=new(**kw);assert s.import_initial()['ok'];advance(s,115);return s
def at_recovery(**kw):
    s=at_boundary(**kw);r=s.submit(e5(s));assert r['ok'],r;advance(s,119);return s
def reason(plan,why):return any(i.get('details',{}).get('reason')==why for i in plan['common']['commonIssues'])
def material_summary(r):
    return dict(gameRevision=r['bundle']['revision'],materialRevision=r['materials']['revision'],scope=r['materials']['scope'],
        lots=deepcopy(r['materials']['lots']),services=deepcopy(r['services']),capacityUsed=deepcopy(r['capacity']['used']))

def real_path():
    verify_runtime();launch=load_launch();t=oldtrace();prediction=json.loads((OUT/'rule/PREDICTION010.json').read_bytes())
    old_evidence=json.loads((OUT/'rule/EVIDENCE008.json').read_bytes())
    assert sha(gzip.decompress((OUT/'rule/TRACE008.json.gz').read_bytes()))==old_evidence['audit']['traceSha256']
    s=new();start=s.snapshot();assert start['bundleJSON']==initial_json()
    assert s.import_initial()['ok'];imported=s.snapshot();assert imported['bundleJSON']==start['bundleJSON']
    record('trusted_011_grant_pinned_policy_rules_manifest_snapshot',launch['approval'])
    record('rear_once_front_zero_game_byte_identical',material_summary(imported))
    assert {l['owner'] for l in imported['materials']['lots'].values()}=={'RC005-DEP-G-A10'}
    early=s.plan(pe(s,'011-early'));assert not early['ok'] and 'UNKNOWN_PAID_SERVICE_RECEIPT' in early['errors']
    advance(s,115);pre=s.snapshot();assert pre['bundleJSON']==t['preE5']['bundleJSON']
    req=e5(s);reply=s.submit(req);assert reply['ok'],reply
    post=s.snapshot();w=post['boundary']
    assert w['ship'] and w['fits'] and w['solveCount']==2 and w['extraSolveForCargo']==0
    assert w['inputSnapshot']==t['E5']['boundary']['inputSnapshot']
    assert w['inputHash']==prediction['inputHash'] and w['jointSPInputHash']==prediction['jointSPInputHash']
    assert post['bundle']['revision']==116 and post['materials']['revision']==2 and post['epoch']=='L4'
    assert post['bundle']['logistics']['epoch']=='L5' and not post['capacity']['holds']
    assert all(l['owner']=='RC005-REC-G-C10' and l['status']=='AVAILABLE' for l in post['materials']['lots'].values())
    assert post['capacity']['used']=={'rail:A10~B10':8,'rail:B10~C10':8,'T':16,'W:GH2':8}
    actualG=next(r for r in w['spResults'] if r['side']=='G');actualS=next(r for r in w['spResults'] if r['side']=='S')
    pred=prediction['germanAlternative']
    for k in ['deliveries','hubs','source_used','hub_unload','constraints','objectives']:
        assert actualG[k]==pred[k],('010_PREDICTION_DIFF',k)
    assert actualG['flows']==[{k:v for k,v in f.items() if k!='variable'} for f in pred['flows']]
    assert actualS==prediction['sovietFrozen'],'SOVIET_FULL_RESULT_CHANGED'
    for expected in prediction['unitComparison']:
        u=next(x for x in (actualG if expected['side']=='G' else actualS)['units'] if x['id']==expected['id'])
        for k,v in u.items():assert v==expected['alternative'][k],(u['id'],k,v,expected['alternative'][k])
    assert w['fullFlowAudit']['G']['rows']==prediction['allCapacityRows']
    assert all(p.get('status',0)==0 for p in w['solverProfile'])
    assert w['localRailWorkIncludedInT']==44
    service=next(iter(post['services'].values()));assert service['status']=='PAID' and service['payload']['paidW']==8
    record('actual_E5_atomic_transport_matches_010_all_units_sources_flows',dict(seconds=reply['seconds'],rows=w['rows'],predictionDifferences=[],solveCount=2))
    advance(s,119);before=s.snapshot();plan=s.plan(pe(s));assert plan['ok'] and plan['common']['commonEligible'],plan
    rr=pe(s);recovered=s.submit(rr);assert recovered['ok'],recovered;after=s.snapshot()
    old=before['bundle'];b=after['bundle'];u0=old['core']['units']['G-I-01'];u1=b['core']['units']['G-I-01']
    assert u0['hex']==u1['hex']=={'q':2,'r':8} and u0['step']==1 and u1['step']==0
    assert b['revision']==120 and after['materials']['revision']==3
    assert b['core']['rp']==old['core']['rp'] and b['core']['random']==old['core']['random']
    assert len(b['core']['actionLog'])==len(old['core']['actionLog'])+1
    def count(core):return sum(x['accepted'] and x['turn']==6 and x['phase']=='GERMAN_RECOVERY' and x['action']['type']=='REPAIR_UNIT' for x in core['actionLog'])
    assert count(old['core'])==0 and count(b['core'])==1
    assert after['capacity']==before['capacity'],'T6_CHARGED_W_AGAIN'
    assert len(after['services'])==1 and next(iter(after['services'].values()))['status']=='CONSUMED'
    assert all(l['quantity']==0 and l['spent']==l['initialQuantity'] and l['status']=='SPENT' for l in after['materials']['lots'].values())
    assert custody_audit(after['materials'])=={'P':1,'E2:L':2}
    repeated=s.plan(pe(s,'011-after-pe-rp','RP'));assert not repeated['ok'] and reason(repeated,'UNIT_ALREADY_RECOVERED_THIS_TURN'),repeated
    used=s.plan(pe(s,'011-after-pe-pe'));assert not used['ok'] and 'SERVICE_ALREADY_USED_OR_EXPIRED' in used['errors'] and reason(used,'UNIT_ALREADY_RECOVERED_THIS_TURN')
    unchanged_before=domain(s);denied=s.submit(pe(s,'011-used-service-submit'));assert not denied['ok'];unchanged(s,unchanged_before)
    effects=[]
    for uid in ['G-PZ-02','G-PZ-03','G-I-01']:
        unit=post['bundle']['core']['units'][uid];refunit=t['E5']['bundle']['core']['units'][uid]
        effects.append(dict(id=uid,reference=deepcopy(refunit['expSupply']),actual=deepcopy(unit['expSupply']),
            referenceSupply=refunit['supplyState'],actualSupply=unit['supplyState'],stepBefore=refunit['step'],stepAfter=unit['step']))
    assert effects[1]['reference']['attackFactor']==1 and effects[1]['actual']['attackFactor']==.75
    assert all(x['stepBefore']==x['stepAfter'] for x in effects)
    record('actual_T6_original_Core_PE_accept_no_RP_RNG_SP_W_payment',dict(beforeUnit=u0,afterUnit=u1,
        RP=b['core']['rp'],gameRevision=[119,120],materialRevision=[2,3],sharedRecoveryCount=[0,1],sharedLimit=repeated,usedServiceRejection=denied,commonPlan=plan))
    record('actual_Core_supply_effects_not_combat_losses',effects)
    rp=next(c for c in old_evidence['cases'] if c['name']=='T6_original_RP_control_and_real_shared_Core_limit')
    assert rp['passed'];record('pinned_008_RP_full_result_control_reused',dict(commit='96bf1d7307063ecb6331fc44b28a832bb2aceac6',evidenceSha256=sha((OUT/'rule/EVIDENCE008.json').read_bytes()),case=rp))
    TRACE.update(initial=start,imported=imported,preE5=pre,E5=post,T6=before,recovered=after,E5Request=req,E5Reply=reply,PERequest=rr,PEReply=recovered,
        materialLedger=[material_summary(x) for x in [start,imported,pre,post,before,after]],CoreSupplyEffects=effects,
        actualCommands=[x['command'] for x in b['journal'][len(start['bundle']['journal']):]])
    return s,req,rr,prediction

def synthetic(s,e5req,pereq):
    # Requests/faults/races are synthetic; every replica starts from the real T5 bytes.
    try:Transactions('unapproved-second-main');raise RuntimeError('SECOND_MAIN_ACCEPTED')
    except AssertionError as ex:assert 'ONLY_ONE_APPROVED_MAIN_INSTANCE' in str(ex)
    record('second_non_test_instance_rejected',synthetic=True)
    before=domain(s)
    assert s.submit(e5req)['replayed'] and s.submit(pereq)['replayed'] and s.import_initial()['replayed'];unchanged(s,before)
    conflict=deepcopy(pereq);conflict['action']['unitId']='G-PZ-02';assert s.submit(conflict)['error']=='REQUEST_ID_CONFLICT';unchanged(s,before)
    bad=deepcopy(candidate()['initialManifest']);bad['quantities']['P']=2
    assert s.import_initial(bad)['error']=='MANIFEST_ID_CONFLICT';unchanged(s,before)
    record('late_E5_PE_and_import_retry_no_refill_rollback_or_double_charge',synthetic=True)
    owner=at_recovery();original=domain(owner)
    for label,changes in [('forged_service',{'serviceReceiptId':'forged'}),('stale_material_hash',{'materialHash':'stale'}),
        ('stale_joint_hash',{'jointHash':'stale'}),('self_approved',{'approved':True})]:
        request=pe(owner,'011-'+label);request.update(changes);denied=owner.submit(request)
        assert not denied['ok'];unchanged(owner,original);record(label,denied,True)
    retarget=owner.submit(pe(owner,'011-retarget',unit='G-PZ-02'));assert not retarget['ok'] and 'SERVICE_TARGET_MISMATCH' in retarget['plan']['errors'];unchanged(owner,original)
    record('retarget_receipt_rejected_without_refund',retarget,True)
    foreign=pe(owner,'011-foreign-receipt');foreign['serviceReceiptId']=next(iter(s.snapshot()['services']))+'-other-instance'
    assert not owner.submit(foreign)['ok'];unchanged(owner,original)
    # RP consumes the original shared count; already paid E5 capacity is not refunded.
    rp=owner.submit(pe(owner,'011-rp-first','RP'));assert rp['ok'],rp
    deny=owner.plan(pe(owner,'011-pe-after-rp'));assert not deny['ok'] and reason(deny,'UNIT_ALREADY_RECOVERED_THIS_TURN')
    assert owner.snapshot()['capacity']==original['capacity'] and all(l['status']=='QUARANTINED' and l['quantity']>0 for l in owner.snapshot()['materials']['lots'].values())
    record('RP_then_PE_real_Core_limit_material_quarantine_no_W_refund',deny,True)
    # E5 must roll back even after physical transfer/service staging in the private root.
    for stage in ['after_reserve','after_transfer','after_service_issue','after_execute','before_commit','inject_unknown_route','inject_missing_audit','inject_solver_failure','inject_timeout']:
        box,fn=arm(stage);owner=at_boundary(test_mode=True,test_fault=fn);request=e5(owner,'011-fault-'+stage);before=domain(owner);box['armed']=True
        fail=owner.submit(request);assert not fail['ok'] and box['triggered'],(stage,fail);unchanged(owner,before)
        retry=owner.submit(request);assert retry['ok'],retry
        assert owner.snapshot()['bundle']['revision']==116 and owner.snapshot()['materials']['revision']==2 and len(owner.snapshot()['services'])==1
        assert owner.submit(request)['replayed'];record('E5_atomic_rollback_'+stage,fail,True)
    # Recovery effect, material debit and service consumption share the same publication.
    for stage in ['after_execute','before_commit']:
        box,fn=arm(stage);owner=at_recovery(test_mode=True,test_fault=fn);request=pe(owner,'011-pe-fault-'+stage);before=domain(owner);box['armed']=True
        fail=owner.submit(request);assert not fail['ok'] and box['triggered'];unchanged(owner,before)
        assert owner.submit(request)['ok'];record('PE_atomic_rollback_'+stage,fail,True)
    # Observe that privately reduced maintenance is never published without its cargo.
    entered=threading.Event();release=threading.Event();box={'on':False}
    def barrier(stage):
        if box['on'] and stage=='after_service_issue':entered.set();assert release.wait(1)
    owner=at_boundary(test_mode=True,test_fault=barrier);before=domain(owner);box['on']=True
    with ThreadPoolExecutor(max_workers=1) as pool:
        job=pool.submit(owner.submit,e5(owner,'011-public-root'));assert entered.wait(2);unchanged(owner,before);release.set();assert job.result()['ok']
    record('SP_material_service_capacity_epoch_publish_one_root',synthetic=True)
    # Wall-clock expiry after private effects still cannot publish anything.
    box={'on':False}
    def delay(stage):
        if box['on'] and stage=='before_commit':time.sleep(3.01)
    owner=at_boundary(test_mode=True,test_fault=delay);before=domain(owner);box['on']=True
    fail=owner.submit(e5(owner,'011-deadline'));assert not fail['ok'] and 'TOTAL_3_SECOND' in fail['detail'];unchanged(owner,before)
    record('actual_deadline_no_late_publication',fail,True)
    for phase in ['E5','PE']:
        for same in [False,True]:
            owner=at_boundary() if phase=='E5' else at_recovery();a=e5(owner,'011-race-a') if phase=='E5' else pe(owner,'011-race-a');b=deepcopy(a)
            if not same:b['id']='011-race-b'
            with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(owner.submit,[a,b]))
            assert sum(r['ok'] and not r.get('replayed') for r in results)==1 and sum(r['ok'] for r in results)==(2 if same else 1)
            assert owner.snapshot()['bundle']['revision']==(116 if phase=='E5' else 120)
            assert owner.snapshot()['materials']['revision']==(2 if phase=='E5' else 3)
            TRACE.setdefault('syntheticRaces',[]).append(dict(phase=phase,sameId=same,results=results))
            record(phase+('_same_ID_single_commit' if same else '_same_version_one_winner'),
                dict(commits=1,successes=sum(r['ok'] for r in results),replays=sum(bool(r.get('replayed')) for r in results),
                    revision=owner.snapshot()['bundle']['revision'],materialRevision=owner.snapshot()['materials']['revision']),True)
        box,fn=arm('after_commit_before_reply');owner=at_boundary(test_mode=True,test_fault=fn) if phase=='E5' else at_recovery(test_mode=True,test_fault=fn)
        request=e5(owner,'011-lost-E5') if phase=='E5' else pe(owner,'011-lost-PE');box['armed']=True
        try:owner.submit(request);raise AssertionError('FAULT_NOT_RAISED')
        except RuntimeError as ex:assert 'SYNTHETIC' in str(ex)
        assert owner.submit(request)['replayed']
        if phase=='E5':advance(owner,119);assert owner.submit(pe(owner))['ok']
        else:assert owner.submit(owner.request('011-later-phase',phase_action(owner)))['ok']
        later=domain(owner);assert owner.submit(request)['replayed'] and owner.import_initial()['replayed'];unchanged(owner,later)
        record(phase+'_lost_ack_and_late_retry_preserves_newer_root',dict(currentRevision=owner.snapshot()['bundle']['revision']),True)
    # Failed eligibility leaves paid service and material intact until original expiry.
    owner=at_recovery();before=domain(owner)
    invalid=pe(owner,'011-wrong-controller');invalid['action']['controllerId']='S-HUMAN-1'
    fail=owner.submit(invalid);assert not fail['ok'] and not fail['plan']['common']['commonEligible'];unchanged(owner,before)
    assert owner.submit(owner.request('011-expiry',phase_action(owner)))['ok']
    fail=owner.submit(pe(owner,'011-after-expiry'));assert not fail['ok']
    assert owner.snapshot()['capacity']==before['capacity'] and all(l['quantity']>0 and l['status']=='QUARANTINED' for l in owner.snapshot()['materials']['lots'].values())
    record('qualification_failure_then_expiry_preserves_committed_work',fail,True)
    # Trusted startup tampering: no caller grant, old grant, policy edit, or manifest edit.
    td=OUT/'test-inputs';td.mkdir(exist_ok=True)
    for label in ['no_grant','old_grant','policy_tamper','candidate_tamper','target_tamper']:
        folder=td/label;folder.mkdir(exist_ok=True);cfg=json.loads((HERE/'launch.json').read_bytes());a=json.loads((HERE/'APPROVAL.json').read_bytes())
        for key in ['candidateFile','ruleFile','policyFile']:
            raw=(HERE/cfg[key]).read_bytes()
            if (label=='policy_tamper' and key=='policyFile') or (label=='candidate_tamper' and key=='candidateFile'):raw+=b' '
            (folder/key).write_bytes(raw);cfg[key]=key
        if label=='no_grant':a={}
        if label=='old_grant':a['decisionRef']='LEADER-RULE-CAMPAIGN-005-20261002'
        if label=='target_tamper':a['scope']['targetUnit']='G-PZ-02'
        cfg['approvalFile']='approval.json';(folder/'approval.json').write_text(serialized(a),encoding='utf8');(folder/'launch.json').write_text(serialized(cfg),encoding='utf8')
        try:load_launch(folder/'launch.json');raise RuntimeError('TAMPER_ACCEPTED')
        except AssertionError:pass
        record(label+'_startup_rejected',synthetic=True)

def main(write=False):
    s,eq,pq,prediction=real_path()
    if '--probe' not in sys.argv:synthetic(s,eq,pq)
    report=dict(task='INDUSTRY-INTEGRATE-011',status='PASS_ACTUAL_E5_TRANSPORT_AND_T6_RECOVERY',
        actualShipment=1,actualPERecoveries=1,capacity=TRACE['E5']['capacity'],maintenanceCost=prediction['affectedUnits'],
        predictionDifferences=[],CoreSupplyEffects=TRACE['CoreSupplyEffects'],materialLedger=TRACE['materialLedger'],
        cases=CASES,globalBlockersRetained=35,globalBlockersClosed=0,singleProcessOwnerOnly=True,crashPersistence=False,
        traceSha256=sha(serialized(TRACE).encode()),secondsE5=TRACE['E5Reply']['seconds'],secondsPE=TRACE['PEReply']['seconds'])
    if write:
        (HERE/'TRACE.json.gz').write_bytes(gzip.compress(serialized(TRACE).encode(),mtime=0))
        (HERE/'EVIDENCE.json').write_bytes((json.dumps(report,ensure_ascii=False,indent=2)+'\n').encode())
    elif '--probe' in sys.argv:
        (OUT/'probe.json').write_bytes((json.dumps(report,ensure_ascii=False,indent=2)+'\n').encode())
    else:
        saved=json.loads((HERE/'EVIDENCE.json').read_bytes())
        def stable(v):
            if isinstance(v,dict):return {k:stable(x) for k,x in v.items() if k not in ['seconds','secondsE5','secondsPE','traceSha256']}
            if isinstance(v,list):return [stable(x) for x in v]
            return v
        assert stable(saved)==stable(report),'SAVED_EVIDENCE_DIFFERS'
        assert sha(gzip.decompress((HERE/'TRACE.json.gz').read_bytes()))==saved['traceSha256']
    print(json.dumps(dict(status=report['status'],tests=len(CASES),shipment=1,recovery=1,secondsE5=report['secondsE5'],secondsPE=report['secondsPE'],effects=TRACE['CoreSupplyEffects'])))
if __name__=='__main__':main('--write' in sys.argv)

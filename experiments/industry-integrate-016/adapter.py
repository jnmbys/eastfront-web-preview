"""Single queue/private copy/single root publication. No HTTP, import or persistence API."""
import os,sys,threading,time,json,subprocess
from copy import deepcopy
from config import *
from audit import fixed_settlement,route_check
LOCK=threading.RLock();OWNERS=set();VERIFIED=None
def runtime():
    os.environ['OPENBLAS_NUM_THREADS']='1'
    if str(LIVE) not in sys.path:sys.path.insert(0,str(LIVE))
    import live,bounded
    return live,bounded
def query(bundle,deadline):
    raw=serialized(bundle)
    p=subprocess.run(['node',str(HERE/'query.mjs')],input=serialized(dict(bundle=bundle)),text=True,encoding='utf8',capture_output=True,timeout=max(.001,deadline-time.perf_counter()))
    assert p.returncode==0,p.stderr
    assert serialized(bundle)==raw
    return json.loads(p.stdout)
def initial_forward():
    return dict(materialRevision=0,care=None,shipment=None,terminal=None,recovery=None,capacity=None,epochs=[],events=[],closed=False,receiver=dict(id=FRONT,capacity={'P':1,'E2:L':2},incoming={}))
def material(root):
    return root['personnel']['package'],root['industry']['batch']
def audit_root(r,base):
    p,e=material(r);f=r.get('forward',initial_forward());ib=r['industry']['budget']
    assert p['id']==base['personnel']['package']['id'] and e['id']==base['industry']['batch']['id']
    assert p['quantityP']+p.get('consumedP016',0)==1 and e['quantityE2']+e.get('consumedE2016',0)==2
    assert p['owner']==e['owner'] or (not f['shipment'] and p['owner']==REAR and e['owner']==REAR)
    assert r['industry']['warehouse']['resident']==(e['quantityE2'] if e['owner']==REAR else 0)
    assert ib['granted']==10==ib['freeI']+ib['productionSpent']+ib['handoffSpent']+ib['escrow']+ib.get('careTransferOutI',0)
    assert r['personnel']['account']==base['personnel']['account']
    for field in ['quota','importReceipt','applicationReceipt','ids']:
        assert r['personnel'][field]==base['personnel'][field],field
    for field in ['external','grants','order','events']:
        assert r['industry'][field]==base['industry'][field],field
    assert r['grantRegistry']==base['grantRegistry']
    for id,rec in base['receipts'].items():assert r['receipts'][id]==rec
    assert p['receivedEpoch']==7 and p['availableFromTurn']==8 and e['receivedEpoch']==6 and e['availableFromTurn']==7
    if p['owner']==FRONT:assert p['quantityP']<=1 and e['quantityE2']<=2
    if f['care']:assert ib['freeI']==4 and ib['careTransferOutI']==1 and f['care']['receivedI']==f['care']['spentI']==1 and f['care']['availableI']==0
    if f['capacity']:
        for row in f['capacity']:assert row['spUsed']+row['freight']+row['reservation']<=row['originalCap']
    assert serialized(r['bundle'])==r['bundleJSON']

class Transactions:
    def __init__(self,*,test_label=None):
        global VERIFIED
        with LOCK:
            if VERIFIED is None:VERIFIED=load()
            self.config=deepcopy(VERIFIED);self.base=deepcopy(self.config['root'])
            key='EASTFRONT-012-ISOLATED' if test_label is None else 'NONMERGEABLE_TEST/'+test_label
            assert key not in OWNERS,'SAME_MATCH_ALREADY_OWNED_NO_REIMPORT'
            OWNERS.add(key);self.test_label=test_label;self._fault=None;self._root=deepcopy(self.base)
            _,bounded=runtime();bounded.warm_start()
    def snapshot(self):return deepcopy(self._root)
    def view(self):
        from view import export_view
        return export_view(self._root)
    def fault(self,stage):
        if self._fault:
            assert self.test_label is not None,'FAULT_INJECTION_TEST_ONLY'
            self._fault(stage)
    def binding(self,r):
        return dict(rootRevision=r['revision'],rootHash=digest(r),gameRevision=r['bundle']['revision'],gameHash=sha(r['bundleJSON'].encode()),
            materialRevision=r.get('forward',{}).get('materialRevision',0),materialHash=digest([*material(r)]),
            candidateHash=self.config['candidateHash'],fixed015Hash=digest(self.config['result']['candidate']),approvalHash=self.config['approvalHash'])
    def request(self,id,action):
        with LOCK:return dict(id=id,action=deepcopy(action),**self.binding(self._root))
    def phase_request(self):
        with LOCK:
            b=self._root['bundle'];a=query(b,time.perf_counter()+3)['nextAction']
            assert a is not None,'PENDING_EXPLICIT_RESOLUTION_REQUIRED'
            return self.request('016-phase-'+str(b['revision']),a)
    def submit(self,request):
        q=deepcopy(request)
        with LOCK:return self._submit(q)
    def _submit(self,q):
        began=time.perf_counter();deadline=began+3;r=self._root
        if not isinstance(q,dict) or set(q)!={'id','action',*self.binding(r)} or not isinstance(q['id'],str) or not q['id'] or not isinstance(q['action'],dict):return dict(ok=False,error='INVALID_REQUEST_SCHEMA')
        fp=digest(q);prior=r['receipts'].get(q['id'])
        if prior:
            if prior['fingerprint']!=fp:return dict(ok=False,error='REQUEST_ID_CONFLICT')
            return dict(ok=True,replayed=True,historicalOnly=True,receipt=deepcopy(prior))
        oldhook=None;oldmode=os.environ.get('INDUSTRY007_PAYMENT_MODE');witness=None
        try:
            assert all(q[k]==v for k,v in self.binding(r).items()),'STALE_OR_AUTHORITY_BINDING'
            n=deepcopy(r);f=n.setdefault('forward',initial_forward());a=q['action'];kind=a.get('type');b=r['bundle'];c=b['core'];p,e=material(n)
            assert c['pendingDecision'] is None,'PENDING_DECISION'
            assert c['turn'] in [8,9] and c['phase']!='GAME_OVER','OUTSIDE_016_WINDOW'
            if kind=='PAY_CARE':
                assert a=={'type':'PAY_CARE'} and not f['care'],'CARE_ALREADY_PAID_OR_OVERRIDE'
                assert (c['turn'],c['phase'])==(8,'GERMAN_RECOVERY') and p['custody']=='REAR_AVAILABLE' and p['owner']==REAR,'CARE_SCOPE_EXPIRED'
                assert n['industry']['budget']['freeI']==5
                n['industry']['budget']['freeI']-=1;n['industry']['budget']['careTransferOutI']=1;n['industry']['revision']+=1
                f['care']=dict(id=PREFIX+'/care-extension-0001',accountId=PREFIX+'/CARE-I',transferId=PREFIX+'/budget-transfer-0001',
                    packageId=p['id'],receivedI=1,spentI=1,availableI=0,oldEndEpoch=8,endEpoch=9,nonrefundable=True,status='PAID_ACTIVE')
                f['events'].append(dict(event='T8_CARE_PAID',details=deepcopy(f['care'])));self.fault('after_care_payment')
            elif kind in ['END_PHASE','DEPLOY_REINFORCEMENT','REPAIR_UNIT']:
                repair=kind=='REPAIR_UNIT';atE8=(c['turn'],c['phase'])==(8,'SOVIET_ENTRENCHMENT');ship=atE8 and f['care'] is not None
                common=query(b,deadline)
                if repair:
                    # Original common qualification runs BEFORE the experimental once guard.
                    assert common['common']['commonEligible'],'CORE_COMMON:'+serialized(common['common'])
                    assert a==dict(type='REPAIR_UNIT',controllerId='G-HUMAN-1',unitId='G-I-01'),'TARGET_OR_CONTROLLER_OUTSIDE_SCOPE'
                    assert (c['turn'],c['phase'])==(9,'GERMAN_RECOVERY'),'T9_RECOVERY_ONLY'
                    route_check(b,common);self.check_service(r)
                else:
                    assert a==common['nextAction'],'ONLY_ORIGINAL_CANONICAL_LEGAL_PHASE_COMMAND'
                live,_=runtime();oldhook=live.logistics_transaction;captured={}
                if ship:
                    assert not f['shipment'] and not f['closed'],'SHIPMENT_ALREADY_USED'
                    assert p['quantityP']==1 and e['quantityE2']==2 and p['owner']==e['owner']==REAR
                    assert p['custody']==e['custody']=='REAR_AVAILABLE'
                    route_check(b,common);self.fault('before_route_accept')
                    def fixed(s,op,seconds):
                        assert op=='settle' and not captured
                        result=fixed_settlement(s,self.config['result'],min(deadline,time.perf_counter()+seconds))
                        captured.update(input=deepcopy(s),result=deepcopy(result));self.fault('after_fixed_settlement')
                        return result
                    live.logistics_transaction=fixed
                else:
                    def tap(s,op,seconds):
                        result=oldhook(s,op,seconds)
                        if result['ok']:captured.update(input=deepcopy(s),result=deepcopy(result))
                        return result
                    live.logistics_transaction=tap
                os.environ['INDUSTRY007_PAYMENT_MODE']='PE' if repair else 'RP'
                # Reuse the saved legal command identities so the authoritative input
                # hash (which includes accepted Core history) is exactly the approved one.
                id=('014-uncommitted-' if b['revision']<=151 else '016-core-')+str(b['revision'])
                cmd=dict(id=id,revision=b['revision'],action=a)
                result=live.execute(b,cmd,seconds=max(0,deadline-time.perf_counter()))
                assert result['ok'],result.get('error');assert not result.get('duplicate')
                n['bundle']=result['state'];n['bundleJSON']=serialized(result['state'])
                if captured:
                    epoch=c['turn'];assert epoch not in f['epochs'];f['epochs'].append(epoch)
                    assert n['bundle']['core']['turn']==epoch+1 and n['bundle']['journal'][-1]['settled']
                    witness=dict(epoch=epoch,inputHash=digest(captured['input']),results=captured['result']['result'],newSolverCalls=0 if ship else 'ORIGINAL_COMPLETE_TWO_SIDE_SETTLEMENT')
                    if ship:
                        witness.update(captured['result']['witness']);witness['inputSnapshot']=captured['input']
                        self.transfer(n,common,witness,deadline,q)
                    else:
                        f['events'].append(dict(event='ORIGINAL_SP_BOUNDARY',epoch=epoch,inputHash=witness['inputHash'],resultsHash=digest(witness['results'])))
                    self.close_scope(n,epoch)
                if repair:self.consume(n,r,q,common)
                if n['bundle']['core']['phase']=='GAME_OVER':self.close_scope(n,c['turn'],terminal=True)
            else:raise ValueError('NO_IMPORT_GRANT_TRANSPORT_OVERRIDE_OR_OTHER_ACTION')
            audit_root(n,self.base);self.fault('after_execute')
            n['revision']+=1
            rec=dict(status='COMMITTED',fingerprint=fp,request=q,beforeRootRevision=r['revision'],afterRootRevision=n['revision'],
                beforeGameRevision=b['revision'],afterGameRevision=n['bundle']['revision'],boundaryEpoch=witness['epoch'] if witness else None,
                witnessHash=digest(witness) if witness else None,materialRevision=f['materialRevision'])
            n['receipts'][q['id']]=rec;self.fault('before_commit')
            assert time.perf_counter()<deadline,'TOTAL_3_SECOND_BUDGET'
        except Exception as ex:
            assert self._root is r
            return dict(ok=False,error='REJECTED_UNCHANGED',detail=str(ex))
        finally:
            if oldhook is not None:live.logistics_transaction=oldhook
            if oldmode is None:os.environ.pop('INDUSTRY007_PAYMENT_MODE',None)
            else:os.environ['INDUSTRY007_PAYMENT_MODE']=oldmode
        self._root=n
        elapsed=time.perf_counter()-began;self.fault('after_commit_before_reply')
        return dict(ok=True,replayed=False,receipt=deepcopy(rec),boundary=witness,seconds=elapsed)

    def transfer(self,n,prequery,w,deadline,request):
        f=n['forward'];p,e=material(n);assert f['care']['status']=='PAID_ACTIVE' and f['care']['endEpoch']==9
        # All holds and custody transitions are private until the same SP root publishes.
        f['capacity']=[dict(**row,reservation=row['cargo'],freight=0) for row in w['capacity'] if row['id'] in CARGO]
        assert len(f['capacity'])==4
        f['receiver']['incoming']={PREFIX+'/shipment-0001':{'P':1,'E2:L':2}}
        self.fault('after_reserve')
        f['shipment']=dict(id=PREFIX+'/shipment-0001',packageId=p['id'],batchId=e['id'],dispatchEpoch=8,arrivalEpoch=None,availableFromTurn=9,
            inputHash=w['inputHash'],candidateHash=w['candidateHash'],capacityWitnessHash=digest(w['capacity']),careExtensionId=f['care']['id'],status='IN_TRANSIT',
            inputRootHash=request['rootHash'],requestId=request['id'],requestFingerprint=digest(request),inputMaterialRevision=request['materialRevision'])
        p.update(owner=f['shipment']['id'],custody='IN_TRANSIT');e.update(owner=f['shipment']['id'],custody='IN_TRANSIT');n['industry']['warehouse']['resident']=0
        for row in f['capacity']:row.update(reservation=0,freight=row['cargo'])
        f['events'].append(dict(event='E8_DEPARTED',P=deepcopy(p),E2=deepcopy(e),capacity=deepcopy(f['capacity'])))
        self.fault('after_dispatch')
        receiptQuery=query(n['bundle'],deadline)
        # Qualification failure after departure retains actual transit owner, booked
        # capacity and destination hold. Internal faults still abort the whole root.
        try:route_check(n['bundle'],receiptQuery)
        except AssertionError as ex:accepted=False;refusal=str(ex)
        else:accepted=True;refusal=None
        if self.test_label:
            try:self.fault('synthetic_refuse_receipt')
            except RuntimeError:accepted=False;refusal='SYNTHETIC_RECEIVER_REFUSAL'
        if accepted:
            p.update(owner=FRONT,custody='FRONT_AVAILABLE');e.update(owner=FRONT,custody='FRONT_AVAILABLE')
            f['receiver']['incoming']={};f['shipment'].update(status='RECEIVED',arrivalEpoch=8,receiptId=PREFIX+'/receipt-0001')
            f['terminal']=dict(id=PREFIX+'/terminal-GI01-0001',status='PAID',unitId='G-I-01',controllerId='G-HUMAN-1',side='G',node='C10',key='2,8',
                paidW=8,extraRecoveryW=0,shipmentId=f['shipment']['id'],packageId=p['id'],batchId=e['id'],arrivalEpoch=8,availableFromTurn=9,
                approvalHash=self.config['approvalHash'],candidateHash=self.config['candidateHash'],fixedCandidateHash=w['candidateHash'],inputHash=w['inputHash'],
                capacityWitnessHash=f['shipment']['capacityWitnessHash'],careExtensionId=f['care']['id'],expiresAfterEpoch=9,
                inputRootHash=request['rootHash'],requestFingerprint=digest(request),materialRevision=f['materialRevision']+1)
        else:
            p['custody']=e['custody']='HELD';f['shipment'].update(status='HELD',refusal=refusal)
        n['personnel']['revision']+=1;n['industry']['revision']+=1;f['materialRevision']+=1
        f['events'].append(dict(event='E8_RECEIVED' if accepted else 'E8_HELD',shipment=deepcopy(f['shipment']),terminal=deepcopy(f['terminal']),P=deepcopy(p),E2=deepcopy(e)))
        self.fault('after_transfer')
    def check_service(self,r):
        f=r.get('forward',{});p,e=material(r);t=f.get('terminal');s=f.get('shipment')
        assert t and s and not f['closed'] and not f['recovery'],'NO_ACTIVE_UNUSED_TERMINAL'
        expected=dict(id=PREFIX+'/terminal-GI01-0001',status='PAID',unitId='G-I-01',controllerId='G-HUMAN-1',side='G',node='C10',key='2,8',paidW=8,extraRecoveryW=0,
            shipmentId=PREFIX+'/shipment-0001',packageId=p['id'],batchId=e['id'],arrivalEpoch=8,availableFromTurn=9,approvalHash=self.config['approvalHash'],
            candidateHash=self.config['candidateHash'],fixedCandidateHash=digest(self.config['result']['candidate']),inputHash=self.config['result']['inputHash'],
            capacityWitnessHash=s['capacityWitnessHash'],careExtensionId=PREFIX+'/care-extension-0001',expiresAfterEpoch=9,
            inputRootHash=s['inputRootHash'],requestFingerprint=s['requestFingerprint'],materialRevision=s['inputMaterialRevision']+1)
        assert t==expected,'FORGED_RETARGETED_OR_USED_SERVICE'
        rec=r['receipts'][s['requestId']]
        assert rec['status']=='COMMITTED' and rec['fingerprint']==s['requestFingerprint']==digest(rec['request'])
        assert rec['request']['rootHash']==s['inputRootHash'] and rec['request']['materialRevision']==s['inputMaterialRevision']
        assert s['capacityWitnessHash']==digest(self.config['result']['allCapacityRows'])
        assert s['status']=='RECEIVED' and p['owner']==e['owner']==FRONT and p['custody']==e['custody']=='FRONT_AVAILABLE'
        assert p['quantityP']==1 and e['quantityE2']==2
        assert {row['id']:row['freight'] for row in f['capacity']}==CARGO
        assert f['care']['status']=='PAID_ACTIVE' and f['care']['spentI']==1
    def consume(self,n,r,q,common):
        before=r['bundle'];after=n['bundle'];f=n['forward'];p,e=material(n)
        assert after['core']['rp']==before['core']['rp'] and after['core']['random']==before['core']['random']
        assert after['core']['units']['G-I-01']['step']==before['core']['units']['G-I-01']['step']-1
        def sp(b):
            s=b['logistics'];return dict(units=[{k:u[k] for k in ['id','stock','debt','B','cap']} for u in s['units']],hubs=s['hubs'],sources=s['sources'],done=s['done'],T=s['T'],spent=s['action_spent'])
        assert sp(after)==sp(before),'PE_PAYMENT_CHANGED_SP'
        p.update(quantityP=0,consumedP016=1,custody='CONSUMED');e.update(quantityE2=0,consumedE2016=2,custody='CONSUMED')
        f['terminal']['status']='CONSUMED';f['terminal']['consumedBy']=PREFIX+'/recovery-0001'
        f['materialRevision']+=1;n['personnel']['revision']+=1;n['industry']['revision']+=1
        f['recovery']=dict(id=PREFIX+'/recovery-0001',requestId=q['id'],unitId='G-I-01',payment={'P':1,'E2:L':2,'RP':0,'extraW':0},
            beforeStep=before['core']['units']['G-I-01']['step'],afterStep=after['core']['units']['G-I-01']['step'],
            beforeGameRevision=before['revision'],afterGameRevision=after['revision'],commonBefore=common['common'])
        f['events'].append(dict(event='T9_PE_CONSUMED',details=deepcopy(f['recovery'])));self.fault('after_material_payment')
    def close_scope(self,n,epoch,terminal=False):
        f=n['forward'];p,e=material(n)
        if not f['care']:
            # Invoke the pinned 013 expiry reducer, not an invented replacement.
            import importlib.util
            spec=importlib.util.spec_from_file_location('old_personnel013',HERE.parent/'industry-integrate-013/personnel.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
            before=digest(p);mod.housekeeping(n['personnel'],epoch,terminal)
            if digest(p)!=before:
                f['materialRevision']+=1
                f['events'].append(dict(event='ORIGINAL_013_EXPIRY',epoch=epoch,owner=p['owner'],custody=p['custody']))
            return
        if (epoch>=9 or terminal) and not f['closed']:
            f['closed']=True;f['care']['status']='EXPIRED_PAID_NO_REFUND'
            if p['quantityP']:
                p['custody']='FRONT_QUARANTINED' if p['owner']==FRONT else 'REAR_QUARANTINED' if p['owner']==REAR else 'TRANSIT_QUARANTINED'
                if e['owner']!=REAR:e['custody']=p['custody']
                f['receiver']['incoming']={};f['materialRevision']+=1;n['personnel']['revision']+=1;n['industry']['revision']+=int(e['owner']!=REAR)
                n['personnel']['application']['status']='EXPIRED'
                if f['terminal']:f['terminal']['status']='EXPIRED_NO_REFUND'
            f['events'].append(dict(event='END_E9_OR_TERMINAL_QUARANTINE',epoch=epoch,terminal=terminal,owner=p['owner'],P=deepcopy(p),E2=deepcopy(e),refundI=0,
                stillOccupiesReceiver={'P':p['quantityP'] if p['owner']==FRONT else 0,'E2:L':e['quantityE2'] if e['owner']==FRONT else 0}))

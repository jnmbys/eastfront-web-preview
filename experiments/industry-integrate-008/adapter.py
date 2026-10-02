"""Single-process owner: one lock/queue, private execution, one root publication.

No HTTP, persistence, advanced-state import, or caller authorization surface.
The disposable original solver worker never owns/publicizes game or material state.
"""
import os,json,threading,time,subprocess,sys
from copy import deepcopy
from pathlib import Path
from config import HERE,OUT,CANDIDATE_SHA,load_launch,verify_runtime,initial_json,digest,sha,serialized

_OWNERS=set()
_EXECUTION=threading.Lock() # Original live/worker globals belong to one in-process execution owner.
_VERIFIED=False
def runtime():
    global _VERIFIED
    if not _VERIFIED:verify_runtime();_VERIFIED=True
    os.environ['OPENBLAS_NUM_THREADS']='1'
    sys.path.insert(0,str(OUT/'live')) if str(OUT/'live') not in sys.path else None
    import live,bounded
    return live,bounded
def common_query(bundle,mode,controller='G-HUMAN-1',unit='G-I-01',seconds=3):
    raw=serialized(bundle)
    p=subprocess.run(['node',str(HERE/'query.mjs')],input=serialized(dict(bundle=bundle,mode=mode,controllerId=controller,unitId=unit)),
        text=True,encoding='utf8',capture_output=True,timeout=seconds)
    if p.returncode:raise ValueError(p.stderr)
    assert serialized(bundle)==raw
    return json.loads(p.stdout)
def custody_audit(m):
    total={'P':0,'E2:L':0};seen=set()
    for lot in m['lots'].values():
        assert lot['id'] not in seen;seen.add(lot['id'])
        assert lot['status'] in ['SOURCE_AVAILABLE','SOURCE_RESERVED','IN_TRANSIT','RECEIVED_LOCKED','AVAILABLE','SPENT','QUARANTINED']
        assert lot['quantity']>=0 and lot['spent']>=0 and lot['quantity']+lot['spent']==lot['initialQuantity']
        assert lot['owner'] in ['RC005-DEP-G-A10','RC005-REC-G-C10'] or lot['owner'].startswith('shipment:')
        if lot['status'] in ['AVAILABLE','RECEIVED_LOCKED']:assert lot['owner']=='RC005-REC-G-C10'
        if lot['status'] in ['SOURCE_AVAILABLE','SOURCE_RESERVED']:assert lot['owner']=='RC005-DEP-G-A10'
        if lot['status']=='IN_TRANSIT':assert lot['owner'].startswith('shipment:')
        total[lot['material']]+=lot['quantity']+lot['spent']
    assert total==({'P':1,'E2:L':2} if m['imports'] else {'P':0,'E2:L':0})
    return total

def transfer_private(root,witness,c,request,fault):
    """Owner-only reducer on a private copy. Unit tests may use labelled synthetic inputs."""
    m=root['materials'];id=request['id'];history=[]
    assert root['epoch'] is None and not root['capacity']['holds'] and not root['capacity']['used']
    root['epoch']='L4';root['boundary']=witness
    root['capacity']=dict(epoch='L4',rows=deepcopy(witness['rows']),holds={},used={x['id']:0 for x in witness['rows']})
    cap=root['capacity']
    def capture(stage):
        custody_audit(m)
        history.append(dict(stage=stage,materials=deepcopy(m['lots']),capacity=deepcopy(cap)))
    if m['imports']:
        m['revision']+=1
        if witness['ship']:
            assert set(m['lots'])==set(c['initialManifest']['lotIds'].values())
            assert all(l['status']=='SOURCE_AVAILABLE' and l['owner']==c['services']['source']['id'] for l in m['lots'].values())
            assert all(l['quantity']==c['cargo']['kit'][l['material']] for l in m['lots'].values())
            assert all(q<=c['services']['source']['capacity'][material] and q<=c['services']['receiver']['capacity'][material] for material,q in c['cargo']['kit'].items())
            # A single kit and empty receiver are the only authorized reservation.
            assert not any(l['owner']==c['services']['receiver']['id'] for l in m['lots'].values())
            cap['holds'][id]=dict(sourceLots=list(m['lots']),receiver=c['services']['receiver']['id'],receiverSpace=deepcopy(c['cargo']['kit']),
                quantities=deepcopy(c['cargo']['kit']),rows={r['id']:r['perKit'] for r in cap['rows']},
                key=dict(experimentId=c['scope']['experimentId'],epoch='L4',shipmentId=id,manifestDigest=digest(c['initialManifest']),routeDigest=witness['routeHash'],jointSnapshotHash=request['jointHash']))
            for row in cap['rows']:
                assert row['spUsed']+row['otherHolds']+row['alreadyCommitted']+row['perKit']<=row['cap']
                row.update(reservation=row['perKit'],freight=0)
            for lot in m['lots'].values():lot['status']='SOURCE_RESERVED'
            capture('SOURCE_RESERVED');fault('after_reserve')
            for lot in m['lots'].values():lot.update(status='IN_TRANSIT',owner='shipment:'+id)
            capture('IN_TRANSIT')
            for lot in m['lots'].values():lot.update(status='RECEIVED_LOCKED',owner=c['services']['receiver']['id'])
            capture('RECEIVED_LOCKED');fault('after_transfer')
            for row in cap['rows']:
                row.update(reservation=0,freight=row['perKit']);cap['used'][row['id']]=row['perKit']
            del cap['holds'][id]
            assert root['bundle']['core']['turn']==6
            for lot in m['lots'].values():lot['status']='AVAILABLE'
            capture('AVAILABLE_AT_T6_PUBLICATION')
            m['journal'].append(dict(event='E5_TRANSFER',shipmentId=id,manifestDigest=digest(c['initialManifest']),
                lotIds=list(m['lots']),quantities=c['cargo']['kit'],source=c['services']['source']['id'],receiver=c['services']['receiver']['id'],
                arrivalEpoch=5,availableFromTurn=6,requestFingerprint=digest(request),routeHash=witness['routeHash'],
                jointInputHash=request['jointHash'],spInputHash=witness['inputHash'],privateTransitions=history))
        else:
            for lot in m['lots'].values():lot['status']='QUARANTINED'
            m['scope']='QUARANTINED';m['journal'].append(dict(event='E5_ZERO_SHIPMENT_QUARANTINE',reason=witness['reason']))
    custody_audit(m)
    return history

class Transactions:
    def __init__(self,instance_id,config_file=HERE/'launch.json',*,test_fault=None,test_mode=False):
        if test_fault and not test_mode:raise ValueError('TEST_MODE_REQUIRED')
        self._launch=load_launch(config_file);self.c=self._launch['candidate']
        assert isinstance(instance_id,str) and instance_id and instance_id not in _OWNERS,'NEW_INSTANCE_REQUIRED'
        live,bounded=runtime()
        with _EXECUTION:bounded.warm_start() # Explicit service startup outside transaction budget.
        self._lock=threading.RLock();self._fault=test_fault;self._test_mode=test_mode
        raw=initial_json();assert sha(raw.encode())==self.c['checkpoint']['serializedSnapshotSha256']
        self._root=dict(bundle=json.loads(raw),bundleJSON=raw,materials=dict(revision=0,instanceId=instance_id,imports={},lots={},journal=[],scope='ACTIVE'),
            capacity=dict(epoch=None,rows=[],holds={},used={}),epoch=None,receipts={},boundary=None)
        _OWNERS.add(instance_id)
    def snapshot(self):
        # Published roots are never mutated; readers can see the prior root while
        # private solve/transfer runs. They never wait on, or see, private holds.
        root=self._root
        return deepcopy(root)
    def _binding(self,r):
        return dict(revision=r['bundle']['revision'],gameHash=sha(r['bundleJSON'].encode()),materialRevision=r['materials']['revision'],materialHash=digest(r['materials']),
            jointHash=digest(dict(gameHash=sha(r['bundleJSON'].encode()),materials=r['materials'],capacity=r['capacity'],epoch=r['epoch'],
                witnessHash=digest(r['boundary']) if r['boundary'] else None,candidateHash=CANDIDATE_SHA,approvalHash=self._launch['approvalHash'])))
    def request(self,id,action,mode='NONE'):
        with self._lock:return dict(id=id,action=deepcopy(action),paymentMode=mode,**self._binding(self._root))
    def gates(self):
        return dict(runtimeAllowed=False,runtimeDecision='REJECT',globalBlockersClosed=0,
            blockers=[x['blocker'] for x in self.c['blockerReview']['rows']],localApprovedItems=19,
            outOfSliceBlockers=16,scope='RC005_A10_C10_E5_T6_ISOLATED_ONLY')
    def _fault_at(self,stage):
        if self._fault:self._fault(stage)
    def import_initial(self,manifest=None):
        captured=deepcopy(self.c['initialManifest'] if manifest is None else manifest)
        with self._lock:
            r=self._root;m=r['materials'];key=captured.get('id');h=digest(captured)
            if key in m['imports']:
                if h!=m['imports'][key]['digest']:return dict(ok=False,error='MANIFEST_ID_CONFLICT')
                return dict(ok=True,replayed=True,receipt=deepcopy(m['imports'][key]))
            if h!=digest(self.c['initialManifest']):return dict(ok=False,error='MANIFEST_CONTENT_MISMATCH')
            if sha(r['bundleJSON'].encode())!=self.c['checkpoint']['serializedSnapshotSha256'] or m['revision']!=0:return dict(ok=False,error='INITIAL_SCOPE_EXPIRED')
            n=deepcopy(r);nm=n['materials'];nm['revision']=1
            rec=dict(id=key,digest=h,initialGameHash=sha(r['bundleJSON'].encode()),retired=False)
            nm['imports'][key]=rec
            for material,qty in captured['quantities'].items():
                lotid=captured['lotIds'][material]
                nm['lots'][lotid]=dict(id=lotid,material=material,quantity=qty,initialQuantity=qty,spent=0,status='SOURCE_AVAILABLE',owner=captured['atService'],manifestId=key)
            nm['journal'].append(dict(event='REAR_INITIAL_IMPORT',manifest=deepcopy(captured),front={'P':0,'E2:L':0}))
            custody_audit(nm)
            try:self._fault_at('before_import_commit')
            except Exception as e:return dict(ok=False,error='PRECOMMIT_FAILURE',detail=str(e))
            self._root=n
            self._fault_at('after_import_commit_before_reply')
            return dict(ok=True,replayed=False,receipt=deepcopy(rec))
    def _plan(self,r,request,deadline):
        errors=[];common=None
        fields={'id','action','paymentMode','revision','gameHash','materialRevision','materialHash','jointHash'}
        if not isinstance(request,dict) or set(request)!=fields or not isinstance(request['id'],str) or not request['id'] or not isinstance(request['action'],dict):return dict(ok=False,errors=['INVALID_REQUEST_SCHEMA'],common=None)
        for k,v in self._binding(r).items():
            if request[k]!=v:errors.append('STALE_'+k)
        a=request['action'];b=r['bundle'];s=self.c['scope'];m=r['materials']
        if a.get('type')=='REPAIR_UNIT':
            mode=request['paymentMode']
            if set(a)!={'type','controllerId','unitId'} or mode not in ['RP','PE']:errors.append('INVALID_RECOVERY_REQUEST')
            common=common_query(b,mode,a.get('controllerId'),a.get('unitId'),max(.001,deadline-time.perf_counter()))
            if not common['commonEligible']:errors.append('CORE_COMMON_INELIGIBLE')
            if mode=='RP' and common['rpIssues']:errors.append('RP_PAYMENT_INSUFFICIENT')
            if mode=='PE':
                u=b['core']['units'].get(a.get('unitId'),{});node=next((n for n in b['logistics']['nodes'] if n['id']=='C10'),{})
                if a.get('unitId')!=s['recoveryUnitId'] or a.get('controllerId')!=s['controllerId'] or u.get('hex')!={'q':2,'r':8}:errors.append('TARGET_OUTSIDE_SCOPE')
                if b['core']['turn']!=6 or b['core']['phase']!='GERMAN_RECOVERY':errors.append('T6_SCOPE_INVALID')
                if m['scope']!='ACTIVE':errors.append('MATERIAL_SCOPE_'+m['scope'])
                if node.get('control','unknown') is not None or any(o!='G' for o in node.get('occupants',[])) or any(z!='G' for z in node.get('zoc_by',[])):errors.append('RECEIVER_ACCESS_INVALID')
                if not r['boundary'] or not r['boundary']['ship'] or r['epoch']!='L4':errors.append('NO_E5_TRANSPORT_RECEIPT')
                for material,qty in self.c['recovery']['materialPrice'].items():
                    lot=m['lots'].get(self.c['initialManifest']['lotIds'][material])
                    if not lot or lot['status']!='AVAILABLE' or lot['owner']!=self.c['services']['receiver']['id'] or lot['quantity']!=qty:errors.append('MATERIAL_UNAVAILABLE:'+material)
        else:
            if request['paymentMode']!='NONE':errors.append('PAYMENT_MODE_ON_NON_RECOVERY')
            if a.get('type') not in ['END_PHASE','READY_FOR_PHASE_END','PASS_REACTION','PASS_ADVANCE','PASS_BREAKTHROUGH','PASS_SCHWERPUNKT','RETREAT','ALLOCATE_LOSSES']:errors.append('ACTION_OUTSIDE_SLICE')
            if b['core']['turn'] not in [5,6] or (b['core']['turn']==6 and b['core']['phase'] not in ['GERMAN_SUPPLY_RAIL','GERMAN_MOVEMENT','GERMAN_COMBAT','GERMAN_RECOVERY']):errors.append('PHASE_OUTSIDE_SLICE')
        if request['id'] in b['seen']:errors.append('LEGACY_REQUEST_ID_COLLISION')
        return dict(ok=not errors,errors=errors,common=common,payment=request.get('paymentMode'),
                    materialDebits=deepcopy(self.c['recovery']['materialPrice']) if request.get('paymentMode')=='PE' and not errors else None)
    def plan(self,request):
        with self._lock:
            before=serialized(self._root);result=self._plan(self._root,deepcopy(request),time.perf_counter()+3)
            assert serialized(self._root)==before
            return {**result,'gates':self.gates()}
    def submit(self,request):
        captured=deepcopy(request)
        with self._lock, _EXECUTION:
            return {**self._submit(captured),'gates':self.gates()}
    def _submit(self,request):
        began=time.perf_counter();deadline=began+3;r=self._root
        if not isinstance(request,dict) or not isinstance(request.get('id'),str):return dict(ok=False,error='INVALID_REQUEST_SCHEMA')
        id=request['id'];fingerprint=digest(request);prior=r['receipts'].get(id)
        if prior:
            if prior['fingerprint']!=fingerprint:return dict(ok=False,error='REQUEST_ID_CONFLICT')
            if prior['status']=='COMMITTED':return dict(ok=True,replayed=True,receipt=deepcopy(prior),current=self._binding(r))
        bound=dict(fingerprint=fingerprint,status='RETRYABLE',request=deepcopy(request))
        # Binding metadata may survive a failed attempt; domain state never changes.
        r={**r,'receipts':{**r['receipts'],id:bound}};self._root=r
        try:
            p=self._plan(r,request,deadline)
            if not p['ok']:return dict(ok=False,error='PLAN_BLOCKED',plan=p)
            self._fault_at('before_execute')
            live,bounded=runtime();ship_requested=bool(r['materials']['imports']) and all(l['status']=='SOURCE_AVAILABLE' for l in r['materials']['lots'].values())
            fault=None
            if self._test_mode:
                for stage in ['unknown_route','missing_audit','solver_failure','timeout']:
                    try:self._fault_at('inject_'+stage)
                    except Exception:fault=stage
            bounded.CONTEXT=dict(shipRequested=ship_requested,testFault=fault)
            os.environ['INDUSTRY007_PAYMENT_MODE']='PE' if request['paymentMode']=='PE' else 'RP'
            command=dict(id=id,revision=r['bundle']['revision'],action=request['action'])
            result=live.execute(r['bundle'],command,seconds=max(0,deadline-time.perf_counter()))
            if not result['ok']:return dict(ok=False,error='ENGINE_OR_BOUNDARY_REJECTED',detail=result['error'])
            assert not result.get('duplicate')
            n=deepcopy(r);n['bundle']=result['state'];n['bundleJSON']=serialized(result['state']);m=n['materials'];witness=result['boundary']
            if witness:
                assert r['epoch'] is None and not r['capacity']['used'],'EPOCH_ALREADY_COMMITTED'
                assert r['bundle']['core']['turn']==5 and r['bundle']['core']['phase']=='SOVIET_ENTRENCHMENT'
                assert n['bundle']['core']['turn']==6 and witness['epoch']=='L4' and n['bundle']['logistics']['epoch']=='L5'
                transfer_private(n,witness,self.c,request,self._fault_at)
            if request['paymentMode']=='PE':
                assert n['bundle']['core']['rp']==r['bundle']['core']['rp']
                assert n['bundle']['core']['random']==r['bundle']['core']['random']
                assert n['bundle']['core']['units']['G-I-01']['step']==r['bundle']['core']['units']['G-I-01']['step']-1
                def payment_sp(b):
                    s=b['logistics']
                    return dict(units=[{k:u[k] for k in ['id','stock','debt','B','cap']} for u in s['units']],
                        hubs=s['hubs'],sources=s['sources'],done=s['done'],T=s['T'],spent=s['action_spent'])
                assert payment_sp(n['bundle'])==payment_sp(r['bundle']),'MATERIAL_PAYMENT_CHANGED_SP'
                for lot in m['lots'].values():lot['spent']+=lot['quantity'];lot.update(quantity=0,status='SPENT')
                m['revision']+=1;m['scope']='CONSUMED'
                m['imports'][self.c['initialManifest']['id']]['retired']=True
                m['journal'].append(dict(event='T6_PE_SPENT',requestId=id,debits=self.c['recovery']['materialPrice']))
            core=n['bundle']['core']
            if (request['paymentMode']=='RP' and core['turn']==6) or core['phase']=='GAME_OVER' or (core['turn']==6 and core['phase']=='GERMAN_ENTRENCHMENT'):
                if m['scope']=='ACTIVE' and m['lots']:
                    for lot in m['lots'].values():
                        if lot['quantity']:lot['status']='QUARANTINED'
                    m['scope']='QUARANTINED';m['revision']+=1;m['journal'].append(dict(event='SCOPE_EXPIRED_QUARANTINE'))
            custody_audit(m)
            self._fault_at('after_execute');assert self._root is r
            receipt={**bound,'status':'COMMITTED'}
            receipt.update(before=self._binding(r),after=self._binding(n),command=command,
                boundaryHash=digest(witness) if witness else None,arrived=bool(witness and witness['ship']))
            n['receipts'][id]=receipt
            self._fault_at('before_commit')
            if time.perf_counter()>=deadline:raise TimeoutError('TOTAL_3_SECOND_BOUNDARY_BUDGET')
        except Exception as e:return dict(ok=False,error='PRECOMMIT_FAILURE',detail=str(e))
        self._root=n # Game, material, capacity, epoch and receipt publish together.
        elapsed=time.perf_counter()-began
        self._fault_at('after_commit_before_reply')
        return dict(ok=True,replayed=False,receipt=deepcopy(receipt),current=self._binding(n),seconds=elapsed,budgetSeconds=3)

def phase_action(store):
    b=store.snapshot()['bundle'];c=b['core'];p=c['pendingDecision']
    if p:
        # No invented decisions. Saved slice has no pending combat; unexpected choices stop.
        raise ValueError('EXPLICIT_LEGAL_PENDING_RESOLUTION_REQUIRED:'+serialized(p))
    controller=next(x['id'] for x in c['controllers'].values() if x['side']==c['activeSide'])
    return dict(type='END_PHASE',controllerId=controller)

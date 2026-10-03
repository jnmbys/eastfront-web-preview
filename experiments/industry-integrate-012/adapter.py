"""One serialized owner; original execute into private copy, then one root swap."""
import os,sys,json,time,threading,subprocess
from copy import deepcopy
from config import HERE,LIVE,start_json,serialized,sha,digest,load_launch,verify_runtime
import production
_EXECUTION=threading.RLock();_MAIN=False;_IDS=set();_VERIFIED=False
def runtime():
    global _VERIFIED
    if not _VERIFIED:verify_runtime();_VERIFIED=True
    os.environ['OPENBLAS_NUM_THREADS']='1'
    if str(LIVE) not in sys.path:sys.path.insert(0,str(LIVE))
    import live,bounded
    return live,bounded

def current_eligibility(bundle,epoch,launch,deadline):
    p=launch['parameters'];assert p['receiver']['allowNullControl'] is True
    if epoch not in p['receiver']['epochs']:return dict(eligible=False,issues=['SERVICE_WINDOW_EXPIRED'])
    result=subprocess.run(['node',str(HERE/'eligibility.mjs')],input=serialized(bundle['core']),text=True,encoding='utf8',capture_output=True,
        timeout=max(.001,deadline-time.perf_counter()))
    if result.returncode:raise ValueError('QUALIFICATION_QUERY_FAILED:'+result.stderr)
    proof=json.loads(result.stdout);proof['gameHash']=sha(serialized(bundle).encode());proof['epoch']=epoch
    return proof

class Transactions:
    def __init__(self,instance_id='012-main',*,config_file=HERE/'launch.json',test_mode=False,test_fault=None):
        global _MAIN
        with _EXECUTION:
            self.launch=load_launch(config_file)
            assert instance_id not in _IDS
            if test_mode:assert instance_id.startswith('012-test-')
            else:assert not _MAIN and instance_id==self.launch['approval']['instanceId'],'ONE_MAIN_INSTANCE_ONLY'
            assert test_fault is None or test_mode
            self._fault=test_fault;self._test=test_mode;self._lock=threading.RLock()
            _,bounded=runtime();bounded.warm_start()
            raw=start_json();self._root=dict(revision=0,bundle=json.loads(raw),bundleJSON=raw,industry=production.initial(instance_id,self.launch),receipts={})
            _IDS.add(instance_id)
            if not test_mode:_MAIN=True
    def snapshot(self):return deepcopy(self._root)
    def read_view(self):
        from view import export_view
        root=self._root
        return export_view(root,origin='SYNTHETIC_TEST' if self._test else 'REAL')
    def fault(self,stage):
        if self._fault:self._fault(stage)
    def binding(self,r):
        return dict(revision=r['revision'],gameRevision=r['bundle']['revision'],gameHash=sha(r['bundleJSON'].encode()),industryHash=digest(r['industry']),
            contractHash=self.launch['contractHash'],approvalHash=self.launch['approvalHash'])
    def request(self,id,action):
        with self._lock:return dict(id=id,action=deepcopy(action),**self.binding(self._root))
    def phase_request(self,id=None):
        b=self._root['bundle'];c=b['core'];assert c['pendingDecision'] is None,'EXPLICIT_PENDING_RESOLUTION_REQUIRED'
        controller=next(x['id'] for x in c['controllers'].values() if x['side']==c['activeSide'])
        return self.request(id or '012-phase-'+str(b['revision']),dict(type='END_PHASE',controllerId=controller))
    def submit(self,request):
        captured=deepcopy(request)
        with self._lock,_EXECUTION:return self._submit(captured)
    def _submit(self,q):
        began=time.perf_counter();deadline=began+3;r=self._root
        fields={'id','action',*self.binding(r)}
        if not isinstance(q,dict) or set(q)!=fields or not isinstance(q['id'],str) or not q['id'] or not isinstance(q['action'],dict):return dict(ok=False,error='INVALID_REQUEST_SCHEMA')
        fp=digest(q);prior=r['receipts'].get(q['id'])
        if prior:
            if prior['fingerprint']!=fp:return dict(ok=False,error='REQUEST_ID_CONFLICT')
            if prior['status']=='COMMITTED':return dict(ok=True,replayed=True,receipt=deepcopy(prior),current=self.binding(r))
        bound=dict(fingerprint=fp,status='RETRYABLE');r={**r,'receipts':{**r['receipts'],q['id']:bound}};self._root=r
        try:
            assert all(q[k]==v for k,v in self.binding(r).items()),'STALE_BINDING'
            n=deepcopy(r);i=n['industry'];a=q['action'];kind=a.get('type');b=r['bundle'];c=b['core']
            assert c['pendingDecision'] is None,'PENDING_REJECTED'
            assert (c['turn']<7 or (c['turn']==7 and c['phase']!='GERMAN_RECOVERY')),'SLICE_ENDED_T7_RECOVERY'
            self.fault('before_execute')
            boundaryEpoch=None
            if kind in ['ALLOCATE_I','PLACE_ORDER']:
                assert set(a)=={'type'},'FIXED_ORDER_ONLY_NO_CALLER_PRICE_OR_AUTHORITY'
                if kind=='ALLOCATE_I' and i['grants']:
                    # A new envelope referring to the permanent grant is also a
                    # successful receipt lookup: bind it for later stale retries.
                    receipt=dict(fingerprint=fp,status='COMMITTED',before=self.binding(r),after=self.binding(r),action=deepcopy(a),
                        permanentGrant=deepcopy(next(iter(i['grants'].values()))))
                    if time.perf_counter()>=deadline:raise TimeoutError('TOTAL_3_SECOND_BUDGET')
                    self._root={**r,'receipts':{**r['receipts'],q['id']:receipt}}
                    return dict(ok=True,replayed=True,receipt=deepcopy(receipt),current=self.binding(r))
                assert b['revision']==109 and c['turn']==5 and c['phase']=='GERMAN_RECOVERY','INITIAL_ORDER_WINDOW_EXPIRED'
                if kind=='ALLOCATE_I':production.grant(i,self.launch)
                else:production.accept(i,self.launch,sha(r['bundleJSON'].encode()))
                self.fault('after_payment')
            elif kind=='END_PHASE':
                assert set(a)=={'type','controllerId'},'ACTION_OUTSIDE_SLICE'
                live,_=runtime();command=dict(id=q['id'],revision=b['revision'],action=a)
                result=live.execute(b,command,seconds=max(0,deadline-time.perf_counter()))
                assert result['ok'],result.get('error')
                assert not result.get('duplicate'),'LEGACY_ID_COLLISION'
                n['bundle']=result['state'];n['bundleJSON']=serialized(result['state'])
                new=n['bundle']
                if new['core']['turn']!=c['turn']:
                    assert new['core']['turn']==c['turn']+1 and new['journal'][-1]['settled']
                    oldS=b['logistics'];newS=new['logistics']
                    assert newS['tick']==oldS['tick']+1 and set(newS['done'])-set(oldS['done'])=={oldS['epoch']}
                    assert {x['side'] for x in newS['done'][oldS['epoch']]}=={'G','S'}
                    boundaryEpoch=c['turn']
                    def qualify(bundle,epoch,stage):
                        proof=current_eligibility(bundle,epoch,self.launch,deadline)
                        if self._test:
                            try:self.fault('deny_'+stage)
                            except RuntimeError:proof={**proof,'eligible':False,'issues':['SYNTHETIC_RECEIVER_UNAVAILABLE']}
                        return proof
                    production.boundary(i,self.launch,boundaryEpoch,new,sha(r['bundleJSON'].encode()),qualify,self.fault)
            else:raise ValueError('ACTION_OUTSIDE_SLICE')
            production.audit(i,self.launch['parameters']);self.fault('after_execute')
            assert self._root is r
            n['revision']+=1
            receipt=dict(fingerprint=fp,status='COMMITTED',before=self.binding(r),after=self.binding(n),action=deepcopy(a),boundaryEpoch=boundaryEpoch)
            n['receipts'][q['id']]=receipt
            self.fault('before_commit')
            if time.perf_counter()>=deadline:raise TimeoutError('TOTAL_3_SECOND_BUDGET')
        except Exception as ex:return dict(ok=False,error='REJECTED_NO_DOMAIN_COMMIT',detail=str(ex))
        self._root=n
        seconds=time.perf_counter()-began;self.fault('after_commit_before_reply')
        return dict(ok=True,replayed=False,receipt=deepcopy(receipt),seconds=seconds)

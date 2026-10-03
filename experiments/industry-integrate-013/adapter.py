"""Single match owner and atomic root. Failures retain no new receipt bindings."""
import os,sys,json,time,threading,subprocess
from copy import deepcopy
from config import HERE,LIVE,serialized,sha,digest,start_root,load_launch,verify_runtime,START_SHA
import personnel
_EXECUTION=threading.RLock();_MATCH_OWNERS={};_VERIFIED=False
def runtime():
    global _VERIFIED
    if not _VERIFIED:verify_runtime();_VERIFIED=True
    os.environ['OPENBLAS_NUM_THREADS']='1'
    if str(LIVE) not in sys.path:sys.path.insert(0,str(LIVE))
    import live,bounded
    return live,bounded
def current_eligibility(bundle,epoch,stage,deadline):
    if (stage=='dispatch' and epoch not in [7,8]) or (stage=='receipt' and epoch not in [7,8,9]):return dict(eligible=False,issues=['OUTSIDE_SERVICE_WINDOW'])
    r=subprocess.run(['node',str(HERE/'eligibility.mjs')],input=serialized(bundle['core']),text=True,encoding='utf8',capture_output=True,timeout=max(.001,deadline-time.perf_counter()))
    if r.returncode:raise ValueError('QUALIFICATION_UNRESOLVED:'+r.stderr)
    proof=json.loads(r.stdout);proof.update(epoch=epoch,stage=stage,gameHash=sha(serialized(bundle).encode()))
    return proof

def next_action(bundle,deadline):
    r=subprocess.run(['node',str(HERE/'next-action.mjs')],input=serialized(bundle['core']),text=True,encoding='utf8',capture_output=True,
        timeout=max(.001,deadline-time.perf_counter()))
    if r.returncode:raise ValueError('LEGAL_CONTINUATION_UNRESOLVED:'+r.stderr)
    return json.loads(r.stdout)

class Transactions:
    def __init__(self,instance_id='013-main',*,test_mode=False,test_fault=None,config_file=HERE/'launch.json'):
        with _EXECUTION:
            self.launch=load_launch(config_file);base=start_root();match=self.launch['profile']['matchId']
            if test_mode:
                assert instance_id.startswith('013-test-');match='SYNTHETIC-NONMERGEABLE/'+instance_id
            assert match not in _MATCH_OWNERS,'MATCH_ALREADY_HAS_OWNER_NO_REIMPORT_BY_INSTANCE_RENAME'
            if not test_mode:assert instance_id==self.launch['profile']['instanceId']
            assert test_fault is None or test_mode
            _,bounded=runtime();bounded.warm_start()
            self._lock=threading.RLock();self._test=test_mode;self._fault=test_fault
            self._base=base;self._industryHash=digest(base['industry']);self._root=deepcopy(base)
            self._root['personnel']=personnel.initial(match,self.launch)
            self._root['grantRegistry']=deepcopy(base['industry']['grants'])
            self._root['warehouseRegistry']={personnel.REAR:dict(node='A10',coreKey='0,9',side='G',
                E2=dict(authority='industry.warehouse.resident',capacity=2),
                P=dict(authority='personnel.package owner/custody/quantityP',capacity=1,accountId='RC008-G-A10-P'),
                legacy012PField='FROZEN_HISTORICAL_ZERO_NOT_CURRENT_P_STOCK')}
            self._root['continuation']=dict(baseRootHash=START_SHA,originalMatchId=self.launch['profile']['matchId'],registryMatchId=match,
                equipment012GrantId=next(iter(base['industry']['grants'])),equipment012AccountRef='industry.budget',syntheticNonmergeable=test_mode)
            _MATCH_OWNERS[match]=self
    def snapshot(self):return deepcopy(self._root)
    def read_view(self):
        from view import export_view
        return export_view(self._root)
    def fault(self,stage):
        if self._fault:self._fault(stage)
    def binding(self,r):return dict(revision=r['revision'],gameHash=sha(r['bundleJSON'].encode()),personnelHash=digest(r['personnel']),
        fullRootHash=digest(r),contractHash=self.launch['contractHash'],approvalHash=self.launch['approvalHash'],matchId=r['personnel']['matchId'])
    def request(self,id,action):
        with self._lock:return dict(id=id,action=deepcopy(action),**self.binding(self._root))
    def phase_request(self,id=None):
        with self._lock:
            b=self._root['bundle'];c=b['core'];assert c['pendingDecision'] is None,'PENDING_REQUIRES_EXPLICIT_LEGAL_RESOLUTION'
            return self.request(id or '013-phase-'+str(b['revision']),next_action(b,time.perf_counter()+3))
    def submit(self,request):
        q=deepcopy(request)
        with self._lock,_EXECUTION:return self._submit(q)
    def _submit(self,q):
        began=time.perf_counter();deadline=began+3;r=self._root
        if not isinstance(q,dict) or set(q)!={'id','action',*self.binding(r)} or not isinstance(q['id'],str) or not q['id'] or not isinstance(q['action'],dict):return dict(ok=False,error='INVALID_REQUEST_SCHEMA')
        fp=digest(q);prior=r['receipts'].get(q['id'])
        if prior:
            if prior['fingerprint']!=fp:return dict(ok=False,error='REQUEST_ID_CONFLICT')
            return dict(ok=True,replayed=True,historicalOnly=True,receipt=deepcopy(prior))
        try:
            for k in ['contractHash','approvalHash','matchId']:assert q[k]==self.binding(r)[k],'AUTHORITY_BINDING_MISMATCH'
            a=q['action'];kind=a.get('type');p=r['personnel']
            if kind in ['ACTIVATE_PERSONNEL','APPLY_PERSONNEL']:
                assert set(a)=={'type'},'NO_REQUEST_AUTHORITY_PRICE_OR_PACKAGE_OVERRIDE'
                existing=p['importReceipt'] if kind=='ACTIVATE_PERSONNEL' else p['applicationReceipt']
                if existing:return dict(ok=True,replayed=True,historicalOnly=True,receipt=deepcopy(existing),currentCustody=personnel.counts(p))
            assert all(q[k]==v for k,v in self.binding(r).items()),'STALE_FULL_ROOT_BINDING'
            n=deepcopy(r);p=n['personnel'];b=r['bundle'];c=b['core'];epoch=None
            assert c['pendingDecision'] is None and c['phase']!='GAME_OVER','PENDING_OR_GAME_OVER'
            assert c['turn']<8 or (c['turn']==8 and c['phase'] in ['GERMAN_SUPPLY_RAIL','GERMAN_MOVEMENT','GERMAN_COMBAT']),'STOP_AT_T8_RECOVERY'
            self.fault('before_execute')
            if kind in ['ACTIVATE_PERSONNEL','APPLY_PERSONNEL']:
                assert b['revision']==129 and b['core']['turn']==7 and c['phase']=='GERMAN_RECOVERY','FIXED_T7_ACCEPTANCE_SCOPE'
                if kind=='ACTIVATE_PERSONNEL':personnel.activate(p,n['grantRegistry'],self.launch)
                else:personnel.accept(p,self.launch)
                self.fault('after_personnel_payment')
            elif kind in ['END_PHASE','DEPLOY_REINFORCEMENT']:
                if kind=='END_PHASE':assert set(a)=={'type','controllerId'},'ONLY_LEGAL_PHASE_COMMANDS'
                else:
                    # Only the required original scenario slot and deterministic legal entry.
                    # Re-query current Core; no caller-selected industrial formation.
                    assert a==next_action(b,deadline),'NOT_REQUIRED_CANONICAL_SCENARIO_REINFORCEMENT'
                live,_=runtime();cmd=dict(id=q['id'],revision=b['revision'],action=a)
                result=live.execute(b,cmd,seconds=max(0,deadline-time.perf_counter()))
                assert result['ok'],result.get('error');assert not result.get('duplicate')
                n['bundle']=result['state'];n['bundleJSON']=serialized(result['state']);new=n['bundle']
                if new['core']['turn']!=c['turn']:
                    assert new['core']['turn']==c['turn']+1 and new['journal'][-1]['settled']
                    oldS=b['logistics'];newS=new['logistics'];assert newS['tick']==oldS['tick']+1
                    assert set(newS['done'])-set(oldS['done'])=={oldS['epoch']}
                    assert {x['side'] for x in newS['done'][oldS['epoch']]}=={'G','S'}
                    epoch=c['turn']
                    # Frozen 012 equipment service cannot be concurrently invoked.
                    assert digest(n['industry'])==self._industryHash
                    assert n['industry']['batch']['custody']=='REAR_AVAILABLE' and not any(x['holds'] for x in n['industry']['external'].values())
                    def qualify(bundle,e,stage):
                        proof=current_eligibility(bundle,e,stage,deadline)
                        if self._test:
                            try:self.fault('deny_'+stage)
                            except RuntimeError:proof={**proof,'eligible':False,'issues':['SYNTHETIC_REFUSAL']}
                        return proof
                    personnel.boundary(p,epoch,new,qualify,self.fault)
                if new['core']['phase']=='GAME_OVER':personnel.housekeeping(p,new['core']['turn'],terminal=True)
            else:raise ValueError('NO_EQUIPMENT_GRANT_PRODUCTION_FORWARD_RECOVERY_OR_FORMATION')
            personnel.audit(p);assert digest(n['industry'])==self._industryHash
            for k,v in self._base['receipts'].items():assert n['receipts'][k]==v,'012_RECEIPT_CHANGED'
            for k,v in self._base['industry']['grants'].items():assert n['grantRegistry'][k]==v
            n['revision']+=1;self.fault('after_execute');assert self._root is r
            receipt=dict(fingerprint=fp,status='COMMITTED',request=deepcopy(q),beforeRevision=r['revision'],afterRevision=n['revision'],
                beforeGameHash=sha(r['bundleJSON'].encode()),afterGameHash=sha(n['bundleJSON'].encode()),boundaryEpoch=epoch,personnelAfter=digest(p))
            n['receipts'][q['id']]=receipt
            self.fault('before_commit')
            if time.perf_counter()>=deadline:raise TimeoutError('TOTAL_3_SECOND_BUDGET')
        except Exception as e:
            assert self._root is r
            return dict(ok=False,error='REJECTED_ALL_STATE_AND_RECEIPTS_UNCHANGED',detail=str(e))
        self._root=n;elapsed=time.perf_counter()-began;self.fault('after_commit_before_reply')
        return dict(ok=True,replayed=False,receipt=deepcopy(receipt),seconds=elapsed)

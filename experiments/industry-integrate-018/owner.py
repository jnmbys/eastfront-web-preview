"""One live chain; only delegates' computed private roots can be atomically published."""
import threading,time,json
from copy import copy,deepcopy
from loader import load,digest,sha,HERE
LOCK=threading.RLock();MAIN_CREATED=False
OPS={'ALLOCATE_I','PLACE_ORDER','ACTIVATE_PERSONNEL','APPLY_PERSONNEL','CARE','NEXT','RECOVER'}

class Transactions:
    def __init__(self):
        global MAIN_CREATED
        with LOCK:
            assert not MAIN_CREATED,'ONE_INSTANCE_PER_PROCESS_NO_RESET'
            self.mods=load();self.test_label=None;self._fault=None;self.bindings={};self.replies={}
            scope=(HERE/'LOCAL-SCOPE.json').read_bytes()
            assert sha(scope)=='125efcb9adccaef43af2411957775a9513051abc7596611b38344b7ecb7ba012','LOCAL_SCOPE_CHANGED'
            self.scope=json.loads(scope)
            assert self.scope['task']=='INDUSTRY-INTEGRATE-018' and self.scope['runtimeDefaultApproved'] is False
            # Prevalidate inherited authorities; reference roots are comparison evidence only.
            self.mods['016'].VERIFIED=self.mods['016'].load()
            actor=self.mods['012'].Transactions()
            self.contexts={'012':actor}
            self._head=dict(version=0,stage='012',root=actor.snapshot(),handoffs=[],transactions={})
            self.checkpoints={};MAIN_CREATED=True
    def snapshot(self):return deepcopy(self._head['root'])
    def head(self):return deepcopy(self._head)
    def view(self):
        from stage016.view import export_view
        return export_view(self._head['root'])
    @property
    def config(self):return self.contexts['016'].config
    def check_service(self,r):return self.actor(stage='016').check_service(r)
    def fault(self,stage):
        if self._fault:
            assert self.test_label,'FAULT_TEST_ONLY'
            self._fault(stage)
    def fork_test(self,label):
        assert label.startswith('SYNTHETIC-')
        child=copy(self);child._head=deepcopy(self._head);child.contexts=dict(self.contexts)
        child.bindings=deepcopy(self.bindings);child.replies=deepcopy(self.replies);child.checkpoints={};child.test_label=label;child._fault=None
        return child
    def actor(self,root=None,stage=None):
        stage=stage or self._head['stage'];root=root or self._head['root'];a=copy(self.contexts[stage]);a._root=deepcopy(root)
        if hasattr(a,'_lock'):a._lock=threading.RLock()
        if stage in ['012','013']:a._test=bool(self.test_label)
        else:a.test_label=self.test_label
        a._fault=(lambda s:self.fault('delegate:'+s) if s!='after_commit_before_reply' else None) if self._fault else None
        return a
    def inner(self,id,op):
        r=self._head['root'];stage=self._head['stage'];a=self.actor();b=r['bundle']
        if op=='NEXT':
            q=a.phase_request();q['id']=('012-phase-' if stage=='012' else '013-phase-' if stage=='013' else '018-phase-')+str(b['revision'])
            if stage=='016':q['id']='018-'+id
            return q
        action={'ALLOCATE_I':'ALLOCATE_I','PLACE_ORDER':'PLACE_ORDER','ACTIVATE_PERSONNEL':'ACTIVATE_PERSONNEL','APPLY_PERSONNEL':'APPLY_PERSONNEL','CARE':'PAY_CARE'}.get(op)
        action={'type':action} if action else dict(type='REPAIR_UNIT',controllerId='G-HUMAN-1',unitId='G-I-01')
        canonical={'ALLOCATE_I':'012-grant','PLACE_ORDER':'012-order','ACTIVATE_PERSONNEL':'013-import','APPLY_PERSONNEL':'013-apply'}.get(op,'018-'+id)
        return a.request(canonical,action)
    def request(self,id,op):
        with LOCK:
            assert op in OPS
            return dict(id=id,operation=op,version=self._head['version'],headHash=digest(self._head),stage=self._head['stage'],inner=self.inner(id,op))
    def _handoff(self,n,contexts,deadline):
        r=n['root'];c=r['bundle']['core'];old=n['stage']
        target='013' if old=='012' and (c['turn'],c['phase'])==(7,'GERMAN_RECOVERY') else '016' if old=='013' and (c['turn'],c['phase'])==(8,'GERMAN_RECOVERY') else None
        if not target:return None
        self.fault('before_handoff_'+target)
        expected=self.mods[target].START_SHA
        assert digest(r)==expected,'HANDOFF_FULL_ROOT_MISMATCH_'+target
        # These derived constructors accept only the just-computed root. No checkpoint assignment.
        actor=self.mods[target].Transactions(r)
        output=actor.snapshot()
        assert output['bundleJSON']==r['bundleJSON'] and output['industry']==r['industry'] and output['receipts']==r['receipts']
        contexts[target]=actor;n['root']=output;n['stage']=target
        n['handoffs'].append(dict(fromStage=old,toStage=target,inputRootHash=digest(r),expectedRootHash=expected,outputRootHash=digest(output),
            gameRevision=r['bundle']['revision'],retainedReceipts=len(r['receipts']),retainedEquipmentBudget=deepcopy(r['industry']['budget']),source='CURRENT_TRANSACTION_PRIVATE_ROOT'))
        self.fault('after_handoff_'+target);assert time.perf_counter()<deadline,'TOTAL_3_SECOND_BUDGET'
        return (target,deepcopy(r),deepcopy(output))
    def submit(self,request):
        with LOCK:
            q=deepcopy(request);old=self._head;began=time.perf_counter();deadline=began+3
            if not isinstance(q,dict) or set(q)!={'id','operation','version','headHash','stage','inner'}:return dict(ok=False,error='INVALID_REQUEST')
            if q['id'] in self.bindings:
                if self.bindings[q['id']]!=q:return dict(ok=False,error='REQUEST_ID_CONFLICT')
                return deepcopy(self.replies[q['id']])
            self.bindings[q['id']]=deepcopy(q)
            try:
                assert q['operation'] in OPS and q['version']==old['version'] and q['headHash']==digest(old) and q['stage']==old['stage'],'STALE_FULL_CHAIN_BINDING'
                allowed={'012':{'ALLOCATE_I','PLACE_ORDER','NEXT'},'013':{'ACTIVATE_PERSONNEL','APPLY_PERSONNEL','NEXT'},'016':{'CARE','NEXT','RECOVER'}}
                assert q['operation'] in allowed[old['stage']],'OUTSIDE_STAGE'
                action=q['inner']['action'];op=q['operation']
                if op=='NEXT':assert action.get('type') in ['END_PHASE','DEPLOY_REINFORCEMENT'],'NOT_A_PHASE_ACTION'
                elif op=='RECOVER':assert action==dict(type='REPAIR_UNIT',controllerId='G-HUMAN-1',unitId='G-I-01'),'WRONG_RECOVERY_TARGET'
                else:assert action=={'type':'PAY_CARE' if op=='CARE' else op},'INTENT_ACTION_MISMATCH'
                a=self.actor();a._outer_deadline=deadline
                result=a.submit(q['inner']);assert result['ok'],str(result)
                self.fault('after_delegate')
                n=deepcopy(old);n['root']=a.snapshot();contexts=dict(self.contexts)
                # A new outer request must execute a new transition; replay uses saved outer reply.
                assert n['root']['revision']==old['root']['revision']+1,'NO_REIMPORT_OR_DUPLICATE_DOMAIN_ACTION'
                bridge=self._handoff(n,contexts,deadline)
                n['version']+=1
                receipt=dict(status='COMMITTED',fingerprint=digest(q),operation=q['operation'],beforeVersion=old['version'],afterVersion=n['version'],
                    innerId=q['inner']['id'],stage=old['stage'],gameRevision=n['root']['bundle']['revision'],domainRootHash=digest(n['root']),handoff=bridge[0] if bridge else None)
                n['transactions'][q['id']]=receipt
                self.fault('before_commit');assert time.perf_counter()<deadline,'TOTAL_3_SECOND_BUDGET'
            except Exception as e:
                assert self._head is old
                reply=dict(ok=False,error='REJECTED_UNCHANGED',detail=str(e),version=old['version']);self.replies[q['id']]=reply;return deepcopy(reply)
            self._head=n;self.contexts=contexts
            if bridge:self.checkpoints['handoff'+bridge[0]]=dict(before=bridge[1],after=bridge[2])
            reply=dict(ok=True,receipt=receipt,seconds=time.perf_counter()-began,boundary=result.get('boundary'))
            self.replies[q['id']]=deepcopy(reply);self.fault('after_commit_before_reply');return deepcopy(reply)
    def close(self):self.mods['016'].runtime()[1].close_worker()

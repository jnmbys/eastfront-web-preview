"""Add closed production/personnel intents to the unchanged 017 HTTP envelope."""
import threading,queue,uuid,time,re
from copy import deepcopy
from types import SimpleNamespace
from owner import Transactions,OPS
from loader import load,digest
mods=load()
from compat017.bridge import Session as OldSession,ProtocolError,PHASES

class Session(OldSession):
    def __init__(self,*,test_owner=None):
        assert test_owner is None or test_owner.test_label
        self.tx=test_owner or Transactions();self.adapter=SimpleNamespace(query=mods['016'].query,digest=digest,runtime=mods['016'].runtime)
        self.instance_id=str(uuid.uuid4());self.lock=threading.RLock();self.records={};self.queue=queue.Queue();self.closed=False
        self.public=self._state();self.worker=threading.Thread(target=self._worker,name='industry018-single-owner',daemon=True);self.worker.start()
    def _state(self):
        before=digest(self.tx.head());r=self.tx.snapshot();stage=self.tx.head()['stage'];b=r['bundle'];c=b['core'];i=r['industry'];p=r.get('personnel');batch=i['batch'];package=p['package'] if p else None
        if stage=='016':v=super()._state()
        else:
            q=mods['016'].query(b,time.perf_counter()+3);common=q['common'];action=q['nextAction']
            mats={k:dict(owner=x['owner'] if x else None,custody=x['custody'] if x else 'NOT_CREATED',quantity=x[field] if x else 0,consumed=0) for k,x,field in [('P',package,'quantityP'),('E2:L',batch,'quantityE2')]}
            budget=p['account'] if p else dict(grantedI=0,availableI=0,acceptanceCareSpentI=0,escrowI=0,carriageSpentI=0)
            v=dict(schema='industry-017-state.v1',instanceId=self.instance_id,version=r['revision'],gameRevision=b['revision'],materialRevision=0,turn=c['turn'],phase=c['phase'],phaseLabel=PHASES.get(c['phase'],c['phase']),
                equipmentBudget=deepcopy(i['budget']),personnelBudget=deepcopy(budget),care=None,materials=mats,frontInventory={'P':0,'E2:L':0},availableFrontInventory={'P':0,'E2:L':0},
                rearInventory={k:m['quantity'] if m['owner']=='RC007-REAR-G-A10' else 0 for k,m in mats.items()},transport=None,shipment=None,terminal=None,recovery=None,expired=bool(package and 'QUARANTINED' in package['custody']),impact=None,
                target=dict(id='G-I-01',step=c['units']['G-I-01']['step'],RP=deepcopy(c['rp']),recoveryCount=common['context']['recoveryCount'],recoveryLimit=common['context']['recoveryLimit']),
                blockers=['AWAIT_PRODUCTION_AND_REAR_RECEIPT'] if stage=='012' else ['AWAIT_PERSONNEL_REAR_RECEIPT'],
                operations={'CARE':dict(enabled=False,label='T8支付1I照管'),'RECOVER':dict(enabled=False,label='T9恢复G-I-01'),
                    'NEXT':dict(enabled=action is not None,label=('执行原场景增援：'+action['reinforcementId']) if action and action['type']=='DEPLOY_REINFORCEMENT' else '结束当前'+PHASES.get(c['phase'],c['phase'])+'阶段')},
                restrictions=dict(singleProcess=True,persistent=False,globalBlockersRetained=35,globalBlockersClosed=0,sourceGapSP={'G':9,'S':14},formalRuntimeApproved=False))
        initial=(c['turn'],c['phase'],b['revision'])==(5,'GERMAN_RECOVERY',109)
        atT7=stage=='013' and (c['turn'],c['phase'],b['revision'])==(7,'GERMAN_RECOVERY',129)
        v['operations'].update(ALLOCATE_I=dict(enabled=stage=='012' and initial and not i['grants'],label='领取本实例一次性10I装备拨款'),
            PLACE_ORDER=dict(enabled=stage=='012' and initial and bool(i['grants']) and not i['order'],label='下单2 E2：付3I，托管2I'),
            ACTIVATE_PERSONNEL=dict(enabled=atT7 and not p['importReceipt'],label='启用原后备池1P及独立2I'),
            APPLY_PERSONNEL=dict(enabled=atT7 and bool(p['importReceipt']) and not p['application'],label='申请1P接驳：付1I，托管1I'))
        # NEXT is a phase action, not an implicit order or grant. Missing prerequisites can fail exact handoff.
        v['extensions']={'industry018':dict(schema='industry-018-chain.v1',stage=stage,matchId='EASTFRONT-012-ISOLATED',
            order=None if not i['order'] else {k:deepcopy(i['order'][k]) for k in ['id','batchId','status','acceptedTurn','workEpochs']},
            production=dict(workRequired=2,workCompleted=len(i['order']['workEpochs']) if i['order'] else 0,bufferHoldE2=i['productionHold']),
            equipmentBatch=deepcopy(batch),equipmentHandoffCapacity=deepcopy(i['external']),
            personnel=None if not p else dict(ids=deepcopy(p['ids']),sourceKind='SCENARIO_INITIAL_TRAINED_RESERVE_ASSUMPTION',trainingReceipt=None,
                activated=bool(p['importReceipt']),application=None if not p['application'] else dict(id=p['application']['id'],status=p['application']['status']),package=deepcopy(package),quota=deepcopy(p['quota']),incomingP=deepcopy(p['incomingP'])),
            handoffs=[{k:h[k] for k in ['fromStage','toStage','gameRevision','retainedReceipts','source']} for h in self.tx.head()['handoffs']],
            accountStatus=dict(equipment='ACTIVE' if i['grants'] else 'NOT_ALLOCATED',personnel='ACTIVE' if p and p['importReceipt'] else 'NOT_ACTIVATED'),
            baselineCompatibility='017 state and request envelope retained; additional fixed intents and this extension only; UI005 remains unchanged')}
        assert digest(self.tx.head())==before,'READ_MUTATED_CHAIN';return v
    def submit(self,body):
        if not isinstance(body,dict) or set(body)!={'requestId','instanceId','expectedVersion','operation'}:raise ProtocolError(400,'INVALID_FIELDS')
        id=body['requestId'];op=body['operation']
        if not isinstance(id,str) or not re.fullmatch(r'[A-Za-z0-9_-]{8,80}',id):raise ProtocolError(400,'INVALID_REQUEST_ID')
        if not isinstance(op,str) or op not in OPS or type(body['expectedVersion']) is not int:raise ProtocolError(400,'INVALID_INTENT_OR_VERSION')
        with self.lock:
            if self.closed:raise ProtocolError(503,'SESSION_CLOSING')
            if body['instanceId']!=self.instance_id:raise ProtocolError(409,'INSTANCE_CHANGED_DO_NOT_REPLAY')
            prior=self.records.get(id)
            if prior:
                if prior['body']!=body:raise ProtocolError(409,'REQUEST_ID_CONTENT_CONFLICT')
                return self._result(prior)
            rec=dict(**deepcopy(body),body=deepcopy(body),internal=None,status='PENDING',code=None,resultVersion=None,gameRevision=None);self.records[id]=rec
            try:
                if body['expectedVersion']!=self.tx.head()['version']:raise ProtocolError(409,'STALE_VERSION')
                if not self.public['operations'][op]['enabled']:raise ProtocolError(409,'OPERATION_NOT_AVAILABLE')
                rec['internal']=self.tx.request(id,op);rec['internalHash']=digest(rec['internal']);self.queue.put(id)
            except ProtocolError as e:rec.update(status='REJECTED',code=e.code)
            except Exception:rec.update(status='REJECTED',code='ADMISSION_UNRESOLVED')
            return self._result(rec)
    def _worker(self):
        while True:
            id=self.queue.get()
            if id is None:self.queue.task_done();return
            try:
                with self.lock:
                    rec=self.records[id];rec['status']='PROCESSING';bound=deepcopy(rec['internal']);assert digest(bound)==rec['internalHash']
                    try:result=self.tx.submit(bound)
                    except Exception:
                        prior=self.tx.head()['transactions'].get(id)
                        result=dict(ok=bool(prior and prior['fingerprint']==digest(bound)),error='TRANSACTION_UNRESOLVED')
                    rec['engineResult']=result;rec.update(status='COMMITTED' if result['ok'] else 'REJECTED',code='COMMITTED' if result['ok'] else 'CORE_OR_TRANSACTION_REJECTED')
                    rec.update(resultVersion=self.tx.head()['version'],gameRevision=self.tx.snapshot()['bundle']['revision'])
                    assert digest(rec['internal'])==rec['internalHash']
                    try:self.public=self._state()
                    except Exception:self.public={**self.public,'readError':'VIEW_UNRESOLVED_QUERY_RECEIPT'}
            finally:self.queue.task_done()
    def close(self):
        with self.lock:self.closed=True
        self.queue.join();self.queue.put(None);self.worker.join(timeout=5)
        # Test forks share the same stateless bounded solver; only the main owner closes it.
        if not self.tx.test_label:self.tx.close()

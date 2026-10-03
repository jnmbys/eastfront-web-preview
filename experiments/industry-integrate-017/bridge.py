"""Finite HTTP intents mapped to one unchanged 016 owner; immutable first-request bindings."""
from copy import deepcopy
import threading,queue,time,uuid,re
from paths import load_adapter,digest
OPS={'CARE','NEXT','RECOVER'}
PHASES={'GERMAN_RECOVERY':'德军恢复','GERMAN_ENTRENCHMENT':'德军构筑','SOVIET_REINFORCEMENT_SUPPLY':'苏军增援与补给','SOVIET_MOVEMENT':'苏军移动','SOVIET_COMBAT':'苏军战斗','SOVIET_RECOVERY':'苏军恢复','SOVIET_ENTRENCHMENT':'苏军构筑','GERMAN_SUPPLY_RAIL':'德军铁路补给','GERMAN_MOVEMENT':'德军移动','GERMAN_COMBAT':'德军战斗'}
class ProtocolError(Exception):
    def __init__(self,status,code):self.status=status;self.code=code;super().__init__(code)
class Session:
    def __init__(self,*,test_label=None):
        self.adapter=load_adapter();self.tx=self.adapter.Transactions(test_label=test_label)
        self.instance_id=str(uuid.uuid4());self.lock=threading.RLock();self.records={};self.queue=queue.Queue();self.closed=False
        self.public=self._state();self.worker=threading.Thread(target=self._worker,name='industry017-one-owner',daemon=True);self.worker.start()
    def _state(self):
        r=self.tx.snapshot();v=self.tx.view();b=r['bundle'];c=b['core'];f=r.get('forward',{})
        q=self.adapter.query(b,time.perf_counter()+3);common=q['common']
        ended=c['turn']>9 or f.get('recovery') is not None
        at_stop=(c['turn'],c['phase'])==(9,'GERMAN_RECOVERY')
        care=not ended and (c['turn'],c['phase'])==(8,'GERMAN_RECOVERY') and not f.get('care') and r['personnel']['package']['custody']=='REAR_AVAILABLE'
        next_ok=not ended and not at_stop and q['nextAction'] is not None
        recover=not ended and at_stop and common['commonEligible'] and bool(f.get('terminal')) and not f.get('closed')
        if recover:
            try:self.tx.check_service(r)
            except (AssertionError,KeyError):recover=False
        next_action=q['nextAction']
        if next_action is None:next_label='存在待决事项，当前切片不代作选择'
        elif next_action['type']=='DEPLOY_REINFORCEMENT':next_label='执行原场景必需增援：'+next_action['reinforcementId']
        else:next_label='结束当前'+PHASES.get(c['phase'],c['phase'])+'阶段'
        if c['turn']==8 and c['phase']=='SOVIET_ENTRENCHMENT':next_label+='；执行E8原结算'+('及固定前送，T9到账可用' if f.get('care') else '；未照管人员将在E8结束隔离')
        if at_stop:next_label='本轮已完成，停在T9恢复后。' if f.get('recovery') else '已到T9恢复阶段；请检查右侧恢复资格。'
        impact=None
        if f.get('shipment'):
            ledger=b['logistics']['done'].get('L7',[]);actual={u['id']:u for x in ledger for u in x['units']}
            impact=[]
            for row in self.tx.config['result']['unitComparison']:
                if row['deliveryDeltaQ'] or row['maintenanceDeltaQ'] or row['stockDeltaQ']:
                    a=actual[row['id']];ref=row['reference'];u=c['units'][row['id']]
                    impact.append(dict(unit=row['id'],referencePaidSP=ref['maintenance']/4,actualPaidSP=a['maintenance']/4,referenceStockSP=ref['after']/4,
                        actualStockSP=a['after']/4,referenceD=ref['debt'],actualD=a['debt'],actualLoss=a['loss'],CoreSupply=u.get('expSupply'),supplyState=u['supplyState']))
        material={}
        for key,m in v['materials'].items():
            material[key]=dict(owner=m['owner'],custody=m['custody'],quantity=m['quantityP'] if key=='P' else m['quantityE2'],consumed=m.get('consumedP016',0) if key=='P' else m.get('consumedE2016',0))
        return dict(schema='industry-017-state.v1',instanceId=self.instance_id,version=r['revision'],gameRevision=b['revision'],materialRevision=v['materialRevision'],
            turn=c['turn'],phase=c['phase'],phaseLabel=PHASES.get(c['phase'],c['phase']),equipmentBudget=v['equipmentBudget'],personnelBudget=v['personnelBudget'],
            care=None if not v['care'] else {k:v['care'][k] for k in ['receivedI','spentI','availableI','endEpoch','nonrefundable','status']},materials=material,
            frontInventory=v['frontInventory'],availableFrontInventory=v['availableFrontInventory'],rearInventory=v['rearInventory'],
            transport=v['transport'],shipment=None if not v['shipment'] else {k:v['shipment'][k] for k in ['status','dispatchEpoch','arrivalEpoch','availableFromTurn']},
            terminal=None if not v['terminal'] else {k:v['terminal'][k] for k in ['status','paidW','extraRecoveryW']},
            recovery=None if not v['recovery'] else {k:v['recovery'][k] for k in ['unitId','payment','beforeStep','afterStep','beforeGameRevision','afterGameRevision']},
            target=dict(id='G-I-01',step=c['units']['G-I-01']['step'],RP=c['rp'],recoveryCount=common['context']['recoveryCount'],recoveryLimit=common['context']['recoveryLimit']),
            expired=v['expired'],impact=impact,blockers=v['blockers'],
            operations={'CARE':dict(enabled=care,label='支付1I照管至E9结束'), 'NEXT':dict(enabled=next_ok,label=next_label), 'RECOVER':dict(enabled=recover,label='T9恢复G-I-01：支付1P＋2 E2，RP不扣')},
            restrictions=dict(singleProcess=True,persistent=False,globalBlockersRetained=35,globalBlockersClosed=0,sourceGapSP={'G':9,'S':14},formalRuntimeApproved=False))
    def state(self):
        with self.lock:
            if self.public.get('readError'):self.public=self._state()
            return deepcopy(self.public)
    def _result(self,rec):
        # No root, internal bindings, arbitrary Core command, approval, or full receipt.
        return deepcopy({k:rec[k] for k in ['requestId','instanceId','operation','expectedVersion','status','code','resultVersion','gameRevision']})
    def result(self,id):
        with self.lock:
            rec=self.records.get(id)
            if rec is None:raise ProtocolError(404,'REQUEST_NOT_REGISTERED')
            return self._result(rec)
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
            # Register every well-formed first request, including stale/disabled failures.
            # Rejected requests remain rejected; retry never re-quotes a later root.
            rec=dict(**deepcopy(body),body=deepcopy(body),internal=None,status='PENDING',code=None,resultVersion=None,gameRevision=None)
            self.records[id]=rec
            try:
                r=self.tx.snapshot()
                if body['expectedVersion']!=r['revision']:raise ProtocolError(409,'STALE_VERSION')
                if not self.public['operations'][op]['enabled']:raise ProtocolError(409,'OPERATION_NOT_AVAILABLE')
                if op=='CARE':action={'type':'PAY_CARE'}
                elif op=='RECOVER':action=dict(type='REPAIR_UNIT',controllerId='G-HUMAN-1',unitId='G-I-01')
                else:
                    action=self.adapter.query(r['bundle'],time.perf_counter()+3)['nextAction']
                    if action is None:raise ProtocolError(409,'PENDING_REQUIRES_DECISION')
                rec['internal']=self.tx.request('017-'+id,action)
                rec['internalHash']=digest(rec['internal'])
                self.queue.put(id)
            except ProtocolError as e:rec.update(status='REJECTED',code=e.code)
            except Exception:rec.update(status='REJECTED',code='ADMISSION_UNRESOLVED')
            return self._result(rec)
    def _worker(self):
        while True:
            id=self.queue.get()
            if id is None:self.queue.task_done();return
            try:
                with self.lock:
                    rec=self.records[id];rec['status']='PROCESSING';bound=deepcopy(rec['internal'])
                    assert digest(bound)==rec['internalHash']
                    try:result=self.tx.submit(bound)
                    except Exception:
                        # A local exception may happen after publication. Check the
                        # permanent 016 receipt; never create a replacement request.
                        prior=self.tx.snapshot()['receipts'].get(bound['id'])
                        if prior and prior['status']=='COMMITTED' and prior['fingerprint']==self.adapter.digest(bound):result=dict(ok=True)
                        else:result=dict(ok=False,error='TRANSACTION_UNRESOLVED')
                    rec['engineResult']=result # Private evidence only; never HTTP response.
                    if result['ok']:rec.update(status='COMMITTED',code='COMMITTED')
                    else:rec.update(status='REJECTED',code='CORE_OR_TRANSACTION_REJECTED')
                    current=self.tx.snapshot();rec.update(resultVersion=current['revision'],gameRevision=current['bundle']['revision'])
                    assert digest(rec['internal'])==rec['internalHash'],'IMMUTABLE_BINDING_CHANGED'
                    try:self.public=self._state()
                    except Exception:
                        # Receipt remains authoritative even if the ancillary view fails.
                        self.public={**self.public,'readError':'VIEW_UNRESOLVED_QUERY_RECEIPT'}
            finally:self.queue.task_done()
    def close(self):
        with self.lock:self.closed=True
        self.queue.join();self.queue.put(None);self.worker.join(timeout=5)
        self.adapter.runtime()[1].close_worker()

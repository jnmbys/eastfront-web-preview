"""Continuous owner: original T5 state, reducers and Core; no saved-root handoffs."""
import sys,time,os
from pathlib import Path
from copy import deepcopy
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'experiments/industry-integrate-018'))
from loader import load,digest
mods=load()
from stage012 import production
from stage013 import personnel
from stage016.adapter import initial_forward,serialized,material
from stage016.config import REAR,FRONT,PREFIX,CARGO
from stage016.audit import route_check

class Transactions:
 def __init__(self):
  self.base=mods['012'].Transactions();self.launch=self.base.launch
  self.personnel_launch=mods['013'].load_launch(mods['013'].HERE/'launch.json')
  self.config=mods['016'].load();r=self.base.snapshot()
  r.update(personnel=personnel.initial(self.personnel_launch['profile']['matchId'],self.personnel_launch),grantRegistry={},forward=initial_forward())
  self._head=dict(version=0,stage='CONTINUOUS',root=r,transactions={},handoffs=[])
  self.test_label=None;self.bindings={};self.replies={}
  self.service=object.__new__(mods['016'].Transactions);self.service.config=self.config;self.service.test_label=None;self.service._fault=None
 def head(self):return deepcopy(self._head)
 def snapshot(self):return deepcopy(self._head['root'])
 def close(self):mods['016'].runtime()[1].close_worker()
 def request(self,id,op):return dict(id=id,operation=op,version=self._head['version'])
 def check_service(self,r):
  f=r['forward'];p,e=material(r);t=f['terminal'];s=f['shipment']
  assert t and s and not f['closed'] and not f['recovery'],'NO_ACTIVE_UNUSED_TERMINAL'
  assert t['unitId']=='G-I-01' and t['key']=='2,8' and t['paidW']==8 and t['extraRecoveryW']==0
  assert t['inputHash']==s['inputHash'] and t['capacityWitnessHash']==s['capacityWitnessHash']
  assert s['status']=='RECEIVED' and p['owner']==e['owner']==FRONT and p['custody']==e['custody']=='FRONT_AVAILABLE'
  assert p['quantityP']==1 and e['quantityE2']==2
  assert {row['id']:row['freight'] for row in f['capacity']}==CARGO
  rec=r['receipts'][s['requestId']];assert rec['status']=='COMMITTED' and rec['fingerprint']==s['requestFingerprint']
  assert f['care']['status']=='PAID_ACTIVE' and f['care']['spentI']==1
 def freight_status(self,r,query):
  f=r['forward'];p,e=material(r)
  if not f['care'] or f['care']['status']!='PAID_ACTIVE':return '尚未照管；工业前送可跳过'
  if not p or not e or p['quantityP']!=1 or e['quantityE2']!=2 or p['owner']!=REAR or e['owner']!=REAR or p['custody']!='REAR_AVAILABLE' or e['custody']!='REAR_AVAILABLE':return '前送需要后方可用的1P与2E2'
  try:route_check(r['bundle'],query)
  except AssertionError as ex:return '运输或服务位置受阻：'+(str(ex) or '铁路状态不符')
  return None
 def settle_fixed_if_current(self,s,deadline):
  # Compare rule inputs, not Core command history or a historical checkpoint hash.
  reference=self.config['plan']['projection']['input']
  keys=['nodes','edges','sources','hubs','units','clock','variant','T','use_t','policy','order','tick','epoch','rotation','solver','allocator','reserve_setting','campaign_config']
  if any(s.get(k)!=reference.get(k) for k in keys):return None
  import model
  sys.path.insert(0,str(ROOT/'experiments/industry-integrate-018/.runtime/audit'))
  import reference009
  approved=self.config['result'];g=deepcopy(approved['candidate']);soviet=deepcopy(approved['sovietFrozen'])
  rows=reference009.audit_flows(s,g,CARGO)
  old=model.solve;olddeadline=model.DEADLINE
  try:
   model.DEADLINE=deadline
   model.solve=lambda current,side:deepcopy(g if side=='G' else soviet)
   out,results,retry=model.settle(s,s['epoch']);model.check_budget()
  finally:model.solve=old;model.DEADLINE=olddeadline
  return dict(ok=True,state=out,result=results,retry=retry,witness=dict(inputHash=digest(s),candidateHash=digest(g),capacity=rows))
 def audit(self,r):
  i=r['industry'];b=i['budget'];p=r['personnel'];f=r['forward'];pa,e=material(r)
  assert b['granted'] in [0,10] and b['granted']==sum(b[k] for k in ['freeI','productionSpent','handoffSpent','escrow'])+b.get('careTransferOutI',0)
  assert all(b[k]>=0 for k in ['freeI','productionSpent','handoffSpent','escrow'])
  a=p['account'];assert a['grantedI'] in [0,2] and a['grantedI']==sum(a[k]for k in ['availableI','acceptanceCareSpentI','escrowI','carriageSpentI'])
  assert sum(p['quota']['used'].values())+sum(p['quota']['holds'].values())<=4
  if pa:assert pa['quantityP']+pa.get('consumedP016',0)==1
  if e:assert e['quantityE2']+e.get('consumedE2016',0)==2 and i['warehouse']['resident']==(e['quantityE2']if e['owner']==REAR else 0)
  assert len(f['epochs'])==len(set(f['epochs']))
  for row in f['capacity'] or []:assert row['spUsed']+row['freight']+row['reservation']<=row['originalCap']
  assert serialized(r['bundle'])==r['bundleJSON']
  mods['016'].runtime()[0].audit(r['bundle']['logistics'])
 def submit(self,q,action=None,started=None):
  start=started or time.perf_counter();deadline=start+3;id=q['id'];old=self._head
  if id in self.bindings:
   return deepcopy(self.replies[id]) if self.bindings[id]==q else dict(ok=False,error='REQUEST_ID_CONFLICT')
  self.bindings[id]=deepcopy(q)
  try:
   assert q['version']==old['version'],'STALE_VERSION'
   n=deepcopy(old);r=n['root'];b=r['bundle'];c=b['core'];i=r['industry'];p=r['personnel'];f=r['forward'];op=q['operation']
   assert c['phase']!='GAME_OVER','GAME_OVER'
   assert op=='ACTION' or not c['pendingDecision'],'RESOLVE_PENDING_FIRST'
   if op in ['ALLOCATE_I','PLACE_ORDER']:
    assert (c['turn'],c['phase'])==(5,'GERMAN_RECOVERY'),'T5_ORDER_WINDOW_CLOSED'
    if op=='ALLOCATE_I':production.grant(i,self.launch);r['grantRegistry'].update(deepcopy(i['grants']))
    else:production.accept(i,self.launch,digest(b))
   elif op in ['ACTIVATE_PERSONNEL','APPLY_PERSONNEL']:
    assert (c['turn'],c['phase'])==(7,'GERMAN_RECOVERY'),'T7_PERSONNEL_WINDOW_CLOSED'
    if op=='ACTIVATE_PERSONNEL':personnel.activate(p,r['grantRegistry'],self.personnel_launch)
    else:personnel.accept(p,self.personnel_launch)
   elif op=='CARE':
    pa=p['package'];assert (c['turn'],c['phase'])==(8,'GERMAN_RECOVERY') and not f['care'] and pa and pa['owner']==REAR and pa['custody']=='REAR_AVAILABLE'
    assert i['budget']['freeI']>=1,'CARE_BUDGET'
    i['budget']['freeI']-=1;i['budget']['careTransferOutI']=1;i['revision']+=1
    f['care']=dict(id=PREFIX+'/care-extension-0001',accountId=PREFIX+'/CARE-I',transferId=PREFIX+'/budget-transfer-0001',packageId=pa['id'],receivedI=1,spentI=1,availableI=0,oldEndEpoch=8,endEpoch=9,nonrefundable=True,status='PAID_ACTIVE')
    f['events'].append(dict(event='T8_CARE_PAID',details=deepcopy(f['care'])))
   else:
    common=None
    if op in ['NEXT','RECOVER']:common=mods['016'].query(b,deadline)
    if op=='NEXT':action=common['nextAction'];assert action,'PENDING_REQUIRES_EXPLICIT_RESOLUTION'
    if op=='RECOVER':
     assert (c['turn'],c['phase'])==(9,'GERMAN_RECOVERY') and common['common']['commonEligible'],'CORE_COMMON_RECOVERY'
     route_check(b,common);self.check_service(r)
     action=dict(type='REPAIR_UNIT',controllerId='G-HUMAN-1',unitId='G-I-01')
    assert action and op in ['ACTION','NEXT','RECOVER']
    # Snapshot request binding protects receipt and service provenance; never compares to a saved root.
    bound=dict(id=id,action=deepcopy(action),rootHash=digest(r),materialRevision=f['materialRevision'])
    live,_=mods['016'].runtime();oldhook=live.logistics_transaction;oldmode=os.environ.get('INDUSTRY007_PAYMENT_MODE');captured={}
    freight=(c['turn'],c['phase'])==(8,'SOVIET_ENTRENCHMENT') and bool(f['care']) and not f['shipment']
    reason=None
    if freight:
     common=common or mods['016'].query(b,deadline);reason=self.freight_status(r,common)
    def settle(s,operation,seconds):
     nonlocal reason
     result=None
     if freight and not reason:
      result=self.settle_fixed_if_current(s,min(deadline,time.perf_counter()+seconds))
      if result is None:reason='当前运力或部队状态已偏离唯一获批维护取舍；未批准重新选择牺牲单位，取消本次前送'
     if result is None:result=oldhook(s,operation,max(0,deadline-time.perf_counter()))
     if result['ok']:captured.update(input=deepcopy(s),result=deepcopy(result))
     return result
    try:
     live.logistics_transaction=settle;os.environ['INDUSTRY007_PAYMENT_MODE']='PE' if op=='RECOVER' else 'RP'
     result=live.execute(b,dict(id='003-'+id,revision=b['revision'],action=action),seconds=max(0,deadline-time.perf_counter()))
     assert result['ok'],result.get('error');assert not result.get('duplicate')
    finally:
     live.logistics_transaction=oldhook
     if oldmode is None:os.environ.pop('INDUSTRY007_PAYMENT_MODE',None)
     else:os.environ['INDUSTRY007_PAYMENT_MODE']=oldmode
    r['bundle']=result['state'];r['bundleJSON']=serialized(result['state'])
    if captured:
     epoch=c['turn'];assert epoch not in f['epochs'];f['epochs'].append(epoch)
     assert r['bundle']['core']['turn']==epoch+1
     if epoch in [5,6]:production.boundary(i,self.launch,epoch,r['bundle'],digest(b),lambda bun,e,stage:mods['012'].current_eligibility(bun,e,self.launch,deadline),lambda _:None)
     if epoch>=7 and epoch<=9 and not f['care']:personnel.boundary(p,epoch,r['bundle'],lambda bun,e,stage:mods['013'].current_eligibility(bun,e,stage,deadline),lambda _:None)
     if freight:
      if reason:f['events'].append(dict(event='FORWARD_BLOCKED',epoch=epoch,reason=reason));f['blockedReason']=reason
      else:self.service.transfer(r,common,captured['result']['witness'],deadline,bound)
     f['events'].append(dict(event='SP_BOUNDARY',epoch=epoch,inputHash=digest(captured['input']),resultsHash=digest(captured['result']['result'])))
     if p['package']:self.service.close_scope(r,epoch)
    if op=='RECOVER':self.service.consume(r,old['root'],bound,common)
    if r['bundle']['core']['phase']=='GAME_OVER' and p['package']:self.service.close_scope(r,c['turn'],terminal=True)
    r['receipts'][id]=dict(status='COMMITTED',fingerprint=digest(bound),request=bound)
   r['revision']+=1;n['version']+=1;self.audit(r)
   receipt=dict(status='COMMITTED',fingerprint=digest(q),operation=op,beforeVersion=old['version'],afterVersion=n['version'],gameRevision=r['bundle']['revision'])
   n['transactions'][id]=receipt
   assert time.perf_counter()<deadline,'TOTAL_3_SECOND_BUDGET'
  except Exception as ex:
   reply=dict(ok=False,error='REJECTED_UNCHANGED',detail=str(ex),version=old['version'])
  else:self._head=n;reply=dict(ok=True,receipt=receipt,version=n['version'],seconds=time.perf_counter()-start)
  self.replies[id]=deepcopy(reply);return reply

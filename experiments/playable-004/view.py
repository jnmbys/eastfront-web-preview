from copy import deepcopy
import time
from continuous import mods,REAR,FRONT
from compat017.bridge import PHASES

def state(session):
 tx=session.tx;r=tx.snapshot();b=r['bundle'];c=b['core'];i=r['industry'];p=r['personnel'];f=r['forward'];batch=i['batch'];package=p['package']
 q=mods['016'].query(b,time.perf_counter()+3);common=q['common'];action=q['nextAction'];terminal=c['phase']=='GAME_OVER';window=(c['turn'],c['phase'])
 mats={k:dict(owner=x['owner']if x else None,custody=x['custody']if x else 'NOT_CREATED',quantity=x[field]if x else 0,consumed=x.get(consumed,0)if x else 0)for k,x,field,consumed in [('P',package,'quantityP','consumedP016'),('E2:L',batch,'quantityE2','consumedE2016')]}
 inv=lambda owner,available=False:{k:m['quantity']if m['owner']==owner and (not available or m['custody']=='FRONT_AVAILABLE')else 0 for k,m in mats.items()}
 recover=False;block=[]
 if f['recovery']:block.append('本次材料恢复已完成，不能重复消费')
 if c['units']['G-I-01']['hex']!={'q':2,'r':8}:block.append('G-I-01已离开C10：限定前送/材料恢复不可用；普通作战可继续')
 if window==(9,'GERMAN_RECOVERY') and not f['recovery']:
  try:
   assert common['commonEligible'],'恢复公共资格不足'
   tx.check_service(r)
   from stage016.audit import route_check
   route_check(b,q);recover=True
  except (AssertionError,KeyError,TypeError)as ex:block.append(str(ex)or'材料服务或铁路资格不足')
 if f.get('blockedReason'):block.append(f['blockedReason'])
 label='处理待决事项后继续'if action is None else ('部署可用苏军增援：'+action['reinforcementId']if action['type']=='DEPLOY_REINFORCEMENT'else '结束当前'+PHASES.get(c['phase'],c['phase'])+'阶段')
 ops=dict(ALLOCATE_I=dict(enabled=window==(5,'GERMAN_RECOVERY')and not i['grants'],label='T5：领取本实例一次性10I装备拨款'),PLACE_ORDER=dict(enabled=window==(5,'GERMAN_RECOVERY')and bool(i['grants'])and not i['order'],label='T5：下单2 E2（3I＋托管2I，可不下单）'),ACTIVATE_PERSONNEL=dict(enabled=window==(7,'GERMAN_RECOVERY')and not p['importReceipt'],label='T7：启用原后备池1P及独立2I'),APPLY_PERSONNEL=dict(enabled=window==(7,'GERMAN_RECOVERY')and bool(p['importReceipt'])and not p['application'],label='T7：申请1P接驳（1I＋托管1I）'),CARE=dict(enabled=window==(8,'GERMAN_RECOVERY')and not f['care']and bool(package and package['owner']==REAR and package['custody']=='REAR_AVAILABLE')and i['budget']['freeI']>=1,label='T8：支付1I照管至E9结束'),RECOVER=dict(enabled=recover,label='T9 C10：G-I-01材料恢复（1P＋2 E2，不扣RP）'),NEXT=dict(enabled=not terminal and action is not None,label='战役已自然终局'if terminal else (label+'（不运输工业材料）'if window==(8,'SOVIET_ENTRENCHMENT')else label)))
 if terminal or c['pendingDecision']:
  for v in ops.values():v['enabled']=False
 return dict(schema='industry-017-state.v1',instanceId=session.instance_id,version=tx.head()['version'],gameRevision=b['revision'],materialRevision=f['materialRevision'],turn=c['turn'],phase=c['phase'],phaseLabel=PHASES.get(c['phase'],c['phase']),equipmentBudget=deepcopy(i['budget']),personnelBudget=deepcopy(p['account']),care=deepcopy(f['care']),materials=mats,frontInventory=inv(FRONT),availableFrontInventory=inv(FRONT,True),rearInventory=inv(REAR),transport=deepcopy(f['capacity']),shipment=deepcopy(f['shipment']),terminal=deepcopy(f['terminal']),recovery=deepcopy(f['recovery']),expired=f['closed'] or bool(package and 'QUARANTINED'in package['custody']),impact=None,target=dict(id='G-I-01',step=c['units']['G-I-01']['step'],RP=c['rp'],recoveryCount=common['context']['recoveryCount'],recoveryLimit=common['context']['recoveryLimit']),blockers=block,operations=ops,restrictions=dict(singleProcess=True,persistent=False,globalBlockersRetained=35,globalBlockersClosed=0),extensions=dict(industry018=dict(stage='CONTINUOUS',order=deepcopy(i['order']),production=dict(workRequired=2,workCompleted=len(i['order']['workEpochs'])if i['order']else 0,bufferHoldE2=i['productionHold']),equipmentBatch=deepcopy(batch),personnel=dict(activated=bool(p['importReceipt']),application=deepcopy(p['application']),package=deepcopy(package)),handoffs=[])))

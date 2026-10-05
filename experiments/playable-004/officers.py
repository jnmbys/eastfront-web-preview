"""One serialized capability scheduler. Policy input is produced by FairHost only.
Stored in the match owner, survives browser refresh; never consumes combat RNG.
"""
import time,uuid
from copy import deepcopy
NAMES=['埃里克·林德','玛拉·沃斯','尤里·索科林']
class Officers:
 def __init__(self):
  self.enabled=False;self.revision=0;self.cursor=0;self.receipts={};self.history={};self.reports=[];self.battles={}
  self.groups=[dict(id=str(i),name=n,members=[],order=None,paused=True,rp=0,status='尚未授权')for i,n in enumerate(NAMES)]
 def public(self,view):
  if view['viewer']!='GERMAN':return None
  own={u['id']:u for u in view['units']if u['side']=='GERMAN'}
  groups=deepcopy(self.groups)
  for g in groups:
   g['members']=[id for id in g['members']if id in own]
   g['needs']=[dict(id=id,damage=own[id]['step'],supply=own[id]['supplyState'])for id in g['members']if own[id]['step']or own[id]['supplyState']!='SUPPLIED']
  return dict(enabled=self.enabled,revision=self.revision,groups=groups,reports=self.reports[-12:])
 def config(self,body,view):
  assert set(body)=={'revision','command'},'INVALID_FIELDS'
  assert body['revision']==self.revision,'OFFICER_ORDER_CHANGED'
  c=body['command'];op=c.get('type');own={u['id']for u in view['units']if u['side']=='GERMAN' and 'friendly'in u}
  if op=='ENABLE':
   assert type(c.get('enabled'))is bool;self.enabled=c['enabled']
   if not self.enabled:
    for g in self.groups:g['paused']=True;g['status']='军官模式已关闭，控制交还玩家'
  else:
   assert c.get('group')in ['0','1','2'];g=self.groups[int(c['group'])]
   if op=='ASSIGN':
    assert c.get('unit')in own;assert type(c.get('direct'))is bool
    previous={x['id']for x in self.groups if c['unit']in x['members']}
    self.battles={battle:owner for battle,owner in self.battles.items()if owner not in previous}
    for x in self.groups:x['members']=[id for id in x['members']if id!=c['unit']]
    if not c['direct']:g['members'].append(c['unit'])
   elif op=='ORDER':
    order=c.get('order');assert isinstance(order,dict)and set(order)=={'kind','target'}and order['kind']in ['ATTACK','DEFEND','REFIT']
    if order['kind']!='REFIT':assert order['target']in [h['coord']for h in view['hexes']],'INVALID_PUBLIC_TARGET'
    else:assert order['target']is None
    # Explicit issuance is the only activation; plain map marks are not orders.
    g['order']=deepcopy(order);g['paused']=False;g['status']='命令生效，等待所属阶段'
   elif op=='PAUSE':g['paused']=True;g['status']='已暂停，当前待决交还玩家'
   elif op=='RESUME':
    assert g['order'];g['paused']=False;g['status']='继续原命令'
   elif op=='CANCEL':g['order']=None;g['paused']=True;g['status']='命令取消，控制交还玩家'
   elif op=='RP':
    assert type(c.get('amount'))is int and 0<=c['amount']<=99
    assert sum(x['rp']for x in self.groups if x is not g)+c['amount']<=view['resources']['GERMAN']['rp'],'RP_ALREADY_RESERVED_OR_INSUFFICIENT'
    g['rp']=c['amount']
   else:raise AssertionError('UNKNOWN_OFFICER_COMMAND')
  self.revision+=1
  return dict(ok=True,revision=self.revision)
 def active(self):return[g for g in self.groups if self.enabled and g['order']and not g['paused']and g['members']]
 @staticmethod
 def units(a):
  if 'unitId'in a:return[a['unitId']]
  if 'attackerUnitIds'in a:return a['attackerUnitIds']
  if 'unitIdsByStep'in a:return a['unitIdsByStep']
  if 'retreats'in a:return[r['unitId']for r in a['retreats']]
  return[]
 def manual(self,a,view):
  p=view['pendingDecision']
  # A mixed/global pending decision is explicitly human, no stranded battle.
  affected=p.get('unitIds',p.get('eligibleUnitIds',[]))if p else[]
  if p:return not affected or not any(all(id in g['members']for id in affected)for g in self.active())
  return not any(id in g['members']for g in self.active()for id in self.units(a))
 def tick(self,game,body):
  assert set(body)=={'id','version','revision'},'INVALID_FIELDS'
  assert isinstance(body['id'],str)and 8<=len(body['id'])<=80
  if body['id']in self.receipts:
   original,reply=self.receipts[body['id']];assert original==body,'ID_CONFLICT';return deepcopy(reply)
  assert body['revision']==self.revision and body['version']==game.tx.head()['version'],'OFFICER_STALE_TICKET'
  start=time.perf_counter();old=game.tx.head();c=old['root']['bundle']['core'];owner=c['pendingDecision']['side']if c['pendingDecision']else c['activeSide']
  # This is the same owner lock used by enemy AI, player actions and industry.
  if owner!='GERMAN':
   pending=c['pendingDecision'];group=self.battles.get(pending['battleId'])if pending else None
   if group in [g['id']for g in self.active()]:
    reply=game.tick_ai();self.receipts[body['id']]=(deepcopy(body),deepcopy(reply));return reply
   return dict(ok=False,error='等待玩家或对手；军官未获当前行动权')
  if not self.active():return dict(ok=False,error='军官未授权')
  reply=dict(ok=False,error='军官当前无行动；直属、阶段推进和后勤仍由玩家处理')
  for offset in range(3):
   index=(self.cursor+offset)%3;g=self.groups[index]
   if g not in self.active():continue
   phase=f"{c['turn']}:{c['phase']}";history=self.history.get((g['id'],phase),[])
   decision=game.project(officer=dict(members=g['members'],order=g['order'],profile=index,rp=g['rp']),history=history)
   a=decision['intent'];g['status']=decision['reason']
   if not a:continue
   assert a['type']not in ['READY_FOR_PHASE_END','END_PHASE','END_SIDE']
   assert all(id in g['members']for id in self.units(a)),'CAPABILITY_ESCAPE'
   controller=next(x['id']for x in c['controllers'].values()if x['side']=='GERMAN')
   try:
    reply=game.apply_game_action(old,{**a,'controllerId':controller},'officer-'+body['id'],start)
    new=game.tx.head()['root']['bundle']['core'];spent=c['rp']['GERMAN']-new['rp']['GERMAN'];g['rp']=max(0,g['rp']-max(0,spent))
    if a['type']=='ATTACK' and new['pendingDecision']:self.battles[new['pendingDecision']['battleId']]=g['id']
    self.cursor=(index+1)%3
   except Exception as e:
    game.rejected+=1;game.last_private_error=str(e);reply=dict(ok=False,error='Core拒绝；已暂停该军官，请玩家接管。未从拒绝推断隐藏位置')
    g['paused']=True;g['status']=reply['error']
   self.history[(g['id'],phase)]=(history+[dict(observationKey=decision['observationKey'],intent=a,outcome='ACCEPTED'if reply['ok']else'REJECTED')])[-16:]
   self.reports.append(dict(officer=g['name'],turn=c['turn'],phase=c['phase'],action=deepcopy(a),accepted=reply['ok'],reason=g['status'],metrics=decision['metrics'],seconds=time.perf_counter()-start))
   break
  self.receipts[body['id']]=(deepcopy(body),deepcopy(reply));game.save_trace();return reply

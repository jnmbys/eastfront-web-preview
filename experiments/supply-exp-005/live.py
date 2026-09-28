import os
os.environ['OPENBLAS_NUM_THREADS']='1'
import json,time,subprocess
from pathlib import Path
from copy import deepcopy
from fractions import Fraction
from legalmap import FRAMES,scenario
from continuity import start,material
from bounded import transaction as logistics_transaction
from model import digest
ROOT=Path(__file__).parent
CLIPS={'prepare':('t4_GERMAN_before_move',4),'isolation':('t8_GERMAN_before_move',2),'restore':('t8_GERMAN_before_move',2)}
ARMOR={'PANZER','TANK','HEAVY_TANK','MOTORIZED'}
def effects(s,action=None):
 out={};ids=set(action.get('attackerUnitIds',[])) if action and action['type']=='ATTACK' else set()
 for u in s['units']:
  d=Fraction(u['debt']);factor=.5 if d>=2 else .75 if d>=1 else 1
  if u['id'] in ids:factor=min(factor,.5+.5*min(4,u['stock'])/4)
  out[u['id']]={'factor':factor,'cap':1 if d>=2 else None,'exhausted':d>=2}
 return out
def node(core,mode,s,op='frame',deadline=None,**extra):
 remaining=10 if deadline is None else deadline-time.perf_counter()
 if remaining<=0:raise TimeoutError('total deadline')
 p=subprocess.run(['node',str(ROOT/'core-bridge.mjs')],input=json.dumps(dict(state=core,mode=mode,effects=effects(s,extra.get('action')),op=op,**extra)),text=True,capture_output=True,timeout=remaining,cwd=ROOT)
 if p.returncode:raise RuntimeError(p.stderr)
 r=json.loads(p.stdout)
 if not r['ok']:raise ValueError(r['error'])
 return r
def sync(s,f):
 key='__live_adapter__';f=deepcopy(f);f['id']=key;FRAMES[key]=f
 try:fresh=scenario(frame=key,clock=s['clock'],variant=s['variant'],reserve=s['reserve_setting'],policy=s['policy'],use_t=s['use_t'],order=s['order'],delivery_range=s['hubs'][0]['range'])
 finally:del FRAMES[key]
 out=deepcopy(s);old={u['id']:u for u in s['units']};current={u['id']:u for u in fresh['units']};events=[];units=[]
 for uid,u in current.items():
  if uid in old:
   u=deepcopy(old[uid])
   for k in ['node','core_type','core_controller','core_step']:u[k]=current[uid][k]
   if u['node']!=old[uid]['node']:events.append(dict(type='moved',unit=uid,side=u['side'],stock=u['stock']))
  else:
   if uid in out['continuity']['retired']:raise ValueError('retired id reused')
   u.update(stock=0,cap=u['B']*s['reserve_setting'],target=u['B']*s['reserve_setting']);events.append(dict(type='reinforced_empty',unit=uid,side=u['side']))
  u['strength']=f['capacities'][uid];units.append(u)
 for uid,u in old.items():
  if uid not in current:
   out['continuity']['removed']+=u['stock'];out['continuity']['retired'].append(uid);events.append(dict(type='destroyed_sink',unit=uid,side=u['side'],lost=u['stock']))
 out['units']=units
 for k in ['nodes','edges','legal_view','core_phase','core_turn','core_state_hash','core_action_count','pending','game_over']:out[k]=fresh[k]
 previous={e['id']:e for e in s['edges']}
 for e in out['edges']:
  for k in ['cap','bridge_cap']:e[k]=previous[e['id']][k]
 if events:out['continuity']['events'].append({'events':events})
 return out
def audit(s):
 injected=sum(sum(r['source_used'].values()) for rs in s.get('done',{}).values() for r in rs);maintenance=sum(u['maintenance'] for rs in s.get('done',{}).values() for r in rs for u in r['units']);used=s.get('action_spent',0);lost=s['continuity']['removed'];initial=s['continuity']['initial']
 assert initial+injected==material(s)+maintenance+used+lost,(initial,injected,material(s),maintenance,used,lost)
 return dict(initial=initial,injected=injected,maintenance=maintenance,action=used,destroyed=lost,remaining=material(s))
def hash_bundle(b):return digest({k:v for k,v in b.items() if k not in ['journal','seen']})
def create(clip='prepare',mode='new'):
 fid,reserve=CLIPS[clip];s=start(fid,reserve=reserve,delivery_range=8);s.update(ruleset='SUPPLY-EXP-005-v1',action_spent=0,action_ledger=[]);
 if clip=='restore':
  hub=next(h for h in s['hubs'] if h['id']=='GH2');hub.update(node='D10',W=512)
  next(x for x in s['sources'] if x['id']=='G-A10')['cap']=128
  for e in s['edges']:
   if 'rail' in e['modes']:e['cap']=128
 f=FRAMES[fid];r=node(deepcopy(f['state']),mode,s);s=sync(s,r['frame'])
 return dict(core=r['frame']['state'],logistics=s,mode=mode,clip=clip,revision=0,seen={},journal=[])
def execute(original,command,seconds=3):
 began=time.perf_counter();deadline=began+seconds
 try:
  cid=command['id'];ph=digest({k:v for k,v in command.items() if k!='id'})
  if cid in original['seen']:
   if original['seen'][cid]!=ph:raise ValueError('request ID conflict')
   return dict(ok=True,state=original,duplicate=True,seconds=time.perf_counter()-began)
  if command['revision']!=original['revision']:raise ValueError('stale revision')
  b=deepcopy(original);s=b['logistics'];core=b['core'];a=deepcopy(command['action'])
  if core['turn']>15:raise ValueError('short experiment ends after T15')
  controller=next(x['id'] for x in core['controllers'].values() if x['side']==core['activeSide'])
  if a.get('controllerId')!=controller:raise ValueError('not active controller')
  fields={'MOVE':{'type','controllerId','unitId','path'},'ATTACK':{'type','controllerId','attackerUnitIds','target'},'END_PHASE':{'type','controllerId'},'END_SIDE':{'type','controllerId'},'RAIL_REPAIR':{'type','controllerId','edgeKeys'}}
  if a['type'] not in fields or set(a)-fields[a['type']]:raise ValueError('unsupported surface')
  r=node(core,b['mode'],s,'act',deadline,action=a);newcore=r['frame']['state'];charges=[]
  if b['mode']=='new':
   ids=a['attackerUnitIds'] if a['type']=='ATTACK' else [a['unitId']] if a['type']=='MOVE' and core['units'][a['unitId']]['type'] in ARMOR else []
   for uid in ids:
    u=next(u for u in s['units'] if u['id']==uid);paid=min(4,u['stock']);u['stock']-=paid;s['action_spent']+=paid;charges.append(dict(unit=uid,side=u['side'],cost=paid,type=a['type']))
   s['action_ledger'].extend(charges)
  s=sync(s,r['frame']);settled=False;supply_events=[]
  if b['mode']=='new' and newcore['turn']>core['turn']:
   result=logistics_transaction(s,'settle',deadline-time.perf_counter())
   if not result['ok']:raise TimeoutError('supply unresolved')
   s=result['state'];settled=True;losses={u['id']:u['loss'] for rs in s['ledger'] for u in rs['units'] if u['loss']}
   post=node(newcore,b['mode'],s,'attrition',deadline,losses=losses,epoch='L'+str(s['tick']-1));newcore=post['frame']['state'];supply_events=post['events'];s=sync(s,post['frame'])
  elif b['mode']=='new':
   post=node(newcore,b['mode'],s,'frame',deadline);newcore=post['frame']['state'];s=sync(s,post['frame'])
  b.update(core=newcore,logistics=s,revision=b['revision']+1);audit(s);b['seen'][cid]=ph
  b['journal'].append(dict(command=command,core_actions=r['actions'],events=r['events'],charges=charges,settled=settled,supply_events=supply_events,hash=hash_bundle(b)))
  if time.perf_counter()>deadline:raise TimeoutError('total deadline')
  return dict(ok=True,state=b,seconds=time.perf_counter()-began)
 except Exception as e:return dict(ok=False,state=original,error=str(e),seconds=time.perf_counter()-began)
def auto_command(b,kind='END_SIDE'):
 controller=next(x['id'] for x in b['core']['controllers'].values() if x['side']==b['core']['activeSide'])
 return dict(id='auto-'+str(b['revision']),revision=b['revision'],action=dict(type=kind,controllerId=controller))

"""EXP004 adapter: no new supply rule. Stable-ID inventory transfer, explicit sinks."""
from copy import deepcopy
from legalmap import scenario,FRAMES

def material(s):return sum(u['stock'] for u in s['units'])+sum(h['stock'] for h in s['hubs'])

def start(frame,**config):
 s=scenario(frame=frame,**config);s['ruleset']='SUPPLY-EXP-004-v1'
 s['reserve_setting']=config.get('reserve',4)
 s['continuity']={'initial':material(s),'removed':0,'events':[],'frames':[frame],'retired':[]}
 return s

def migrate(s,frame):
 if frame==s['scenario']:return deepcopy(s)
 if FRAMES[frame]['acceptedActions']<=s['core_action_count']:raise ValueError('只能沿同一重放向前；回退须明确开始新实验')
 fresh=scenario(frame=frame,clock=s['clock'],variant=s['variant'],reserve=4,policy=s['policy'],use_t=s['use_t'],order=s['order'],delivery_range=s['hubs'][0]['range'])
 out=deepcopy(s);journal=out['continuity'];old={u['id']:u for u in s['units']};current={u['id']:u for u in fresh['units']};units=[];events=[]
 for uid,u in current.items():
  if uid in journal['retired']:raise ValueError('已注销身份不得复活')
  if uid in old:
   prev=old[uid];u=deepcopy(prev)
   for field in ['node','core_type','core_controller','core_step']:u[field]=current[uid][field]
   if u['node']!=prev['node']:events.append({'type':'moved','unit':uid,'side':u['side'],'from':prev['node'],'to':u['node'],'stock':u['stock']})
   if u['core_step']!=prev['core_step']:events.append({'type':'core_step_changed','unit':uid,'side':u['side'],'from':prev['core_step'],'to':u['core_step'],'stock':u['stock']})
   # Core strength and shadow attrition are separate: carry shadow strength, never resurrect.
  else:
   # Reinforcements bring no free EXP supply. Capacity uses original reserve setting.
   reserve=s['reserve_setting']
   u.update(stock=0,cap=u['B']*reserve,target=u['B']*reserve)
   events.append({'type':'reinforced_empty','unit':uid,'side':u['side'],'stock':0})
  units.append(u)
 for uid,u in old.items():
  if uid not in current:
   journal['removed']+=u['stock'];journal['retired'].append(uid)
   events.append({'type':'core_destroyed_inventory_sink','unit':uid,'side':u['side'],'lost':u['stock']})
 out['units']=units
 for field in ['nodes','edges','legal_view','core_phase','core_turn','core_state_hash','core_action_count','pending','game_over','scenario','name']:out[field]=fresh[field]
 # Fixed experimental hub identities/locations and their stock survive disconnection.
 # Core has no hub ownership; do not invent capture or loot from control:null.
 old_edges={e['id']:e for e in s['edges']}
 for e in out['edges']:
  for field in ['cap','bridge_cap']:
   if field in old_edges[e['id']]:e[field]=old_edges[e['id']][field]
 out['ledger']=[];journal['frames'].append(frame);journal['events'].append({'frame':frame,'events':events})
 assert material(s)==material(out)+sum(e.get('lost',0) for e in events)
 return out

def audit(s):
 j=s['continuity'];produced=paid=0
 for results in s.get('done',{}).values():
  for r in results:
   produced+=sum(r['source_used'].values());paid+=sum(u['maintenance'] for u in r['units'])
 actions=sum(a['cost'] for a in s.get('last_action',[])) # UI does not execute shadow attack in EXP004.
 expected=j['initial']+produced-paid-j['removed']
 assert expected==material(s),(expected,material(s))
 return dict(initial=j['initial'],injected=produced,maintenance=paid,destroyed=j['removed'],remaining=material(s),epochs=len(s.get('done',{})))

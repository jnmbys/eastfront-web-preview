"""Read-only Core state adapter. Only logistics parameters are experimental."""
import json
from pathlib import Path
from realmap import scenario as experimental,MAP
from collections.abc import MutableMapping
DATA=json.loads((Path(__file__).parent/'data/frame-index.json').read_text())
class FrameStore(MutableMapping):
 def __init__(self):self.ids=list(DATA['ids']);self.extra={}
 def __getitem__(self,k):
  if k in self.extra:return self.extra[k]
  if k not in self.ids:raise KeyError(k)
  return json.loads((Path(__file__).parent/'data/frames'/str(k+'.json')).read_text())
 def __setitem__(self,k,v):self.extra[k]=v
 def __delitem__(self,k):del self.extra[k]
 def __iter__(self):return iter(dict.fromkeys(self.ids+list(self.extra)))
 def __len__(self):return len(set(self.ids)|set(self.extra))
FRAMES=FrameStore()
SIDES={'GERMAN':'G','SOVIET':'S'}
KEYS={str(n['coord']['q'])+','+str(n['coord']['r']):n['id'] for n in MAP['nodes']}
def key(c):return str(c['q'])+','+str(c['r'])
def scenario(frame='repaired',clock='full',variant='A',reserve=4,policy='last',use_t=True,order='GS',delivery_range=6,**ignored):
 f=FRAMES[frame];core=f['state'];s=experimental(clock=clock,variant=variant,reserve=reserve,policy=policy,use_t=use_t,order=order,delivery_range=delivery_range)
 s.update(ruleset='SUPPLY-EXP-003-v1',legal_state=True,solver='signature',scenario=frame,name=frame,core_phase=core['phase'],core_turn=core['turn'],core_state_hash=f['stateHash'],source_commit=DATA['commit'],core_action_count=f['acceptedActions'],control_overlay='NONE; Core control values retained',core_control='Core runtime null retained; no territory ownership inferred',pending=bool(core['pendingDecision']),game_over=core['phase']=='GAME_OVER',sources=[],hubs=[],units=[],hidden={},legal_view=f['views'],losses=[])
 ns={n['id']:n for n in s['nodes']}
 for ck,h in core['hexes'].items():
  n=ns[KEYS[ck]];n.update(control=SIDES.get(h['control']),core_control=h['control'],occupants=[],zoc_by=[],known=False)
 for cs in ['GERMAN','SOVIET']:
  for ck in f['derived']['zoc'+SIDES[cs]]:ns[KEYS[ck]]['zoc_by'].append(SIDES[cs])
 for u in core['units'].values():
  if not u['alive']:continue
  ns[KEYS[key(u['hex'])]]['occupants'].append(SIDES[u['side']])
  B=8 if u['type'] in ['PANZER','TANK','HEAVY_TANK','MOTORIZED'] else 4
  s['units'].append(dict(id=u['id'],node=KEYS[key(u['hex'])],side=SIDES[u['side']],B=B,stock=B*(reserve-1),cap=B*reserve,target=B*reserve,debt='0',strength=max(1,3-u['step']),priority=1,MP=4,core_type=u['type'],core_controller=u['controllerId'],core_step=u['step']))
 edgeOriginal={e['id']:e for e in MAP['edges']}
 for e in s['edges']:
  base=edgeOriginal[e['id']]['core'];actual=core['edges'].get(base['key']) if base else None
  e.update(cut=False,bridge=actual['bridge'] if actual else None,core_railway=actual['railway'] if actual else None,rail_repair_overlay=None)
  e['cap']=40;e['bridge_cap']=24 if e['bridge'] else None
 for side,entries,hubs in [('G',['A5','A10','A16'],['A5','C10','A16']),('S',['AF4','AF10','AF16','AC10','AC11'],['AC10','AC11','AF10'])]:
  caps=[32,32,32] if side=='G' else [24,24,16,16,16]
  for node,cap in zip(entries,caps):s['sources'].append(dict(id=side+'-'+node,node=node,side=side,cap=cap))
  for i,node in enumerate(hubs):s['hubs'].append(dict(id=side+'H'+str(i+1),node=node,side=side,stock=8 if variant=='A' else 0,cap=32,W=96,quota=40,range=int(delivery_range),floor=4,inactive=False))
  if variant=='B':
   remain=24
   for u in s['units']:
    if u['side']!=side:continue
    q=min(remain,u['cap']-u['stock']);u['stock']+=q;remain-=q
    if not remain:break
   assert remain==0
 return s

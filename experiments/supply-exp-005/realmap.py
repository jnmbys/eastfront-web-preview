"""Real geometry; explicitly synthetic logistics/control overlay, never a live game."""
from pathlib import Path
import json
from scenarios import scenario as small
MAP=json.loads((Path(__file__).parent/'data/core-map.json').read_text())
def scenario(key='concentration',clock='full',variant='A',reserve=4,policy='last',use_t=True,order='GS',map_mode='real',delivery_range=4,allocator='progressive',unit_count=12):
 if map_mode=='small':
  s=small(key,clock,variant,reserve,policy,use_t,order);s['solver']='exp001';return s
 s=small(key,clock,variant,reserve,policy,use_t,order)
 s.update(ruleset='supply-exp-002-v1-'+variant,real_map=True,solver='signature',allocator=allocator,control_overlay='explicit laboratory: all traversable hexes G; not live control',core_control='all null at import',name='真实地形 / 实验控制与物流 · '+s['name'],hidden={},units=[],hubs=[],edges=[],sources=[],repairs=[])
 s['nodes']=[dict(id=n['id'],x=n['x'],y=n['y'],terrain=n['terrain'],core_control=n['control'],control='G',known=True,guard=False) for n in MAP['nodes']]
 for e in MAP['edges']:
  c=e['core'] or {};ab=e['infantry_ab']['total'];ba=e['infantry_ba']['total'];modes=(['road'] if ab is not None and ba is not None else [])+(['rail'] if c.get('railway') else [])
  if not modes:continue
  s['edges'].append(dict(id=e['id'],a=e['a'],b=e['b'],modes=modes,cost=1,cost_ab=ab,cost_ba=ba,rail_cost=1,cap=40,bridge_cap=24 if c.get('bridge') else None,cut=False,physical_road=bool(c.get('road')),river=c.get('river'),bridge=c.get('bridge'),core_railway=c.get('railway'),rail_repair_overlay='G repaired for laboratory' if c.get('railway') else None))
 # Deliberate fixed research fixture. Hubs on actual railway vertices, chosen by column.
 railnodes={e[k] for e in s['edges'] if 'rail' in e['modes'] for k in ('a','b')};ns={n['id']:n for n in s['nodes']}
 def near(x,y):return min(railnodes,key=lambda k:((ns[k]['x']-x)**2+(ns[k]['y']-y)**2,k))
 source=near(0,9);hubnodes=[near(8,5),near(16,10),near(25,15)]
 s['sources']=[dict(id='rear',node=source,side='G',cap=96)]
 s['T']=2200
 s['hubs']=[dict(id='H'+str(i+1),node=n,side='G',stock=8 if variant=='A' else 0,cap=32,W=96,quota=40,range=int(delivery_range),floor=4,inactive=False) for i,n in enumerate(hubnodes)]
 available=sorted([n for n in s['nodes'] if n['terrain']!='LAKE'],key=lambda n:(n['x'],n['y']))
 if unit_count==58:positions=[available[i*len(available)//58]['id'] for i in range(58)]
 else:
  positions=[]
  for h in s['hubs']:
   hn=ns[h['node']];local=sorted(available,key=lambda n:((n['x']-hn['x'])**2+(n['y']-hn['y'])**2,n['id']))
   positions += [n['id'] for n in local[:max(1,unit_count//3)]]
 for i,n in enumerate(positions):
  B=8 if i%3==0 else 4;stock=(reserve-1)*B if key in ('breakthrough','pocket') else 0
  s['units'].append(dict(id='G'+str(i+1),node=n,side='G',B=B,stock=stock,cap=B*reserve,target=B*reserve,debt='0',strength=3,priority=1,MP=4))
 # Equal initial material A/B, but B carries hub's initial inventory on its local unit.
 if variant=='B':
  for i in range(3):
   remaining=8
   for u in s['units'][i*max(1,unit_count//3):]+s['units'][:i*max(1,unit_count//3)]:
    take=min(remaining,u['cap']-u['stock']);u['stock']+=take;remaining-=take
    if not remaining:break
   assert remaining==0
 for u in s['units']:u['stock']=min(u['stock'],u['cap'])
 if key=='breakthrough':
  s['units'][0]['node']=near(31,1)
 if key=='cut_repair':
  for e in s['edges']:
   if source in (e['a'],e['b']) and 'rail' in e['modes']:e['cut']=True
 if key=='hub_backup':
  s['hubs'][0].update(inactive=True,stock=0);s['losses']=[dict(hub='H1',lost=8 if variant=='A' else 0)]
  # B cannot lose nonexistent warehouse cargo; report this structural difference.
 if key=='pocket':
  n=s['units'][0]['node']
  for e in s['edges']:
   if n in (e['a'],e['b']):e['cut']=True
 return s

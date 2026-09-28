"""Exact integer edge flow + cost-layered last-mile graph; no candidate path cutoff.
Positive movement costs; cycles only waste capacity/work, so removable without loss.
All sources fungible within a side. No source-specific cargo or routing restrictions.
"""
import time
from collections import defaultdict,deque
from model import Program,budget,adjacency,maintenance_stages,usable

def solve_network(s,side='G'):
 began=time.perf_counter();p=Program();groups={};units=sorted([u for u in s['units'] if u['side']==side and u.get('strength',3)>0],key=lambda u:u['id']);hubs=sorted([h for h in s['hubs'] if h['side']==side and not h.get('inactive')],key=lambda h:h['id']);sources=[a for a in s['sources'] if a['side']==side];edges={e['id']:e for e in s['edges']};big=sum(max(0,u['target']-u['stock']) for u in units)+sum(h['cap'] for h in hubs)+1
 def row(a,hi,label):p.row(a,hi=hi,label=label);groups[label]=(a,hi)
 def add(d,i,v):d[i]=d.get(i,0)+v
 rail=adjacency(s,'rail',side);road=adjacency(s,'road',side);rb=defaultdict(dict);railuse=defaultdict(dict);bridgeuse=defaultdict(dict);work={};arcs=[];injections={};draw={};local=defaultdict(dict)
 for a in sources:
  i=p.var('source:'+a['id'],budget(a['cap'],s) if usable(s,a['node'],side) else 0);injections[a['id']]=i;add(rb['@source:'+a['node']],i,1);row({i:1},budget(a['cap'],s),'source:'+a['id'])
 for n in rail:
  for other,e in rail[n]:
   i=p.var('rail:'+n+'>'+other,budget(e['cap'],s));add(rb[n],i,-1);add(rb[other],i,1);railuse[e['id']][i]=1;work[i]=e.get('rail_cost',1);arcs.append(dict(i=i,kind='rail',edges=[e['id']],source=n,hub=other,cost=e.get('rail_cost',1)))
 for n in sorted({a['node'] for a in sources}):
  for other,e in rail[n]:
   i=p.var('depart:'+n+'>'+other,budget(e['cap'],s));add(rb['@source:'+n],i,-1);add(rb[other],i,1);railuse[e['id']][i]=1;work[i]=e.get('rail_cost',1);arcs.append(dict(i=i,kind='rail',edges=[e['id']],source=n,hub=other,cost=e.get('rail_cost',1)))
 for h in hubs:
  i=p.var('unload:'+h['id'],big);draw[h['id']]=i;add(rb[h['node']],i,-1)
 for a in sources:
  extra={}
  for h in hubs:
   if a['node']==h['node'] and usable(s,a['node'],side):
    i=p.var('localrail:'+a['id']+':'+h['id'],budget(a['cap'],s));local[h['id']][i]=1;extra[i]=1;work[i]=1
    arcs.append(dict(i=i,kind='rail',edges=[],source=a['id'],hub=h['id'],cost=1))
  injections[a['id']]={injections[a['id']]:1,**extra};row(injections[a['id']],budget(a['cap'],s),'source:'+a['id'])
 for n,a in rb.items():p.row(a,0,0,'rail balance:'+n)
 for eid,a in railuse.items():row(a,budget(edges[eid]['cap'],s),'rail:'+eid)
 if s['use_t']:row(dict(work),budget(s['T'],s),'T')
 delivery={u['id']:{} for u in units};hub_end={};floors={};lastwork={};allout={}
 from route_signatures import signatures
 for h in hubs:
  labels=signatures(s,h,side,road);wh={};outgoing={}
  for u in units:
   if not usable(s,h['node'],side) or not usable(s,u['node'],side):continue
   for mask,(cost,es) in sorted(labels[u['node']].items()):
    cost=max(1,cost)
    i=p.var('route:'+h['id']+':'+u['id']+':'+str(mask),max(0,u['target']-u['stock']))
    delivery[u['id']][i]=1;outgoing[i]=1;lastwork[i]=cost;wh[i]=cost if s['variant']=='A' else 1
    for eid in es:
     if edges[eid].get('bridge_cap') is not None:bridgeuse[eid][i]=1
    arcs.append(dict(i=i,kind='last',edges=list(es),hub=h['id'],unit=u['id'],cost=cost,delivery=True))
  balance={draw[h['id']]:1,**local[h['id']],**{i:-1 for i in outgoing}};hub_end[h['id']]=balance
  stock=h['stock'] if s['variant']=='A' else 0;cap=h['cap'] if s['variant']=='A' else 0
  p.row(balance,-stock,cap-stock,'hub:'+h['id']);row(wh,budget(h['W'] if s['variant']=='A' else h['quota'],s),'W:'+h['id'])
  f=p.var('floor:'+h['id'],h.get('floor',0) if s['variant']=='A' else 0);floors[f]=1;p.row({f:1,**{i:-v for i,v in balance.items()}},hi=stock)
 for eid,a in bridgeuse.items():row(a,budget(edges[eid]['bridge_cap'],s),'bridge:'+eid)
 ys={};lam=p.var('maintenance_min_ratio',1,False)
 for u in units:
  d=delivery[u['id']];row(d,max(0,min(u['cap'],u['target'])-u['stock']),'unit:'+u['id']);b=budget(u['B'],s);y=p.var('maintenance:'+u['id'],b);ys[u['id']]=y;p.lo[y]=min(b,u['stock']);p.hi[y]=min(b,u['stock']) if not d else b;p.row({y:1,**{i:-v for i,v in d.items()}},hi=u['stock']);p.row({lam:b,y:-1},hi=0)
 x=None;objectives=[]
 def stage(name,obj,maximize=True,offset=0):
  nonlocal x
  p.stage_name=name
  if all(p.lo[i]==p.hi[i] for i in obj):
   val=sum(p.lo[i]*v for i,v in obj.items());objectives.append([name,val+offset]);PROFILE.append(dict(stage=name,solver_ms=0,matrix_ms=0,verify_ms=0,skipped_constant=True));return
  try:x,val=p.solve(obj,maximize,True)
  except Exception as e:raise type(e)(name+': '+str(e)) from e
  objectives.append([name,round(val+offset,8)])
 from model import PROFILE
 PROFILE.append(dict(stage='model',ms=(time.perf_counter()-began)*1000))
 if s.get('allocator')!='progressive':maintenance_stages(s,p,units,ys,lam,stage)
 else:
  from fractions import Fraction
  thresholds=sorted({Fraction(k,budget(u['B'],s)) for u in units for k in range(1,budget(u['B'],s)+1)})
  for t in thresholds:
   zs={};constant=0
   for u in units:
    b=budget(u['B'],s)
    if not b:continue
    k=(t.numerator*b+t.denominator-1)//t.denominator;y=ys[u['id']]
    if p.lo[y]>=k:constant+=1;continue
    if p.hi[y]<k:continue
    z=p.var('ratio:'+u['id']+':'+str(t),1);zs[z]=1;p.row({y:1,z:-k},lo=0);p.row({y:1,z:-(b-k+1)},hi=k-1)
   stage('leximin_at_'+str(t),zs,offset=constant)
  ids=[u['id'] for u in units];k=s.get('rotation',0)%max(1,len(ids));ids=ids[k:]+ids[:k]
  stage('maintenance_rotation',{ys[i]:len(ids)-ids.index(i) for i in ids})
 if s['policy']=='floor':stage('bounded_hub_floor',floors)
 stage('priority_delivery',{i:u.get('priority',1) for u in units for i in delivery[u['id']]})
 totalhub={}
 for a in hub_end.values():
  for i,v in a.items():add(totalhub,i,v)
 stage('remaining_hub_stock',totalhub)
 ids=[u['id'] for u in units];k=s.get('rotation',0)%max(1,len(ids));ids=ids[k:]+ids[:k]
 stage('rotating_remainder',{i:len(ids)-ids.index(u['id']) for u in units for i in delivery[u['id']]})
 stage('transport_work',work|lastwork,False)
 for h in hubs:stage('canonical_hub:'+h['id'],hub_end[h['id']])
 if x is None:x,_=p.solve({})
 # Report actual arc flows, not invented source-specific commodity paths.
 flows=[{k:v for k,v in a.items() if k!='i'}|{'q':int(x[a['i']])} for a in arcs if x[a['i']]>0]
 r=dict(side=side,deliveries={u['id']:int(sum(x[i] for i in delivery[u['id']])) for u in units},hubs={h['id']:int((h['stock'] if s['variant']=='A' else 0)+sum(x[i]*v for i,v in hub_end[h['id']].items())) for h in hubs},flows=flows,source_used={a['id']:int(sum(x[i] for i in injections[a['id']])) for a in sources},hub_unload={h['id']:int(x[draw[h['id']]]+sum(x[i] for i in local[h['id']])) for h in hubs},constraints=[dict(id=n,used=int(sum(x[i]*v for i,v in a.items())),cap=cap,saturated=bool(a) and int(sum(x[i]*v for i,v in a.items()))==cap) for n,(a,cap) in groups.items()],objectives=objectives,paths=None,variables=len(p.names),rows=len(p.rows),exact=True,solver='exact-signature',conditional=s.get('view')=='player' and any(not n.get('known',True) for n in s['nodes']),ms=round((time.perf_counter()-began)*1000,3))
 r['solver_retries']=p.solver_retries
 assert sum(r['source_used'].values())+sum(h['stock'] if s['variant']=='A' else 0 for h in hubs)==sum(r['hubs'].values())+sum(r['deliveries'].values())
 return r

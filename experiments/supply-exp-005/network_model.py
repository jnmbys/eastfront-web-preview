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
 for h in hubs:
  origin=(h['node'],0);states={origin};q=deque([origin]);layerarcs=[]
  while q:
   n,c=q.popleft()
   for other,e in road[n]:
    cost=e.get('cost_ab' if n==e['a'] else 'cost_ba',e.get('cost',1));assert isinstance(cost,int) and cost>0
    dest=(other,c+cost)
    if dest[1]>h['range']:continue
    layerarcs.append(((n,c),dest,e,cost))
    if dest not in states:states.add(dest);q.append(dest)
  # Reverse reachability removes only layer states that provably cannot deliver.
  terminals={v for v in states if usable(s,h['node'],side) and any(u['node']==v[0] for u in units)};back=defaultdict(list)
  for a,b,e,c in layerarcs:back[b].append(a)
  good=set(terminals);q=deque(terminals)
  while q:
   for a in back[q.popleft()]:
    if a not in good:good.add(a);q.append(a)
  lb=defaultdict(dict);wh={};outgoing={}
  for a,b,e,c in layerarcs:
   if a not in good or b not in good:continue
   i=p.var('last:'+h['id']+':'+str(a)+'>'+str(b),big);add(lb[a],i,-1);add(lb[b],i,1);lastwork[i]=c
   wh[i]=c if s['variant']=='A' else 0
   if e.get('bridge_cap') is not None:bridgeuse[e['id']][i]=1
   arcs.append(dict(i=i,kind='last',edges=[e['id']],hub=h['id'],unit='transit',from_node=a[0],to_node=b[0],cost=c))
  for u in units:
   for n,c in sorted(good):
    if n!=u['node']:continue
    i=p.var('receive:'+h['id']+':'+u['id']+':'+str(c),max(0,u['target']-u['stock']));delivery[u['id']][i]=1;outgoing[i]=1;add(lb[(n,c)],i,-1)
    if s['variant']=='B' or c==0:wh[i]=1
    if c==0:lastwork[i]=1
    arcs.append(dict(i=i,kind='last',edges=[],hub=h['id'],unit=u['id'],cost=max(1,c),delivery=True))
  dispatch=p.var('dispatch:'+h['id'],big);add(lb[origin],dispatch,1)
  for n,a in lb.items():p.row(a,0,0,'last balance:'+h['id']+str(n))
  balance={draw[h['id']]:1,dispatch:-1,**local[h['id']]};hub_end[h['id']]=balance;stock=h['stock'] if s['variant']=='A' else 0;cap=h['cap'] if s['variant']=='A' else 0
  p.row(balance,-stock,cap-stock,'hub:'+h['id']);row(wh,budget(h['W'] if s['variant']=='A' else h['quota'],s),'W:'+h['id']);allout.update(outgoing)
  f=p.var('floor:'+h['id'],h.get('floor',0) if s['variant']=='A' else 0);floors[f]=1;p.row({f:1,**{i:-v for i,v in balance.items()}},hi=stock)
 for eid,a in bridgeuse.items():row(a,budget(edges[eid]['bridge_cap'],s),'bridge:'+eid)
 ys={};lam=p.var('maintenance_min_ratio',1,False)
 for u in units:
  d=delivery[u['id']];row(d,max(0,min(u['cap'],u['target'])-u['stock']),'unit:'+u['id']);b=budget(u['B'],s);y=p.var('maintenance:'+u['id'],b);ys[u['id']]=y;p.row({y:1,**{i:-v for i,v in d.items()}},hi=u['stock']);p.row({lam:b,y:-1},hi=0)
 x=None;objectives=[]
 def stage(name,obj,maximize=True):
  nonlocal x
  try:x,val=p.solve(obj,maximize,True)
  except Exception as e:raise type(e)(name+': '+str(e)) from e
  objectives.append([name,round(val,8)])
 maintenance_stages(s,p,units,ys,lam,stage)
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
 # Report actual arc flows, not invented source-specific commodity paths.
 flows=[{k:v for k,v in a.items() if k!='i'}|{'q':int(x[a['i']])} for a in arcs if x[a['i']]>0]
 r=dict(side=side,deliveries={u['id']:int(sum(x[i] for i in delivery[u['id']])) for u in units},hubs={h['id']:int((h['stock'] if s['variant']=='A' else 0)+sum(x[i]*v for i,v in hub_end[h['id']].items())) for h in hubs},flows=flows,source_used={a['id']:int(sum(x[i] for i in injections[a['id']])) for a in sources},hub_unload={h['id']:int(x[draw[h['id']]]+sum(x[i] for i in local[h['id']])) for h in hubs},constraints=[dict(id=n,used=int(sum(x[i]*v for i,v in a.items())),cap=cap,saturated=bool(a) and int(sum(x[i]*v for i,v in a.items()))==cap) for n,(a,cap) in groups.items()],objectives=objectives,paths=None,variables=len(p.names),rows=len(p.rows),exact=True,solver='edge-layered',conditional=s.get('view')=='player' and any(not n.get('known',True) for n in s['nodes']),ms=round((time.perf_counter()-began)*1000,3))
 r['solver_retries']=p.solver_retries
 assert sum(r['source_used'].values())+sum(h['stock'] if s['variant']=='A' else 0 for h in hubs)==sum(r['hubs'].values())+sum(r['deliveries'].values())
 return r

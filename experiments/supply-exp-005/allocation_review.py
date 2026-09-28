from copy import deepcopy
from itertools import product
from fractions import Fraction
import json
from model import solve,settle
from scenarios import scenario

def fixture():
 s=scenario();s.update(allocator='legacy',use_t=False,T=0,policy='last',nodes=[],edges=[],sources=[],hubs=[],units=[])
 for i,(cap,demands) in enumerate([(0,[4]),(4,[4,4]),(4,[2,6])]):
  n='N'+str(i);s['nodes'].append(dict(id=n,x=i,y=0,known=True,control='G'))
  if cap:s['sources'].append(dict(id='S'+str(i),node=n,side='G',cap=cap))
  s['hubs'].append(dict(id='H'+str(i),node=n,side='G',stock=0,cap=0,W=100,quota=100,range=1,floor=0))
  for j,B in enumerate(demands):s['units'].append(dict(id=f'U{i}{j}',node=n,side='G',B=B,stock=0,cap=B,target=B,debt='0',strength=100,priority=9 if j==0 else 1,MP=4))
 return s

def brute(s):
 us=s['units'];feasible=[]
 for xs in product(*(range(u['B']+1) for u in us)):
  if any(sum(x for x,u in zip(xs,us) if u['node']==n)>cap for n,cap in [('N0',0),('N1',4),('N2',4)]):continue
  ratios=tuple(sorted(Fraction(x,u['B']) for x,u in zip(xs,us)));feasible.append((ratios,xs))
 best=max(r[0] for r in feasible)
 return {'sortedRatios':[str(x) for x in best],'allocations':[dict(zip([u['id'] for u in us],x)) for r,x in feasible if r==best],'enumeratedFeasible':len(feasible)}

def run():
 s=fixture();ref=brute(s);out={'fixture':s,'reference':ref,'modes':{}}
 for mode in ['legacy','progressive']:
  a=deepcopy(s);a['allocator']=mode;r=solve(a);first={k:r[k] for k in ['deliveries','objectives']};ticks=[]
  for k in range(6):
   a,rr,_=settle(a,a['epoch']);ticks.append({u['id']:u['maintenance'] for u in rr[0]['units']})
  first.update(maintenance6Ticks=ticks,totalMaintenance={u['id']:sum(t[u['id']] for t in ticks) for u in s['units']});out['modes'][mode]=first
 got=out['modes']['progressive']['deliveries'];assert got in ref['allocations']
 out['choice']='Progressive discrete max-min maintenance, rotating maintenance identities, then weighted reserve refill. Legacy remains comparison. Refills can still concentrate by design; no claim of reserve fairness.'
 open('evidence/allocation-review.json','w').write(json.dumps(out,indent=2));print(json.dumps(out['modes'],indent=2))
if __name__=='__main__':run()

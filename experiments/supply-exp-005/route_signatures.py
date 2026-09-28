"""Exact dominance compression under EXP002 last-mile constraints.
Resource signature = capacitated bridge set + distance. No k-path/range truncation.
Every nondominated signature is retained. Unknown extra constraints => reject.
"""
import heapq
from model import check_budget,UnsupportedGraph,usable

def signatures(s,hub,side,adj):
 for e in s['edges']:
  if e.get('road_cap') is not None:raise UnsupportedGraph('road_cap not supported by signature proof; use layered reference')
 bits={e['id']:1<<i for i,e in enumerate(sorted((e for e in s['edges'] if e.get('bridge_cap') is not None),key=lambda e:e['id']))}
 start=hub['node'];labels={n:{} for n in adj};labels[start][0]=(0,());queue=[(0,start,0,())]
 if not usable(s,start,side):return labels
 while queue:
  check_budget();cost,node,mask,route=heapq.heappop(queue)
  if labels[node].get(mask)!=(cost,route):continue
  for dest,e in adj[node]:
   bit=bits.get(e['id'],0)
   if bit&mask:continue
   nc=cost+e.get('cost_ab' if node==e['a'] else 'cost_ba',e.get('cost',1));nm=mask|bit
   if nc>hub['range']:continue
   target=labels[dest]
   if any((m&nm)==m and d<=nc for m,(d,p) in target.items()):continue
   for m,(d,p) in list(target.items()):
    if (m&nm)==nm and d>=nc:del target[m]
   path=route+(e['id'],);target[nm]=(nc,path);heapq.heappush(queue,(nc,dest,nm,path))
 return labels

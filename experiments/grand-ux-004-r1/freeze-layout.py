import json, math
from pathlib import Path
x=json.loads(Path('evidence/grand-ux-004-r1/layout-input.json').read_text(encoding='utf8'));cells=x['hexes'];key=lambda h:f"{h['q']},{h['r']}";row=lambda h:h['r']+h['q']//2
locked={}
for n in x['nodes']:
 if n['side']:locked[n['hex']]=n['side']
for u in x['units']:locked[key(u['hex'])]=u['side']
for f in x['facilities'].values():locked[f['hex']]=cells[f['hex']]['control']
for city in x['cities']:
 for d in city['districts']:
  if cells[d['hex']]['control']:locked[d['hex']]=cells[d['hex']]['control']
# Preserve at least one original railway source path to every national node.
for side in ['GERMAN','SOVIET']:
 adj={}
 for e in x['edges'].values():
  a,b=key(e['a']),key(e['b'])
  if (e.get('railway') or {}).get('present') and all(cells[k]['control']==side for k in [a,b]):
   adj.setdefault(a,[]).append(b);adj.setdefault(b,[]).append(a)
 sources=[n['hex'] for n in x['nodes'] if n['side']==side and n['sourceQ']>0];seen={k:None for k in sources};queue=sources[:]
 for k in queue:
  for n in sorted(adj.get(k,[])):
   if n not in seen:seen[n]=k;queue.append(n)
 for n in x['nodes']:
  if n['side']!=side:continue
  at=n['hex']
  while at is not None:
   locked[at]=side;at=seen.get(at)
rows=[[h for h in cells.values() if row(h['coord'])==r and h['terrain']!='LAKE'] for r in range(32)]
valid=[];counts=[];cost=[]
for r,hs in enumerate(rows):
 options=[];ns={};cs={}
 for q in range(7,28):
  if any((k in locked and locked[k]!=('GERMAN' if h['coord']['q']<q else 'SOVIET')) for h in hs for k in [key(h['coord'])]):continue
  options.append(q);ns[q]=sum(h['coord']['q']<q and h['control'] is not None for h in hs)
  # Prefer an actual river at the row's boundary, penalize severing rail edges.
  cut=[e for e in x['edges'].values() if row(e['a'])==r and row(e['b'])==r and (e['a']['q']<q)!=(e['b']['q']<q)]
  cs[q]=sum(.2 if e.get('river') else 1 for e in cut)+sum(4 for e in cut if (e.get('railway') or {}).get('present'))
 valid.append(options);counts.append(ns);cost.append(cs)
dp={(q,counts[0][q]):(cost[0][q],[q]) for q in valid[0]}
for r in range(1,32):
 out={}
 for (prev,n),(v,path) in dp.items():
  for q in valid[r]:
   if abs(q-prev)>4:continue
   nn=n+counts[r][q]
   if nn>650:continue
   score=v+cost[r][q]+abs(q-prev)*2
   k=q,nn
   if k not in out or score<out[k][0]:out[k]=(score,path+[q])
 dp=out
best=min(((abs(n-623)*100+v,path,n) for (q,n),(v,path) in dp.items() if 614<=n<=650))
_,front,n=best
old={r['hex']:r for r in x['old']['rows']};items=[];changed=[]
for k,h in cells.items():
 if h['terrain']=='LAKE' or h['control'] is None:continue
 side='GERMAN' if h['coord']['q']<front[row(h['coord'])] else 'SOVIET'
 r=dict(old[k]);r['side']=side;items.append(r)
 if side!=h['control']:changed.append(k)
config={**x['old'],'version':'THEATRE-CORES-UX004-R1','layoutName':'均衡面积战区 R1（新战役）','frontierByMapRow':front,'rows':items}
Path('experiments/grand-ux-004-r1/territory-config.json').write_text(json.dumps(config,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
report={'method':'Fixed row frontier; protected original units, districts, factories, sources and one owned rail path to every national node. Existing neutral corridor retained. River cuts preferred; bounded bends, no simulation result used.','frontier':front,'land':sum(map(len,rows)),'old':{'GERMAN':797,'SOVIET':448,'NEUTRAL':33},'new':{'GERMAN':n,'SOVIET':1245-n,'NEUTRAL':33},'changedLand':changed,'protectedCount':len(locked),'scoreTotals':{s:sum(r['weight'] for r in items if r['side']==s) for s in ['GERMAN','SOVIET']}}
Path('evidence/grand-ux-004-r1/layout.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n');print(json.dumps({k:v for k,v in report.items() if k!='changedLand'},ensure_ascii=False))


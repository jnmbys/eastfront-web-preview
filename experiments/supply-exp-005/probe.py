from live import *
from bounded import warm_start,close_worker
if __name__=='__main__':
 warm_start();rows=[]
 for clip in ['prepare','isolation','restore']:
  a=json.loads((ROOT/'data/playable'/f'{clip}-new.json').read_text())['state'];b=json.loads((ROOT/'data/playable'/f'{clip}-old.json').read_text())['state'];side='S' if clip=='restore' else 'G'
  for u in a['logistics']['units']:
   if u['side']!=side:continue
   x=node(a['core'],'new',a['logistics'],'options',unit=u['id'],side=side)['options'];y=node(b['core'],'old',b['logistics'],'options',unit=u['id'],side=side)['options']
   if (len(x)!=len(y)) or (clip=='restore' and u['node']=='A5'):
    rows.append(dict(clip=clip,unit=u['id'],node=u['node'],debt=u['debt'],new=len(x),old=len(y),new_examples=x[:3],old_examples=y[:3]));print(rows[-1],flush=True)
 (ROOT/'evidence/options-probe.json').write_text(json.dumps(rows,indent=2));close_worker()

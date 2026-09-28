from live import *
from bounded import warm_start,close_worker
if __name__=='__main__':
 warm_start();out=[];(ROOT/'data/playable').mkdir(exist_ok=True)
 for clip in ['restore']:
  for mode in ['new','old']:
   b=create(clip,mode);initial=deepcopy(b);times=[]
   if clip!='prepare':
    for i in range(6):
     cmd=auto_command(b);r=execute(b,cmd);times.append(r['seconds'])
     if not r['ok']:raise RuntimeError((clip,mode,i,r['error']))
     b=r['state']
   (ROOT/'data/playable'/f'{clip}-{mode}.json').write_text(json.dumps({'initial':initial,'state':b}))
   out.append(dict(clip=clip,mode=mode,phase=b['core']['phase'],turn=b['core']['turn'],epochs=b['logistics']['tick'],times=times,hash=hash_bundle(b),debt2=sum(Fraction(u['debt'])>=2 for u in b['logistics']['units'])))
   print(out[-1],flush=True)
 (ROOT/'evidence/scenes-restore-revised.json').write_text(json.dumps(out,indent=2));close_worker()

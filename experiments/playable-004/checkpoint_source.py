import json,lzma,time
from copy import deepcopy
from continuous import Transactions,mods,digest

def frames():
 out={}
 for line in lzma.open('evidence/playable-003/browser-chain.jsonl.xz','rt',encoding='utf8'):
  h=json.loads(line)['head'];c=h['root']['bundle']['core'];out.setdefault((c['turn'],c['phase']),h)
 return out

def run():
 tx=Transactions();mods['016'].runtime();tx._head=deepcopy(frames()[(8,'SOVIET_ENTRENCHMENT')])
 from planner import public_input
 from legalmap import KEYS
 s=tx.snapshot()['bundle']['logistics'];pub=public_input(s)
 print('public fields',list(pub),'units',len(pub['units']),flush=True)
 for reductions in [{},{'G-REC-02':2}]:
  r=tx.preview(tx.head()['version'],dict(reductions=reductions,priorities={}))
  print('PREVIEW',r['status'],r['seconds'],[(x['id'],x['reference']['maintenance'],x['alternative']['maintenance'])for x in r.get('comparison',[])if x['reference']['maintenance']!=x['alternative']['maintenance']],flush=True)
  if r['status']=='FEASIBLE':
   q=tx.request('probe-freight','FREIGHT_'+r['planId']);reply=tx.submit(q);print('COMMIT',reply,flush=True)
 tx.close()
if __name__=='__main__':run()

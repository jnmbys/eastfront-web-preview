import sys,json,time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from continuous import Transactions
if __name__=='__main__':
 tx=Transactions();log=[]
 try:
  for j in range(400):
   c=tx.snapshot()['bundle']['core']
   if c['phase']=='GAME_OVER':break
   r=tx.submit(tx.request('no-order-'+str(j),'NEXT'));log.append(dict(turn=c['turn'],phase=c['phase'],**r));print(j,c['turn'],c['phase'],r['ok'],r.get('detail',''),flush=True)
   if not r['ok']:break
  Path('evidence/playable-003/no-order-local.json').write_text(json.dumps(dict(log=log,final=tx.snapshot()['bundle']['core']['phase'],turn=tx.snapshot()['bundle']['core']['turn'],victory=tx.snapshot()['bundle']['core'].get('victory'),finalBudget=tx.snapshot()['industry']['budget']),ensure_ascii=False),encoding='utf-8')
 finally:tx.close()

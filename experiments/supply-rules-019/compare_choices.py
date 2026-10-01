"""Six short legal branches. Frozen runtime and 3-second budget; no fabricated states."""
import sys,json,gzip,hashlib,platform
from pathlib import Path
from copy import deepcopy
ROOT=Path(__file__).resolve().parents[2];EXP=ROOT/'experiments/supply-exp-005'
sys.path.insert(0,str(EXP))
import live
from bounded import warm_start,close_worker
OUT=Path(__file__).parent/'evidence'
IDS=['G-I-01','G-PZ-01','G-MOT-01','G-ENG-01']
report={'source':'813b4072568352e95d0726fe5fe04060c889c554','environment':platform.platform(),'budget_seconds':3,'scope':'local rules research, not deployment/container/browser acceptance','branches':[]}
def read(name):
 p=EXP/'evidence'/name;d=json.load(gzip.open(p,'rt',encoding='utf-8'))
 if 'state' in d:assert live.hash_bundle(d['state'])==d['hash']
 return d
def snapshot(b):
 units={}
 for u in b['logistics']['units']:
  if u['id'] not in IDS:continue
  fx=live.effects(b['logistics'],{'type':'ATTACK','attackerUnitIds':[u['id']]})[u['id']]
  units[u['id']]={k:u[k] for k in ['node','B','stock','cap','target','debt','strength']}
  units[u['id']].update(debt_only_effect=live.effects(b['logistics'])[u['id']],next_direct_attack_effect=fx,core_hex=b['core']['units'][u['id']]['hex'])
 return {'revision':b['revision'],'turn':b['core']['turn'],'phase':b['core']['phase'],'pending':b['core']['pendingDecision'],'units':units,
 'ledger':[u for r in b['logistics']['ledger'] for u in r['units'] if u['id'] in IDS],
 'hubs':[h for h in b['logistics']['hubs'] if h['side']=='G'],'audit':live.audit(b['logistics']),'hash':live.hash_bundle(b)}
def act(b,a,log):
 controller=b['core']['pendingDecision']['decisionOwnerControllerId'] if b['core']['pendingDecision'] else next(c['id'] for c in b['core']['controllers'].values() if c['side']==b['core']['activeSide'])
 a={k:v for k,v in a.items() if k!='controllerId'}
 cmd={'id':'019-'+str(b['revision'])+'-'+a['type'],'revision':b['revision'],'action':{'type':a.pop('type'),'controllerId':controller,**a}}
 before=live.hash_bundle(b);r=live.execute(b,cmd)
 row={'command':cmd,'ok':r['ok'],'seconds':r['seconds'],'before_hash':before}
 if not r['ok']:row['error']=r['error'];log.append(row);raise AssertionError(row)
 assert live.hash_bundle(b)==before
 b=r['state'];live.audit(b['logistics']);j=b['journal'][-1]
 row.update(after_hash=live.hash_bundle(b),charges=j['charges'],settled=j['settled'],events=j['events'],supply_events=j['supply_events'])
 log.append(row);return b
def round_end(b,log):
 turn=b['core']['turn']
 for _ in range(12):
  if b['core']['turn']>turn:return b
  assert b['core']['pendingDecision'] is None
  b=act(b,{'type':'END_PHASE'},log)
 raise AssertionError('one-round bound exceeded')
def save(name,start,b,log,extra=None):
 report['branches'].append({'name':name,'before':snapshot(start),'after':snapshot(b),'actions':log,'extra':extra})
 print(name,'actions',len(log),'units',[(k,v['node'],v['stock'],v['debt']) for k,v in snapshot(b)['units'].items()],flush=True)
if __name__=='__main__':
 OUT.mkdir(exist_ok=True);warm_start()
 try:
  cp75=read('campaign011-final/checkpoint-75.json.gz')['state'];rows=read('campaign011-final/reserve-recovery-repeat.json.gz')['records'];prefix=[];pre=deepcopy(cp75)
  for row in rows[:3]:
   pre=act(pre,row['command']['action'],prefix);assert live.hash_bundle(pre)==row['hash']
  report['shared_attack_prefix']=prefix
  for choice in ['attack_now','wait_one_delivery']:
   b=deepcopy(pre);log=[]
   if choice=='attack_now':
    for row in rows[3:]:b=act(b,row['command']['action'],log);assert live.hash_bundle(b)==row['hash']
   b=round_end(b,log);save(choice,pre,b,log)
  move=deepcopy(cp75);log=[];move=act(move,{'type':'END_PHASE'},log);report['shared_move_prefix']=log
  for choice,dest in [('concentrate_near_engineer',{'q':2,'r':7}),('disperse_forward',{'q':4,'r':5})]:
   b=deepcopy(move);log=[];options=live.node(b['core'],b['mode'],b['logistics'],'options',side='G',unit='G-PZ-01')['options']
   option=next(o for o in options if o['coords']==[dest])
   b=act(b,{'type':'MOVE','unitId':'G-PZ-01','path':[dest]},log);post_move=snapshot(b)
   b=round_end(b,log);save(choice,move,b,log,{'legal_move_option':option,'post_move':post_move})
  cp117=read('campaign011-close/checkpoint-117.json.gz')['state']
  repair=read('campaign011-close/recover-attack.json.gz')['records'][0]['command']['action']
  for choice in ['repair_two_edges','defer_repair']:
   b=deepcopy(cp117);log=[];post_repair=None
   if choice=='repair_two_edges':b=act(b,repair,log);post_repair=snapshot(b)
   b=round_end(b,log);save(choice,cp117,b,log,{'post_repair':post_repair,'comparison_limit':'no BREAKTHROUGH decision at checkpoint117; same units stay put after rail phase, testing repair vs defer, not a fictional same-phase breakthrough choice'})
  report['passed']=True
 except Exception:
  import traceback
  report['passed']=False;report['failure']=traceback.format_exc();print(report['failure'],flush=True)
 finally:
  close_worker();(OUT/'choices.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
 raise SystemExit(0 if report['passed'] else 1)

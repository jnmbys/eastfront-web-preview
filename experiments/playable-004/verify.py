"""Offline checkpoints from recorded real 003 actions; no HTTP injection endpoint."""
import json,time,gzip
from pathlib import Path
from copy import deepcopy
from continuous import Transactions,mods,digest
from checkpoint_source import frames
from planner import public_input

def run():
 tx=Transactions();mods['016'].runtime();saved=frames();checks=[];seq=0;trace=[]
 def restore(key):
  tx._head=deepcopy(saved[key]);tx.bindings={};tx.replies={};tx.preview_version=-1;tx.failed_freight_version=None
 def action(op='NEXT',a=None):
  nonlocal seq
  seq+=1;q=tx.request('verify-'+str(seq).zfill(5),op)
  if a:q.update(action=a)
  r=tx.submit(q,action=a);assert r['ok'],r
  trace.append(dict(request=q,result=r,head=tx.head()));return q,r
 def preview(reductions=None,priorities=None):
  before=digest(tx.head());p=tx.preview(tx.head()['version'],dict(reductions=reductions or {},priorities=priorities or {}));assert digest(tx.head())==before;return p
 def confirm(p):
  assert p['status']=='FEASIBLE',p
  q,r=action('FREIGHT_'+p['planId']);before=digest(tx.head());assert tx.submit(q)==r and digest(tx.head())==before
  return tx.snapshot()
 try:
  restore((8,'SOVIET_ENTRENCHMENT'));default=preview();assert default['status']=='NO_CAPACITY'
  p=preview({'G-REC-02':2});root=confirm(p)
  assert root['forward']['shipment']['status']=='RECEIVED'
  alt=next(x for x in p['comparison']if x['id']=='G-REC-02');assert alt['reference']['maintenance']-alt['alternative']['maintenance']==2
  checks.append(dict(check='original_approved_tradeoff_and_readonly_duplicate',default=default,selected=p,afterVersion=tx.head()['version']))
  # Different explicit maintenance donor; no target IDs exist in the planner.
  restore((8,'SOVIET_ENTRENCHMENT'));p2=preview({'G-REC-01':2},{'G-REC-02':3});confirm(p2)
  changed=[x['id']for x in p2['comparison']if x['alternative']['maintenance']<x['reference']['maintenance']];assert changed==['G-REC-01'],changed
  checks.append(dict(check='different_selected_donor_actual_equals_preview',selected=p2))
  # Real Core action alters unit position and spends its existing SP.
  restore((8,'GERMAN_MOVEMENT'))
  a=dict(type='MOVE',controllerId='G-HUMAN-1',unitId='G-PZ-01',path=[dict(q=3,r=8)])
  action('ACTION',a)
  while tx.snapshot()['bundle']['core']['phase']!='SOVIET_ENTRENCHMENT':
   c=tx.snapshot()['bundle']['core'];op='CARE'if c['phase']=='GERMAN_RECOVERY'and not tx.snapshot()['forward']['care']else'NEXT';action(op)
  moved=tx.snapshot();assert moved['bundle']['core']['units']['G-PZ-01']['hex']=={'q':3,'r':8}
  p3=preview({'G-REC-02':2});root=confirm(p3)
  checks.append(dict(check='real_move_new_position_stock_replan',selected=p3,stock=next(u for u in root['bundle']['logistics']['units']if u['id']=='G-PZ-01')))
  # Recovery remains the original service and subsequent phases reach original victory.
  recovered=False
  for _ in range(140):
   c=tx.snapshot()['bundle']['core']
   if c['phase']=='GAME_OVER':break
   op='RECOVER'if (c['turn'],c['phase'])==(9,'GERMAN_RECOVERY')and not recovered else'NEXT';action(op);recovered|=op=='RECOVER'
  c=tx.snapshot()['bundle']['core'];assert recovered and c['phase']=='GAME_OVER'and c['turn']==16
  checks.append(dict(check='dynamic_commit_recovery_continue_natural_terminal',turn=c['turn'],phase=c['phase'],victory=c.get('victory')))
  restore((8,'SOVIET_ENTRENCHMENT'));p=preview({'G-REC-02':2});q=tx.request('stale-plan-000','FREIGHT_'+p['planId']);action();before=digest(tx.head());r=tx.submit(q);assert not r['ok']and digest(tx.head())==before
  checks.append(dict(check='stale_plan_never_auto_accepts_new_cost',result=r))
  restore((8,'GERMAN_MOVEMENT'));action('ACTION',dict(type='MOVE',controllerId='G-HUMAN-1',unitId='G-I-01',path=[dict(q=3,r=8)]))
  while tx.snapshot()['bundle']['core']['phase']!='SOVIET_ENTRENCHMENT':action('CARE'if tx.snapshot()['bundle']['core']['phase']=='GERMAN_RECOVERY'and not tx.snapshot()['forward']['care']else'NEXT')
  p=preview({'G-REC-02':4});assert p['status']=='SERVICE_INVALID';action();assert tx.snapshot()['bundle']['core']['turn']==9
  checks.append(dict(check='moved_service_target_not_capacity_override_continue',preview=p))
  # Paired hidden information: identical authorized view, arbitrarily changed hidden occupancy,
  # ZOC, opponent stock and hidden hashes must produce byte-identical planner inputs/results.
  restore((8,'SOVIET_ENTRENCHMENT'));s=tx.snapshot()['bundle']['logistics'];a=public_input(s);hidden=deepcopy(s)
  for n in hidden['nodes']:n['occupants']=['S'];n['zoc_by']=['S']
  for u in hidden['units']:
   if u['side']=='S':u['stock']+=100;u['node']='A10'
  hidden['core_state_hash']='hidden-change';assert digest(a)==digest(public_input(hidden))
  checks.append(dict(check='hidden_pair_identical_authorized_planner_input',hash=digest(a)))
  p=preview({'G-REC-02':2});before=digest(tx.head());q=tx.request('timeout-00000','FREIGHT_'+p['planId']);r=tx.submit(q,started=time.perf_counter()-4);assert not r['ok']and digest(tx.head())==before
  checks.append(dict(check='expired_atomic_budget_retains_all_resources',result=r))
  Path('evidence/playable-004/checks.json').write_text(json.dumps(dict(offlineOnly=True,source='003 browser-chain.jsonl.xz',checks=checks),ensure_ascii=False,indent=2),encoding='utf8')
  with gzip.open('evidence/playable-004/offline-actions.jsonl.gz','wt',encoding='utf8')as f:
   for row in trace:f.write(json.dumps(row,ensure_ascii=False)+'\n')
  print('PASS',len(checks),'checks;',len(trace),'accepted original-Core actions',flush=True)
 finally:tx.close()
if __name__=='__main__':run()

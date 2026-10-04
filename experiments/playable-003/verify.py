"""Offline branch checks from browser-produced roots; never exposed as HTTP fixtures."""
import sys,time,json,gzip,lzma
from copy import deepcopy
from pathlib import Path
from continuous import Transactions,mods,digest

def run():
 tx=Transactions();frames={}
 source=Path(sys.argv[1])
 opener=lzma.open if source.suffix=='.xz' else gzip.open
 for line in opener(source,'rt',encoding='utf8'):
  head=json.loads(line)['head'];c=head['root']['bundle']['core'];frames.setdefault((c['turn'],c['phase']),head)
 def restore(key):tx._head=deepcopy(frames[key]);tx.bindings={};tx.replies={};tx.test_label='SYNTHETIC-OFFLINE-BROWSER-ROOT'
 log=[]
 try:
  restore((8,'GERMAN_MOVEMENT'))
  move=dict(type='MOVE',controllerId='G-HUMAN-1',unitId='G-I-01',path=[dict(q=3,r=8)])
  q=dict(id='offline-free-move',operation='ACTION',version=tx.head()['version'],action=move)
  result=tx.submit(q,action=move);assert result['ok'],result
  committed=digest(tx.head());assert tx.submit(q,action=move)==result and digest(tx.head())==committed
  log.append(dict(check='actual_move_and_identical_retry',position=tx.snapshot()['bundle']['core']['units']['G-I-01']['hex'],unchangedAfterRetry=True))
  for n in range(15):
   c=tx.snapshot()['bundle']['core']
   if c['turn']==9:break
   op='CARE'if c['phase']=='GERMAN_RECOVERY'and not tx.snapshot()['forward']['care']else'NEXT'
   result=tx.submit(tx.request('offline-phase-'+str(n),op));assert result['ok'],result
  r=tx.snapshot();assert r['bundle']['core']['turn']==9 and r['forward']['shipment'] is None
  assert 'TARGET_MOVED'in r['forward']['blockedReason']
  assert r['industry']['budget']['freeI']==4 and r['personnel']['package']['quantityP']==1
  log.append(dict(check='moved_target_blocks_freight_not_turn',turn=9,reason=r['forward']['blockedReason'],budget=r['industry']['budget']))
  for n in range(15):
   if tx.snapshot()['bundle']['core']['turn']==10:break
   result=tx.submit(tx.request('offline-expiry-'+str(n),'NEXT'));assert result['ok'],result
  r=tx.snapshot();assert r['forward']['closed'] and r['personnel']['package']['custody']=='REAR_QUARANTINED'
  log.append(dict(check='skip_material_recovery_expiry_and_continue',turn=r['bundle']['core']['turn'],care=r['forward']['care'],P=r['personnel']['package']))
  restore((9,'GERMAN_MOVEMENT'));q=tx.request('offline-budget-expired','NEXT');before=digest(tx.head());result=tx.submit(q,started=time.perf_counter()-4);assert not result['ok']and digest(tx.head())==before
  log.append(dict(check='deadline_preserves_root',result=result))
  s=deepcopy(tx.config['plan']['projection']['input']);s['core_state_hash']='unrelated-command-history';s['core_action_count']+=3
  result=tx.settle_fixed_if_current(s,time.perf_counter()+3);assert result and result['ok']
  s['T']-=1;assert tx.settle_fixed_if_current(s,time.perf_counter()+3)is None
  log.append(dict(check='history_independent_current_capacity_guard',samePhysicalAccepted=True,changedCapacityRequiresUnapprovedReallocation=False))
  Path('evidence/playable-003/targeted-checks.json').write_text(json.dumps(dict(source=str(source),offlineOnly=True,checks=log),ensure_ascii=False,indent=2),encoding='utf8')
  print('PASS',len(log),'targeted checks')
 finally:tx.close()
if __name__=='__main__':run()

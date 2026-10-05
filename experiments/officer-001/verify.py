"""Offline only: reuses real 003 checkpoints, no HTTP injection or strategy oracle."""
import sys,json,time,lzma,uuid
from pathlib import Path
from copy import deepcopy
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'experiments/playable-004'))
from server import Game
from officers import Officers
from checkpoint_source import frames
from loader import digest

def run():
 g=Game();saved=frames();saved[(5,'GERMAN_RECOVERY')]=g.tx.head();checks=[];seq=0
 def load(k):
  g.tx._head=deepcopy(saved[k]);g.tx.bindings={};g.tx.replies={};g.officers=Officers();g.history=[];g.ai_stopped=False;g.public=g._state()
 def config(type,group='0',**extra):return g.officers.config(dict(revision=g.officers.revision,command=dict(type=type,group=group,**extra)),g.project()['view'])
 def tick():
  nonlocal seq
  seq+=1;q=dict(id='verify-officer-'+str(seq),revision=g.officers.revision,version=g.tx.head()['version']);r=g.officers.tick(g,q)
  return q,r
 def op(name):
  q=g.tx.request('verify-op-'+str(uuid.uuid4()),name);r=g.tx.submit(q);assert r['ok'],r;g.public=g._state();return r
 try:
  load((8,'GERMAN_MOVEMENT'));before=digest(g.tx.head());config('ENABLE',enabled=True);config('ASSIGN',unit='G-PZ-03',direct=False);config('ASSIGN',unit='G-PZ-04',direct=False);config('ORDER',order=dict(kind='ATTACK',target=dict(q=5,r=6)));assert digest(g.tx.head())==before
  v=g.project()['view'];assert not g.officers.manual(dict(type='MOVE',unitId='G-PZ-03'),v);assert g.officers.manual(dict(type='MOVE',unitId='G-I-01'),v)
  q,r=tick();assert r['ok'],r;after=digest(g.tx.head());assert g.officers.tick(g,q)==r and digest(g.tx.head())==after
  q2,r2=tick();assert r2['ok'],r2;assert g.tx.snapshot()['bundle']['core']['phase']=='GERMAN_MOVEMENT'
  reports=deepcopy(g.officers.reports);assert {r['action']['unitId']for r in reports}=={'G-PZ-03','G-PZ-04'}
  pending_view=deepcopy(g.project()['view']);pending_view['pendingDecision']=dict(unitIds=['G-PZ-03']);assert not g.officers.manual(dict(type='PASS_ADVANCE'),pending_view)
  config('PAUSE');assert g.officers.manual(dict(type='PASS_ADVANCE'),pending_view)
  try:g.officers.tick(g,dict(id='stale-after-pause',revision=0,version=g.tx.head()['version']));raise RuntimeError('Stale accepted')
  except AssertionError:pass
  before=digest(g.tx.head());assert not tick()[1]['ok'];assert digest(g.tx.head())==before;assert g.officers.manual(dict(type='MOVE',unitId='G-PZ-03'),g.project()['view'])
  g.officers.battles['takeover-test']='0'
  config('ASSIGN',group='1',unit='G-PZ-03',direct=False);assert 'G-PZ-03'not in g.officers.groups[0]['members'];assert g.officers.groups[1]['members']==['G-PZ-03']
  assert not g.officers.battles
  assert g.officers.public(dict(viewer='SOVIET'))is None
  checks.append(dict(name='serial_moves_direct_ownership_duplicate_pause_reassign_privacy',reports=reports))
  # Existing source start: damaged I01 can be repaired using original RP action.
  load((5,'GERMAN_RECOVERY'));config('ENABLE',enabled=True);config('ASSIGN',unit='G-I-01',direct=False);config('ORDER',order=dict(kind='REFIT',target=None));assert not tick()[1]['ok']
  config('RP',amount=8)
  try:config('RP',group='1',amount=1);raise RuntimeError('Overreserved')
  except AssertionError:pass
  before=g.tx.snapshot()['bundle']['core'];q,r=tick();assert r['ok'],r;after=g.tx.snapshot()['bundle']['core'];assert after['units']['G-I-01']['step']==before['units']['G-I-01']['step']-1;assert after['rp']['GERMAN']<before['rp']['GERMAN'];assert g.officers.groups[0]['rp']==after['rp']['GERMAN'];assert not tick()[1]['ok']
  checks.append(dict(name='real_recovery_rp_and_limit',beforeRP=before['rp']['GERMAN'],afterRP=after['rp']['GERMAN'],report=g.officers.reports[-1]))
  # Original industry chain checkpoint + one legal officer move. No changed payments.
  load((8,'GERMAN_MOVEMENT'));config('ENABLE',enabled=True);config('ASSIGN',unit='G-PZ-01',direct=False);config('ORDER',order=dict(kind='DEFEND',target=dict(q=3,r=8)));q,r=tick();assert r['ok'],r
  while g.tx.snapshot()['bundle']['core']['phase']!='SOVIET_ENTRENCHMENT':op('CARE'if g.tx.snapshot()['bundle']['core']['phase']=='GERMAN_RECOVERY'and not g.tx.snapshot()['forward']['care']else'NEXT')
  p=g.tx.preview(g.tx.head()['version'],dict(reductions={'G-REC-02':2},priorities={}));assert p['status']=='FEASIBLE',p['status'];op('FREIGHT_'+p['planId'])
  while g.tx.snapshot()['bundle']['core']['phase']!='GERMAN_RECOVERY':op('NEXT')
  op('RECOVER');assert g.tx.snapshot()['bundle']['core']['units']['G-I-01']['step']==0
  while g.tx.snapshot()['bundle']['core']['turn']<10:op('NEXT')
  checks.append(dict(name='officer_move_then_004_dynamic_transport_material_recovery_continue_T10',planId=p['planId'],phase=g.tx.snapshot()['bundle']['core']['phase']))
  Path('evidence/officer-001/owner-check.json').write_bytes(json.dumps(dict(checks=checks,trace=str(g.trace_path)),ensure_ascii=False,indent=2).encode())
  print(json.dumps(checks,ensure_ascii=False))
 finally:g.close()
if __name__=='__main__':run()

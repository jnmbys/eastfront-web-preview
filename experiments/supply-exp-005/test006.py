import unittest,json,subprocess
from copy import deepcopy
from unittest.mock import patch
from test005 import scene
from live import *
from exercise import run
from bounded import warm_start,close_worker
import server
CASES=json.loads((ROOT/'evidence/choices006.json').read_text())
def initial(rec):
 if 'frame' not in rec:return run(scene(rec['clip']),{'type':'END_PHASE'})
 fid=rec['frame'];s=start(fid,reserve=4,delivery_range=8);s.update(ruleset='SUPPLY-EXP-005-v1',action_spent=0,action_ledger=[])
 r=node(FRAMES[fid]['state'],'new',s);s=sync(s,r['frame']);return dict(core=r['frame']['state'],logistics=s,mode='new',clip='prepare',revision=0,seen={},journal=[])
def pending(rec):
 b=initial(rec)
 for a in rec['actions']:b=run(b,a)
 return b
class ChoiceTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):warm_start()
 @classmethod
 def tearDownClass(cls):close_worker()
 def test_every_action_replay_and_fees(self):
  for kind,rec in CASES.items():
   with self.subTest(kind=kind):
    b=initial(rec);before=deepcopy(b)
    for a in rec['actions']:b=run(b,a)
    spent=b['logistics']['action_spent'];a=rec['choice'];expected=min(4,next(u['stock'] for u in b['logistics']['units'] if u['id']==a['unitId'])) if a['type']=='SCHWERPUNKT_ATTACK' else 0
    b=run(b,a);self.assertEqual(b['logistics']['action_spent']-spent,expected);audit(b['logistics'])
    x=before
    for j in b['journal'][len(before['journal']):]:
     r=execute(x,j['command']);self.assertTrue(r['ok'],r.get('error'));x=r['state'];self.assertEqual(hash_bundle(x),j['hash'])
    self.assertEqual(hash_bundle(x),hash_bundle(b))
    (ROOT/'evidence'/('replay006-'+kind+'.json')).write_text(json.dumps(dict(initial=before,state=b)))
 def test_complete_battle_to_settlement_replay(self):
  rec=CASES['SECOND_ATTACK'];b=initial(rec);before=deepcopy(b)
  for a in [*rec['actions'],rec['choice']]:b=run(b,a)
  for _ in range(25):
   if not b['core']['pendingDecision']:break
   opts=json.loads(subprocess.check_output(['node',str(ROOT/'choice-probe.mjs')],input=json.dumps(b['core']).encode()));b=run(b,opts[-1])
  self.assertIsNone(b['core']['pendingDecision']);b=run(run(b,{'type':'END_SIDE'}),{'type':'END_SIDE'});self.assertEqual(b['logistics']['tick'],before['logistics']['tick']+1);audit(b['logistics']);x=before
  for j in b['journal'][len(before['journal']):]:
   r=execute(x,j['command']);self.assertTrue(r['ok'],r.get('error'));x=r['state'];self.assertEqual(hash_bundle(x),j['hash'])
  (ROOT/'evidence/replay006-complete.json').write_text(json.dumps(dict(initial=before,state=b)))
 def test_forced_owner_invalid_duplicate_timeout_rollback(self):
  b=pending(CASES['MOVING_RETREAT']);cmd=auto_command(b);cmd['action']=CASES['MOVING_RETREAT']['choice'];r=execute(b,cmd);self.assertTrue(r['ok']);self.assertEqual(execute(r['state'],cmd)['state'],r['state']);bad=deepcopy(cmd);bad['action']['retreats']=[];self.assertFalse(execute(r['state'],bad)['ok'])
  for a in [dict(type='END_PHASE'),dict(type='PASS_ADVANCE',battleId=b['core']['pendingDecision']['battleId']),dict(type='RETREAT',battleId=b['core']['pendingDecision']['battleId'],retreats=[])]:
   cmd2=auto_command(b);cmd2['action'].update(a);q=execute(b,cmd2);self.assertFalse(q['ok']);self.assertEqual(q['state'],b)
  bad=deepcopy(cmd);bad['action']['controllerId']=next(c for c in b['core']['controllers'] if c!=cmd['action']['controllerId']);self.assertFalse(execute(b,bad)['ok']);self.assertEqual(execute(b,cmd,.001)['state'],b)
  import live
  real=live.node
  def fail(core,mode,s,op='frame',deadline=None,**kw):
   if op=='frame':raise TimeoutError('after Core accepted')
   return real(core,mode,s,op,deadline,**kw)
  with patch('live.node',side_effect=fail):self.assertEqual(execute(b,cmd)['state'],b)
 def test_legal_passes(self):
  for kind,t in [('ADVANCE_AFTER_COMBAT','PASS_ADVANCE'),('BREAKTHROUGH_OPTION','PASS_BREAKTHROUGH'),('SCHWERPUNKT_OPTION','PASS_SCHWERPUNKT')]:
   b=pending(CASES[kind]);x=run(b,dict(type=t,battleId=b['core']['pendingDecision']['battleId']));self.assertEqual(x['logistics']['action_spent'],b['logistics']['action_spent'])
 def test_pending_permission_and_no_enemy_diagnostics(self):
  for rec in CASES.values():
   b=pending(rec);server.state=b;p=b['core']['pendingDecision'];owner=server.ACTIVE[p['side']];other='S' if owner=='G' else 'G';self.assertIsNone(server.public(other)['state']['pending']);v=server.public(owner)['state'];self.assertEqual(v['pending']['kind'],p['kind']);self.assertNotIn('context',v['pending']);self.assertNotIn('random',v);self.assertTrue(all(u['side']==owner for u in v['units']));self.assertNotIn('combatTransactions',v)
 def test_old_mode_cost_isolation(self):
  b=run(scene('prepare','old'),{'type':'END_PHASE'});a=CASES['DEFENDER_REACTION']['actions'][0];b=run(b,a)
  for _ in range(15):
   if not b['core']['pendingDecision']:break
   opts=json.loads(subprocess.check_output(['node',str(ROOT/'choice-probe.mjs')],input=json.dumps(b['core']).encode()));b=run(b,opts[-1])
  self.assertEqual(b['logistics']['action_spent'],0);self.assertEqual(b['logistics']['tick'],0);self.assertNotIn('expSupplyMode',b['core'])
 def test_payment_factor_locked_until_reaction(self):
  rec=CASES['DEFENDER_REACTION'];b=pending(rec);p=b['core']['pendingDecision'];tx=b['core']['combatTransactions'][p['battleId']];f={i:b['core']['units'][i]['expSupply']['attackFactor'] for i in tx['attackerUnitIds']};x=node(b['core'],'new',b['logistics'])['frame']['state'];self.assertEqual(f,{i:x['units'][i]['expSupply']['attackFactor'] for i in f})
if __name__=='__main__':unittest.main()

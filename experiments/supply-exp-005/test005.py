import unittest,json,time
from copy import deepcopy
from unittest.mock import patch
from live import *
from bounded import warm_start,close_worker
from exercise import run,cell
from display import player_display

def scene(clip='prepare',mode='new'):return json.loads((ROOT/'data/playable'/f'{clip}-{mode}.json').read_text())['state']
class SeamTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):warm_start()
 @classmethod
 def tearDownClass(cls):close_worker()
 def test_real_move_fee_and_duplicate(self):
  b=scene();u=next(u for u in b['logistics']['units'] if u['core_type']=='PANZER');opts=node(b['core'],'new',b['logistics'],'options',unit=u['id'],side='G')['options'];a=auto_command(b);a['action']=dict(type='MOVE',controllerId=b['core']['units'][u['id']]['controllerId'],unitId=u['id'],path=opts[0]['coords']);r=execute(b,a);self.assertTrue(r['ok'],r.get('error'));end=r['state'];self.assertEqual(end['logistics']['action_spent'],4);self.assertNotEqual(end['core']['units'][u['id']]['hex'],b['core']['units'][u['id']]['hex']);audit(end['logistics']);self.assertEqual(execute(end,a)['state'],end)
  conflict=deepcopy(a);conflict['action']['path']=[];self.assertFalse(execute(end,conflict)['ok'])
 def test_movement_cap_actual_rejection(self):
  n=scene('isolation');o=scene('isolation','old');u='G-MOT-02';opts=node(o['core'],'old',o['logistics'],'options',unit=u,side='G')['options'];p=next(x for x in opts if x['cost']>1);a=auto_command(n);a['action']=dict(type='MOVE',controllerId=n['core']['units'][u]['controllerId'],unitId=u,path=p['coords']);r=execute(n,a);self.assertFalse(r['ok']);self.assertEqual(r['state'],n);a['revision']=o['revision'];self.assertTrue(execute(o,a)['ok'])
 def test_whole_transaction_timeout(self):
  b=scene();a=auto_command(b);r=execute(b,a,.001);self.assertFalse(r['ok']);self.assertEqual(r['state'],b)
 def test_failure_after_core_accept_before_supply_commit(self):
  b=run(scene('restore'),{'type':'END_SIDE'});a=auto_command(b)
  with patch('live.logistics_transaction',return_value={'ok':False}):r=execute(b,a)
  self.assertFalse(r['ok']);self.assertEqual(r['state'],b);self.assertEqual(r['state']['core']['random'],b['core']['random'])
 def test_failure_after_dice_roll(self):
  import live
  b=run(scene('isolation'),{'type':'END_PHASE'});action=json.loads((ROOT/'data/combat-example.json').read_text());cmd=auto_command(b);cmd['action']=action;real=live.node;rolled=[]
  def fail_frame(core,mode,s,op='frame',deadline=None,**kw):
   if op=='frame':raise TimeoutError('injected after resolved combat')
   r=real(core,mode,s,op,deadline,**kw);rolled.append(r['frame']['state']['random']);return r
  with patch('live.node',side_effect=fail_frame):r=execute(b,cmd)
  self.assertTrue(rolled);self.assertNotEqual(rolled[0],b['core']['random']);self.assertFalse(r['ok']);self.assertEqual(r['state'],b)
 def test_clock_only_full_turn_and_no_repeat(self):
  b=scene();x=run(b,{'type':'END_SIDE'});self.assertEqual(x['logistics']['tick'],0);a=auto_command(x);r=execute(x,a);self.assertTrue(r['ok']);y=r['state'];self.assertEqual(y['logistics']['tick'],1);self.assertEqual(execute(y,a)['state'],y);audit(y['logistics'])
 def test_old_mode_no_new_spend(self):
  b=scene(mode='old');x=run(run(b,{'type':'END_SIDE'}),{'type':'END_SIDE'});self.assertEqual(x['logistics']['tick'],0);self.assertEqual(x['logistics']['action_spent'],0);self.assertNotIn('expSupplyMode',x['core'])
 def test_core_attribution_and_recovery(self):
  x=json.loads((ROOT/'evidence/exercise.json').read_text());a,b=x['combat'];self.assertEqual(a['before_rng'],b['before_rng']);self.assertEqual(a['after_rng'],b['after_rng']);self.assertNotEqual(a['context']['attackStrength'],b['context']['attackStrength']);self.assertTrue(a['journal']['charges']);
  rows=x['restore'];self.assertTrue(any(Fraction(u['debt'])<2 for u in rows[-1]['units'] if u['id']=='G-MOT-03'))
 def test_actual_attrition_once(self):
  b=scene('isolation');uid='G-I-01';before=b['core']['units'][uid]['step'];b=run(b,{'type':'END_SIDE'});cmd=auto_command(b);r=execute(b,cmd);self.assertTrue(r['ok']);b=r['state'];self.assertEqual(b['core']['units'][uid]['step'],before+1);self.assertEqual(execute(b,cmd)['state'],b);self.assertTrue(b['journal'][-1]['supply_events']);audit(b['logistics'])
 def test_repair_not_instant_refresh(self):
  b=scene('restore');edge=next(e['core']['key'] for e in __import__('realmap').MAP['edges'] if {e['a'],e['b']}=={'C10','D10'});x=run(b,{'type':'RAIL_REPAIR','edgeKeys':[edge]});self.assertEqual(x['logistics']['tick'],b['logistics']['tick']);self.assertEqual([(u['stock'],u['debt']) for u in x['logistics']['units']],[(u['stock'],u['debt']) for u in b['logistics']['units']])
 def test_replay(self):
  b=scene();initial=deepcopy(b)
  for _ in range(2):b=run(b,{'type':'END_SIDE'})
  x=initial
  for j in b['journal'][len(initial['journal']):]:
   r=execute(x,j['command']);self.assertTrue(r['ok']);x=r['state'];self.assertEqual(hash_bundle(x),j['hash'])
  self.assertEqual(hash_bundle(x),hash_bundle(b))
 def test_privacy_hidden_pair_candidates(self):
  p=json.loads((ROOT/'data/hidden-pairs.json').read_text())[10]
  bundles=[]
  for f in [FRAMES[p['before']],p['after']]:
   FRAMES['__pair']=f
   s=start('__pair',reserve=2,delivery_range=8);s.update(action_spent=0,action_ledger=[]);r=node(f['state'],'new',s);s=sync(s,r['frame']);s['name']='pair';s['scenario']='pair';bundles.append((r['frame']['state'],s));del FRAMES['__pair']
  a,b=bundles;self.assertEqual(player_display(a[1]),player_display(b[1]));uid=next(u['id'] for u in a[1]['units'] if u['side']=='G');self.assertEqual(node(a[0],'new',a[1],'options',unit=uid,side='G'),node(b[0],'new',b[1],'options',unit=uid,side='G'))
if __name__=='__main__':unittest.main()

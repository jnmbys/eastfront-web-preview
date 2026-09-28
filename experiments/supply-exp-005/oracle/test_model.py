import unittest,json
from copy import deepcopy
from itertools import product
from model import *
from scenarios import *

def tiny(cap=3):
 s=scenario();s['nodes']=s['nodes'][:1];s['nodes'][0]['id']='R';s['edges']=[]
 s['sources']=[dict(id='rear',node='R',side='G',cap=cap)]
 s['hubs']=[dict(id='H',node='R',side='G',stock=0,cap=0,W=100,quota=100,range=1,floor=0)]
 s['units']=[dict(id='G'+str(i),node='R',side='G',B=2,stock=0,cap=4,target=4,debt='0',priority=1,strength=3) for i in range(2)]
 s['use_t']=False
 return s

class ModelTests(unittest.TestCase):
 def test_shared_trunk(self):
  s=scenario();r=solve(s);self.assertEqual(sum(r['deliveries'].values()),24)
  self.assertTrue(all(c['used']<=c['cap'] for c in r['constraints']))
 def test_overlap_no_duplicate(self):
  s=scenario();s['units']=s['units'][:1];s['units'][0].update(B=4,cap=4,target=4)
  r=solve(s);self.assertEqual(r['deliveries']['G1'],4);self.assertEqual(sum(f['q'] for f in r['flows'] if f['kind']=='last'),4)
 def test_shared_bridge(self):
  s=scenario();next(e for e in s['edges'] if e['id']=='bridge')['bridge_cap']=5
  self.assertEqual(sum(solve(s)['deliveries'].values()),5)
 def test_isolated_store(self):
  s=scenario('cut_repair');r=solve(s);self.assertEqual(sum(r['deliveries'].values()),16)
  self.assertFalse(any(f['kind']=='rail' for f in r['flows']))
 def test_capture_loss_no_loot(self):
  s=scenario('cut_repair');s=capture(s,'HA','S');self.assertEqual(s['losses'][-1]['lost'],8)
  self.assertEqual(sum(solve(s)['deliveries'].values()),8)
  s=capture(s,'HA','G');self.assertEqual(s['losses'][-1]['lost'],0)
 def test_backup(self):
  s=scenario('hub_backup');self.assertEqual(sum(solve(s)['deliveries'].values()),8)
  next(e for e in s['edges'] if e['id']=='backup')['cut']=True
  self.assertEqual(sum(solve(s)['deliveries'].values()),0)
 def test_storage_caps(self):
  s=scenario('breakthrough');r=solve(s)
  self.assertTrue(all(r['hubs'][h['id']]<=h['cap'] for h in s['hubs']))
 def test_maintenance_before_priority_and_floor(self):
  s=scenario();s['policy']='floor';s['units'][0]['priority']=9
  r=solve(s);self.assertEqual(list(r['deliveries'].values()),[8,8,8]);self.assertEqual(sum(r['hubs'].values()),0)
 def test_idempotence(self):
  s=scenario();s,r,_=settle(s,'L0');before=digest(s);ss,rr,duplicate=settle(s,'L0')
  self.assertTrue(duplicate);self.assertEqual(before,digest(ss));self.assertEqual(r,rr)
 def test_replay(self):
  def run():
   s=scenario('cut_repair');s=attack(s,'G','a');s=advance(s,'b');s=advance(s,'c');return s
  self.assertEqual(digest(run()),digest(run()))
 def test_attack_id_and_turn_gate(self):
  s=scenario('pocket');a=attack(s,'G','x');self.assertEqual(digest(a),digest(attack(a,'G','x')))
  b=attack(a,'G','y');self.assertEqual([u['stock'] for u in a['units']],[u['stock'] for u in b['units']])
 def test_pending_and_gameover(self):
  for k in ['pending','game_over']:
   s=scenario();s[k]=True
   with self.assertRaises(ValueError):settle(s,'L0')
   with self.assertRaises(ValueError):attack(s,'G','a')
   with self.assertRaises(ValueError):advance(s,'a')
 def test_half_budgets_odd(self):
  s=scenario(clock='half');a=budget(7,s);s['tick']=1;self.assertEqual(a+budget(7,s),7)
 def test_half_maintenance_debt(self):
  a=scenario('pocket',clock='full');b=scenario('pocket',clock='half')
  for s in [a,b]:
   for u in s['units']:u['stock']=0
  a,_,_=settle(a,'L0');b,_,_=settle(b,'L0');b,_,_=settle(b,'L1')
  self.assertEqual(a['units'][0]['debt'],b['units'][0]['debt'])
 def test_projection_noninterference(self):
  a=scenario();next(n for n in a['nodes'] if n['id']=='P')['known']=False
  b=deepcopy(a);b['hidden']={'P':{'occupied':True,'zoc':True}}
  self.assertEqual(project(a),project(b));pa=solve(project(a));pb=solve(project(b));pa.pop('ms');pb.pop('ms');self.assertEqual(pa,pb)
  self.assertGreater(sum(solve(a)['deliveries'].values()),sum(solve(b)['deliveries'].values()))
  self.assertTrue(pa['conditional'])
 def test_projection_enemy_private_removed(self):
  s=timing_scenario();v=project(s);self.assertFalse(any(u['side']=='S' for u in v['units']));self.assertNotIn('hidden',v)
 def test_exits(self):
  s=scenario('pocket');s['units'][0]['debt']='2';e=exits(s,'G1')
  self.assertFalse(any(x['legal'] for x in e));self.assertEqual(len(e),4)
  next(x for x in s['edges'] if x['id']=='river_exit').update(cut=False,move_cost=1)
  self.assertTrue(next(x for x in exits(s,'G1') if x['edge']=='river_exit')['legal'])
  s['hidden']={'FR':{'zoc':True}};self.assertFalse(next(x for x in exits(s,'G1') if x['edge']=='river_exit')['legal'])
 def test_bruteforce_oracle(self):
  # Independent exhaustive integer allocation checks all tiny capacities and rotations.
  for cap in range(1,9):
   for rotation in (0,1):
    s=tiny(cap);s['rotation']=rotation;r=solve(s);got=tuple(r['deliveries']['G'+str(i)] for i in range(2))
    def key(xs):return (min(min(x,2)/2 for x in xs),sum(min(x,2) for x in xs),sum(xs),sum((2-((i-rotation)%2))*x for i,x in enumerate(xs)))
    feasible=[x for x in product(range(5),repeat=2) if sum(x)<=cap];self.assertEqual(key(got),max(map(key,feasible)))
 def test_full_enumeration_finds_longer_route(self):
  s=scenario('hub_backup');self.assertTrue(any('backup' in f['edges'] for f in solve(s)['flows']))
 def test_low_capacity_conservation(self):
  for cap in (0,1,5,12,24):
   s=scenario();next(e for e in s['edges'] if e['id']=='trunk')['cap']=cap;r=solve(s)
   self.assertLessEqual(sum(r['deliveries'].values()),cap)
 def test_B_no_warehouse(self):
  s=scenario('breakthrough',variant='B');self.assertEqual(sum(solve(s)['hubs'].values()),0)
 def test_global_material_balance(self):
  for key in NAMES:
   s=scenario(key);r=solve(s)
   old=sum(h['stock'] for h in s['hubs'] if h['side']=='G' and not h.get('inactive'))
   received=sum(f['q'] for f in r['flows'] if f['kind']=='rail')
   delivered=sum(r['deliveries'].values());new=sum(r['hubs'].values())
   self.assertEqual(old+received,delivered+new)
 def test_path_guard_rejects_not_truncates(self):
  s=tiny();s['nodes']=[dict(id=str(i),control='G') for i in range(12)]
  s['edges']=[dict(id=f'{a}-{b}',a=str(a),b=str(b),modes=['rail'],cap=100,rail_cost=1) for a in range(12) for b in range(a+1,12)]
  with self.assertRaises(UnsupportedGraph):paths(s,'0','11','rail','G')
 def test_inactive_side_cannot_attack(self):
  s=scenario(order='SG')
  with self.assertRaises(ValueError):attack(s,'G','bad')
 def test_stale_epoch(self):
  with self.assertRaises(ValueError):settle(scenario(),'L8')
 def test_T_extra_constraint(self):
  s=scenario();s['T']=24;a=sum(solve(s)['deliveries'].values());s['use_t']=False;b=sum(solve(s)['deliveries'].values());self.assertLess(a,b)

if __name__=='__main__':unittest.main(verbosity=2)

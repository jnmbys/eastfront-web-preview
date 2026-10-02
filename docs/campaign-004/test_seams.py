"""Targeted saved-evidence checks plus exact replay through the unchanged authority.
python docs/campaign-004/test_seams.py
No server, extra campaign policy, parameter scan, or synthetic state mutation.
"""
import unittest,sys,json,gzip,hashlib,time,subprocess
from pathlib import Path
from copy import deepcopy
HERE=Path(__file__).resolve().parent
EXP=HERE/'.runtime/experiments/supply-exp-005'
sys.path.insert(0,str(EXP))
from campaign import create_campaign,CONFIG
from live import execute,hash_bundle,audit
from bounded import warm_start,close_worker
from analyze import load,save

class Seams(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.cp=load('CHECKPOINTS.json.gz');cls.acts=load('ACTIONS.json.gz');cls.q=load('QUERIES.json.gz');cls.f=load('FACTS.json')

 def test_01_full_army_and_parameters(self):
  for side,n,maintenance,gap in [('G',26,33,9),('S',32,38,14)]:
   a=self.f['army'][side]
   self.assertEqual((a['count'],a['maintenance_SP'],a['source_cap_SP'],a['unavoidable_source_gap_SP']),(n,maintenance,24,gap))
  self.assertEqual(self.f['map']['hex_count'],640)
  self.assertEqual(self.f['map']['map_sha256'],self.f['map']['layout_map_sha256'])
  self.assertEqual(len(self.q['full_roster_T1']['slots']),13)
  for b in self.cp.values():
   self.assertEqual(b['logistics']['campaign_config'],CONFIG)
   self.assertEqual(b['logistics']['sources'],CONFIG['sources'])
   self.assertEqual(b['logistics']['policy'],'last')
   self.assertEqual(b['logistics']['T'],2200)
   for e in b['logistics']['edges']:
    self.assertEqual(e['cap'],40)
    self.assertEqual(e['bridge_cap'],24 if e['bridge'] else None)

 def test_02_authority_rejections_are_atomic(self):
  rejected=[r for r in self.acts if not r['accepted']]
  self.assertEqual(len(rejected),14)
  for r in rejected:
   self.assertEqual(r['before_hash'],r['after_hash'],r['label'])
   self.assertEqual(r['before'],r['after'],r['label'])
  expected={'industrial_order_unsupported':'unsupported surface','industrial_entry_unsupported':'unsupported surface',
   'damaged_supplied_without_base_rejected':'RECOVERY_BASE_TOO_FAR','unknown_industrial_slot_rejected':'REINFORCEMENT_SLOT_UNKNOWN',
   'existing_slot_duplicate_rejected':'REINFORCEMENT_ALREADY_DEPLOYED'}
  for site in ['J7','M14','R9','AD9','AC10']:expected['non_entry_'+site+'_rejected']='REINFORCEMENT_ENTRY_NOT_EAST_EXIT'
  for label,error in expected.items():self.assertIn(error,next(r['error'] for r in rejected if r['label']==label))

 def test_03_real_damage_delivery_repair_and_later_action(self):
  target='G-I-01'
  unit=lambda b: b['core']['units'][target]
  self.assertEqual(unit(self.cp['full_roster_T1'])['step'],0)
  self.assertEqual(unit(self.cp['post_battle'])['step'],1)
  self.assertEqual(self.q['full_roster_T1']['bases']['GERMAN'],[])
  self.assertIn('C10',self.q['after_rail_opening']['bases']['GERMAN'])
  repair=next(r for r in self.acts if r['label']=='actual_RP_repair')
  self.assertTrue(repair['accepted']);self.assertEqual(repair['before']['phase'],'GERMAN_RECOVERY')
  self.assertEqual(repair['before']['turn'],5)
  self.assertEqual(repair['before']['rp']['GERMAN']-repair['after']['rp']['GERMAN'],1)
  resources=lambda rows:[{k:v for k,v in u.items() if k!='strength'} for u in rows]
  self.assertEqual(resources(repair['before']['stock']),resources(repair['after']['stock']))
  self.assertEqual(next(u['strength'] for u in repair['before']['stock'] if u['id']==target),2)
  self.assertEqual(next(u['strength'] for u in repair['after']['stock'] if u['id']==target),3)
  self.assertEqual(unit(self.cp['repaired'])['step'],0)
  move=next(r for r in self.acts if r['label']=='repaired_unit_subsequent_move')
  self.assertEqual((move['before']['turn'],move['before']['phase']),(6,'GERMAN_MOVEMENT'))
  self.assertTrue(move['accepted']);self.assertTrue(unit(self.cp['after_repaired_move'])['hasMoved'])
  self.assertNotEqual(unit(self.cp['repaired'])['hex'],unit(self.cp['after_repaired_move'])['hex'])
  delivery=self.f['settlements'][0]['damaged_target']
  self.assertEqual((delivery['before'],delivery['received'],delivery['maintenance'],delivery['after']),(8,8,4,12))

 def test_04_scheduled_entry_is_not_industrial_formation(self):
  before=self.cp['before_existing_reinforcement'];after=self.cp['after_existing_reinforcement']
  added=set(after['core']['units'])-set(before['core']['units']);self.assertEqual(len(added),2)
  for uid in added:
   u=next(u for u in after['logistics']['units'] if u['id']==uid)
   self.assertEqual((u['stock'],u['debt']),(0,'0'))
   self.assertFalse(after['core']['units'][uid]['hasMoved']);self.assertFalse(after['core']['units'][uid]['hasAttacked'])
  self.assertEqual(before['core']['rp'],after['core']['rp'])
  r=next(r for r in self.acts if r['label']=='existing_reinforcement_same_turn_move')
  self.assertTrue(r['accepted']);self.assertEqual((r['before']['turn'],r['before']['phase']),(4,'SOVIET_MOVEMENT'))
  u=next(u for u in r['before']['stock'] if u['id']==r['command']['action']['unitId']);self.assertEqual(u['stock'],0)

 def test_05_no_facility_authorization_and_actual_graph(self):
  for site in ['J7','M14','R9','AD9']:
   x=next(h for h in self.q['full_roster_T1']['siteFacts'] if h['id']==site)
   self.assertFalse(x['recoveryBaseG']);self.assertFalse(x['recoveryBaseS'])
   self.assertNotIn(site,self.q['full_roster_T1']['sovietEntryBoardFacts'])
   self.assertFalse(any(a['node']==site for a in CONFIG['sources']))
   self.assertFalse(any(site in ns for ns in CONFIG['hub_nodes'].values()))
  for pair in self.q['full_roster_T1']['pairs']:
   e=pair['coreEdge'];self.assertFalse(e and (e['road'] or e['railway']))
  edges=self.f['topology']['after_rail_opening']['model_graph']['G']['source_to_hub']
  path=next(x for x in edges if x['source']=='G-A10' and x['hub']=='GH2')['edges']
  self.assertEqual(path,['A10~B10','B10~C10'])

 def test_06_frozen_runtime_and_accounting(self):
  provenance=load('PROVENANCE.json')
  for path,h in provenance['runtime_files_sha256'].items():self.assertEqual(hashlib.sha256((HERE/'.runtime'/path).read_bytes()).hexdigest(),h,path)
  for path,h in provenance['compiled_sha256'].items():self.assertEqual(hashlib.sha256((EXP/path).read_bytes()).hexdigest(),h,path)
  for b in self.cp.values():
   a=audit(b['logistics'])
   self.assertEqual(a['initial']+a['injected'],a['maintenance']+a['action']+a['destroyed']+a['remaining'])
  for e in load('SETTLEMENTS.json.gz'):
   for r in e['ledger']:
    self.assertTrue(r['exact'])
    for c in r['constraints']:self.assertLessEqual(c['used'],c['cap'],c['id'])
    for u in r['units']:self.assertEqual(u['before']+u['received'],u['maintenance']+u['after'])

 def test_07_missing_equipment_and_PE_interfaces_reject(self):
  b=self.cp['german_recovery_T5'];snapshot=deepcopy(b);records=[]
  for i,action in enumerate([
    {'type':'DISPATCH_EQUIPMENT','sourceId':'G-A10','receiverId':'J7','equipment':1},
    {'type':'REPAIR_UNIT','unitId':'G-I-01','personnel':1,'equipment':1},
    {'type':'PAY_RESERVE_MAINTENANCE','orderId':'IND-TEST','sourceId':'G-A10'},
  ]):
   cmd=dict(id='gap-'+str(i),revision=b['revision'],action={'controllerId':'G-HUMAN-1',**action})
   r=execute(b,cmd);self.assertFalse(r['ok']);self.assertEqual(r['error'],'unsupported surface');self.assertEqual(r['state'],snapshot)
   records.append(dict(command=cmd,accepted=r['ok'],error=r['error'],before_hash=hash_bundle(b),after_hash=hash_bundle(r['state']),phase=b['core']['phase'],turn=b['core']['turn']))
  save('INTERFACE_REJECTIONS.json',dict(note='Probe names express requested capabilities; they are not proposed protocol additions.',records=records))

 def test_08_exact_authority_replay(self):
  warm_start();b=create_campaign('new',17);self.assertEqual(b,load('INITIAL.json.gz'));checks=[];started=time.perf_counter()
  try:
   for row in self.acts:
    self.assertEqual(hash_bundle(b),row['before_hash'],row['label'])
    r=execute(b,row['command']);self.assertEqual(r['ok'],row['accepted'],(row['label'],r.get('error')))
    self.assertEqual(r.get('error'),row['error']);b=r['state']
    self.assertEqual(hash_bundle(b),row['after_hash'],row['label']);audit(b['logistics'])
    checks.append(dict(label=row['label'],accepted=r['ok'],hash=row['after_hash']))
   self.assertEqual(b,self.cp['final'])
   save('REPLAY.json',dict(status='PASS_EXACT_AUTHORITY_REPLAY',commands=len(checks),seconds=time.perf_counter()-started,
    initial_hash=hash_bundle(load('INITIAL.json.gz')),final_hash=hash_bundle(b),checks=checks))
  finally:close_worker()

 def test_09_real_canonical_map(self):
  report=json.loads(subprocess.check_output(['node',str(HERE/'verify_map.mjs')],cwd=HERE))
  self.assertEqual(report['status'],'PASS');self.assertEqual(report['hexes'],640)

if __name__=='__main__':
 suite=unittest.defaultTestLoader.loadTestsFromTestCase(Seams)
 result=unittest.TextTestRunner(verbosity=2).run(suite)
 save('TEST_RESULTS.json',dict(status='PASS' if result.wasSuccessful() else 'FAIL',tests=result.testsRun,
  failures=[(str(t),msg) for t,msg in result.failures],errors=[(str(t),msg) for t,msg in result.errors],
  scope='Local immutable source, real Core/solver calls and saved receipts; no HTTP, concurrency, deployment or balance certification'))
 sys.exit(0 if result.wasSuccessful() else 1)

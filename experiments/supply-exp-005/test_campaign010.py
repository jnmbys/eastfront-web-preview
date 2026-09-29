"""Seam tests; scripted passive lifecycle is not AI or a balance game."""
import unittest,json,time
from campaign import *
from bounded import warm_start,close_worker
class CampaignTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):warm_start()
 @classmethod
 def tearDownClass(cls):close_worker()
 def test_lifecycle(self):
  reports=[]
  for mode in ['new','old']:
   b=create_campaign(mode);initial=deepcopy(b);timings=[];records=[];reinforced=0;settlements=0
   def apply(a):
    nonlocal b,settlements
    cmd=auto_command(b);cmd['action'].update(a);r=execute(b,cmd)
    if not r['ok']:
     Path('evidence/campaign010-stop.json').write_text(json.dumps(dict(mode=mode,turn=b['core']['turn'],phase=b['core']['phase'],revision=b['revision'],action=a,error=r.get('error'),seconds=r['seconds'])));self.fail(str(r.get('error')))
    b=r['state'];audit(b['logistics']);settlements+=int(b['journal'][-1]['settled']);timings.append(r['seconds']);records.append(dict(command=cmd,hash=hash_bundle(b)))
   # Exact Core production smoke deployment pattern, scripted and no opponent inspection.
   for side in ['S','G']:
    md=metadata(b['core'],side);zone=md['deployment']['zone'];roster=sorted(md['deployment']['roster'],key=lambda u:u['id'])
    for i,u in enumerate(roster):
     apply(dict(type='DEPLOY_INITIAL_UNIT',deploymentUnitId=u['id'],hex=zone[i//2]))
     lu=next(x for x in b['logistics']['units'] if x['id']==u['id']);self.assertEqual(lu['stock'],3*lu['B'])
    apply(dict(type='READY_FOR_PHASE_END'))
   self.assertEqual(b['core']['turn'],1);self.assertEqual(b['logistics']['tick'],0)
   # Repeat request is inert; altered same id/stale/late-timeout cannot commit.
   last=b['journal'][-1]['command'];dup=execute(b,last);self.assertTrue(dup['duplicate']);self.assertEqual(dup['state'],b)
   conflict=deepcopy(last);conflict['action']['type']='END_PHASE';self.assertFalse(execute(b,conflict)['ok'])
   cmd=auto_command(b,'END_PHASE');r=execute(b,cmd,.001);self.assertFalse(r['ok']);self.assertEqual(r['state'],b);warm_start()
   safe=campaign_view(b,'G');self.assertTrue(all(u['side']=='G' for u in safe['units']));self.assertNotIn('core',safe);self.assertNotIn('journal',safe)
   while b['core']['phase']!='GAME_OVER' and b['revision']<300:
    self.assertIsNone(b['core']['pendingDecision'])
    if b['core']['phase']=='SOVIET_REINFORCEMENT_SUPPLY':
     md=metadata(b['core'],'S')
     for slot in md['reinforcements']:
      # Public entry order, each success is a real canonical Action. Core may reject occupied entries.
      for h in md['entry_hexes']:
       cmd=auto_command(b);cmd['action'].update(type='DEPLOY_REINFORCEMENT',reinforcementId=slot['id'],entryHex=h);r=execute(b,cmd)
       if r['ok']:
        old=set(u['id'] for u in b['logistics']['units']);b=r['state'];audit(b['logistics']);added=[u for u in b['logistics']['units'] if u['id'] not in old];self.assertTrue(added);self.assertTrue(all(u['stock']==0 for u in added));reinforced+=len(added);timings.append(r['seconds']);records.append(dict(command=cmd,hash=hash_bundle(b)));break
       self.assertEqual(r['state'],b)
    apply(dict(type='END_PHASE'))
   self.assertEqual(b['core']['phase'],'GAME_OVER');self.assertEqual(b['core']['turn'],16);self.assertEqual(b['core']['victory']['winner'],'SOVIET')
   self.assertEqual(settlements,15 if mode=='new' else 0);self.assertGreater(reinforced,0)
   before=deepcopy(b);self.assertFalse(execute(b,auto_command(b,'END_PHASE'))['ok']);self.assertEqual(b,before)
   # Complete adapter replay includes logistics damage and same canonical terminal checkpoint.
   replay=initial
   for row in records:
    r=execute(replay,row['command']);self.assertTrue(r['ok'],r.get('error'));replay=r['state'];self.assertEqual(hash_bundle(replay),row['hash'])
   self.assertEqual(hash_bundle(replay),hash_bundle(b))
   out=dict(mode=mode,seed=17,profile=CONFIG,initial_hash=hash_bundle(initial),records=records,final_hash=hash_bundle(b),victory=b['core']['victory'],settlements=settlements,reinforced=reinforced,retired=len(b['logistics']['continuity']['retired']),audit=audit(b['logistics']),seconds=timings)
   Path('evidence/campaign010-'+mode+'.json').write_text(json.dumps(out,ensure_ascii=False,indent=2));reports.append({k:v for k,v in out.items() if k not in ['records','profile','seconds']});print(json.dumps(reports[-1]),flush=True)
  Path('evidence/campaign010-summary.json').write_text(json.dumps(reports,indent=2))
if __name__=='__main__':unittest.main()

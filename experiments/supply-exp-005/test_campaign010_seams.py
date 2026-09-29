import unittest,json,subprocess,importlib.util,threading,urllib.request
from copy import deepcopy
from campaign import *
from bounded import warm_start,close_worker
from test006 import CASES,initial
class CampaignSeams(unittest.TestCase):
 @classmethod
 def setUpClass(cls):warm_start()
 @classmethod
 def tearDownClass(cls):close_worker()
 def test_forced_battle_campaign_replay(self):
  rec=CASES['SECOND_ATTACK'];b=initial(rec);b['logistics']['campaign_config']=deepcopy(CONFIG);start_b=deepcopy(b);kinds=[]
  def action(a):
   nonlocal b
   cmd=auto_command(b);cmd['action'].update(a);r=execute(b,cmd);self.assertTrue(r['ok'],r.get('error'));b=r['state'];audit(b['logistics'])
  for a in [*rec['actions'],rec['choice']]:action(a)
  for _ in range(25):
   p=b['core']['pendingDecision']
   if not p:break
   kinds.append(p['kind']);before=deepcopy(b);r=execute(b,auto_command(b,'END_PHASE'));self.assertFalse(r['ok']);self.assertEqual(r['state'],before)
   opts=json.loads(subprocess.check_output(['node',str(ROOT/'choice-probe.mjs')],input=json.dumps(b['core']).encode()));self.assertTrue(opts);action(opts[-1])
  self.assertIsNone(b['core']['pendingDecision'])
  action({'type':'END_SIDE'});action({'type':'END_SIDE'});self.assertEqual(b['logistics']['tick'],start_b['logistics']['tick']+1)
  x=start_b
  for j in b['journal'][len(start_b['journal']):]:
   r=execute(x,j['command']);self.assertTrue(r['ok'],r.get('error'));x=r['state'];self.assertEqual(hash_bundle(x),j['hash'])
  Path('evidence/campaign010-combat.json').write_text(json.dumps(dict(test='focused inherited EXP006 battle fixture, not a full campaign',pending_kinds=kinds,commands=[j['command'] for j in b['journal'][len(start_b['journal']):]],equal=hash_bundle(x)==hash_bundle(b),audit=audit(b['logistics'])),indent=2))
 def test_deployment_filter_and_reposition_no_mint(self):
  b=create_campaign();m=metadata(b['core'],'S');u=m['deployment']['roster'][0]['id'];h=m['deployment']['zone'][0]
  cmd=auto_command(b);cmd['action'].update(type='DEPLOY_INITIAL_UNIT',deploymentUnitId=u,hex=h);r=execute(b,cmd);self.assertTrue(r['ok']);b=r['state'];stock=material(b['logistics']);before_initial=b['logistics']['continuity']['initial']
  cmd=auto_command(b);cmd['action'].update(type='DEPLOY_INITIAL_UNIT',deploymentUnitId=u,hex=m['deployment']['zone'][1]);r=execute(b,cmd)
  # Core may permit reposition or reject it; either path cannot mint supply.
  b=r['state'];self.assertEqual(material(b['logistics']),stock);self.assertEqual(b['logistics']['continuity']['initial'],before_initial)
  g=campaign_view(b,'G');self.assertFalse(g['units']);self.assertFalse(g['contacts']);self.assertTrue(all(u['side']=='GERMAN' for u in g['campaign']['deployment']['roster']))
  wrong=auto_command(b);wrong['action']['controllerId']='G-HUMAN-1';self.assertFalse(execute(b,wrong)['ok'])
 def test_loss_and_retreat_still_block_until_player_choice(self):
  rows=[]
  for name in ['LOSS_ALLOCATION','MOVING_RETREAT']:
   rec=CASES[name];b=initial(rec);b['logistics']['campaign_config']=deepcopy(CONFIG)
   for a in rec['actions']:
    cmd=auto_command(b);cmd['action'].update(a);r=execute(b,cmd);self.assertTrue(r['ok'],r.get('error'));b=r['state']
   self.assertIsNotNone(b['core']['pendingDecision']);r=execute(b,auto_command(b,'END_SIDE'));self.assertFalse(r['ok']);self.assertEqual(r['state'],b)
   cmd=auto_command(b);cmd['action'].update(rec['choice']);r=execute(b,cmd);self.assertTrue(r['ok'],r.get('error'));audit(r['state']['logistics']);rows.append(dict(kind=name,blocked_end=True,choice_accepted=True))
  Path('evidence/campaign010-forced.json').write_text(json.dumps(rows,indent=2))
 def test_deployment_late_failure_is_atomic(self):
  from unittest.mock import patch
  import live
  b=create_campaign();md=metadata(b['core'],'S');cmd=auto_command(b);cmd['action'].update(type='DEPLOY_INITIAL_UNIT',deploymentUnitId=md['deployment']['roster'][0]['id'],hex=md['deployment']['zone'][0]);real=live.node;seen=[]
  def fail(core,mode,s,op='frame',deadline=None,**kw):
   if op=='frame':
    seen.append(s['continuity']['initial']);raise TimeoutError('after Core placement and stock credit')
   return real(core,mode,s,op,deadline,**kw)
  with patch('live.node',side_effect=fail):r=execute(b,cmd)
  self.assertTrue(seen);self.assertGreater(seen[0],b['logistics']['continuity']['initial']);self.assertFalse(r['ok']);self.assertEqual(r['state'],b);self.assertEqual(b['revision'],0);self.assertFalse(b['core']['units'])
 def test_http_entry(self):
  spec=importlib.util.spec_from_file_location('campaign_server',ROOT/'campaign-server.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);srvmod=mod.server
  srvmod.state,srvmod.initial=mod.load('campaign','new');srvmod.receipt=None;srvmod.error=None
  http=srvmod.HTTPServer(('127.0.0.1',0),mod.Handler);thread=threading.Thread(target=http.serve_forever,daemon=True);thread.start();url='http://127.0.0.1:'+str(http.server_port)
  try:
   html=urllib.request.urlopen(url).read().decode();self.assertIn('campaign-ui.js',html);self.assertIn('<option value="S" selected>',html)
   from urllib.error import HTTPError
   with self.assertRaises(HTTPError) as caught:urllib.request.urlopen(url+'/replay?debug=1')
   self.assertEqual(caught.exception.code,404)
   d=json.load(urllib.request.urlopen(url+'/api?viewer=S'));self.assertEqual(len(d['state']['campaign']['deployment']['roster']),32)
   md=d['state']['campaign'];cmd=dict(op='action',viewer='S',id='http-deploy',revision=0,action=dict(type='DEPLOY_INITIAL_UNIT',deploymentUnitId=md['deployment']['roster'][0]['id'],hex=md['deployment']['zone'][0]))
   req=urllib.request.Request(url+'/api',data=json.dumps(cmd).encode(),headers={'Content-Type':'application/json'});r=json.load(urllib.request.urlopen(req));self.assertIsNone(r['error']);self.assertEqual(r['state']['revision'],1)
   self.assertEqual(len(r['state']['units']),1);self.assertNotIn('core',r['state']);self.assertNotIn('journal',r['state'])
  finally:http.shutdown();http.server_close();thread.join()
if __name__=='__main__':unittest.main()

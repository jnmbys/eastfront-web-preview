"""Test-only process; no instrumentation or debug endpoints in the served app."""
import unittest,time
import online
from copy import deepcopy
import server
from live import execute,hash_bundle,auto_command
from bounded import warm_start,close_worker
from test007 import OnlineTests
class ResourceOnlineTests(OnlineTests):
 def test_no_debug_csrf_expiry_and_capacity(self):
  a=self.client();self.call(a);self.assertEqual(self.call(a,'/replay?debug=1')[0],404)
  cmd=dict(op='reset',clip='restore',mode='new',viewer='G')
  self.assertEqual(self.call(a,cmd=cmd,origin='https://other.example')[0],403)
  for _ in range(3):self.call(self.client())
  self.assertEqual(self.call(self.client())[0],503)
  print('expiry fixture monotonic_seconds=',time.monotonic(),' ttl=',online.TTL,flush=True)
  for slot in online.SESSIONS.values():slot['touched']=time.monotonic()-online.TTL-1
  self.assertEqual(self.call(a,cmd=cmd)[0],409)
class NewModeRollback(unittest.TestCase):
 def test_timeout_keeps_complete_new_bundle_and_retry(self):
  warm_start()
  try:
   b,_=server.load('restore','new');before=hash_bundle(b);cmd=auto_command(b)
   r=execute(b,cmd,seconds=.001)
   self.assertFalse(r['ok']);self.assertEqual(hash_bundle(r['state']),before);self.assertEqual(r['state'],b)
   r=execute(b,cmd,seconds=3)
   # Resource-driven retry failure is retained, not treated as success.
   self.assertTrue(r['ok'],r.get('error'));self.assertEqual(hash_bundle(execute(r['state'],cmd)['state']),hash_bundle(r['state']))
  finally:close_worker()
if __name__=='__main__':
 suite=unittest.TestSuite([unittest.defaultTestLoader.loadTestsFromTestCase(ResourceOnlineTests),unittest.defaultTestLoader.loadTestsFromTestCase(NewModeRollback)])
 result=unittest.TextTestRunner(verbosity=2).run(suite)
 raise SystemExit(not result.wasSuccessful())

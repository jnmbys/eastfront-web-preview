import unittest,threading,json,time,urllib.request,urllib.error,http.cookiejar
from copy import deepcopy
import online,server
from live import execute,hash_bundle
from bounded import warm_start,close_worker
class OnlineTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  warm_start();online.SECURE=False;online.ORIGIN='http://127.0.0.1:8767';cls.http=online.Service(('127.0.0.1',8767),online.Handler);cls.thread=threading.Thread(target=cls.http.serve_forever,daemon=True);cls.thread.start()
 @classmethod
 def tearDownClass(cls):cls.http.shutdown();cls.http.server_close();close_worker()
 def client(self):return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
 def call(self,c,path='/api',cmd=None,origin=None):
  time.sleep(.17);r=urllib.request.Request('http://127.0.0.1:8767'+path,data=json.dumps(cmd).encode() if cmd else None,headers={'Content-Type':'application/json','Origin':origin or online.ORIGIN})
  try:
   with c.open(r,timeout=12) as v:return v.status,json.load(v)
  except urllib.error.HTTPError as e:return e.code,e.read().decode()
 def setUp(self):online.SESSIONS.clear();online.CREATIONS.clear()
 def test_sessions_actions_receipts_replay(self):
  a,b=self.client(),self.client();_,sa=self.call(a);_,sb=self.call(b);self.assertEqual(len(online.SESSIONS),2)
  initial=deepcopy(next(iter(online.SESSIONS.values()))['state']);rev=sa['state']['revision'];action={'type':'END_PHASE'};cmd=dict(op='action',id='http-007',revision=rev,viewer='G',action=action)
  status,x=self.call(a,cmd=cmd);self.assertEqual(status,200);self.assertEqual(x['state']['revision'],rev+1);self.assertIsNotNone(x['state']['feedback']);self.assertEqual(self.call(b)[1]['state']['revision'],sb['state']['revision'])
  final=next(iter(online.SESSIONS.values()))['state'];j=final['journal'][-1];expected=execute(initial,j['command']);self.assertTrue(expected['ok']);self.assertEqual(hash_bundle(final),hash_bundle(expected['state']))
  self.assertEqual(self.call(a,cmd=cmd)[1]['state']['revision'],rev+1)
  bad={**cmd,'id':'bad','revision':rev+1,'action':{'type':'MOVE','unitId':'not-own','paperPath':'A1'}};self.call(a,cmd=bad);self.assertEqual(hash_bundle(next(iter(online.SESSIONS.values()))['state']),hash_bundle(final))
 def test_no_debug_csrf_expiry_and_capacity(self):
  a=self.client();self.call(a);self.assertEqual(self.call(a,'/replay?debug=1')[0],404)
  cmd=dict(op='reset',clip='restore',mode='new',viewer='G')
  self.assertEqual(self.call(a,cmd=cmd,origin='https://other.example')[0],403)
  for _ in range(3):self.call(self.client())
  self.assertEqual(self.call(self.client())[0],503)
  for s in online.SESSIONS.values():s['touched']=0
  self.assertEqual(self.call(a,cmd=cmd)[0],409)
 def test_busy_and_owner_filter(self):
  a=self.client();self.call(a);online.GATE.acquire()
  try:self.assertEqual(self.call(a)[0],503)
  finally:online.GATE.release()
  s=self.call(a,'/api?viewer=S')[1]['state'];self.assertTrue(all(u['side']=='S' for u in s['units']));self.assertNotIn('core',s);self.assertNotIn('journal',s)
 def test_old_mode_zero_charge_and_timeout(self):
  a=self.client();self.call(a);self.call(a,cmd=dict(op='reset',clip='prepare',mode='old',viewer='G'));slot=next(iter(online.SESSIONS.values()));before=hash_bundle(slot['state']);cmd=dict(op='action',id='tiny',revision=slot['state']['revision'],viewer='G',budget=.001,action={'type':'END_SIDE'});_,r=self.call(a,cmd=cmd);self.assertIsNotNone(r['error']);self.assertEqual(hash_bundle(slot['state']),before);self.assertEqual(slot['state']['logistics']['action_spent'],0)
if __name__=='__main__':unittest.main()

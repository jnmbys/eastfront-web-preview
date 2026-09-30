"""Targeted seams only. Legal saved checkpoints injected into private test slots, never via HTTP."""
import sys,json,time,gzip,threading,urllib.request,urllib.error,http.cookiejar,platform
from pathlib import Path
from copy import deepcopy
from unittest.mock import patch
import service as s
from live import hash_bundle,audit,execute
OUT=Path(__file__).parent/'evidence';OUT.mkdir(exist_ok=True)
report={'environment':dict(python=platform.python_version(),platform=platform.platform(),resource_limits='Local shared host; no Docker/Render claim; transaction budget 3 s'),'checks':[],'actions':[]}
def check(name,fn):
 try:detail=fn();report['checks'].append(dict(name=name,passed=True,detail=detail));print('PASS',name,flush=True)
 except Exception as e:report['checks'].append(dict(name=name,passed=False,error=repr(e)));print('FAIL',name,repr(e),flush=True)
def slot(b):return dict(state=deepcopy(b),viewer=b['core']['pendingDecision']['side'] if b['core']['pendingDecision'] else b['core']['activeSide'],memory={'GERMAN':[],'SOVIET':[]},receipt={},base_revision=0,seconds=None,touched=time.monotonic())
def apply(sl,c,expected=None):
 sl['viewer']=sl['state']['core']['controllers'][c['action']['controllerId']]['side'];cmd=deepcopy(c);del cmd['action']['controllerId']
 p=s.transact(sl,cmd)
 if expected:assert hash_bundle(sl['state'])==expected
 audit(sl['state']['logistics']);report['actions'].append(dict(type=c['action']['type'],revision=sl['state']['revision'],hash=hash_bundle(sl['state']),seconds=p['supply']['seconds'],charges=sl['state']['journal'][-1]['charges'],settled=sl['state']['journal'][-1]['settled']))
 return p
if __name__=='__main__':
 s.warm_start()
 def deployment():
  out=[]
  for mode in ['new','old']:
   b=s.create_campaign(mode);sl=slot(b);p,_=s.packet(sl);roster=p['model']['deployment']['roster'];q,r=map(int,p['model']['deployment']['zoneKeys'][0].split(','));c=dict(id='015-deploy-'+mode,revision=0,action=dict(type='DEPLOY_INITIAL_UNIT',controllerId=p['model']['viewerControllerId'],deploymentUnitId=roster[0]['id'],hex=dict(q=q,r=r)))
   reference=execute(b,c);assert reference['ok'];apply(sl,c,hash_bundle(reference['state']));assert sl['state']==reference['state'];out.append(mode)
  return out
 check('new and old deployment: exact sandbox state, RNG, ledger',deployment)
 base=s.EXP/'evidence'
 read=lambda p:json.load(gzip.open(p,'rt'))
 advance=read(base/'campaign011-close/advance-battle.json.gz')['records'][:9]
 sl=slot(read(base/'campaign011-close/checkpoint-66.json.gz')['state'])
 def pending_delivery():
  for j in advance:apply(sl,j['command'],j['hash'])
  assert sl['state']['journal'][-1]['settled'];return audit(sl['state']['logistics'])
 check('pending advance -> phase boundaries -> real delivery (9 recorded Actions)',pending_delivery)
 repeat=read(base/'campaign011-final/reserve-recovery-repeat.json.gz')['records']
 sl2=slot(read(base/'campaign011-final/checkpoint-75.json.gz')['state'])
 def attack():
  for j in repeat:apply(sl2,j['command'],j['hash'])
  return {'revision':sl2['state']['revision'],'last_battle':list(sl2['state']['core']['combatTransactions'])[-1]}
 check('recorded movement -> attack -> retreat, exact recorded states and dice',attack)
 sl3=slot(read(base/'campaign011-final/checkpoint-75.json.gz')['state'])
 apply(sl3,repeat[0]['command'],repeat[0]['hash'])
 def armor():
  # Read actual legal options; no future dice probing.
  draft=json.loads(__import__('subprocess').check_output(['node','--input-type=module','-e',"import {createPresentationState} from './dist/app/state/presentation.js';import {queryDraft} from './dist/app/multiplayer/gameplayProtocol.js';let p=createPresentationState();p.selectedUnitId='G-PZ-01';console.log(JSON.stringify(queryDraft(p)));"],cwd=s.ROOT,text=True))
  p,_=s.packet(sl3,draft=draft);opt=next(o for o in p['model']['moveOptions'] if o['legal'])
  c=dict(id='015-armor',revision=sl3['state']['revision'],action=dict(type='MOVE',controllerId=p['model']['viewerControllerId'],unitId='G-PZ-01',path=[opt['hex']]))
  reference=execute(sl3['state'],c);assert reference['ok'];apply(sl3,c,hash_bundle(reference['state']));assert sl3['state']==reference['state'];assert sl3['state']['journal'][-1]['charges'][0]['cost']==4
  return sl3['state']['journal'][-1]['charges']
 check('normal movement query -> armor MOVE costs 4, exact sandbox state',armor)
 def duplicates():
  b=deepcopy(sl3['state']);c=b['journal'][-1]['command'];p=apply(sl3,c);assert p['duplicate'] and sl3['state']==b
  c=deepcopy(c);c['action']['path']=[{'q':0,'r':0}]
  try:apply(sl3,c);raise AssertionError('conflict accepted')
  except s.Rejected:pass
  assert sl3['state']==b;return 'identical id/command is a no-op; conflicting id rejected'
 check('duplicate and ID conflict',duplicates)
 def rollback():
  before=deepcopy(sl3);orig=s.projection
  def delayed(*a,**kw):
   p=orig(*a,**kw)
   if 'previous' in kw:time.sleep(3.01)
   return p
  c=dict(id='015-timeout',revision=sl3['state']['revision'],action={'type':'READY_FOR_PHASE_END'})
  try:
   with patch.object(s,'projection',delayed):s.transact(sl3,c)
   raise AssertionError('late commit')
  except TimeoutError:pass
  assert sl3==before;return 'post-execute deadline failure leaves Core/RNG/inventory/seen/journal/receipt/memory byte-identical'
 check('3-second total budget rollback after successful real Core action',rollback)
 def filtering():
  b=read(base/'campaign011-close/checkpoint-66.json.gz')['state'];out=[]
  for side in ['GERMAN','SOVIET']:
   sl=slot(b);sl['viewer']=side;p,_=s.packet(sl);raw=json.dumps(p)
   for key in ['random','actionLog','authoritativeState','seen','journal','core','memory']:assert key not in p and ('"'+key+'":') not in raw,key
   assert set(p['view']['resources'])=={side}
   visible={u['id'] for u in p['view']['units']};hidden={u['id'] for u in b['core']['units'].values() if u['side']!=side and u['id'] not in visible}
   assert not any(('"'+id+'"') in raw for id in hidden)
   assert all(b['core']['units'][u['id']]['side']==side for u in p['supply']['units'])
   assert p['view']['pendingDecision'] is None or p['view']['pendingDecision']['side']==side
   out.append(dict(viewer=side,hidden=len(hidden),bytes=len(raw)))
  return out
 check('authorization projection: hidden IDs, private RNG and enemy supply withheld',filtering)
 # Real HTTP session boundaries on a private ephemeral listener.
 srv=s.online.Service(('127.0.0.1',0),s.Handler);threading.Thread(target=srv.serve_forever,daemon=True).start();origin='http://127.0.0.1:'+str(srv.server_port)
 class Client:
  def __init__(self):self.jar=http.cookiejar.CookieJar();self.http=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
  def post(self,**cmd):
   req=urllib.request.Request(origin+'/experiment',data=json.dumps(dict(version=s.VERSION,**cmd)).encode(),headers={'Content-Type':'application/json','Origin':origin})
   try:
    with self.http.open(req) as r:return r.status,json.load(r)
   except urllib.error.HTTPError as e:return e.code,json.load(e)
  def private(self):return s.SESSIONS[next(iter(self.jar)).value]
 def http_checks():
  a,b=Client(),Client();assert a.post(op='open',mode='new')[0]==200;assert b.post(op='open',mode='old')[0]==200
  original=deepcopy(b.private()['state']);assert a.post(op='open',mode='old')[0]==422
  a.private().update(deepcopy(sl3));body={'op':'action',**sl3['state']['journal'][-1]['command']};body['action']=dict(body['action']);body['action'].pop('controllerId')
  assert a.post(**body)[1]['duplicate'];assert b.private()['state']==original
  with s.GATE:assert a.post(op='open')[0]==503
  assert a.post(op='query',revision=-1)[0]==409
  assert a.post(op='switch',viewer='OBSERVER')[0]==422
  before=deepcopy(a.private()['state']);assert a.post(op='switch',viewer='SOVIET')[0]==200;assert a.private()['state']==before
  a.private()['touched']-=s.online.TTL+1;assert a.post(**body)[0]==409
  assert a.post(op='open',mode='new')[0]==200
  return 'mode immutable, two sessions isolated, busy 503, stale 409, observer denied, switch read-only, expired action never recreates'
 check('HTTP session/authorization/busy/mode lock/expiry',http_checks)
 srv.shutdown()
 # Actual authorized packet for rendering proof; no cookies, no private state.
 p,_=s.packet(sl3);(OUT/'authorized-view.json').write_text(json.dumps(p,ensure_ascii=False))
 report['max_transaction_seconds']=max(x['seconds'] for x in report['actions']);report['all_passed']=all(x['passed'] for x in report['checks'])
 (OUT/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print('report',OUT/'verification.json',flush=True)
 raise SystemExit(0 if report['all_passed'] else 1)

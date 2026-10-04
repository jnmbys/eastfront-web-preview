"""Offline integration checks using the actual browser transaction trace; no HTTP injection."""
import gzip,lzma,json,time,threading
from pathlib import Path
from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import patch
import server as app

out=app.OUT
path=out/'browser-transactions.jsonl.xz'
rows=[json.loads(x) for x in lzma.decompress(path.read_bytes()).decode().splitlines()]
heads={x['head']['version']:x['head'] for x in rows}
recovered=[h for h in heads.values() if h['root']['bundle']['core']['units']['G-I-01']['step']==0]
assert recovered,'ACTUAL_BROWSER_RECOVERY_MISSING'
after=recovered[0];before=heads[after['version']-1]
assert after['root']['forward']['recovery']['payment']=={'P':1,'E2:L':2,'RP':0,'extraW':0}
assert after['root']['forward']['terminal']['status']=='CONSUMED'
assert before['root']['bundle']['core']['units']['G-I-01']['step']==1
assert before['root']['bundle']['core']['rp']==after['root']['bundle']['core']['rp']
assert after['root']['bundle']['core']['units']['G-I-01']['hex']==before['root']['bundle']['core']['units']['G-I-01']['hex']
assert any(h['root']['bundle']['core']['actionLog'][-1]['action']['type']=='ENTRENCH' for h in recovered)
rail=next(h for h in heads.values() if h['root']['bundle']['core']['turn']==9 and h['root']['bundle']['core']['phase']=='GERMAN_SUPPLY_RAIL')
rail_after=heads[rail['version']+1]
assert rail_after['root']['bundle']['core']['actionLog'][-1]['action']['type']=='RAIL_REPAIR'
assert rail_after['root']['bundle']['core']['actionLog'][-1]['action']['engineerUnitId']=='G-ENG-01'
assert rail_after['root']['bundle']['core']['units']['G-ENG-01']['dedicatedRailRepair']
assert rail_after['root']['bundle']['core']['rp']==rail['root']['bundle']['core']['rp']
assert rail_after['root']['bundle']['core']['cp']==rail['root']['bundle']['core']['cp']
base=next(h['root'] for h in heads.values() if h['stage']=='016')

class TestOwner:
 def __init__(self):self._head=deepcopy(rail);self.contexts={'016':SimpleNamespace(base=deepcopy(base))}
 def head(self):return deepcopy(self._head)
 def snapshot(self):return deepcopy(self._head['root'])
def make():
 g=app.Game.__new__(app.Game);g.tx=TestOwner();g.accepted=0;g.public={}
 def fail():raise RuntimeError('SYNTHETIC_POST_COMMIT_READ_FAILURE')
 g._state=fail
 return g
g=make();old=g.tx.head();action=dict(type='RAIL_REPAIR',controllerId='G-HUMAN-1',edgeKeys=['0,4|1,4'])
reply=g.apply_game_action(old,action,'offline-read-failure',time.perf_counter())
assert reply['ok'] and g.tx.head()['version']==old['version']+1 and g.public['readError']
# Inject only into this offline object; no production route or game checkpoint is changed.
fake=SimpleNamespace(execute=lambda *a,**k:dict(ok=True,state=deepcopy(g.tx.head()['root']['bundle'])))
timed=make();old=timed.tx.head()
with patch.dict(app.mods,{'016':SimpleNamespace(runtime=lambda:(fake,None),serialized=app.mods['016'].serialized)}):
 try:timed.apply_game_action(old,action,'offline-timeout',time.perf_counter()-4)
 except AssertionError as e:assert str(e)=='TOTAL_3_SECOND_BUDGET'
 else:raise AssertionError('DEADLINE_NOT_ENFORCED')
assert timed.tx.head()==old

# Same policy DTO and decision after changes exclusively to invisible enemies/future RNG.
probe=app.Game.__new__(app.Game);probe.tx=TestOwner();probe.instance_id='offline-pair'
c=deepcopy(rail['root']['bundle']['core']);c['phase']='GERMAN_MOVEMENT'
probe.tx._head['root']['bundle']['core']=c
a=probe.project(viewer='GERMAN',ai=True)
visible={u['id'] for u in probe.project()['view']['units']}
changed=[]
for id,u in c['units'].items():
 if u['side']=='SOVIET' and id not in visible:u['step']=0;u['entrenched']=not u['entrenched'];changed.append(id)
assert changed
if 'rngState' in c:c['rngState']=987654321
b=probe.project(viewer='GERMAN',ai=True)
assert a==b,'HIDDEN_INFORMATION_AFFECTED_POLICY'
for turn in [5,7,8]:
 v=dict(turn=turn,phase='GERMAN_RECOVERY',extensions={'industry018':dict(order=None,personnel=None)},care=None)
 assert app.required_chain_step(v)
 v['extensions']['industry018'].update(order={'status':'ACCEPTED'},personnel={'application':{'status':'ACCEPTED'}});v['care']={'endEpoch':9}
 assert app.required_chain_step(v)is None
ended=make();ended.lock=threading.RLock();ended.records={'known-id':{}};ended.tx._head['root']['bundle']['core']['turn']=10
with patch.object(app.Session,'submit',return_value={'status':'COMMITTED'}):
 assert ended.submit({'requestId':'known-id','operation':'NEXT'})['status']=='COMMITTED'
 try:ended.submit({'requestId':'new-id','operation':'NEXT'})
 except app.ProtocolError:pass
 else:raise AssertionError('NEW_ACTION_AFTER_T9')
report=dict(source=str(path.name),browserVersions=len(heads),rail=dict(beforeVersion=rail['version'],afterVersion=rail_after['version'],engineer='G-ENG-01',noRPOrCP=True),recovery=dict(beforeVersion=before['version'],afterVersion=after['version'],step=[1,0],sameRP=True,sameMapUnit=True),postRecoveryEntrench=True,postCommitReadFailureRemainsCommitted=True,threeSecondRollbackUnchanged=True,hiddenEnemyPairCount=len(changed),policyPairEqual=True,fixedChainMissingPrerequisiteGuard=True,oldReceiptReplayAfterScopeEnd=True)
(out/'integration-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
print(json.dumps(report,ensure_ascii=False));app.mods['016'].runtime()[1].close_worker()

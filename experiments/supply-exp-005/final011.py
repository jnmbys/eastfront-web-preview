"""Two bounded, fixed continuations from 1be79878. No state edits/dice probes."""
from campaign import *
from bounded import warm_start,close_worker
from close011 import checkpoint,read
from verify_campaign011 import check_losses
import gzip,sys,math
OUT=ROOT/'evidence/campaign011-final';OUT.mkdir(exist_ok=True)
COORD={n['id']:n['coord'] for n in __import__('realmap').MAP['nodes']}
BASE='1be79878ca07930a554d259560cd18814d0e7868'
def save(path,d):path.write_bytes(gzip.compress(json.dumps(d,ensure_ascii=False).encode(),mtime=0))
def prepare():
 original=read(ROOT/'evidence/campaign011/run.json.gz');b=checkpoint('checkpoint-66.json.gz')
 for row in original['records'][66:75]:
  r=execute(b,row['command'],seconds=3);assert r['ok'],r.get('error');b=r['state'];assert hash_bundle(b)==row['hash']
 save(OUT/'checkpoint-75.json.gz',dict(state=b,hash=hash_bundle(b),source='../campaign011/run.json.gz',through=75,from_checkpoint=66))
 old=read(ROOT/'evidence/campaign011-close/advance-battle.json');b=checkpoint('checkpoint-66.json.gz')
 for row in old['records'][:25]:
  r=execute(b,row['command'],seconds=3);assert r['ok'],r.get('error');b=r['state'];assert hash_bundle(b)==row['hash']
 save(OUT/'checkpoint-91.json.gz',dict(state=b,hash=hash_bundle(b),source='../campaign011-close/advance-battle.json.gz',through=25,from_checkpoint=66))
class Trial:
 def __init__(self,name,n):
  self.name=name;self.start=n;d=read(OUT/f'checkpoint-{n}.json.gz');self.b=d['state'];self.initial=d['hash'];assert hash_bundle(self.b)==self.initial;self.records=[];self.failures=[]
 def record(self):
  save(OUT/(self.name+'-state.json.gz'),self.b)
  (OUT/(self.name+'.json')).write_text(json.dumps(dict(base=BASE,checkpoint=f'checkpoint-{self.start}.json.gz',initial_hash=self.initial,records=self.records,failures=self.failures,final_hash=hash_bundle(self.b)),ensure_ascii=False,indent=2))
 def act(self,a):
  before=self.b;cmd=auto_command(before);cmd['id']=self.name+'-'+str(before['revision']);cmd['action'].update(a)
  r=execute(before,cmd,seconds=3)
  if not r['ok']:
   assert r['state']==before;self.failures.append(dict(command=cmd,error=r['error'],unchanged=True));self.record();raise RuntimeError(self.failures[-1])
  self.b=r['state'];j=self.b['journal'][-1];check_losses(before,self.b,j)
  old={u['id']:u for u in before['logistics']['units']};new={u['id']:u for u in self.b['logistics']['units']}
  row=dict(command=cmd,hash=hash_bundle(self.b),seconds=r['seconds'],events=j['events'],supply_events=j['supply_events'],charges=j['charges'],settled=j['settled'],audit_before=audit(before['logistics']),audit_after=audit(self.b['logistics']),changes=[dict(unit=k,before=old.get(k),after=new.get(k)) for k in sorted(set(old)|set(new)) if old.get(k)!=new.get(k)])
  if a['type']=='ATTACK':
   declaration=next(e for e in j['events'] if e['type']=='CombatDeclared');row['battle']=deepcopy(self.b['core']['combatTransactions'][declaration['battleId']]);row['attack_effects']={u:effects(before['logistics'],cmd['action'])[u] for u in a['attackerUnitIds']}
  if j['settled']:row['ledger']=deepcopy(self.b['logistics']['ledger'])
  duplicate=execute(self.b,cmd,seconds=3);assert duplicate['ok'] and duplicate['duplicate'] and duplicate['state']==self.b
  self.records.append(row);self.record();print(self.name,self.b['revision'],a['type'],flush=True)
 def end(self):self.act(dict(type='END_PHASE'))
 def to_movement(self):
  for _ in range(8):
   if self.b['core']['phase']=='GERMAN_MOVEMENT':return
   self.end()
  raise AssertionError('movement not reached')
 def forced(self):
  while self.b['core']['pendingDecision']:
   p=self.b['core']['pendingDecision'];kind=p['kind'];base=dict(battleId=p['battleId'])
   if kind in ['ADVANCE_AFTER_COMBAT','BREAKTHROUGH_OPTION','SCHWERPUNKT_OPTION','DEFENDER_REACTION']:
    self.act(dict(type={'ADVANCE_AFTER_COMBAT':'PASS_ADVANCE','BREAKTHROUGH_OPTION':'PASS_BREAKTHROUGH','SCHWERPUNKT_OPTION':'PASS_SCHWERPUNKT','DEFENDER_REACTION':'PASS_REACTION'}[kind],**base))
   else:
    assert kind in ['LOSS_ALLOCATION','RETREAT'];options=json.loads(subprocess.check_output(['node',str(ROOT/'choice-probe.mjs')],input=json.dumps(self.b['core']).encode()));assert options;self.act(options[0])
def run():
 # Precommitted actors/targets; outcomes are read only after their accepted Action.
 t=Trial('reserve-recovery-repeat',75);u=next(u for u in t.b['logistics']['units'] if u['id']=='G-I-01');assert u['stock']==12 and Fraction(u['debt'])==0
 t.to_movement();t.act(dict(type='MOVE',unitId='G-I-01',path=[COORD['E8']]))
 t.end();t.act(dict(type='ATTACK',attackerUnitIds=['G-I-01'],target=COORD['F8']));t.forced();t.record()
 t=Trial('nonzero-combat-destruction',91);u=next(u for u in t.b['logistics']['units'] if u['id']=='S-I-01');assert u['stock']>0 and u['strength']==2
 t.to_movement();t.act(dict(type='MOVE',unitId='G-MOT-01',path=[COORD['C9'],COORD['D9'],COORD['E9']]))
 t.end();t.act(dict(type='ATTACK',attackerUnitIds=['G-MOT-01'],target=COORD['F8']));t.forced();t.record()

def replay():
 report=[]
 for name in ['reserve-recovery-repeat','nonzero-combat-destruction']:
  d=read(OUT/(name+'.json'));p=read(OUT/d['checkpoint']);b=p['state'];assert hash_bundle(b)==d['initial_hash']
  attack_checks=[]
  for row in d['records']:
   before=b;r=execute(b,row['command'],seconds=3);assert r['ok'],r.get('error');b=r['state'];assert hash_bundle(b)==row['hash'];check_losses(before,b,b['journal'][-1])
   if row['command']['action']['type']=='ATTACK':
    action=row['command']['action'];units={u['id']:u for u in before['logistics']['units']};after={u['id']:u for u in b['logistics']['units']};attackers=action['attackerUnitIds'];fx=effects(before['logistics'],action)
    entry=dict(turn=before['core']['turn'],phase=before['core']['phase'],revision=b['revision'],attackers=[dict(unit=uid,stock=units[uid]['stock'],debt=units[uid]['debt'],fee=next(c['cost'] for c in row['charges'] if c['unit']==uid),factor=fx[uid]['factor']) for uid in attackers],target_stock=units['S-I-01']['stock'],target_strength=units['S-I-01']['strength'],result=row['battle']['resolution']['crtResult'],actual_attack_strength=row['battle']['context']['attackStrength'],destroyed_events=[e for e in row['events'] if e['type']=='UnitDestroyed'])
    if name=='reserve-recovery-repeat':
     u=entry['attackers'][0];assert (u['unit'],u['stock'],u['debt'],u['fee'],u['factor'])==('G-I-01',12,'0',4,1);assert after['G-I-01']['stock']==8;assert entry['actual_attack_strength']==5
    else:
     # This actually observed branch does NOT exercise the destruction sink.
     assert entry['target_stock']==0 and not entry['destroyed_events'];assert audit(before['logistics'])['destroyed']==audit(b['logistics'])['destroyed']==0
    attack_checks.append(entry)
  assert hash_bundle(b)==d['final_hash'];report.append(dict(name=name,actions=len(d['records']),hash_replay_passed=True,objective_passed=name=='reserve-recovery-repeat',hash=d['final_hash'],attack_checks=attack_checks))
 (OUT/'replay.json').write_text(json.dumps(report,indent=2));print(report)
if __name__=='__main__':
 try:
  warm_start()
  if sys.argv[1]=='prepare':prepare()
  elif sys.argv[1]=='run':run()
  elif sys.argv[1]=='replay':replay()
 finally:close_worker()

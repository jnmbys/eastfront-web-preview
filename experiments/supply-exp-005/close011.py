"""Replay only the new 011 closure slices (25 + 20 actions by default).
Saved checkpoints are original-Action hash descendants, never hand-authored states.
Optional --all replays retained unsuccessful recovery routes, not the whole campaign.
"""
from campaign import *
from bounded import warm_start,close_worker
from verify_campaign011 import check_losses
import gzip,math,sys
OUT=ROOT/'evidence/campaign011-close'
def read(path):
 if path.exists():return json.loads(gzip.decompress(path.read_bytes()) if path.suffix=='.gz' else path.read_text())
 return json.loads(gzip.decompress(Path(str(path)+'.gz').read_bytes()))
def checkpoint(name):
 d=read(OUT/name);b=d['state'];assert hash_bundle(b)==d['hash']
 source=read(OUT/d['prefix_source']);row=source['records'][d['prefix_actions']-1]
 assert row['hash']==d['hash'] and b['revision']==row['command']['revision']+1
 assert b['logistics']['campaign_config']==CONFIG
 return b

def run(name,limit=None):
 d=read(OUT/(name+'.json'));b=checkpoint(d['checkpoint']);assert hash_bundle(b)==d['initial_hash'];records=d['records'][:limit];summaries=[];rejections=0
 rules=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {defaultRules} from './core/dist/index.js';console.log(JSON.stringify(defaultRules.unitTemplates))"],cwd=ROOT))
 for row in records:
  before=b
  for failure in d['failures']:
   if failure['command']['revision']==b['revision']:
    prior=deepcopy(b);r=execute(b,failure['command'],seconds=3);assert not r['ok'] and b==prior and r['state']==prior;rejections+=1
  result=execute(b,row['command'],seconds=3);assert result['ok'],result.get('error');b=result['state'];assert hash_bundle(b)==row['hash'];j=b['journal'][-1];check_losses(before,b,j)
  prior={u['id']:u for u in before['logistics']['units']};current={u['id']:u for u in b['logistics']['units']}
  for uid,u in current.items():
   core=b['core']['units'][uid];assert u['strength']==rules[core['templateId']]['maxDamageSteps']-core['step'];assert u['core_step']==core['step']
  action=row['command']['action'];detail=dict(revision=b['revision'],type=action['type'],seconds=result['seconds'],settled=j['settled'])
  if action['type']=='ADVANCE_AFTER_COMBAT':
   uid=action['unitId'];assert not j['charges'] and not j['settled'];assert current[uid]['stock']==prior[uid]['stock'] and current[uid]['debt']==prior[uid]['debt'];assert current[uid]['node']!=prior[uid]['node']
   detail.update(unit=uid,stock_unchanged=prior[uid]['stock'],from_node=prior[uid]['node'],to_node=current[uid]['node'])
  damage=[]
  for e in j['events']:
   if e['type']=='UnitStepLost':
    uid=e['unitId'];charge=sum(c['cost'] for c in j['charges'] if c['unit']==uid)
    if uid in current:assert current[uid]['stock']==prior[uid]['stock']-charge
    else:assert b['logistics']['continuity']['removed']>=before['logistics']['continuity']['removed']+prior[uid]['stock']-charge
    damage.append(dict(unit=uid,from_step=e['fromStep'],to_step=e['toStep'],stock_before=prior[uid]['stock'],stock_after=current.get(uid,{}).get('stock'),strength_after=current.get(uid,{}).get('strength')))
  if damage:detail['battle_damage']=damage
  if action['type']=='ATTACK':
   effect=effects(before['logistics'],action);expected=0;attackers=[]
   for uid in action['attackerUnitIds']:
    core=before['core']['units'][uid];raw=rules[core['templateId']]['steps'][core['step']]['attack'];expected+=math.ceil(raw*effect[uid]['factor'])
    charge=next(c['cost'] for c in j['charges'] if c['unit']==uid);assert charge==min(4,prior[uid]['stock'])
    attackers.append(dict(unit=uid,stock_before=prior[uid]['stock'],debt_before=prior[uid]['debt'],paid=charge,base_attack=raw,factor=effect[uid]['factor']))
   declared=next(e for e in j['events'] if e['type']=='CombatDeclared');tx=b['core']['combatTransactions'][declared['battleId']];assert tx['context']['attackStrength']==expected
   detail.update(attackers=attackers,attack_strength=expected,result=tx['resolution']['crtResult'],dice=tx['resolution']['dice'])
  if j['settled']:detail['selected_units']=[u for side in b['logistics']['ledger'] for u in side['units'] if u['id'] in ['G-PZ-01','G-MOT-01','S-I-01']]
  summaries.append(detail)
 assert hash_bundle(b)==records[-1]['hash']
 return dict(name=name,actions=len(records),rejected_unchanged=rejections,final_hash=hash_bundle(b),passed=True,audit=audit(b['logistics']),records=summaries)
if __name__=='__main__':
 try:
  warm_start()
  targets=[('advance-battle',None),('recover-attack',None),('repaired-recovery',None)] if '--all' in sys.argv else [('advance-battle',25),('recovered-unit-attack',None)]
  result=[run(name,limit) for name,limit in targets]
  dest=OUT/('replay-all.json' if '--all' in sys.argv else 'short-replay.json');dest.write_text(json.dumps(result,ensure_ascii=False,indent=2))
  print([(r['name'],r['actions'],r['passed']) for r in result])
 finally:close_worker()

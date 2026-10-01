"""Private localhost replay of the derived legal second-attack checkpoint."""
import os,sys,json,gzip
from pathlib import Path
from copy import deepcopy
os.environ.update(COOKIE_SECURE='0',PYTHONUTF8='1',OPENBLAS_NUM_THREADS='1')
sys.path.insert(0,str(Path(__file__).parent))
from second_attack import s,OUT,hash_bundle,unit
from live import execute
BASE=json.load(gzip.open(OUT/'second-before.json.gz','rt',encoding='utf-8'))
REPORT={'checkpoint_hash':hash_bundle(BASE),'candidate':'8503f1ff826a934f599af423626ea934f29f13bf','queries':[],'actions':[]}
def save(): (OUT/'http-authority.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
s.create_campaign=lambda mode:deepcopy(BASE) if mode=='new' else (_ for _ in ()).throw(ValueError('new fixture only'))
real_packet=s.packet
def observed_packet(slot,*a,**kw):
 before=deepcopy(slot);p,m=real_packet(slot,*a,**kw);assert slot==before
 if kw.get('draft') is not None:
  REPORT['queries'].append(dict(revision=slot['state']['revision'],hash=hash_bundle(slot['state']),random=slot['state']['core']['random'],full_slot_unchanged=True,preview=p['supply']['preview']));save()
 return p,m
s.packet=observed_packet
real=s.transact
def observed_action(slot,cmd):
 before=deepcopy(slot['state']);p=real(slot,cmd);after=slot['state'];j=after['journal'][-1]
 reference=execute(before,j['command']);assert reference['ok'] and reference['state']==after
 row=dict(action=cmd['action'],before=unit(before),after=unit(after),before_hash=hash_bundle(before),after_hash=hash_bundle(after),random_before=before['core']['random'],random_after=after['core']['random'],charges=j['charges'],seconds=p['supply']['seconds'],exact_frozen_executor_state=True)
 if cmd['action']['type']=='SCHWERPUNKT_ATTACK':
  quote=next(q['preview'] for q in reversed(REPORT['queries']) if q['preview']['rows'])
  assert quote['revision']==before['revision']==118
  q=quote['rows'];assert len(q)==1 and q[0]['id']=='G-PZ-01' and q[0]['type']=='SCHWERPUNKT_ATTACK'
  row['quote']=quote;assert q[0]['stock']==row['before']['inventory']['stock']==0
  assert q[0]['cost']==j['charges'][0]['cost']==0
  assert q[0]['after']==row['after']['inventory']['stock']==0
  assert q[0]['debt']==row['before']['inventory']['debt']==row['after']['inventory']['debt']=='1/4'
  assert q[0]['debtFactor']==1 and q[0]['attackFactor']==.5
  tx=list(after['core']['combatTransactions'].values())[-1]
  assert tx['isSchwerpunktSecondAttack'] and tx['sourceBattleId']=='B-000004' and tx['attackerUnitIds']==['G-PZ-01']
  assert tx['context']['attackStrength']==3 and tx['context']['modifiers']['secondAttackShift']==-1
  assert after['core']['random']['draws']==before['core']['random']['draws']+2
  row['battle']=tx;row['preview_matches_authority']=True;REPORT['passed']=True
 REPORT['actions'].append(row);save();return p
s.transact=observed_action
if __name__=='__main__':
 s.warm_start();save();print('SECOND_READY',hash_bundle(BASE),flush=True)
 s.online.Service(('127.0.0.1',8782),s.Handler).serve_forever()

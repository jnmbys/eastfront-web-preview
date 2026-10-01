"""One legal Schwerpunkt attempt; fixed saved campaign state, no state edits or RNG probes."""
import sys,json,gzip,time
from pathlib import Path
from copy import deepcopy
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).parent))
from verify_preview import s,slot,draft
from live import hash_bundle,audit
from bounded import close_worker
OUT=Path(__file__).parent/'evidence'/'second-attack';OUT.mkdir(exist_ok=True)
REPORT={'candidate':'8503f1ff826a934f599af423626ea934f29f13bf','scope':'one short legal campaign branch; no inventory/rule/eligibility/RNG edits','actions':[]}
def save_state(name,b):
 with gzip.open(OUT/(name+'.json.gz'),'wt',encoding='utf-8') as f:json.dump(b,f,ensure_ascii=False)
def unit(b,uid='G-PZ-01'):
 u=next((u for u in b['logistics']['units'] if u['id']==uid),None);c=b['core']['units'].get(uid)
 return {'inventory':{k:u[k] for k in ['stock','debt','B']} if u else None,'unit':{k:c[k] for k in ['hex','step','alive','hasAttacked','supplyState','expSupply']} if c else None}
def act(sl,a):
 before=deepcopy(sl['state']);c=before['core'];sl['viewer']=c['pendingDecision']['side'] if c['pendingDecision'] else c['activeSide']
 cmd={'id':'020-second-'+str(before['revision']),'revision':before['revision'],'action':a}
 p=s.transact(sl,cmd);b=sl['state'];j=b['journal'][-1]
 REPORT['actions'].append(dict(command=cmd,before_hash=hash_bundle(before),after_hash=hash_bundle(b),random_before=before['core']['random'],random_after=b['core']['random'],charges=j['charges'],seconds=p['supply']['seconds'],pending=b['core']['pendingDecision'],unit=unit(b)))
 save_state('latest',b);print(a['type'],b['revision'],b['core']['phase'],b['core']['pendingDecision'],flush=True);return p
if __name__=='__main__':
 s.warm_start()
 try:
  source=s.EXP/'evidence/campaign011-final/nonzero-combat-destruction-state.json.gz'
  b=json.load(gzip.open(source,'rt',encoding='utf-8'));record=json.load(gzip.open(source.with_name('nonzero-combat-destruction.json.gz'),'rt',encoding='utf-8'))
  assert hash_bundle(b)==record['final_hash'];audit(b['logistics'])
  REPORT['source']={'path':str(source.relative_to(ROOT)),'hash':hash_bundle(b),'revision':b['revision'],'random':b['core']['random']};turn=b['core']['turn']
  sl=slot(b)
  for _ in range(16):
   if sl['state']['core']['turn']>turn and sl['state']['core']['phase']=='GERMAN_MOVEMENT':break
   assert sl['state']['core']['pendingDecision'] is None
   sl['viewer']=sl['state']['core']['activeSide']
   if sl['state']['core']['phase']=='SOVIET_REINFORCEMENT_SUPPLY':
    packet,_=s.packet(sl);r=packet['model']['reinforcement']
    if r and r['deployable'] and r['available']:
     q,rcoord=map(int,r['legalEntryKeys'][0].split(','));act(sl,dict(type='DEPLOY_REINFORCEMENT',reinforcementId=r['available'][0]['id'],entryHex=dict(q=q,r=rcoord)));continue
   act(sl,{'type':'END_PHASE'})
  assert sl['state']['core']['phase']=='GERMAN_MOVEMENT'
  act(sl,dict(type='MOVE',unitId='G-I-01',path=[{'q':5,'r':4}]))
  act(sl,dict(type='END_PHASE'));save_state('first-before',sl['state'])
  d=draft(selectedUnitId='G-PZ-01',primaryAttackerId='G-PZ-01',interactionMode='ATTACK',attackUnitIds=['G-PZ-01','G-I-01'],attackTarget={'q':5,'r':5})
  before=deepcopy(sl);p,_=s.packet(sl,draft=d);assert sl==before;REPORT['first_preview']=p['supply']['preview'];REPORT['first_context']=p['model']['combat']['attackDraft']['preview']
  act(sl,dict(type='ATTACK',attackerUnitIds=d['attackUnitIds'],target=d['attackTarget']))
  tx=list(sl['state']['core']['combatTransactions'].values())[-1];REPORT['first_resolution']=tx;save_state('first-after',sl['state'])
  print('FIRST RESULT',tx['resolution'],flush=True)
  assert tx['resolution']['crtResult'] in ['D2R','D3R'],'No lawful second attack in this branch; do not fabricate eligibility'
  act(sl,dict(type='ADVANCE_AFTER_COMBAT',battleId=tx['battleId'],unitId='G-PZ-01'))
  act(sl,dict(type='BREAKTHROUGH',battleId=tx['battleId'],unitId='G-PZ-01',path=[{'q':6,'r':4},{'q':6,'r':5}]))
  d=draft(selectedUnitId='G-PZ-01',interactionMode='SCHWERPUNKT',schwerpunktTarget={'q':5,'r':6})
  before=deepcopy(sl);p,_=s.packet(sl,draft=d);assert sl==before
  assert sl['state']['core']['pendingDecision']['kind']=='SCHWERPUNKT_OPTION'
  REPORT['second_options']=p['model']['combat']['schwerpunkt'];REPORT['second_preview']=p['supply']['preview']
  save_state('second-before',sl['state'])
  REPORT['status']='legal second-attack fixture ready; run verify_second_browser.mjs for actual HTTP/browser execution'
 except Exception:
  import traceback;REPORT['failure']=traceback.format_exc();print(REPORT['failure'],flush=True)
 finally:
  close_worker();(OUT/'attempt.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')

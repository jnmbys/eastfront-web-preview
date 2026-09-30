"""Controlled inherited combat fixture, NOT natural campaign coverage.
No initializer, formula, parameter or RNG changes; no outcome search.
"""
import json,sys
from copy import deepcopy
from pathlib import Path
from test006 import CASES,initial
from campaign import CONFIG
from live import ROOT,execute,audit,hash_bundle,sync,node
from bounded import warm_start,close_worker

def check():
 b=initial(CASES['SECOND_ATTACK']);b['logistics']['campaign_config']=deepcopy(CONFIG)
 commands=json.loads((ROOT/'evidence/campaign010-combat.json').read_text())['commands'][:7]
 start=deepcopy(b);rows=[];destroyed=[]
 for cmd in commands:
  before=deepcopy(b);old={u['id']:u for u in b['logistics']['units']}
  r=execute(b,cmd,seconds=3);assert r['ok'],r.get('error');b=r['state'];j=b['journal'][-1]
  new={u['id']:u for u in b['logistics']['units']};lost=set(old)-set(new);fees={c['unit']:c['cost'] for c in j['charges']}
  assert not j['settled']
  units=[]
  for uid in sorted(lost):
   assert not b['core']['units'][uid]['alive'],(uid,'still alive')
   stock=old[uid]['stock']-fees.get(uid,0);assert stock>0
   assert any(e['type']=='UnitDestroyed' and e.get('unitId')==uid for e in j['events']),j['events']
   assert b['logistics']['continuity']['retired'].count(uid)==1
   events=[e for group in b['logistics']['continuity']['events'] for e in group['events'] if e['type']=='destroyed_sink' and e['unit']==uid]
   assert len(events)==1 and events[0]['lost']==stock
   units.append(dict(unit=uid,stock_destroyed=stock,core_alive_false=True,removed_from_active_logistics=True,retired_once=True))
  assert b['logistics']['continuity']['removed']-before['logistics']['continuity']['removed']==sum(u['stock_destroyed'] for u in units)
  for uid,u in new.items():assert u['stock']==old[uid]['stock']-fees.get(uid,0),(uid,'unexplained transfer')
  assert execute(b,cmd,seconds=3)['state']==b
  if lost:
   frame=node(b['core'],b['mode'],b['logistics'])['frame'];twice=sync(b['logistics'],frame)
   assert twice['continuity']==b['logistics']['continuity'];assert twice['units']==b['logistics']['units'];audit(twice)
  rows.append(dict(command=cmd,hash=hash_bundle(b),events=j['events'],charges=j['charges'],destroyed=units,audit=audit(b['logistics'])))
  destroyed.extend(units)
 assert destroyed,'no positive inventory destroyed'
 x=start
 for row in rows:
  r=execute(x,row['command'],seconds=3);assert r['ok'],r.get('error');x=r['state'];assert hash_bundle(x)==row['hash']
 return dict(classification='controlled seam validation; NOT natural full campaign coverage',fixture='test006.initial(CASES.SECOND_ATTACK) + campaign_config marker; inherited scenario inventory/settings, NOT global campaign defaults',initial_hash=hash_bundle(start),initial_audit=audit(start['logistics']),records=rows,destroyed=destroyed,replay=True,duplicate_action=True,repeated_sync=True,no_transfer=True,natural_campaign_gap_retained=True)
if __name__=='__main__':
 try:
  warm_start();result=check();p=Path(sys.argv[1] if len(sys.argv)>1 else 'evidence/campaign012/controlled.json');p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps({k:v for k,v in result.items() if k!='records'},ensure_ascii=False))
 finally:close_worker()

"""Read saved real-interface results; no scenario execution or arithmetic combat model."""
from common import *
IDS=['G-I-01','G-PZ-02','G-PZ-03','S-I-01']
def label(h):
 q=h['q'];s='';v=q+1
 while v:v,k=divmod(v-1,26);s=chr(65+k)+s
 return s+str(h['r']+1+q//2)
def snapshot(b,uid):
 u=b['core']['units'][uid];l=next((x for x in b['logistics']['units'] if x['id']==uid),None)
 return dict(alive=u['alive'],step=u['step'],hex=label(u['hex']),stockQ=l['stock'] if l else None,debt=l['debt'] if l else None,expSupply=u.get('expSupply'),entrenched=u.get('entrenched'),supply=u.get('supplyState'))
def totals(rows):return [dict(side=x['side'],dueQ=sum(u['due'] for u in x['units']),receivedQ=sum(u['received'] for u in x['units']),maintenanceQ=sum(u['maintenance'] for u in x['units']),shortQ=sum(u['due']-u['maintenance'] for u in x['units']),unitEndQ=sum(u['after'] for u in x['units']),sourceUsedQ=sum(x['source_used'].values()),hubs=x['hubs'],supplyLossSteps=sum(u['loss'] for u in x['units'])) for x in rows]
def analyze():
 results={}
 for arm in 'ABC':
  p=read(HERE/('PREFIX-'+arm+'.json.gz'));r=read(HERE/('RUN-'+arm+'.json.gz'))
  end=r['final'];start=p['initial']['bundle'];post=r['checkpoints']['POST_E6']['bundle']
  battles={k:v for k,v in end['core']['combatTransactions'].items() if k not in start['core']['combatTransactions']}
  settlement=p['E5']['boundary']['spResults'];rows6=post['logistics']['ledger']
  units={}
  attack=next((x for x in r['actions'] if x['command']['action']['type']=='ATTACK'),None)
  for uid in IDS:
   units[uid]=dict(states={name:snapshot(b,uid) for name,b in [('T5',start),('E5',p['E5']['bundle']),('T6_after_choice',r['initial']),('E6',post),('T7_pre_attack',r['checkpoints']['T7_BEFORE_ATTACK']['bundle']),('final',end)]},
    E5=next(u for rs in settlement for u in rs['units'] if u['id']==uid),E6=next(u for rs in rows6 for u in rs['units'] if u['id']==uid),
    actionCharges=[dict(type=x['type'],paidQ=x['cost']) for a in r['actions'] if a['accepted'] for x in a['journal']['charges'] if x['unit']==uid],
    actualCombatLossSteps=sum(v['lossesApplied'].get(start['core']['units'][uid]['side'],{}).get(uid,0) for v in battles.values()))
  controls=[dict(hex=label(h['coord']),before=start['core']['hexes'][k]['control'],after=h['control']) for k,h in end['core']['hexes'].items() if h['control']!=start['core']['hexes'][k]['control']]
  moves=[dict(unit=x['command']['action']['unitId'],accepted=x['accepted'],error=x['error'],validation=x['diagnostic'],charges=x['journal']['charges'] if x['accepted'] else []) for x in r['actions'] if x['command']['action']['type']=='MOVE']
  newsteps=[dict(id=uid,side=u['side'],initialStep=start['core']['units'][uid]['step'],finalStep=u['step'],initialAlive=start['core']['units'][uid]['alive'],finalAlive=u['alive']) for uid,u in end['core']['units'].items() if (u['step'],u['alive'])!=(start['core']['units'][uid]['step'],start['core']['units'][uid]['alive'])]
  results[arm]=dict(status=r['status'],phase=end['core']['phase'],turn=end['core']['turn'],units=units,E5Army=totals(settlement),E6Army=totals(rows6),
   E5AllUnits=settlement,E6AllUnits=rows6,moves=moves,selection=r['selection'],attackDiagnostic=attack['diagnostic'] if attack else None,battles=battles,
   mandatory=[dict(action=x['command']['action'],accepted=x['accepted'],error=x['error']) for x in r['actions'] if x['before']['core']['pendingDecision']],
   acceptedActions=[x['command']['action'] for x in r['actions'] if x['accepted']],rejections=[x for x in r['actions'] if not x['accepted']],
   entrenchment=[dict(action=x['command']['action'],accepted=x['accepted']) for x in r['actions'] if x['command']['action']['type']=='ENTRENCH'],
   RP=dict(initial=start['core']['rp'],afterChoice=r['initial']['core']['rp'],final=end['core']['rp']),random=dict(initial=start['core']['random'],final=end['core']['random']),
   controlChanges=controls,changedUnits=newsteps,alive={side:sum(u['alive'] and u['side']==side for u in end['core']['units'].values()) for side in ['GERMAN','SOVIET']},
   victory=end['core']['victory'],VP=dict(status='UNAVAILABLE',reason='Pinned Core has no campaign VP/W ledger; no proxy score synthesized'),
   materialTerminal={k:v for k,v in r['materialTerminal'].items() if k in ['materials','capacity','services','epoch']},audit=r['finalAudit'])
 return dict(task='CAMPAIGN-005',quarterSP=4,globalBlockersRetained=35,globalBlockersClosed=0,arms=results,
  inference='Single fixed-state short-path comparison only; no long-term balance, battle loss percentage, campaign VP or runtime approval inferred.')
if __name__=='__main__':
 result=analyze();save(HERE/'RESULT.json',result)
 for arm,r in result['arms'].items():
  print(arm,'RP',r['RP'],'E6',r['E6Army'],'moves',r['moves'],'changed',r['changedUnits'],'control',r['controlChanges'])

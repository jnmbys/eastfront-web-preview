"""Actual 640-hex authority seam fixture. Run after prepare.py; never writes runtime state.
All game changes pass live.execute. Queries are pure Core validators.
No source/parameter modifications, supply substitute, or synthetic unit insertion.
"""
import os
os.environ['OPENBLAS_NUM_THREADS']='1'
import sys,json,subprocess,hashlib,gzip
from pathlib import Path
from copy import deepcopy
from collections import Counter
HERE=Path(__file__).resolve().parent
EXP=HERE/'.runtime/experiments/supply-exp-005'
sys.path.insert(0,str(EXP))
from campaign import create_campaign,CONFIG,metadata
from live import execute,auto_command,hash_bundle,audit
from bounded import warm_start,close_worker
from model import adjacency,usable

def save(name,obj):
 data=(json.dumps(obj,ensure_ascii=False,indent=2)+'\n').encode('utf8')
 if name.endswith('.gz'):
  with (HERE/name).open('wb') as f:
   with gzip.GzipFile(filename='',fileobj=f,mode='wb',mtime=0) as z:z.write(data)
 else:(HERE/name).write_bytes(data)

def inspect(b):
 return json.loads(subprocess.check_output(['node',str(HERE/'inspect.mjs')],input=json.dumps({'state':b['core']}).encode(),cwd=HERE))

def compact(b):
 return dict(turn=b['core']['turn'],phase=b['core']['phase'],revision=b['revision'],epoch=b['logistics']['epoch'],
  rng={k:v for k,v in b['core'].items() if 'rng' in k.lower() or 'random' in k.lower()},rp=b['core']['rp'],
  units=[dict(id=u['id'],hex=u['hex'],step=u['step'],alive=u['alive'],hasMoved=u['hasMoved'],hasAttacked=u['hasAttacked'],supplyState=u['supplyState']) for u in b['core']['units'].values()],
  stock=[{k:u[k] for k in ['id','node','B','stock','debt','strength']} for u in b['logistics']['units']],audit=audit(b['logistics']))

def main():
 # Guard against running an accidentally edited authority or compiled artifact.
 provenance=json.loads((HERE/'PROVENANCE.json').read_text())
 for path,expected in provenance['runtime_files_sha256'].items():
  assert hashlib.sha256((HERE/'.runtime'/path).read_bytes()).hexdigest()==expected,path
 for path,expected in provenance['compiled_sha256'].items():
  assert hashlib.sha256((EXP/path).read_bytes()).hexdigest()==expected,path
 warm_start()
 b=create_campaign('new',17);initial=deepcopy(b);records=[];checkpoints={};queries={};settlements=[]
 mapdata=json.loads((EXP/'data/core-map.json').read_text());coords={n['id']:n['coord'] for n in mapdata['nodes']}
 names={str(c['q'])+','+str(c['r']):n for n,c in coords.items()}
 assert len(mapdata['nodes'])==640
 def checkpoint(label):
  checkpoints[label]=deepcopy(b);queries[label]=inspect(b)
  assert not queries[label]['integrity']
 def act(label,action,expected=True):
  nonlocal b
  before=compact(b);fullhash=hash_bundle(b);cmd=auto_command(b);cmd['id']='c004-'+str(len(records));cmd['action'].update(action)
  r=execute(b,cmd) # Original 3-second whole transaction budget; never increased.
  row=dict(label=label,command=cmd,accepted=r['ok'],error=r.get('error'),seconds=r['seconds'],
           before_hash=fullhash,after_hash=hash_bundle(r['state']),before=before,after=compact(r['state']))
  if r['ok']:
   b=r['state'];j=b['journal'][-1];row['receipt']=j
   if j['settled']:settlements.append(dict(label=label,turn_after=b['core']['turn'],ledger=deepcopy(b['logistics']['ledger'])))
  else:assert r['state']==b and hash_bundle(b)==fullhash
  records.append(row);print(label,r['ok'],b['core']['turn'],b['core']['phase'],r.get('error',''),flush=True)
  if expected is not None:assert r['ok']==expected,(label,r.get('error'))
  return r
 try:
  checkpoint('empty_deployment')
  # Full real roster. One opposing infantry pair at the western railway city for a real loss chain.
  # Other units are legally placed near existing supply hubs, not deleted from logistics demand.
  for side in ['S','G']:
   md=metadata(b['core'],side);anchor=coords['AC10' if side=='S' else 'A5']
   zone=sorted(md['deployment']['zone'],key=lambda h:((h['q']-anchor['q'])**2+(h['r']-anchor['r'])**2,h['q'],h['r']))
   count=Counter()
   for u in sorted(md['deployment']['roster'],key=lambda u:u['id']):
    forced={'S-I-01':'D10','G-I-01':'C10','G-PZ-01':'C10'}.get(u['id'])
    h=coords[forced] if forced else next(h for h in zone if count[(h['q'],h['r'])]<2 and names[str(h['q'])+','+str(h['r'])] not in ['C10','D10','AF4','AF10','AF16'])
    act('deploy_'+u['id'],dict(type='DEPLOY_INITIAL_UNIT',deploymentUnitId=u['id'],hex=h))
    count[(h['q'],h['r'])]+=1
   act('ready_'+side,dict(type='READY_FOR_PHASE_END'))
  checkpoint('full_roster_T1')
  act('industrial_order_unsupported',dict(type='PLACE_FORMATION_ORDER'),False)
  act('industrial_entry_unsupported',dict(type='DEPLOY_INDUSTRIAL_UNIT'),False)
  act('german_new_unit_via_initial_rejected',dict(type='DEPLOY_INITIAL_UNIT',deploymentUnitId='G-IND-NEW',hex=coords['A5']),False)
  act('german_new_unit_via_reinforcement_rejected',dict(type='DEPLOY_REINFORCEMENT',reinforcementId='G-IND-NEW',entryHex=coords['A5']),False)
  act('repair_wrong_phase',dict(type='REPAIR_UNIT',unitId='G-I-01'),False)
  while b['core']['phase']!='GERMAN_COMBAT':act('reach_first_combat',dict(type='END_PHASE'))
  act('real_infantry_attack',dict(type='ATTACK',attackerUnitIds=['G-I-01'],target=coords['D10']))
  while b['core']['pendingDecision']:
   opts=json.loads(subprocess.check_output(['node',str(EXP/'choice-probe.mjs')],input=json.dumps(b['core']).encode()))
   assert opts,'Unresolved actual Core pending choice'
   # Pass optional exploitation; for mandatory losses/retreats take first validator-approved choice.
   option=next((a for a in opts if a['type'].startswith('PASS_')),opts[0])
   act('resolve_'+b['core']['pendingDecision']['kind'],option)
  checkpoint('post_battle')
  repaired=None;moved=False;reinforced=False
  # Retain the unrepaired-network rejection, then open the real A10-C10 railway in T5.
  # No base is granted by fixture state; Core derives it from the accepted repair action.
  while b['core']['turn']<=6:
   phase=b['core']['phase'];t=b['core']['turn']
   if phase=='GERMAN_SUPPLY_RAIL' and t==5:
    checkpoint('before_rail_opening')
    edges=[]
    for a,z in [('A10','B10'),('B10','C10')]:
     edges.append(next(e['key'] for e in b['core']['edges'].values() if {str(e['a']['q'])+','+str(e['a']['r']),str(e['b']['q'])+','+str(e['b']['r'])}=={str(coords[a]['q'])+','+str(coords[a]['r']),str(coords[z]['q'])+','+str(coords[z]['r'])}))
    act('open_actual_rail_A10_C10',dict(type='RAIL_REPAIR',edgeKeys=edges))
    checkpoint('after_rail_opening')
   if phase=='SOVIET_MOVEMENT' and t==1:
    q=inspect(b);u=next((u for u in q['units'] if u['id']=='S-I-01'),None)
    if u and u['moves']:
     # Actual retreat away from the contact; no direct position or enemy removal.
     option=max(u['moves'],key=lambda m:(m['action']['path'][0]['q'],m['action']['path'][0]['r']))
     act('soviet_move_away',option['action'])
   if phase=='SOVIET_MOVEMENT' and t==4 and reinforced:
    q=inspect(b);u=next(u for u in q['units'] if u['id'].startswith('S-R-T04'))
    assert u['moves']
    act('existing_reinforcement_same_turn_move',u['moves'][0]['action'])
    checkpoint('existing_reinforcement_first_action')
   if phase=='GERMAN_RECOVERY':
    checkpoint('german_recovery_T'+str(t))
    q=queries['german_recovery_T'+str(t)];candidates=[u for u in q['units'] if not u['repairIssues']]
    if t==2:act('damaged_supplied_without_base_rejected',dict(type='REPAIR_UNIT',unitId='G-I-01'),False)
    if repaired is None and candidates:
     repaired=candidates[0]['id'];act('actual_RP_repair',dict(type='REPAIR_UNIT',unitId=repaired))
     checkpoint('repaired')
     act('duplicate_repair_rejected',dict(type='REPAIR_UNIT',unitId=repaired),False)
   if phase=='GERMAN_MOVEMENT' and repaired and not moved:
    q=inspect(b);u=next(u for u in q['units'] if u['id']==repaired)
    if u['moves']:
     act('repaired_unit_subsequent_move',u['moves'][0]['action']);moved=True;checkpoint('after_repaired_move')
     break
   if phase=='SOVIET_REINFORCEMENT_SUPPLY' and t==4:
    checkpoint('before_existing_reinforcement')
    md=metadata(b['core'],'S');assert md['reinforcements']
    act('unknown_industrial_slot_rejected',dict(type='DEPLOY_REINFORCEMENT',reinforcementId='S-IND-NEW',entryHex=coords['AF4']),False)
    for site in ['J7','M14','R9','AD9','AC10']:
     act('non_entry_'+site+'_rejected',dict(type='DEPLOY_REINFORCEMENT',reinforcementId=md['reinforcements'][0]['id'],entryHex=coords[site]),False)
    for slot in md['reinforcements']:
     act('existing_soviet_entry',dict(type='DEPLOY_REINFORCEMENT',reinforcementId=slot['id'],entryHex=coords['AF4']))
     lu=next(u for u in b['logistics']['units'] if u['id']==slot['id']);assert lu['stock']==0
    act('existing_slot_duplicate_rejected',dict(type='DEPLOY_REINFORCEMENT',reinforcementId=md['reinforcements'][0]['id'],entryHex=coords['AF4']),False)
    reinforced=True;checkpoint('after_existing_reinforcement')
   act('advance_'+phase,dict(type='END_PHASE'))
  checkpoint('final')
  status=dict(status='COMPLETE_WITH_INTERFACE_BLOCKERS',actual_repair_unit=repaired,subsequent_move=moved,existing_soviet_entry=reinforced,
    accepted=sum(r['accepted'] for r in records),rejected=sum(not r['accepted'] for r in records),settlements=len(settlements))
 except Exception as e:
  status=dict(status='STOPPED',error=str(e));raise
 finally:
  save('INITIAL.json.gz',initial);save('CHECKPOINTS.json.gz',checkpoints);save('QUERIES.json.gz',queries)
  save('ACTIONS.json.gz',records);save('SETTLEMENTS.json.gz',settlements);save('RUN_STATUS.json',status)
  close_worker()
 print(json.dumps(status))

if __name__=='__main__':main()

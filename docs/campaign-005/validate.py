"""Targeted 005 evidence checks; no old transaction, fault, concurrency or scan suites."""
import sys,subprocess,tarfile,io
from common import *
from analyze import analyze
sys.path.insert(0,str(original()))
import live
def main():
 policy();checks=[]
 def ok(name,detail=None):checks.append(dict(name=name,passed=True,detail=detail))
 p={a:read(HERE/('PREFIX-'+a+'.json.gz')) for a in 'ABC'};r={a:read(HERE/('RUN-'+a+'.json.gz')) for a in 'ABC'}
 start=read(HERE/'START_T5.json.gz')
 assert all(x['initial']['bundle']==start for x in p.values())
 assert start['core']['random']==dict(seed=17,state=1150042706,draws=2)
 assert len(start['core']['hexes'])==640
 assert len(start['core']['units'])==60
 lots=[[(u['material'],u['quantity'],u['owner']) for u in x['imported']['materials']['lots'].values()] for x in p.values()]
 assert lots[0]==lots[1]==lots[2]
 ok('same_real_T5_640_hexes_60_units_random_and_initial_resources')
 for a in 'ABC':
  ref=read(owner('011' if a=='C' else '008')/'TRACE.json.gz')
  for key in ['preE5','E5','T6']:assert p[a][key]['bundleJSON']==ref[key]['bundleJSON']
  assert len(p[a]['actions'])==10
  assert p[a]['handoff']==read(HERE/('HANDOFF-'+a+'.json.gz'))
  assert r[a]['initial']==p[a]['handoff']['bundle']
 assert p['C']['handoff']['bundleJSON']==read(owner('011')/'TRACE.json.gz')['recovered']['bundleJSON']
 ok('historical_exact_gates_and_unmodified_handoffs')
 assert [r[a]['initial']['core']['rp']['GERMAN'] for a in 'ABC']==[8,7,8]
 assert [r[a]['initial']['core']['units']['G-I-01']['step'] for a in 'ABC']==[1,0,0]
 assert all(r[a]['initial']['core']['random']==start['core']['random'] for a in 'ABC')
 ok('correct_single_repair_choices_no_random_payment')
 for a in 'ABC':
  prior=r[a]['initial']
  for x in r[a]['actions']:
   assert x['before']==prior
   assert x['command']['revision']==prior['revision']
   if x['accepted']:
    assert x['after']['revision']==prior['revision']+1
    assert x['after']['journal'][-1]==x['journal']
    assert x['journal']['command']==x['command']
   else:assert x['after']==prior
   assert x['audit']==live.audit(x['after']['logistics']);prior=x['after']
  assert prior==r[a]['final']
  assert r[a]['status']=='COMPLETED_T7_GERMAN_COMBAT'
  c=prior['core'];assert c['turn']==7 and c['phase']=='GERMAN_RECOVERY' and c['pendingDecision'] is None
  assert c['random']==dict(seed=17,state=22020245,draws=4)
 ok('every_action_state_chain_conservation_stop_boundary_and_two_random_draws')
 for a in 'ABC':
  s=r[a]['materialTerminal'];assert s==r[a]['frozenSidecar'] and digest(s)==r[a]['frozenSidecarHash']
  assert len(s['materials']['imports'])==1
  for lot in s['materials']['lots'].values():assert lot['quantity']+lot['spent']==lot['initialQuantity']
  assert all(l['status']==('SPENT' if a=='C' else 'QUARANTINED') for l in s['materials']['lots'].values())
  if a=='C':
   assert len(s['services'])==1 and next(iter(s['services'].values()))['status']=='CONSUMED'
   assert s['capacity']==p[a]['E5']['capacity']
  assert sum(x['journal']['settled'] for x in r[a]['actions'] if x['accepted'])==1
  assert all(x['command']['action']['type']!='REPAIR_UNIT' for x in r[a]['actions'])
 ok('terminal_kit_preserved_single_E6_no_second_repair_or_transport')
 for a in 'ABC':
  actions=r[a]['actions'];ent=next(x for x in actions if x['command']['action']['type']=='ENTRENCH')
  assert ent['accepted'] and ent['command']['action']['controllerId']==ent['before']['core']['units']['S-I-01']['controllerId']
  selected=[x['unitId'] for x in r[a]['selection'] if x['selected']];assert selected==['G-I-01','G-PZ-03']
  assert r[a]['selection'][2]['diagnostic']['issues'][0]['code']=='NOT_ADJACENT_TO_TARGET'
  assert [x['command']['action']['type'] for x in actions if x['before']['core']['pendingDecision']]==['RETREAT','ADVANCE_AFTER_COMBAT']
  assert all(x['accepted'] for x in actions)
 ok('same_registered_policy_legal_entrenchment_moves_selection_and_pending')
 summary=analyze();assert summary==read(HERE/'RESULT.json')
 for a,v in summary['arms'].items():
  battle=next(iter(v['battles'].values()))
  assert battle['context']['attackStrength']==(8 if a=='A' else 9)
  assert battle['resolution']['crtResult']=='DR'
  assert battle['resolution']['attackerLossSteps']==battle['resolution']['defenderLossSteps']==0
  assert v['E6Army'][1]['supplyLossSteps']==1
  assert v['VP']['status']=='UNAVAILABLE' and not v['controlChanges']
 ok('derived_summary_matches_full_records_actual_losses_separated_from_factors')
 for a in 'ABC':
  req=dict(coreFile=str(original()/'core/dist/index.js'),state=r[a]['final']['core'],op='integrity')
  out=subprocess.run(['node',str(HERE/'query.mjs')],input=json.dumps(req),text=True,encoding='utf8',capture_output=True,check=True)
  assert json.loads(out.stdout)['issues']==[]
 ok('original_Core_final_integrity_all_arms')
 for tag in ['008','011']:
  manifest=read(owner(tag)/'.runtime/manifest.json')
  for name,h in manifest['files'].items():assert hashlib.sha256((owner(tag)/'.runtime'/name).read_bytes()).hexdigest()==h,name
  for name,h in read(HERE/'PROVENANCE.json')['inputs'][tag]['files'].items():
   assert hashlib.sha256((owner(tag)/Path(name).name).read_bytes()).hexdigest()==h,name
 sourcePrefix='experiments/supply-exp-005';sourceCommit='813b4072568352e95d0726fe5fe04060c889c554'
 archive=subprocess.check_output(['git','archive',sourceCommit,sourcePrefix],cwd=HERE.parents[1])
 with tarfile.open(fileobj=io.BytesIO(archive)) as tf:
  files=[m for m in tf.getmembers() if m.isfile()]
  for m in files:assert (original()/Path(m.name).relative_to(sourcePrefix)).read_bytes()==tf.extractfile(m).read(),m.name
 ok('pinned_owner_original_runtime_and_derived_runtime_bytes_unchanged',dict(originalRuntimeCommit=sourceCommit,originalFilesComparedToGit=len(files)))
 blockers=read(HERE/'BLOCKERS.json');assert len(blockers['rows'])==35 and blockers['closed']==0 and not blockers['runtimeAllowed']
 ok('35_global_blockers_retained_no_runtime_approval')
 save(HERE/'VALIDATION.json',dict(status='PASS',checks=checks,oldTransactionSuitesRun=False,unexercisedPending=['LOSS_ALLOCATION','BREAKTHROUGH_OPTION','SCHWERPUNKT_OPTION'],note='Fixture implements fixed policies but does not claim these unencountered branches tested.'))
 print('PASS',len(checks),'targeted evidence checks; no old suites.')
if __name__=='__main__':main()

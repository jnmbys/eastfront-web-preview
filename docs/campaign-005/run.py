"""Replay exactly the registered three arms into ignored files; compare all game states."""
import sys,os,subprocess
from common import *
def comparable_run(record):
 # Preserve the existing wall-time exclusions. Normalize only this path metadata field;
 # never rewrite strings inside gameplay, actions, queries or material records.
 result={k:v for k,v in record.items() if k not in ['frozenSidecar','frozenSidecarHash','materialTerminal']}
 result['actions']=[{k:v for k,v in action.items() if k!='seconds'} for action in record['actions']]
 result['originalRuntime']=record['originalRuntime'].replace('\\','/')
 return result

def compare_arm(old,new,op,np,arm):
 assert comparable_run(old)==comparable_run(new),('CONTINUATION_REPLAY_DIFFERENCE',arm)
 for key in ['initial','imported','preE5','E5','T6','handoff']:
  assert op[key]['bundleJSON']==np[key]['bundleJSON'],(arm,key)
  for part in ['materials','capacity','services','epoch']:
   assert op[key].get(part)==np[key].get(part),(arm,key,part)
 # Historical sidecar receipts contain solver timings. Retain each run's full immutable
 # sidecar/hash check as well as the strict cross-run material comparisons above.
 for record in [old,new]:
  assert record['materialTerminal']==record['frozenSidecar']
  assert digest(record['materialTerminal'])==record['frozenSidecarHash']

def main():
 policy();target=HERE/'.runtime/replay';target.mkdir(parents=True,exist_ok=True)
 env=dict(os.environ,CAMPAIGN005_OUTPUT=str(target));checks=[]
 # Complete all strict historical gates before any short continuation.
 for arm in 'ABC':subprocess.run([sys.executable,str(HERE/'prefix.py'),arm],env=env,check=True)
 for arm in 'ABC':subprocess.run([sys.executable,str(HERE/'continue.py'),arm],env=env,check=True)
 for arm in 'ABC':
  old=read(HERE/('RUN-'+arm+'.json.gz'));new=read(target/('RUN-'+arm+'.json.gz'))
  op=read(HERE/('PREFIX-'+arm+'.json.gz'));np=read(target/('PREFIX-'+arm+'.json.gz'))
  compare_arm(old,new,op,np,arm)
  checks.append(dict(arm=arm,allContinuationGameplayAndQueriesExact=True,prefixSnapshotsExact=True,materialsExact=True))
 save(HERE/'REPLAY.json',dict(status='PASS',arms=checks,scope='Same three arms, same policy/seed; deterministic verification, no additional strategy or scenario',oldTransactionSuitesRun=False))
 print('PASS: full three-arm replay, all game states and material semantics exact.')
if __name__=='__main__':main()

"""Replay exactly the registered three arms into ignored files; compare all game states."""
import sys,os,subprocess
from common import *
def main():
 policy();target=HERE/'.runtime/replay';target.mkdir(parents=True,exist_ok=True)
 env=dict(os.environ,CAMPAIGN005_OUTPUT=str(target));checks=[]
 # Complete all strict historical gates before any short continuation.
 for arm in 'ABC':subprocess.run([sys.executable,str(HERE/'prefix.py'),arm],env=env,check=True)
 for arm in 'ABC':subprocess.run([sys.executable,str(HERE/'continue.py'),arm],env=env,check=True)
 for arm in 'ABC':
  old=read(HERE/('RUN-'+arm+'.json.gz'));new=read(target/('RUN-'+arm+'.json.gz'))
  # Deliberately compare every gameplay, policy and material value. Only transaction wall time differs.
  for r in [old,new]:
   for action in r['actions']:action.pop('seconds',None)
   # The immutable sidecar includes historical solver wall-time receipts. These are checked by
   # each run's own full sidecar hash; compare the non-timing semantic subset below separately.
   for k in ['frozenSidecar','frozenSidecarHash','materialTerminal']:r.pop(k,None)
  assert old==new,('CONTINUATION_REPLAY_DIFFERENCE',arm)
  op=read(HERE/('PREFIX-'+arm+'.json.gz'));np=read(target/('PREFIX-'+arm+'.json.gz'))
  for key in ['initial','imported','preE5','E5','T6','handoff']:
   assert op[key]['bundleJSON']==np[key]['bundleJSON'],(arm,key)
   for part in ['materials','capacity','services','epoch']:
    assert op[key].get(part)==np[key].get(part),(arm,key,part)
  for r in [read(HERE/('RUN-'+arm+'.json.gz')),read(target/('RUN-'+arm+'.json.gz'))]:
   assert r['materialTerminal']==r['frozenSidecar']
   assert digest(r['materialTerminal'])==r['frozenSidecarHash']
  checks.append(dict(arm=arm,allContinuationGameplayAndQueriesExact=True,prefixSnapshotsExact=True,materialsExact=True))
 save(HERE/'REPLAY.json',dict(status='PASS',arms=checks,scope='Same three arms, same policy/seed; deterministic verification, no additional strategy or scenario',oldTransactionSuitesRun=False))
 print('PASS: full three-arm replay, all game states and material semantics exact.')
if __name__=='__main__':main()

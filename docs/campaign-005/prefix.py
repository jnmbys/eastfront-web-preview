"""Only the historically supported E5/T6 slice, in a fresh process per arm."""
import sys,os
from common import *
def main():
 arm=sys.argv[1];assert arm in 'ABC';policy()
 tag='011' if arm=='C' else '008';sys.path.insert(0,str(owner(tag)))
 from adapter import Transactions,phase_action
 from config import verify_runtime
 verify_runtime()
 s=Transactions('011-main' if arm=='C' else '005-'+arm)
 ref=read(owner(tag)/'TRACE.json.gz');t8=read(owner('008')/'TRACE.json.gz')
 start=s.snapshot();assert start['bundleJSON']==t8['initial']['bundleJSON']==ref['initial']['bundleJSON']
 assert read(HERE/'START_T5.json.gz')==start['bundle']
 receipt=s.import_initial();assert receipt['ok'],receipt
 imported=s.snapshot();assert imported['bundleJSON']==start['bundleJSON']
 trace=dict(arm=arm,initial=start,imported=imported,actions=[],exactGates=[])
 for cmd in t8['commands']:
  assert s.snapshot()['bundle']['revision']==cmd['revision']
  assert phase_action(s)==cmd['action']
  reply=s.submit(s.request(cmd['id'],cmd['action']));assert reply['ok'],reply
  state=s.snapshot();trace['actions'].append(dict(command=cmd,reply=reply,state=state))
  for label,revision in [('preE5',115),('E5',116),('T6',119)]:
   if state['bundle']['revision']==revision:
    assert state['bundleJSON']==ref[label]['bundleJSON'],('EXACT_REPLAY_FAILED',arm,label)
    trace[label]=state;trace['exactGates'].append(dict(checkpoint=label,bundleJSONExact=True))
 assert len(trace['actions'])==10
 if arm!='A':
  action=dict(type='REPAIR_UNIT',controllerId='G-HUMAN-1',unitId='G-I-01')
  # C uses the historical ID as well, allowing byte-exact comparison including journal/seen.
  request=s.request('011-recover' if arm=='C' else '005-B-recover',action,'PE' if arm=='C' else 'RP')
  reply=s.submit(request);assert reply['ok'],reply
  trace['repair']=dict(request=request,reply=reply)
  result=s.snapshot()
  assert result['bundle']['core']['units']['G-I-01']['step']==0
  assert result['bundle']['core']['rp']['GERMAN']==(8 if arm=='C' else 7)
  assert result['bundle']['core']['random']==trace['T6']['bundle']['core']['random']
  if arm=='C':
   assert result['bundleJSON']==ref['recovered']['bundleJSON'],'C_REPAIR_REPLAY_FAILED'
   for k in ['materials','capacity','services']:assert result[k]==ref['recovered'][k],k
 else:
  result=s.snapshot();trace['repair']=dict(choice='NO_RECOVERY',actionSubmitted=False)
 trace['handoff']=result
 save(DATA/('PREFIX-'+arm+'.json.gz'),trace)
 save(DATA/('HANDOFF-'+arm+'.json.gz'),result)
 print(arm,'exact prefix matched; handoff revision',result['bundle']['revision'],flush=True)
if __name__=='__main__':main()

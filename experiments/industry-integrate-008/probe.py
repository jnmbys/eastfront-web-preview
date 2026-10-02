"""Short real T5 -> E5 -> T6 probe. No campaign replay or state edits."""
import json
from adapter import Transactions,phase_action
from config import HERE
def main():
    s=Transactions('008-real-probe');print(s.import_initial(),flush=True)
    events=[]
    for i in range(24):
        b=s.snapshot()['bundle'];c=b['core'];print(c['turn'],c['phase'],b['revision'],bool(c['pendingDecision']),flush=True)
        if c['turn']==6 and c['phase']=='GERMAN_RECOVERY':break
        request=s.request('008-progress-'+str(b['revision']),phase_action(s))
        reply=s.submit(request);events.append(dict(request=request,reply=reply));print(json.dumps(reply if not reply['ok'] else dict(ok=True,seconds=reply.get('seconds'))),flush=True)
        if not reply['ok']:break
    snap=s.snapshot()
    if snap['boundary']:print(json.dumps(snap['boundary']['rows']),flush=True)
    request=s.request('008-recover',dict(type='REPAIR_UNIT',controllerId='G-HUMAN-1',unitId='G-I-01'),'PE')
    plan=s.plan(request);print(json.dumps(plan),flush=True)
    if plan['ok']:
        reply=s.submit(request);print(json.dumps(reply),flush=True);events.append(dict(request=request,reply=reply))
    (HERE/'.runtime/test-inputs').mkdir(exist_ok=True)
    (HERE/'.runtime/test-inputs/probe.json').write_text(json.dumps(dict(events=events,final=s.snapshot()),ensure_ascii=False),encoding='utf8')
if __name__=='__main__':main()

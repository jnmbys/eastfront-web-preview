"""Replay the recorded real campaign, asserting every hash and loss/inventory seam."""
from campaign011 import Memory
from campaign import *
from bounded import warm_start, close_worker
from collections import Counter
import gzip, platform, sys


def check_losses(before, after, journal):
    # The ledger is the sole source of supply step losses: no legacy attrition added.
    expected = Counter({u['id']:u['loss'] for side in after['logistics']['ledger'] for u in side['units'] if u['loss']}) if journal['settled'] else Counter()
    events = journal['supply_events']
    assert Counter(e['unitId'] for e in events if e['type']=='UnitStepLost') == expected
    for e in events:
        assert e.get('actionId') == 'SUPPLY-L'+str(after['logistics']['tick']-1)
    # Apply the *actual* Core event stream and compare every old unit. No unexplained step/death.
    prior = before['core']['units']; current = after['core']['units']
    steps = {uid:(u['step'],u['alive']) for uid,u in prior.items()}
    for e in journal['events']+events:
        if e['type']=='UnitStepLost':
            step,alive=steps[e['unitId']];assert alive and step==e['fromStep']
            steps[e['unitId']]=(step if e['toStep'] is None else e['toStep'],e['toStep'] is not None)
        elif e['type']=='UnitDestroyed':
            step,_=steps[e['unitId']];steps[e['unitId']]=(step,False)
    for uid,(step,alive) in steps.items():
        assert current[uid]['alive']==alive,(uid,'unexplained death')
        if alive:assert current[uid]['step']==step,(uid,'unexplained loss')
    assert {u['id'] for u in after['logistics']['units']}=={uid for uid,u in current.items() if u['alive']}
    retired=set(after['logistics']['continuity']['retired'])
    assert not retired & {u['id'] for u in after['logistics']['units']}
    charges=sum(x['cost'] for x in journal['charges'])
    assert after['logistics']['action_spent']-before['logistics']['action_spent']==charges
    assert after['logistics']['tick']-before['logistics']['tick']==int(journal['settled'])
    audit(after['logistics'])


def main():
    path=ROOT/'evidence/campaign011/run.json'
    d=json.loads(path.read_text()) if path.exists() else json.loads(gzip.decompress(path.with_suffix('.json.gz').read_bytes()))
    memory=Memory();memory.start();warm_start();start=time.perf_counter();b=create_campaign('new',d['seed']);timings=[];rollback=None
    assert CONFIG==d['config'];assert hash_bundle(b)==d['initial_hash']
    out={'passed':False,'budget_seconds':3}
    try:
        for i,r in enumerate(d['records'],1):
            if r['settled'] and rollback is None:
                prior=deepcopy(b);failed=execute(b,r['command'],seconds=.001)
                assert not failed['ok'] and failed['state']==prior and b==prior
                rollback=dict(revision=b['revision'],injected_budget_seconds=.001,error=failed['error'],unchanged=True)
            before=b;result=execute(b,r['command'],seconds=3)
            assert result['ok'],(i,result.get('error'));b=result['state']
            assert hash_bundle(b)==r['hash'],(i,'hash mismatch')
            check_losses(before,b,b['journal'][-1])
            duplicate=execute(b,r['command'],seconds=3)
            assert duplicate['ok'] and duplicate['duplicate'] and duplicate['state']==b
            timings.append({'revision':i,'seconds':result['seconds'],'settled':r['settled']})
            if r['settled']: print('VERIFIED',i,b['core']['turn'],round(result['seconds'],3),flush=True)
        assert b['core']['phase']=='GAME_OVER' and hash_bundle(b)==d['final_hash']
        out.update(passed=True,actions=len(timings),final_hash=hash_bundle(b),victory=b['core']['victory'],audit=audit(b['logistics']))
    except Exception as e:
        out.update(error=repr(e),stopped_revision=b['revision']);print('FAIL',repr(e),flush=True)
    finally:
        close_worker();out.update(memory=memory.finish(),wall_seconds=time.perf_counter()-start,timings=timings,timeout_rollback=rollback,environment={'python':platform.python_version(),'platform':platform.platform(),'node':subprocess.check_output(['node','--version'],text=True).strip(),'cpu_max':Path('/sys/fs/cgroup/cpu.max').read_text().strip(),'memory_max':Path('/sys/fs/cgroup/memory.max').read_text().strip(),'OPENBLAS_NUM_THREADS':os.environ.get('OPENBLAS_NUM_THREADS')})
        (ROOT/'evidence/campaign011/replay.json').write_text(json.dumps(out,indent=2));print('RESULT',out['passed'],out['memory'],flush=True)
    if not out['passed']:sys.exit(1)
if __name__=='__main__':main()

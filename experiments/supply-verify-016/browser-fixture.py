"""Local-only operator harness. Production HTTP/UI/execute unchanged; no test endpoint."""
import os, sys, json, gzip, time, argparse, hashlib
from pathlib import Path
from copy import deepcopy
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'experiments/supply-integrate-015'))
os.environ.update(COOKIE_SECURE='0',BIND_HOST='127.0.0.1',PYTHONUTF8='1',OPENBLAS_NUM_THREADS='1')
import service as s
from live import execute,hash_bundle

def load_case(kind):
    read=lambda p:json.load(gzip.open(s.EXP/'evidence'/p,'rt',encoding='utf-8'))
    if kind=='advance-delivery':
        return read('campaign011-close/checkpoint-66.json.gz')['state']
    b=read('campaign011-final/checkpoint-75.json.gz')['state']
    records=read('campaign011-final/reserve-recovery-repeat.json.gz')['records']
    for j in records[:1 if kind=='movement' else 3]:
        r=execute(b,j['command']);assert r['ok'];b=r['state'];assert hash_bundle(b)==j['hash']
    return b

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('case',choices=['movement','combat','advance-delivery']);p.add_argument('--port',type=int,required=True);a=p.parse_args()
    s.warm_start();baseline=load_case(a.case)
    original_create=s.create_campaign
    s.create_campaign=lambda mode:deepcopy(baseline) if mode=='new' else original_create(mode)
    out=Path(__file__).parent/'evidence'/f'{a.case}-authority.json'
    report=dict(case=a.case,baseline_revision=baseline['revision'],baseline_hash=hash_bundle(baseline),fixture_only=True,actions=[])
    original=s.transact
    def observed(slot,cmd):
        before=deepcopy(slot['state']);began=time.perf_counter()
        try:result=original(slot,cmd)
        except Exception as e:
            report['actions'].append(dict(accepted=False,error=type(e).__name__,unchanged=slot['state']==before,wall_seconds=time.perf_counter()-began))
            out.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');raise
        wall=time.perf_counter()-began
        latest=slot['state']['journal'][-1]
        reference=execute(before,latest['command'])
        equal=reference['ok'] and reference['state']==slot['state']
        report['actions'].append(dict(accepted=True,type=cmd['action']['type'],action=cmd['action'],revision=slot['state']['revision'],seconds=slot['seconds'],wall_seconds=wall,sandbox_state_equal=equal,hash=hash_bundle(slot['state']),receipt=slot['receipt']))
        out.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        assert equal,'Frozen executor reference mismatch'
        return result
    s.transact=observed
    out.write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(f'Fixture {a.case} revision {baseline["revision"]} ready on 127.0.0.1:{a.port}',flush=True)
    s.online.Service(('127.0.0.1',a.port),s.Handler).serve_forever()

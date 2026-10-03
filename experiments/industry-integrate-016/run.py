"""Actual bounded continuation only: same full T8 start -> T9 repair / end E9."""
import gzip,json,sys,time
from config import HERE,digest,sha
from adapter import Transactions,query
def ok(tx,q):
    result=tx.submit(q)
    assert result['ok'],result
    print(json.dumps(dict(id=q['id'],gameRevision=tx.snapshot()['bundle']['revision'],seconds=result.get('seconds'),replayed=result.get('replayed'))),flush=True)
    return result
def advance(tx,turn,phase,records):
    for _ in range(32):
        r=tx.snapshot();c=r['bundle']['core']
        if (c['turn'],c['phase'])==(turn,phase):return
        q=tx.phase_request();before=tx.snapshot();result=ok(tx,q)
        records.append(dict(request=q,result=result,**({'beforeBoundary':before,'afterBoundary':tx.snapshot()} if result.get('boundary') else {})))
    raise AssertionError('LEGAL_CONTINUATION_GUARD')
def main():
    tx=Transactions();trace=dict(origin='REAL_LEGAL_EXECUTION_SINGLE_PROCESS',start=tx.snapshot(),records=[]);views={'start':tx.view()}
    care=tx.request('016-care',{'type':'PAY_CARE'});trace['careResult']=ok(tx,care);trace['care']=tx.snapshot();views['carePaid']=tx.view()
    advance(tx,9,'GERMAN_RECOVERY',trace['records']);trace['preRecovery']=tx.snapshot();views['received']=tx.view()
    trace['commonBefore']=query(trace['preRecovery']['bundle'],time.perf_counter()+3)
    repair=tx.request('016-repair',dict(type='REPAIR_UNIT',controllerId='G-HUMAN-1',unitId='G-I-01'))
    trace['recoveryResult']=ok(tx,repair);trace['recovered']=tx.snapshot();trace['commonAfter']=query(tx.snapshot()['bundle'],time.perf_counter()+3);views['recovered']=tx.view()
    if '--main-only' not in sys.argv:
        control=Transactions(test_label='actual-no-operation-control');records=[]
        advance(control,9,'GERMAN_RECOVERY',records);trace['control']=dict(origin='REAL_SAME_START_NO_CARE_NO_SHIPMENT',records=records,root=control.snapshot());views['controlExpired']=control.view()
        unused=Transactions(test_label='actual-unused-E9');records=[];ok(unused,unused.request('016-unused-care',{'type':'PAY_CARE'}))
        advance(unused,9,'GERMAN_RECOVERY',records);trace['unusedT9']=unused.snapshot()
        advance(unused,10,'GERMAN_SUPPLY_RAIL',records);trace['unusedEndE9']=dict(origin='REAL_LEGAL_CONTINUATION_NO_RECOVERY_NORMAL_MAINTENANCE',records=records,root=unused.snapshot());views['unusedExpired']=unused.view()
    raw=(json.dumps(trace,ensure_ascii=False,separators=(',',':'))+'\n').encode()
    (HERE/'TRACE.json.gz').write_bytes(gzip.compress(raw,mtime=0));(HERE/'VIEWS.json').write_bytes((json.dumps(views,ensure_ascii=False,indent=2)+'\n').encode())
    (HERE/'RUN.json').write_bytes((json.dumps(dict(traceSha256=sha(raw),startHash=digest(trace['start']),recoveredHash=digest(trace['recovered']),gameRevision=trace['recovered']['bundle']['revision'],rootRevision=trace['recovered']['revision']),indent=2)+'\n').encode())
    print('SAVED_ACTUAL_CHECKPOINTS')
if __name__=='__main__':main()

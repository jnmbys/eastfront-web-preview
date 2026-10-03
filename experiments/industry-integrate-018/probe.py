"""Real full-chain command-line entry, also usable before starting HTTP."""
import json,gzip
from owner import Transactions
from loader import HERE,digest
def main():
    tx=Transactions();records=[];start=tx.head()
    try:
        for count in range(60):
            r=tx.snapshot();i=r['industry'];p=r.get('personnel');f=r.get('forward',{});c=r['bundle']['core'];stage=tx.head()['stage']
            if f.get('recovery'):break
            op='ALLOCATE_I' if not i['grants'] else 'PLACE_ORDER' if not i['order'] else 'ACTIVATE_PERSONNEL' if stage=='013' and not p['importReceipt'] else 'APPLY_PERSONNEL' if stage=='013' and not p['application'] else 'CARE' if stage=='016' and not f.get('care') else 'RECOVER' if (c['turn'],c['phase'])==(9,'GERMAN_RECOVERY') else 'NEXT'
            q=tx.request('018-probe-'+str(count),op);res=tx.submit(q);records.append(dict(request=q,result=res))
            print(json.dumps(dict(n=count,op=op,ok=res['ok'],game=tx.snapshot()['bundle']['revision'],detail=res.get('detail'))),flush=True)
            assert res['ok'],res
        else:raise AssertionError('NO_FINISH')
        end=tx.head();(HERE/'.runtime/PROBE.json.gz').write_bytes(gzip.compress(json.dumps(dict(start=start,end=end,records=records,handoffs=tx.checkpoints),ensure_ascii=False).encode(),mtime=0))
        print('FULL_CHAIN_OK',digest(end))
    finally:tx.close()
if __name__=='__main__':main()

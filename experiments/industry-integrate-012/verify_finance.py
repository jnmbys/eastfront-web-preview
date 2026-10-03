"""Fast targeted envelope/payment tests; no campaign or E boundary replay."""
import json,sys
from adapter import Transactions
from config import HERE

def main():
    s=Transactions();q=s.request('grant',{'type':'ALLOCATE_I'});assert s.submit(q)['ok']
    duplicate=s.request('grant-duplicate',{'type':'ALLOCATE_I'});before=s.snapshot();assert s.submit(duplicate)['replayed']
    assert s.snapshot()['industry']==before['industry'] and s.snapshot()['revision']==before['revision']
    assert s.submit(s.request('order',{'type':'PLACE_ORDER'}))['ok']
    newer=s.snapshot();assert s.submit(duplicate)['replayed'];assert s.snapshot()==newer
    box={'on':False}
    def fail(stage):
        if box['on'] and stage=='after_payment':box['on']=False;raise RuntimeError('SYNTHETIC_PAYMENT_FAULT')
    owner=Transactions('012-test-payment',test_mode=True,test_fault=fail)
    assert owner.submit(owner.request('grant',{'type':'ALLOCATE_I'}))['ok']
    before=owner.snapshot();order=owner.request('order',{'type':'PLACE_ORDER'});box['on']=True
    denied=owner.submit(order);assert not denied['ok']
    after=owner.snapshot();assert {k:v for k,v in after.items() if k!='receipts'}=={k:v for k,v in before.items() if k!='receipts'}
    assert owner.submit(order)['ok'];assert owner.snapshot()['industry']['budget']['productionSpent']==3
    report=dict(status='PASS',origin='SYNTHETIC_TARGETED_TRANSACTION_TEST',
        checks=['duplicate_permanent_grant_no_new_credit','late_duplicate_envelope_returns_committed_receipt',
                'production_payment_and_escrow_precommit_failure_rollback','payment_retry_once'],
        failure=denied,after=owner.read_view())
    if '--write' in sys.argv:(HERE/'FINANCE-VERIFICATION.json').write_bytes((json.dumps(report,indent=2)+'\n').encode())
    else:assert json.loads((HERE/'FINANCE-VERIFICATION.json').read_bytes())==report
    print('PASS_4_TARGETED_FINANCE_CHECKS')
if __name__=='__main__':main()

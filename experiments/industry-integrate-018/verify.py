"""One actual HTTP/browser run and labelled private forks; never replay an old campaign suite."""
import json,gzip,sys,os,subprocess,threading,socket,time,http.client,uuid
from copy import deepcopy
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from loader import HERE,digest,reference
from session import Session
from local_server import LocalServer

def export_ledger(trace,trace_hash):
    rows=[{k:s[k] for k in ['version','gameRevision','turn','phase','equipmentBudget','personnelBudget','care','materials','rearInventory','frontInventory','transport','recovery','impact']}
          for s in trace['views'] if s['version'] in [0,1,2,8,18,22,23,24,34,37,38,45,48,49]]
    result=dict(origin='EXTRACTED_FROM_THIS_REAL_HTTP_TRACE',rows=rows,maxSubmitSeconds=max(r['engineResult'].get('seconds',0) for r in trace['requests'].values()),sourceTraceSha256=trace_hash)
    (HERE/'LEDGER.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')

class ObservedSession(Session):
    def __init__(self):self.captures={};self.views=[];super().__init__()
    def _state(self):
        v=super()._state();r=self.tx.snapshot();c=r['bundle']['core'];ver=r['revision']
        labels=[]
        for value,label in [(1,'funded'),(21,'preT7'),(22,'T7'),(23,'imported'),(36,'preT8'),(37,'T8'),(38,'care'),(48,'preRecovery')]:
            if ver==value:labels.append(label)
        if c['phase']=='SOVIET_ENTRENCHMENT' and c['turn'] in [6,7,8]:labels.append('preE'+str(c['turn']))
        for label in labels:
            if label not in self.captures:self.captures[label]=self.tx.fork_test('SYNTHETIC-CAPTURE-'+label)
        self.views.append(deepcopy(v));return v

def main():
    servers=[];sessions=[];threads=[];ports=[];checks=[];faults=[]
    def start(s):
        sessions.append(s);sv=LocalServer(0,s);servers.append(sv);ports.append(sv.server_port)
        t=threading.Thread(target=sv.serve_forever,kwargs={'poll_interval':.05},daemon=True);t.start();threads.append(t);return sv
    def record(name,details,origin='SYNTHETIC_PRIVATE_FORK'):
        checks.append(dict(name=name,origin=origin,passed=True,details=details));print(name,flush=True)
    def request(s,path='/api/state',method='GET',body=None,headers=None):
        conn=http.client.HTTPConnection('127.0.0.1',s.server_port,timeout=8);h={'Host':s.host,'X-Local-Session':s.token}
        if method=='POST':h.update(Origin=s.origin,**{'Content-Type':'application/json'})
        if headers:h.update(headers)
        try:
            conn.request(method,path,body=json.dumps(body) if body is not None else None,headers=h);r=conn.getresponse();return r.status,json.loads(r.read())
        finally:conn.close()
    def body(s,op):
        v=s.session.state();return dict(requestId=str(uuid.uuid4()),instanceId=v['instanceId'],expectedVersion=v['version'],operation=op)
    def finish(s,b):
        for _ in range(50):
            status,r=request(s,'/api/requests/'+b['requestId'])
            if r['status'] not in ['PENDING','PROCESSING']:return r
            time.sleep(.05)
        raise AssertionError('RECEIPT_TIMEOUT')
    def act(t,op,prefix):
        q=t.request(prefix+'-'+str(uuid.uuid4()),op);r=t.submit(q);assert r['ok'],r;return q,r
    def diff(a,b,path=''):
        if type(a)!=type(b):return [path]
        if isinstance(a,dict):return [p for k in sorted(set(a)|set(b)) for p in ([path+'/'+k] if k not in a or k not in b else diff(a[k],b[k],path+'/'+k))]
        if isinstance(a,list):return [path] if len(a)!=len(b) else [p for i,(x,y) in enumerate(zip(a,b)) for p in diff(x,y,path+'/'+str(i))]
        return [] if a==b else [path]
    try:
        s=ObservedSession();server=start(s);initial=s.tx.head()
        assert initial['root']==reference('012','initial')
        env=dict(os.environ,INDUSTRY018_URL=server.launch_url,PLAYWRIGHT_MODULE=os.environ.get('PLAYWRIGHT_MODULE',str(Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')))
        subprocess.run(['node',str(HERE/'browser-test.mjs')],env=env,check=True,timeout=240)
        end=s.tx.head();domain=end['root'];ref=reference('016','recovered')
        for n,key in [('013','T7'),('016','T8')]:
            witness=s.tx.checkpoints['handoff'+n];expected=reference('012' if n=='013' else '013',key)
            assert witness['before']==expected
        assert domain['bundle']==ref['bundle'] and domain['bundleJSON']==ref['bundleJSON']
        assert domain['industry']==ref['industry'] and domain['personnel']==ref['personnel'] and domain['forward']['capacity']==ref['forward']['capacity']
        assert sum(len(x['units']) for x in domain['bundle']['logistics']['done']['L7'])==63
        # Solver scalars can be numpy.float64 in memory and plain float after JSON.
        # Compare the actual exact JSON representation, with no rounding/tolerance.
        changes=diff(ref,json.loads(json.dumps(domain,ensure_ascii=False)));metadata={'requestId','requestFingerprint','inputRootHash'}
        assert all(p.startswith('/receipts/') or (p.startswith('/forward/') and p.split('/')[-1] in metadata) for p in changes),changes
        assert all(domain['receipts'][k]==v for k,v in reference('013','T8')['receipts'].items())
        record('same_instance_T5_to_T9_exact_roots_and_full_016_domain_result',dict(handoffs=end['handoffs'],rootDifferences=changes,
            gameHash=digest(domain['bundle']),referenceGameHash=digest(ref['bundle']),transactions=len(end['transactions']),domainReceipts=len(domain['receipts']),newHTTPMetadata='49 first bindings, instance/session IDs and outer receipts are separate; canonical 012/013 domain IDs unchanged; 12 new 016 envelope IDs differ.'),'REAL_HTTP_BROWSER_CHAIN')
        captures=s.captures
        for label,stage,op in [('funded','delegate:after_payment','PLACE_ORDER'),('preE6','delegate:after_output','NEXT'),('preT7','after_handoff_013','NEXT'),('imported','delegate:after_personnel_payment','APPLY_PERSONNEL'),('preE7','delegate:after_dispatch','NEXT'),('preT8','after_handoff_016','NEXT'),('T8','before_commit','CARE'),('preE8','delegate:after_transfer','NEXT'),('preRecovery','delegate:after_material_payment','RECOVER')]:
            t=captures[label].fork_test('SYNTHETIC-ROLLBACK-'+label);before=digest(t.head())
            def fail(at,stage=stage):
                if at==stage:raise RuntimeError('SYNTHETIC_'+stage)
            t._fault=fail;q=t.request('failure-'+label,op);res=t.submit(q);assert not res['ok'] and digest(t.head())==before
            assert stage in res['detail'],res
            t._fault=None;assert t.submit(q)==res and digest(t.head())==before
            retry,good=act(t,op,'new-reviewed-retry');after=digest(t.head());assert t.submit(retry)==good and digest(t.head())==after
            faults.append(dict(origin='SYNTHETIC_PRIVATE_FORK',at=stage,beforeHash=before,failed=res,retry=good['receipt'],afterHash=after))
        record('nine_targeted_rollbacks_and_explicit_new_attempts_preserve_once_only',faults)
        # Arrival refusal is an original qualification branch, not arbitrary inventory mutation.
        held=captures['preE7'].fork_test('SYNTHETIC-REFUSAL')
        def refuse(at):
            if at=='delegate:deny_receipt':raise RuntimeError('SYNTHETIC_RECEIVER_REFUSAL')
        held._fault=refuse;act(held,'NEXT','refusal');held._fault=None
        p=held.snapshot()['personnel'];assert p['package']['custody']=='HELD' and sum(p['quota']['used'].values())==4 and p['account']['carriageSpentI']==1
        # No approved T8 root => no automatic 016 onboarding or renewed scope.
        while held.snapshot()['bundle']['revision']<141:act(held,'NEXT','held-progress')
        before=digest(held.head());bad=held.submit(held.request('held-handoff','NEXT'));assert not bad['ok'] and 'HANDOFF_FULL_ROOT_MISMATCH_016' in bad['detail'] and digest(held.head())==before
        record('refused_personnel_retains_transit_ownership_and_blocks_unapproved_handoff',dict(personnel=p,blocked=bad))
        # No-care control continues normal original E8 SP and expires P.
        expired=captures['T8'].fork_test('SYNTHETIC-NO-CARE-CONTROL')
        while (expired.snapshot()['bundle']['core']['turn'],expired.snapshot()['bundle']['core']['phase'])!=(9,'GERMAN_RECOVERY'):act(expired,'NEXT','no-care')
        er=expired.snapshot();assert er['personnel']['package']['custody']=='REAR_QUARANTINED' and er['industry']['budget']['freeI']==5
        before=digest(expired.head());denied=expired.submit(expired.request('expired-recovery','RECOVER'));assert not denied['ok'] and digest(expired.head())==before
        record('no_care_E8_expiry_no_recovery_no_refund_or_reimport',dict(personnel=er['personnel']['package'],budget=er['industry']['budget'],rejected=denied))
        unused=captures['preRecovery'].fork_test('SYNTHETIC-UNUSED-E9')
        while unused.snapshot()['bundle']['core']['turn']<10:act(unused,'NEXT','unused')
        ur=unused.snapshot();assert ur['personnel']['package']['custody']=='FRONT_QUARANTINED' and ur['personnel']['package']['quantityP']==1
        assert ur['industry']['batch']['quantityE2']==2 and ur['industry']['budget']['freeI']==4 and not ur['forward']['receiver']['incoming']
        record('unused_E9_quarantine_original_normal_SP_continues',dict(care=ur['forward']['care'],P=ur['personnel']['package'],E2=ur['industry']['batch'],receiver=ur['forward']['receiver'],gameRevision=ur['bundle']['revision']))
        # True HTTP competition and post-publication loss on a captured, labelled fork.
        ts=start(Session(test_owner=captures['T8'].fork_test('SYNTHETIC-HTTP-RACES')));a=body(ts,'CARE');b=body(ts,'CARE')
        with ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(lambda q:request(ts,'/api/operations','POST',q),[a,b]))
        results=[finish(ts,a),finish(ts,b)];assert sorted(x['status'] for x in results)==['COMMITTED','REJECTED']
        assert ts.session.tx.snapshot()['industry']['budget']['freeI']==4
        winner=a if results[0]['status']=='COMMITTED' else b
        def lost(at):
            if at=='after_commit_before_reply':raise RuntimeError('SYNTHETIC_COMMITTED_REPLY_LOSS')
        ts.session.tx._fault=lost;c=body(ts,'NEXT');request(ts,'/api/operations','POST',c);assert finish(ts,c)['status']=='COMMITTED';ts.session.tx._fault=None
        d=body(ts,'NEXT');request(ts,'/api/operations','POST',d);assert finish(ts,d)['status']=='COMMITTED'
        later=digest(ts.session.tx.head())
        for q in [winner,c]:assert request(ts,'/api/operations','POST',q)[1]['status']=='COMMITTED' and digest(ts.session.tx.head())==later
        assert request(ts,'/api/operations','POST',{**winner,'operation':'NEXT'})[0]==409
        for extra in [{'authority':True},{'root':{}},{'budget':10},{'plan':{}}]:assert request(ts,'/api/operations','POST',{**body(ts,'NEXT'),**extra})[0]==400
        for headers in [{'Host':'evil.invalid'},{'Origin':'https://evil.invalid'},{'X-Local-Session':'fake'}]:assert request(ts,headers=headers)[0]==403
        assert digest(ts.session.tx.head())==later
        record('HTTP_same_version_competition_reply_loss_late_retry_and_closed_authority',dict(results=results,laterHash=later))
        trace=dict(origin='REAL_HTTP_CHAIN_PRIVATE_EVIDENCE_NOT_API',initial=initial,final=end,handoffs=s.tx.checkpoints,requests=s.records,views=s.views,
            expiryControls=dict(origin='SYNTHETIC_PRIVATE_FORKS_FROM_REAL_CHAIN',noCare=er,unusedE9=ur))
        raw=(json.dumps(trace,ensure_ascii=False,separators=(',',':'))+'\n').encode();(HERE/'TRACE.json.gz').write_bytes(gzip.compress(raw,mtime=0))
        output=dict(task='INDUSTRY-INTEGRATE-018',status='PASS',checks=checks,traceSha256=__import__('hashlib').sha256(raw).hexdigest(),newRulePermissions=[],globalBlockersRetained=35,sourceGapSP={'G':9,'S':14})
        export_ledger(trace,output['traceSha256'])
    finally:
        for sv in servers:sv.shutdown();sv.server_close()
        for t in threads:t.join(timeout=3);assert not t.is_alive()
        for se in reversed(sessions):se.close();assert not se.worker.is_alive()
    for port in ports:
        with socket.socket() as sock:assert sock.connect_ex(('127.0.0.1',port))!=0
    output['validationListenersAndWorkersClosed']=True
    (HERE/'VERIFICATION.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n');print('018_VERIFIED_AND_CLOSED',flush=True)
if __name__=='__main__':main()

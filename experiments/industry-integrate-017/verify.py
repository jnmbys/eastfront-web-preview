"""017-only real HTTP/browser and communication/serialization tests. Always closes listeners."""
import os,sys,json,gzip,subprocess,threading,time,http.client,socket,uuid
from copy import deepcopy
from concurrent.futures import ThreadPoolExecutor
from paths import *
from bridge import Session
from local_http import LocalServer
def main():
    checks=[];servers=[];sessions=[];threads=[];ports=[]
    def record(name,details=None,synthetic=False):
        checks.append(dict(name=name,origin='SYNTHETIC_HTTP_OR_FAULT_TEST' if synthetic else 'REAL_HTTP',passed=True,details=details));print(json.dumps(dict(check=len(checks),name=name)),flush=True)
    def start(session):
        s=LocalServer(0,session);sessions.append(session);servers.append(s);ports.append(s.server_port)
        t=threading.Thread(target=s.serve_forever,kwargs={'poll_interval':.05},daemon=True);t.start();threads.append(t);return s
    def request(s,path='/api/state',method='GET',body=None,headers=None):
        conn=http.client.HTTPConnection('127.0.0.1',s.server_port,timeout=8)
        h={'Host':s.host,'X-Local-Session':s.token}
        if method=='POST':h.update(Origin=s.origin,**{'Content-Type':'application/json'})
        if headers:h.update(headers)
        try:
            conn.request(method,path,body=json.dumps(body) if body is not None else None,headers=h);r=conn.getresponse();raw=r.read();return r.status,json.loads(raw),dict(r.headers)
        finally:conn.close()
    def body(s,op,id=None,version=None):
        p=s.session.state();return dict(requestId=id or str(uuid.uuid4()),instanceId=p['instanceId'],expectedVersion=p['version'] if version is None else version,operation=op)
    def submit(s,b):return request(s,'/api/operations','POST',b)
    def finish(s,b):
        for _ in range(40):
            status,r,_=request(s,'/api/requests/'+b['requestId'])
            if status==200 and r['status'] not in ['PENDING','PROCESSING']:return r
            time.sleep(.05)
        raise AssertionError('RECEIPT_TIMEOUT')
    try:
        session=Session();s=start(session);before=session.tx.snapshot();old=json.loads(gzip.decompress((P16/'TRACE.json.gz').read_bytes()))
        assert digest(before)==digest(old['start']);assert s.server_address[0]=='127.0.0.1'
        baseHash=digest(before)
        for method,path,headers,expected in [('GET','/api/state',{'Host':'evil.invalid'},403),('POST','/api/operations',{'Origin':'http://evil.invalid'},403),('POST','/api/operations',{'Origin':'null'},403),('POST','/api/operations',{'Origin':''},403),('POST','/api/operations',{'X-Local-Session':'forged'},403),('GET','/api/state',{'X-Local-Session':''},403),('GET','/api/state',{'Origin':'http://127.0.0.1:1'},403),('POST','/api/operations',{'Sec-Fetch-Site':'cross-site'},403)]:
            code,r,h=request(s,path,method,body(s,'CARE') if method=='POST' else None,headers);assert code==expected and 'Access-Control-Allow-Origin' not in h
        assert request(s,headers={'X-Local-Session':'é'})[0]==403
        assert digest(session.tx.snapshot())==baseHash
        record('loopback_Host_Origin_credential_cross_site_guards_reject_without_mutation')
        for fields in [{'budget':100},{'approval':True},{'state':{}},{'action':{'type':'REPAIR_UNIT'}},{'candidate':{}}]:
            code,r,_=submit(s,{**body(s,'CARE'),**fields});assert code==400
        for path in ['/api/root','/api/reset','/../bridge.py','/TRACE.json.gz']:
            code,_,_=request(s,path);assert code==404
        record('closed_intent_schema_no_root_import_reset_arbitrary_command_or_file_endpoint')
        try:other=LocalServer(s.server_port,None)
        except OSError:pass
        else:other.server_close();raise AssertionError('PORT_CONFLICT_NOT_REJECTED')
        assert request(s)[0]==200;record('occupied_port_reports_without_killing_existing_owner')
        env=dict(os.environ,INDUSTRY017_URL=s.launch_url)
        if 'PLAYWRIGHT_MODULE' not in env:
            candidate=Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
            if candidate.exists():env['PLAYWRIGHT_MODULE']=str(candidate)
        subprocess.run(['node',str(HERE/'browser-test.mjs')],env=env,check=True,timeout=120)
        end=session.tx.snapshot();ref=old['recovered']
        assert end['bundle']==ref['bundle'] and end['bundleJSON']==ref['bundleJSON'],'COMPLETE_GAME_CORE_SP_RNG_DIFF'
        assert end['industry']==ref['industry'] and end['personnel']==ref['personnel']
        assert end['forward']['capacity']==ref['forward']['capacity']
        assert len(end['bundle']['logistics']['done']['L7'][0]['units'])+len(end['bundle']['logistics']['done']['L7'][1]['units'])==63
        for k,v in old['start']['receipts'].items():assert end['receipts'][k]==v
        assert len(end['receipts'])==49 and end['revision']==49
        def differences(a,b,path=''):
            if type(a)!=type(b):return [path]
            if isinstance(a,dict):
                out=[]
                for k in sorted(set(a)|set(b)):
                    p=path+'/'+str(k)
                    if k not in a or k not in b:out.append(p)
                    else:out+=differences(a[k],b[k],p)
                return out
            if isinstance(a,list):
                if len(a)!=len(b):return [path]
                return [x for i,(v,w) in enumerate(zip(a,b)) for x in differences(v,w,path+'/'+str(i))]
            return [] if a==b else [path]
        diffs=differences(ref,end)
        metadataNames={'requestId','requestFingerprint','inputRootHash'}
        assert all(p.startswith('/receipts/') or (p.startswith('/forward/') and p.split('/')[-1] in metadataNames) for p in diffs),diffs
        record('real_browser_HTTP_main_exact_016_Core_budgets_materials_capacity_63_units_RNG',dict(gameHash=digest(end['bundle']),expectedGameHash=digest(ref['bundle']),rootRevision=end['revision'],gameRevision=end['bundle']['revision'],rootDifferences=diffs,
            explanation='Only 017 request IDs, request fingerprints, ancestor root hashes and their permanent receipts differ. Session/token/HTTP registry remain outside authority root.'))
        private=dict(origin='REAL_HTTP_MAIN_PRIVATE_TEST_CAPTURE_NOT_AN_HTTP_ENDPOINT',start=before,end=end,requests=session.records)
        (HERE/'HTTP-TRACE.json.gz').write_bytes(gzip.compress((json.dumps(private,ensure_ascii=False,separators=(',',':'))+'\n').encode(),mtime=0))
        # Separate nonmergeable owner for targeted competing/failing HTTP requests.
        test=Session(test_label='017-http-faults');ts=start(test);initial=digest(test.tx.snapshot())
        def fail(stage):
            if stage=='before_commit':raise RuntimeError('SYNTHETIC_PRECOMMIT_FAILURE')
        test.tx._fault=fail;failed=body(ts,'CARE');assert submit(ts,failed)[0]==202;result=finish(ts,failed)
        assert result['status']=='REJECTED' and digest(test.tx.snapshot())==initial
        first=deepcopy(test.records[failed['requestId']]['internal']);test.tx._fault=None
        assert submit(ts,failed)[1]['status']=='REJECTED' and test.records[failed['requestId']]['internal']==first
        record('precommit_failure_no_domain_mutation_same_ID_preserves_original_binding_and_rejection',result,True)
        a=body(ts,'CARE');b=body(ts,'CARE')
        with ThreadPoolExecutor(max_workers=2) as pool:replies=list(pool.map(lambda x:submit(ts,x),[a,b]))
        ar,br=finish(ts,a),finish(ts,b);assert sorted([ar['status'],br['status']])==['COMMITTED','REJECTED']
        assert test.tx.snapshot()['industry']['budget']['freeI']==4
        record('two_same_version_HTTP_requests_only_one_commit',[ar,br],True)
        winner=a if ar['status']=='COMMITTED' else b;kept=deepcopy(test.records[winner['requestId']]['internal'])
        stale=body(ts,'NEXT',version=37);submit(ts,stale);assert finish(ts,stale)['code']=='STALE_VERSION'
        assert submit(ts,{**winner,'operation':'NEXT'})[0]==409
        record('old_version_and_same_ID_changed_content_rejected_without_rebinding',synthetic=True)
        # Throw after original 016 single-root publication; HTTP layer recovers its real receipt.
        def lost(stage):
            if stage=='after_commit_before_reply':raise RuntimeError('SYNTHETIC_COMMITTED_REPLY_LOST')
        test.tx._fault=lost;lostBody=body(ts,'NEXT');submit(ts,lostBody);got=finish(ts,lostBody)
        assert got['status']=='COMMITTED';test.tx._fault=None
        beforeRetry=digest(test.tx.snapshot());assert submit(ts,lostBody)[1]['status']=='COMMITTED';assert digest(test.tx.snapshot())==beforeRetry
        nextBody=body(ts,'NEXT');submit(ts,nextBody);assert finish(ts,nextBody)['status']=='COMMITTED'
        later=digest(test.tx.snapshot());assert submit(ts,winner)[1]['status']=='COMMITTED';assert digest(test.tx.snapshot())==later and test.records[winner['requestId']]['internal']==kept
        assert submit(ts,failed)[1]['status']=='REJECTED' and test.records[failed['requestId']]['internal']==first and digest(test.tx.snapshot())==later
        record('after_commit_exception_real_receipt_recovered_late_retry_does_not_revert_or_rebind',got,True)
        public=request(ts)[1];forbidden={'bundle','bundleJSON','core','receipts','grantRegistry','approvalHash','rootHash','internal'}
        def keys(x):return set(x)|set().union(*(keys(v) for v in x.values())) if isinstance(x,dict) else set().union(*(keys(v) for v in x)) if isinstance(x,list) else set()
        assert not (keys(public)&forbidden);assert not (keys(request(ts,'/api/requests/'+winner['requestId'])[1])&forbidden)
        assert submit(ts,{**body(ts,'NEXT'),'instanceId':'old-process'})[0]==409
        record('necessary_views_only_and_foreign_instance_replay_rejected',synthetic=True)
        output=dict(task='INDUSTRY-INTEGRATE-017',status='PASS',checks=checks,browser=json.loads((HERE/'BROWSER.json').read_bytes()),
            traceSha256=sha(gzip.decompress((HERE/'HTTP-TRACE.json.gz').read_bytes())),globalBlockersRetained=35,sourceGapSP={'G':9,'S':14})
    finally:
        for s in servers:s.shutdown();s.server_close()
        for t in threads:t.join(timeout=3);assert not t.is_alive()
        for session in sessions:session.close();assert not session.worker.is_alive()
    for port in ports:
        with socket.socket() as sock:assert sock.connect_ex(('127.0.0.1',port))!=0
    output['validationListenersClosed']=True;output['solverWorkerClosed']=True
    (HERE/'VERIFICATION.json').write_bytes((json.dumps(output,ensure_ascii=False,indent=2)+'\n').encode())
    print(json.dumps(dict(status='PASS',checks=len(checks),listenersClosed=True)))
if __name__=='__main__':main()

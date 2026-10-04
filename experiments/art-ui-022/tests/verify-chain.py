"""UI-only real browser validation. Never runs or overwrites original 018 verification/evidence."""
import argparse,gzip,hashlib,http.client,json,os,socket,subprocess,sys,threading
from pathlib import Path
UI=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(UI));sys.path.insert(0,str(UI.parent/'industry-ui-001'));sys.dont_write_bytecode=True
import server as candidate
ws=candidate.original
import workbench_server as old_ui

def main():
    p=argparse.ArgumentParser();p.add_argument('--backend',required=True,type=Path);a=p.parse_args()
    source=a.backend.resolve();backend=ws.load_backend(source)
    from loader import digest
    out=UI.parents[1]/'evidence/ART-UI-022';out.mkdir(parents=True,exist_ok=True)
    # The old 017 lock must not become a generic backend bypass.
    try:old_ui.verify_backend(source)
    except (RuntimeError,FileNotFoundError):pass
    else:raise AssertionError('OLD_017_LOCK_BYPASSED')
    s=backend.Session();server=candidate.server_type(backend)(0,s);port=server.server_port
    t=threading.Thread(target=server.serve_forever,kwargs={'poll_interval':.05},daemon=True);t.start()
    initial=s.tx.head()
    def request(path,headers=None,method='GET'):
        c=http.client.HTTPConnection('127.0.0.1',port,timeout=10);c.request(method,path,headers=headers or {});r=c.getresponse();raw=r.read();h=dict(r.getheaders());c.close();return r.status,h,raw
    try:
        for method in ['do_POST','do_OPTIONS','check','send']:assert getattr(server.RequestHandlerClass,method) is getattr(backend.Handler,method)
        for path in ['/','/operate/','/candidate/','/candidate/chain-client.mjs','/candidate/chain-view.mjs','/candidate/map-data.json','/records-016.mjs']:
            code,headers,_=request(path);assert code==200 and "connect-src 'self'" in headers['Content-Security-Policy']
            assert 'Access-Control-Allow-Origin' not in headers
            assert request(path,{'Host':'localhost:'+str(port)})[0]==403
            assert request(path,{'Origin':'https://example.invalid'})[0]==403
        assert request('/api/state')[0]==403
        assert request('/api/operations',method='OPTIONS')[0]==403
        assert request('/owner.py')[0]==404
        env=dict(os.environ,INDUSTRY018_URL=server.launch_url.replace('/#','/candidate/#'),UI006_EVIDENCE=str(out))
        env.setdefault('PLAYWRIGHT_MODULE',str(Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))
        subprocess.run(['node',str(UI/'tests/chain-browser.mjs')],env=env,check=True,timeout=600)
        end=s.tx.head();ref=json.loads(gzip.decompress((source/'TRACE.json.gz').read_bytes()))
        assert initial==ref['initial']
        domain=end['root'];expected=ref['final']['root']
        for key in ['bundle','bundleJSON','industry','personnel']:assert domain[key]==expected[key],key
        assert domain['forward']['capacity']==expected['forward']['capacity']
        assert end['handoffs']==ref['final']['handoffs']
        for k,v in ref['handoffs'].items():assert s.tx.checkpoints[k]==v,k
        assert len(s.records)==49 and len(end['transactions'])==49
        assert domain['revision']==49 and domain['bundle']['revision']==153
        assert sum(len(x['units']) for x in domain['bundle']['logistics']['done']['L7'])==63
        # All remaining full-root differences must be request-derived receipt/ancestor metadata.
        def diff(a,b,path=''):
            if type(a)!=type(b):return [path]
            if isinstance(a,dict):return [v for k in set(a)|set(b) for v in ([path+'/'+k] if k not in a or k not in b else diff(a[k],b[k],path+'/'+k))]
            if isinstance(a,list):return [path] if len(a)!=len(b) else [v for i,(x,y) in enumerate(zip(a,b)) for v in diff(x,y,path+'/'+str(i))]
            return [] if a==b else [path]
        differences=diff(expected,json.loads(json.dumps(domain,ensure_ascii=False)))
        assert all(p.startswith('/receipts/') or (p.startswith('/forward/') and p.split('/')[-1] in ['requestId','requestFingerprint','inputRootHash']) for p in differences)
        report=dict(task='ART-UI-022',functionalBaseCommit='75183910f524c87d9a6db3fafee27f3a2e189691',status='PASS',sourceCommit=ws.LOCK['sourceCommit'],uiBaseCommit=ws.LOCK['uiBaseCommit'],realUniqueTransactions=49,
            rootVersion=49,gameRevision=153,units=63,gameHash=digest(domain['bundle']),referenceGameHash=digest(expected['bundle']),
            fullDomainEquality=['bundle','bundleJSON','industry','personnel','forward.capacity'],exactHandoffRoots=True,allowedRequestMetadataDifferences=sorted(differences),
            old017LockRejects018=True,unchangedHTTPAuthenticationAndWriteHandlers=True,globalBlockersRetained=35)
    finally:
        server.shutdown();server.server_close();t.join(timeout=3);s.close()
        assert not t.is_alive() and not s.worker.is_alive()
    with socket.socket() as probe:assert probe.connect_ex(('127.0.0.1',port))!=0
    ws.verify_backend(source)
    manifest=json.loads((source/'INPUTS.json').read_bytes())
    assert all(hashlib.sha256((source/'.runtime'/p).read_bytes()).hexdigest()==h for p,h in manifest['runtimeFiles'].items())
    report.update(sourceFilesUnchanged=len(ws.LOCK['files']),runtimeFilesUnchanged=len(manifest['runtimeFiles']),listenersAndWorkersClosed=True)
    (out/'VALIDATION.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(dict(status='PASS',realUniqueTransactions=49,exact018Domain=True,listenersAndWorkersClosed=True)))

if __name__=='__main__':main()

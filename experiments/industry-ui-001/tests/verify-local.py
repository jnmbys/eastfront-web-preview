"""Real pinned owner/browser validation. Writes evidence only inside this UI directory.
Read/network/precommit faults are SYNTHETIC; successful transactions use unchanged 017-R1.
"""
import argparse, gzip, hashlib, http.client, json, os, socket, subprocess, sys, threading
from pathlib import Path
HERE=Path(__file__).resolve().parent
UI=HERE.parent
sys.path.insert(0,str(UI))
import workbench_server as ws

def main():
    p=argparse.ArgumentParser();p.add_argument('--backend',required=True,type=Path)
    args=p.parse_args();backend=ws.load_backend(args.backend)
    from paths import P16,digest
    out=UI/'evidence-005';out.mkdir(exist_ok=True)
    servers=[];sessions=[];threads=[];ports=[];checks=[]
    env=dict(os.environ,UI005_EVIDENCE=str(out))
    env.setdefault('PLAYWRIGHT_MODULE',str(Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))
    def start(s):
        sessions.append(s);server=ws.server_type(backend)(0,s);servers.append(server);ports.append(server.server_port)
        t=threading.Thread(target=server.serve_forever,kwargs={'poll_interval':.05},daemon=True);t.start();threads.append(t)
        return server
    def run(server,path,case=''):
        subprocess.run(['node',str(path)],env=dict(env,INDUSTRY017_URL=server.launch_url,R1_CASE=case),check=True,timeout=180)
    def request(server,path,headers=None,method='GET'):
        c=http.client.HTTPConnection('127.0.0.1',server.server_port,timeout=10)
        c.request(method,path,headers=headers or {});r=c.getresponse();data=r.read();h=dict(r.getheaders());c.close()
        return r.status,h,data
    try:
        for case in ['committed','rejected']:
            s=backend.Session(test_label='ui005-'+case);server=start(s);before=s.tx.snapshot()
            if case=='rejected':
                def fail(stage):
                    if stage=='before_commit':raise RuntimeError('SYNTHETIC_UI005_PRECOMMIT_FAILURE')
                s.tx._fault=fail
            run(server,HERE/'local-r1-browser.mjs',case)
            end=s.tx.snapshot();assert len(s.records)==1
            if case=='rejected':assert digest(before)==digest(end)
            else:
                assert end['revision']==before['revision']+1 and end['industry']['budget']['freeI']==4
                assert end['bundle']==before['bundle'] and end['bundleJSON']==before['bundleJSON']
            checks.append(dict(case=case,passed=True,initialRoot=digest(before),finalRoot=digest(end),requests=len(s.records)))
        s=backend.Session(test_label='ui005-unknown');server=start(s)
        run(server,HERE/'local-unknown-browser.mjs')
        assert len(s.records)==1 and s.tx.snapshot()['revision']==38
        checks.append(dict(case='unknown_retry_original_request',passed=True,uniqueRequests=1,rootRevision=38))
        s=backend.Session();server=start(s)
        handler=server.RequestHandlerClass
        for method in ['do_POST','do_OPTIONS','check','send']:
            assert getattr(handler,method) is getattr(backend.Handler,method)
        for path in ['/','/operate/','/local-client.mjs','/app.mjs','/records-016.mjs']:
            code,headers,data=request(server,path);assert code==200
            assert "connect-src 'self'" in headers['Content-Security-Policy']
            assert 'Access-Control-Allow-Origin' not in headers
            assert request(server,path,{'Host':'localhost:'+str(server.server_port)})[0]==403
            assert request(server,path,{'Origin':'https://example.invalid'})[0]==403
        assert request(server,'/local-client.mjs')[2]==(args.backend/'app.mjs').read_bytes()
        assert request(server,'/api/state')[0]==403
        assert request(server,'/api/state',{'X-Local-Session':server.token})[0]==200
        assert request(server,'/api/operations',method='OPTIONS')[0]==403
        assert request(server,'/api/reset',method='POST')[0]==403
        assert request(server,'/../bridge.py')[0]==404
        # Occupied port exits without constructing an owner, killing or replacing the listener.
        occupied=subprocess.run([sys.executable,str(UI/'workbench_server.py'),'--backend',str(args.backend),'--port',str(server.server_port)],capture_output=True,timeout=30)
        assert occupied.returncode==2 and request(server,'/api/state',{'X-Local-Session':server.token})[0]==200
        checks.append(dict(case='same_origin_auth_and_unchanged_handlers',passed=True,clientGitBlob=ws.LOCK['files']['app.mjs'],occupiedPortDoesNotReplace=True))
        run(server,HERE/'local-browser.mjs')
        end=s.tx.snapshot();old=json.loads(gzip.decompress((P16/'TRACE.json.gz').read_bytes()));ref=old['recovered']
        assert end['bundle']==ref['bundle'] and end['bundleJSON']==ref['bundleJSON']
        assert end['industry']==ref['industry'] and end['personnel']==ref['personnel']
        assert end['forward']['capacity']==ref['forward']['capacity']
        ref17=json.loads(gzip.decompress((args.backend/'HTTP-TRACE.json.gz').read_bytes()))['end']
        for key in ['bundle','bundleJSON','industry','personnel']:assert end[key]==ref17[key]
        assert end['forward']['capacity']==ref17['forward']['capacity']
        assert sum(len(x['units']) for x in end['bundle']['logistics']['done']['L7'])==63
        assert end['revision']==49 and end['bundle']['revision']==153
        for k,v in old['start']['receipts'].items():assert end['receipts'][k]==v
        checks.append(dict(case='real_complete_chain_matches_016_and_017_R1',passed=True,gameHash=digest(end['bundle']),referenceGameHash=digest(ref['bundle']),reference017GameHash=digest(ref17['bundle']),rootRevision=49,gameRevision=153,units=63,requests=len(s.records),equalDomains=['bundle','bundleJSON','industry','personnel','forward.capacity'],originalPermanentReceiptsUnchanged=True))
    finally:
        for server in servers:server.shutdown();server.server_close()
        for t in threads:t.join(timeout=3);assert not t.is_alive()
        for s in sessions:s.close();assert not s.worker.is_alive()
    for port in ports:
        with socket.socket() as sock:assert sock.connect_ex(('127.0.0.1',port))!=0
    ws.verify_backend(args.backend)
    manifest=json.loads((args.backend/'INPUTS.json').read_bytes())
    assert all(hashlib.sha256((args.backend/'.runtime'/p).read_bytes()).hexdigest()==h for p,h in manifest['runtimeFiles'].items())
    report=dict(task='INDUSTRY-UI-005',uiBase=ws.LOCK['uiBaseCommit'],backendCommit=ws.LOCK['sourceCommit'],status='PASS',checks=checks,backendFilesUnchanged=len(ws.LOCK['files']),runtimeFilesUnchanged=len(manifest['runtimeFiles']),listenersAndWorkersClosed=True,globalBlockersRetained=35,viewportCheckIsNotDeviceAcceptance=True)
    (UI/'UI005-VALIDATION.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(dict(status='PASS',groups=len(checks),listenersAndWorkersClosed=True)))

if __name__=='__main__':main()

"""R1 frontend tests only. Does not overwrite 017 evidence or modify backend code."""
import sys,os,json,gzip,threading,subprocess,socket,hashlib
from pathlib import Path
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parent))
from paths import P16,OUT,digest
from bridge import Session
from local_http import LocalServer

def main():
    servers=[];sessions=[];threads=[];ports=[];checks=[]
    # All baseline tracked files other than the explicitly edited frontend stay byte-identical.
    repo=HERE.parents[2]
    baseline='746f6703e007eafdebb8c9fd3156706e06b5092f'
    tracked=subprocess.check_output(['git','ls-tree','-r','--name-only',baseline],cwd=repo,text=True).splitlines()
    untouched={p:hashlib.sha256((repo/p).read_bytes()).hexdigest() for p in tracked if p!='experiments/industry-integrate-017/app.mjs'}
    env=dict(os.environ)
    env.setdefault('PLAYWRIGHT_MODULE',str(Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))
    def start(s):
        sessions.append(s);server=LocalServer(0,s);servers.append(server);ports.append(server.server_port)
        t=threading.Thread(target=server.serve_forever,kwargs={'poll_interval':.05},daemon=True);t.start();threads.append(t)
        return server
    def run(server,path,case=''):
        subprocess.run(['node',str(path)],env=dict(env,INDUSTRY017_URL=server.launch_url,R1_CASE=case),check=True,timeout=150)
    try:
        for case in ['committed','rejected']:
            s=Session(test_label='017-r1-'+case);server=start(s);before=s.tx.snapshot()
            if case=='rejected':
                def fail(stage):
                    if stage=='before_commit':raise RuntimeError('SYNTHETIC_R1_PRECOMMIT_FAILURE')
                s.tx._fault=fail
            run(server,HERE/'browser-test.mjs',case)
            end=s.tx.snapshot()
            assert len(s.records)==1
            if case=='rejected':assert digest(before)==digest(end)
            else:
                assert end['revision']==before['revision']+1 and end['industry']['budget']['freeI']==4
                assert end['bundle']==before['bundle'] and end['bundleJSON']==before['bundleJSON']
            checks.append(dict(case=case,passed=True,initialRoot=digest(before),finalRoot=digest(end),requests=len(s.records),browser=json.loads((HERE/(case+'.json')).read_bytes())))
        # Rerun the original browser assertions verbatim, changing output destinations only.
        source=(HERE.parent/'browser-test.mjs').read_text(encoding='utf-8')
        adapted=source.replace("'./screenshots/","'../R1/normal/screenshots/").replace("'./BROWSER.json'","'../R1/normal/BROWSER.json'")
        script=OUT/'r1-normal-browser.mjs';script.write_text(adapted,encoding='utf-8')
        s=Session();server=start(s);run(server,script)
        end=s.tx.snapshot();old=json.loads(gzip.decompress((P16/'TRACE.json.gz').read_bytes()));ref=old['recovered']
        assert end['bundle']==ref['bundle'] and end['bundleJSON']==ref['bundleJSON']
        assert end['industry']==ref['industry'] and end['personnel']==ref['personnel']
        assert end['forward']['capacity']==ref['forward']['capacity']
        assert sum(len(x['units']) for x in end['bundle']['logistics']['done']['L7'])==63
        assert end['revision']==49 and end['bundle']['revision']==153
        for k,v in old['start']['receipts'].items():assert end['receipts'][k]==v
        checks.append(dict(case='original_browser_chain',passed=True,gameHash=digest(end['bundle']),referenceGameHash=digest(ref['bundle']),rootRevision=49,gameRevision=153,units=63,originalTestSHA256=hashlib.sha256(source.encode()).hexdigest(),outputRelocatedTestSHA256=hashlib.sha256(adapted.encode()).hexdigest(),onlyTestChange='Evidence destinations relocated; all original assertions retained.',browser=json.loads((HERE/'normal/BROWSER.json').read_bytes())))
    finally:
        for s in servers:s.shutdown();s.server_close()
        for t in threads:t.join(timeout=3);assert not t.is_alive()
        for s in sessions:s.close();assert not s.worker.is_alive()
    for port in ports:
        with socket.socket() as sock:assert sock.connect_ex(('127.0.0.1',port))!=0
    assert all(hashlib.sha256((repo/p).read_bytes()).hexdigest()==v for p,v in untouched.items())
    report=dict(task='INDUSTRY-INTEGRATE-017-R1',baseline=baseline,status='PASS',checks=checks,unchangedBaselineFiles=len(untouched),listenersAndWorkersClosed=True,globalBlockersRetained=35,sourceGapSP={'G':9,'S':14},scope='Single-process local browser; read/network faults and rejected transaction fault explicitly synthetic.')
    (HERE/'VERIFICATION.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(dict(status='PASS',groups=len(checks),listenersClosed=True)))

if __name__=='__main__':main()

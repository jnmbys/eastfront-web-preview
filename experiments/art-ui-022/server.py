"""Candidate static GET routes only. Original 018 sessions, POST, auth and recovery are unchanged."""
import argparse,sys,json,hashlib
from pathlib import Path
from urllib.parse import urlsplit
HERE=Path(__file__).resolve().parent
UI=HERE.parent/'industry-ui-001'
sys.path.insert(0,str(UI));sys.dont_write_bytecode=True
import workbench_018_server as original
def server_type(backend):
    Base=original.server_type(backend)
    # Explicit static allowlist; no directory traversal, source roots or diagnostic dumps served.
    static={}
    for name in ['index.html','candidate.css','shell.mjs','chain-view.mjs','map-controller.mjs','map-data.json']:
        static['/candidate/'+('' if name=='index.html' else name)]=(HERE/name,'text/javascript' if name.endswith('.mjs') else 'text/css' if name.endswith('.css') else 'application/json' if name.endswith('.json') else 'text/html; charset=utf-8')
    static['/candidate/chain-client.mjs']=(UI/'chain-client.mjs','text/javascript')
    for folder in ['map','icons']:
        for f in (HERE/folder).rglob('*'):
            if not f.is_file() or f.suffix not in ['.js','.json','.webp','.svg']:continue
            rel=f.relative_to(HERE).as_posix()
            mime={'.js':'text/javascript','.json':'application/json','.webp':'image/webp','.svg':'image/svg+xml'}[f.suffix]
            static['/candidate/'+rel]=(f,mime)
    for f in (HERE/'map/assets').glob('*.webp'):static['/candidate/assets/'+f.name]=(f,'image/webp')
    class CandidateServer(Base):
        def __init__(self,port,session):
            super().__init__(port,session)
            Parent=self.RequestHandlerClass
            class CandidateHandler(Parent):
                def do_GET(self):
                    p=urlsplit(self.path)
                    if p.scheme or p.netloc or p.query or p.path not in static:return super().do_GET()
                    try:
                        self.check()
                        f,mime=static[p.path]
                        return self.send(200,f.read_bytes(),mime)
                    except backend.ProtocolError as e:self.send(e.status,{'error':e.code})
            self.RequestHandlerClass=CandidateHandler
    return CandidateServer
def main():
    p=argparse.ArgumentParser();p.add_argument('--backend',required=True,type=Path);p.add_argument('--port',type=int,default=8822);p.add_argument('--check',action='store_true');a=p.parse_args()
    if not 1<=a.port<=65535:p.error('port must be 1..65535')
    backend=original.load_backend(a.backend)
    if a.check:
        manifest=json.loads((backend.HERE/'INPUTS.json').read_bytes())
        for name,expected in manifest['runtimeFiles'].items():
            if hashlib.sha256((backend.HERE/'.runtime'/name).read_bytes()).hexdigest()!=expected:raise RuntimeError('Pinned runtime mismatch: '+name)
        print('Pinned 018 source and runtime accepted. No transactions started.');return
    server=server_type(backend)(a.port,None)
    try:
        server.session=backend.Session()
        print('ART-UI-022 · 仅127.0.0.1 · Ctrl+C停止；关闭后进度不保存',flush=True)
        print(server.launch_url.replace('/#', '/candidate/#'),flush=True)
        server.serve_forever(poll_interval=.2)
    except KeyboardInterrupt:pass
    finally:
        server.server_close()
        if server.session:server.session.close()
if __name__=='__main__':main()


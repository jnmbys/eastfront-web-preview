"""UI-only same-origin static routing atop pinned 018 HTTP/transaction code."""
import argparse
import hashlib
import importlib
import json
import os
import sys
from pathlib import Path
from urllib.parse import urlsplit

HERE = Path(__file__).resolve().parent
LOCK = json.loads((HERE/'backend-018-lock.json').read_bytes())

def verify_backend(directory):
    directory = Path(directory).resolve()
    for name, expected in LOCK['files'].items():
        raw = (directory/name).read_bytes()
        actual = hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
        if actual != expected:
            raise RuntimeError('018 pinned file mismatch: '+name)
    return directory

def load_backend(directory):
    directory = verify_backend(directory)
    sys.dont_write_bytecode = True
    sys.path.insert(0, str(directory))
    # No transaction/Core/HTTP methods are changed. Original 018 loader verifies its runtime manifest.
    return importlib.import_module('local_server')

def server_type(backend):
    static = {
        '/': (HERE/'index.html','text/html; charset=utf-8'),
        '/operate/': (HERE/'chain-workbench.html','text/html; charset=utf-8'),
        '/chain-client.mjs': (HERE/'chain-client.mjs','text/javascript; charset=utf-8')
    }
    for name in ['chain-view.mjs','chain-style.css','chain-nav.mjs','styles.css','local-style.css','local-nav.mjs','app.mjs','view.mjs','demo-adapter.mjs',
        'record-adapter.mjs','record-view.mjs','records-012.mjs',
        'personnel-adapter.mjs','personnel-view.mjs','records-013.mjs',
        'forward-adapter.mjs','forward-view.mjs','records-016.mjs']:
        static['/'+name] = (HERE/name,'text/css; charset=utf-8' if name.endswith('.css') else 'text/javascript; charset=utf-8')

    class WorkbenchHandler(backend.Handler):
        # Only GET of listed static files is added. API, authentication and CSP use original methods.
        def do_GET(self):
            parsed = urlsplit(self.path)
            if parsed.scheme or parsed.netloc or parsed.query or parsed.path.startswith('/api/'):
                return super().do_GET()
            try:
                self.check()
                if parsed.path not in static: raise backend.ProtocolError(404,'NOT_FOUND')
                file, mime = static[parsed.path]
                return self.send(200, file.read_bytes(), mime)
            except backend.ProtocolError as error:
                self.send(error.status, {'error':error.code})

    class WorkbenchServer(backend.LocalServer):
        def __init__(self, port, session):
            super().__init__(port, session)
            self.RequestHandlerClass = WorkbenchHandler
    return WorkbenchServer

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--backend',type=Path,default=os.environ.get('INDUSTRY018_PATH'))
    parser.add_argument('--port',type=int,default=8818)
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    if args.backend is None: parser.error('Provide --backend pointing to pinned experiments/industry-integrate-018')
    if not 1<=args.port<=65535: parser.error('port must be 1..65535')
    backend=load_backend(args.backend)
    if args.check:
        manifest=json.loads((backend.HERE/'INPUTS.json').read_bytes())
        for name, expected in manifest['runtimeFiles'].items():
            if hashlib.sha256((backend.HERE/'.runtime'/name).read_bytes()).hexdigest()!=expected:
                raise RuntimeError('017 runtime mismatch: '+name)
        print(json.dumps({'pinnedCommit':LOCK['sourceCommit'],'backendFiles':len(LOCK['files']),
            'runtimeFiles':len(manifest['runtimeFiles']),'transactionsStarted':False}))
        return 0
    # Bind before constructing a transaction owner, preserving original occupied-port behavior.
    try: server=server_type(backend)(args.port,None)
    except OSError as error:
        print('端口不可用；未终止其他进程。'+str(error),file=sys.stderr)
        return 2
    try:
        server.session=backend.Session()
        print('INDUSTRY-UI-006 · 本机操作 · 固定018单进程事务',flush=True)
        print('仅在本机打开完整会话链接（请勿分享凭证）：\n'+server.launch_url,flush=True)
        print('Ctrl+C关闭，等待当前事务和求解进程退出；进度不持久保存。',flush=True)
        server.serve_forever(poll_interval=.2)
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        if server.session: server.session.close()
        print('已关闭本机监听和事务会话。',flush=True)
    return 0

if __name__=='__main__': sys.exit(main())

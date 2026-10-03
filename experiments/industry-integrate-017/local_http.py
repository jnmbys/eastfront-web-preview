"""Loopback-only facade; distinct module name from the original runtime server."""
import argparse,json,secrets,hmac,threading,signal,sys
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from urllib.parse import urlsplit
from paths import HERE
from bridge import Session,ProtocolError
class LocalServer(ThreadingHTTPServer):
    daemon_threads=True;allow_reuse_address=False
    def __init__(self,port,session):
        self.session=session;self.token=secrets.token_urlsafe(32)
        super().__init__(('127.0.0.1',port),Handler)
        self.host='127.0.0.1:'+str(self.server_port);self.origin='http://'+self.host
    @property
    def launch_url(self):return self.origin+'/#session='+self.token
class Handler(BaseHTTPRequestHandler):
    protocol_version='HTTP/1.1'
    def log_message(self,*args):pass # Never log credentials or request bodies.
    def setup(self):super().setup();self.connection.settimeout(6)
    def check(self,api=False,write=False):
        hosts=self.headers.get_all('Host',[]);origins=self.headers.get_all('Origin',[])
        if hosts!=[self.server.host]:raise ProtocolError(403,'HOST_REJECTED')
        if len(origins)>1 or (origins and origins!=[self.server.origin]) or (write and origins!=[self.server.origin]):raise ProtocolError(403,'ORIGIN_REJECTED')
        if self.headers.get('Sec-Fetch-Site') in ['cross-site']:raise ProtocolError(403,'CROSS_SITE_REJECTED')
        if api:
            credentials=self.headers.get_all('X-Local-Session',[])
            if len(credentials)!=1 or not credentials[0].isascii() or not hmac.compare_digest(credentials[0],self.server.token):raise ProtocolError(403,'SESSION_CREDENTIAL_REQUIRED')
    def send(self,status,data,content_type='application/json; charset=utf-8'):
        raw=data if isinstance(data,bytes) else json.dumps(data,ensure_ascii=False).encode()
        self.send_response(status);self.send_header('Content-Type',content_type);self.send_header('Content-Length',str(len(raw)))
        self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Referrer-Policy','no-referrer');self.send_header('Cross-Origin-Resource-Policy','same-origin')
        self.send_header('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
        self.send_header('Connection','close');self.end_headers()
        try:self.wfile.write(raw)
        except (BrokenPipeError,ConnectionResetError,ConnectionAbortedError):pass
        self.close_connection=True
    def do_GET(self):
        try:
            p=urlsplit(self.path)
            if p.scheme or p.netloc or p.query:raise ProtocolError(400,'INVALID_TARGET')
            self.check(api=p.path.startswith('/api/'))
            if p.path=='/api/state':return self.send(200,self.server.session.state())
            if p.path.startswith('/api/requests/'):
                id=p.path.removeprefix('/api/requests/')
                if '/' in id or not id:raise ProtocolError(400,'INVALID_REQUEST_ID')
                return self.send(200,self.server.session.result(id))
            allowed={'/':('index.html','text/html; charset=utf-8'),'/app.mjs':('app.mjs','text/javascript; charset=utf-8'),'/styles.css':('styles.css','text/css; charset=utf-8')}
            if p.path not in allowed:raise ProtocolError(404,'NOT_FOUND')
            name,mime=allowed[p.path];return self.send(200,(HERE/name).read_bytes(),mime)
        except ProtocolError as e:self.send(e.status,dict(error=e.code))
    def do_POST(self):
        try:
            self.check(api=True,write=True)
            if self.path!='/api/operations':raise ProtocolError(404,'NOT_FOUND')
            if self.headers.get('Transfer-Encoding') is not None:raise ProtocolError(400,'TRANSFER_ENCODING_REJECTED')
            lengths=self.headers.get_all('Content-Length',[])
            if len(lengths)!=1 or not lengths[0].isdigit() or not 0<int(lengths[0])<=2048:raise ProtocolError(413,'BODY_SIZE_REJECTED')
            if self.headers.get('Content-Type')!='application/json':raise ProtocolError(415,'JSON_REQUIRED')
            def pairs(xs):
                d={}
                for k,v in xs:
                    if k in d:raise ValueError('DUPLICATE_FIELD')
                    d[k]=v
                return d
            try:body=json.loads(self.rfile.read(int(lengths[0])),object_pairs_hook=pairs)
            except (ValueError,UnicodeDecodeError):raise ProtocolError(400,'INVALID_JSON')
            result=self.server.session.submit(body)
            self.send(202 if result['status'] in ['PENDING','PROCESSING'] else 200,result)
        except ProtocolError as e:self.send(e.status,dict(error=e.code))
    def do_OPTIONS(self):self.send(403,dict(error='CROSS_ORIGIN_PREFLIGHT_NOT_SUPPORTED'))
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=8817);args=parser.parse_args()
    if not 1<=args.port<=65535:parser.error('port must be 1..65535')
    # Bind first: an occupied port must not initialize another experimental owner.
    try:server=LocalServer(args.port,None)
    except OSError as e:print('端口不可用；未终止其他进程。'+str(e),file=sys.stderr);return 2
    try:
        server.session=Session()
        print('固定场景 · 单进程 · 关闭后不保存进度',flush=True)
        print('打开本机会话入口（请勿分享含凭证的完整链接）：\n'+server.launch_url,flush=True)
        print('关闭：在此终端按 Ctrl+C；服务仅监听127.0.0.1。',flush=True)
        server.serve_forever(poll_interval=.2)
    except KeyboardInterrupt:pass
    finally:
        server.server_close()
        if server.session:server.session.close()
    return 0
if __name__=='__main__':sys.exit(main())

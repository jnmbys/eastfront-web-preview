"""018 static page and finite session over the pinned 017 loopback/security transport."""
import argparse,sys
from urllib.parse import urlsplit
from loader import HERE,load
load()
from compat017.local_http import Handler as OriginalHandler,LocalServer as OriginalServer
from session import Session,ProtocolError
class Handler(OriginalHandler):
    def do_GET(self):
        p=urlsplit(self.path)
        assets={'/':('index.html','text/html; charset=utf-8'),'/app.mjs':('app.mjs','text/javascript; charset=utf-8'),'/styles.css':('styles.css','text/css; charset=utf-8')}
        if p.path not in assets:return super().do_GET()
        try:
            if p.scheme or p.netloc or p.query:raise ProtocolError(400,'INVALID_TARGET')
            self.check();name,mime=assets[p.path];self.send(200,(HERE/name).read_bytes(),mime)
        except ProtocolError as e:self.send(e.status,dict(error=e.code))
class LocalServer(OriginalServer):
    def __init__(self,port,session):
        super().__init__(port,session);self.RequestHandlerClass=Handler
def main():
    p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=8818);a=p.parse_args()
    if not 1<=a.port<=65535:p.error('port must be 1..65535')
    try:server=LocalServer(a.port,None)
    except OSError as e:print('端口不可用，未终止其他进程：'+str(e),file=sys.stderr);return 2
    try:
        server.session=Session();print('018固定场景，同一实例。关闭后进度不保存。\n'+server.launch_url+'\n关闭：Ctrl+C；仅127.0.0.1。',flush=True)
        server.serve_forever(poll_interval=.2)
    except KeyboardInterrupt:pass
    finally:
        server.server_close()
        if server.session:server.session.close()
    return 0
if __name__=='__main__':sys.exit(main())

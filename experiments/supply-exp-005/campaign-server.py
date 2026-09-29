"""Loopback-only hotseat entry; never the deployed online.py service."""
import server
from campaign import create_campaign,metadata
from live import ROOT,deepcopy
from bounded import warm_start
from urllib.parse import urlparse
server.CLIPS={'campaign'}
def load(clip,mode):
 if clip!='campaign':raise ValueError('campaign only')
 b=create_campaign(mode);return b,deepcopy(b)
server.load=load
base_public=server.public
def public(viewer):
 result=base_public(viewer);result['state']['campaign']=metadata(server.state['core'],viewer)
 result['notice']='完整战役实验 / 本地热座 / 原Core胜负 / 未平衡'
 return result
server.public=public
class Handler(server.Handler):
 def do_GET(self):
  path=urlparse(self.path).path
  if path in ['/', '/campaign-ui.js']:
   data=(ROOT/('sandbox.html' if path=='/' else 'campaign-ui.js')).read_bytes()
   if path=='/':data=data.replace(b'<option value="S">',b'<option value="S" selected>')+b'<script src="/campaign-ui.js"></script>'
   self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8' if path=='/' else 'text/javascript; charset=utf-8');self.end_headers();self.wfile.write(data)
  elif path=='/replay':self.send_error(404) # Omniscient research artifacts are CLI-only.
  else:super().do_GET()
if __name__=='__main__':
 warm_start();server.state,server.initial=load('campaign','new');print('CAMPAIGN010 http://127.0.0.1:8766 (local hotseat; no AI)',flush=True)
 server.HTTPServer(('127.0.0.1',8766),Handler).serve_forever()

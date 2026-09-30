"""Single-process, isolated hotseat sessions. No production backend dependency.
Global lock intentionally serializes legacy Core bridge + singleton solver.
A busy request is rejected immediately: no unbounded solve queue.
"""
import os,time,secrets,threading
from http.cookies import SimpleCookie
from http.server import ThreadingHTTPServer
from urllib.parse import urlparse
import server as app
from bounded import warm_start
GATE=threading.Lock()
SESSIONS={}
MAX_SESSIONS=4
TTL=1800
MAX_ACTIONS=150
MAX_STATE_BYTES=6*1024*1024
SECURE=os.environ.get('COOKIE_SECURE','1')=='1'
ORIGIN=os.environ.get('PUBLIC_ORIGIN','').rstrip('/')
CREATIONS=[]
# Opt-in campaign surface; short-clip service defaults remain compatible.
CAMPAIGN=os.environ.get('ENABLE_CAMPAIGN','0')=='1'
CAMPAIGN_MAX_ACTIONS=1000
if CAMPAIGN:
 from campaign import create_campaign,metadata
 old_load,old_public=app.load,app.public
 app.CLIPS=set(app.CLIPS)|{'campaign'}
 def load(clip,mode):
  if clip!='campaign':return old_load(clip,mode)
  b=create_campaign(mode);return b,app.deepcopy(b)
 def public(viewer):
  result=old_public(viewer)
  if app.state['clip']=='campaign':
   result['state']['campaign']=metadata(app.state['core'],viewer)
   result['notice']='完整战役实验 / 双方手动操作 / 原Core胜负 / 未平衡'
  return result
 app.load,app.public=load,public
class Handler(app.Handler):
 def setup(self):
  super().setup();self.connection.settimeout(5);self.new_cookie=None
 def end_headers(self):
  self.send_header('Cache-Control','no-store')
  self.send_header('X-Content-Type-Options','nosniff')
  self.send_header('Referrer-Policy','no-referrer')
  self.send_header('X-Frame-Options','DENY')
  if self.new_cookie:self.send_header('Set-Cookie','ef_supply='+self.new_cookie+'; Path=/; HttpOnly; SameSite=Strict; Max-Age=1800'+('; Secure' if SECURE else ''))
  super().end_headers()
 def do_GET(self):self.dispatch(False)
 def do_POST(self):self.dispatch(True)
 def dispatch(self,post):
  path=urlparse(self.path).path
  if path=='/healthz':return self.reply({'ready':True})
  if path not in (['/','/api','/options','/ux007.js']+(['/campaign-ui.js'] if CAMPAIGN else [])) and not path.startswith('/fonts/'):return self.send_error(404)
  if post:
   if path!='/api':return self.send_error(404)
   origin=self.headers.get('Origin')
   expected=ORIGIN or ('http://'+self.headers.get('Host',''))
   if origin!=expected or self.headers.get('Content-Type','').split(';')[0]!='application/json':return self.reply({'error':'来源或请求格式不正确；未提交。'},403)
   try:n=int(self.headers.get('Content-Length','0'))
   except ValueError:return self.reply({'error':'请求长度无效。'},400)
   if not 0<n<=20000:return self.reply({'error':'请求过大或为空。'},413)
  if CAMPAIGN and not post and path in ['/','/campaign-ui.js']:
   data=(app.ROOT/('sandbox.html' if path=='/' else 'campaign-ui.js')).read_bytes()
   if path=='/':data=data.replace(b'<option value="S">',b'<option value="S" selected>')+b'<script>window.campaignOnline=true;</script><script src="/campaign-ui.js"></script>'
   self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8' if path=='/' else 'text/javascript; charset=utf-8');self.end_headers();self.wfile.write(data);return
  if path in ['/','/ux007.js'] or path.startswith('/fonts/'):
   return super().do_GET() if not post else self.send_error(404)
  if not GATE.acquire(False):return self.reply({'error':'另一局正在结算，请稍后重试；本次未提交。'},503)
  try:
   now=time.monotonic()
   for key in list(SESSIONS):
    if now-SESSIONS[key]['touched']>TTL:del SESSIONS[key]
   cookie=SimpleCookie()
   try:cookie.load(self.headers.get('Cookie',''))
   except Exception:return self.reply({'error':'会话无效，请刷新。'},400)
   token=cookie.get('ef_supply');token=token.value if token else None
   if token not in SESSIONS:
    # POST can never silently recreate a lost game and replay an old action.
    if post:return self.reply({'error':'会话已过期，请刷新并重置片段。'},409)
    if path!='/api':return self.reply({'error':'请先打开试玩首页。'},409)
    CREATIONS[:]=[t for t in CREATIONS if now-t<60]
    if len(SESSIONS)>=MAX_SESSIONS or len(CREATIONS)>=8:return self.reply({'error':'试玩席位已满，请稍后再试。'},503)
    token=secrets.token_urlsafe(32);state,initial=app.load('campaign' if CAMPAIGN else 'prepare','new');SESSIONS[token]=dict(state=state,initial=initial,error=None,receipt=None,touched=now,last=0,base_revision=state['revision']);CREATIONS.append(now);self.new_cookie=token
   slot=SESSIONS[token]
   if post and now-slot['last']<.15:return self.reply({'error':'操作太快，请稍后重试；未提交。'},429)
   if post:slot['last']=now
   slot['touched']=now
   for k in ['state','initial','error','receipt']:setattr(app,k,slot[k])
   # The inherited handler executes unchanged Actions and commits atomically.
   # Bound post-session growth BEFORE accepting more actions. Reset remains available.
   if post:
    raw=self.rfile.read(n)
    try:cmd=app.json.loads(raw)
    except Exception:return self.reply({'error':'请求格式无效。'},400)
    if cmd.get('op')!='reset' and (app.state['revision']-slot['base_revision']>=(CAMPAIGN_MAX_ACTIONS if app.state['clip']=='campaign' else MAX_ACTIONS) or len(app.json.dumps(app.state))>MAX_STATE_BYTES):return self.reply({'error':'本局已达操作／内存限制，请导出反馈并重置。'},409)
    import io
    self.rfile=io.BytesIO(raw)
   try:
    if post:super().do_POST()
    else:super().do_GET()
   finally:
    for k in ['state','initial','error','receipt']:slot[k]=getattr(app,k)
    if post and cmd.get('op')=='reset':slot['base_revision']=app.state['revision']
    for k in ['state','initial','error','receipt']:setattr(app,k,None)
  finally:GATE.release()
class Service(ThreadingHTTPServer):
 daemon_threads=True
 request_queue_size=8
 # Bound concurrent handlers including slow request bodies.
 slots=threading.BoundedSemaphore(8)
 def process_request(self,request,client_address):
  if not self.slots.acquire(False):self.shutdown_request(request);return
  try:super().process_request(request,client_address)
  except Exception:self.slots.release();raise
 def process_request_thread(self,*args):
  try:super().process_request_thread(*args)
  finally:self.slots.release()
if __name__=='__main__':
 if SECURE and not ORIGIN:raise SystemExit('PUBLIC_ORIGIN is required for HTTPS candidate')
 warm_start()
 host=os.environ.get('BIND_HOST','127.0.0.1');port=int(os.environ.get('PORT','8765'))
 print('SUPPLY sandbox ready on '+host+':'+str(port),flush=True)
 Service((host,port),Handler).serve_forever()

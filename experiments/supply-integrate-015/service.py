"""Opt-in, same-origin hotseat authority. Never imported by the live sandbox entry."""
import os,sys,json,time,secrets,subprocess,mimetypes,threading
from pathlib import Path
from http.cookies import SimpleCookie
from urllib.parse import urlparse
from copy import deepcopy
ROOT=Path(__file__).resolve().parents[2]
EXP=ROOT/'experiments/supply-exp-005'
sys.path.insert(0,str(EXP))
os.environ['ENABLE_CAMPAIGN']='1'
import online
from live import execute,effects
from campaign import create_campaign,CONFIG
from display import player_display
from bounded import warm_start
from supply_preview import action_preview, debt_inventory
VERSION='SUPPLY-INTEGRATE-015-v1'
SOURCE='aca1f4b9801ab7b7c7073ac7973bb028cd6df435'
SESSIONS={};GATE=threading.Lock();CREATIONS=[]
class Rejected(Exception):pass

def projection(b,viewer,draft=None,deadline=None,**extra):
 action={'type':'ATTACK','attackerUnitIds':draft.get('attackUnitIds',[])} if draft else None
 request=dict(core=b['core'],revision=b['revision'],viewer=viewer,draft=draft,effects=effects(b['logistics'],action),nextAttackEffects=effects(b['logistics'],{'type':'ATTACK','attackerUnitIds':[u['id'] for u in b['logistics']['units']]}),**extra)
 remaining=(deadline-time.perf_counter()) if deadline else 3
 if remaining<=0:raise TimeoutError()
 p=subprocess.run(['node',str(Path(__file__).with_name('projection.mjs'))],input=json.dumps(request),text=True,capture_output=True,timeout=remaining,cwd=ROOT)
 if p.returncode:raise Rejected('界面请求或操作无效；本次未提交。')
 return json.loads(p.stdout)

def packet(slot,b=None,draft=None,deadline=None,**extra):
 b=b or slot['state'];viewer=slot['viewer'];p=projection(b,viewer,draft,deadline,memory=deepcopy(slot['memory']),**extra)
 memory=p.pop('memory');actions=p.pop('supplyActions')
 supply=player_display(b['logistics'],'G' if viewer=='GERMAN' else 'S')
 own=supply['units'];fx=effects(b['logistics'])
 p['supply']={'version':VERSION,'source':SOURCE,'mode':b['mode'],'profile':CONFIG['id'],
  'units':[dict(id=u['id'],stock=u['stock'],reserve=u['target'],debt=u['debt'],maintenance=u['B'],debtInventory=debt_inventory(u['debt'],u['B']),effect=fx[u['id']]) for u in own],
  'preview':action_preview(b,viewer,actions,draft),
  'ledger':[{**row,'units':[{**u,'debtInventory':debt_inventory(u['debt'],u['due'])} for u in row['units']]} for row in supply['ledger']],'transition':supply['transition'],'receipt':slot.get('receipt',{}).get(viewer),
  'next':'苏军回合末统一配送、维护和恢复；修路不会立即补仓','seconds':slot.get('seconds'),
  'owner':b['core']['pendingDecision']['side'] if b['core']['pendingDecision'] else b['core']['activeSide']}
 p.update(matchRevision=b['revision'],version=VERSION)
 return p,memory

def transact(slot,cmd):
 # Includes validation and post-action projection. No state/receipt/memory commits before deadline.
 started=time.perf_counter();deadline=started+3;b=slot['state']
 if type(cmd.get('revision')) is not int or not isinstance(cmd.get('id'),str) or not 1<=len(cmd['id'])<=96:raise Rejected('操作编号或版本无效；未提交。')
 if not isinstance(cmd.get('action'),dict):raise Rejected('操作格式无效；未提交。')
 a=cmd['action']
 if 'controllerId' in a or 'actionId' in a:raise Rejected('行动方与行动编号由服务管理；未提交。')
 controller=next(c['id'] for c in b['core']['controllers'].values() if c['side']==slot['viewer'])
 # Keep sandbox Action serialization order: frame core_state_hash hashes JSON bytes.
 canonical={'type':a.get('type'),'controllerId':controller};canonical.update({k:v for k,v in a.items() if k not in ['type','controllerId']})
 command=dict(id=cmd['id'],revision=cmd['revision'],action=canonical)
 # Frozen execute handles idempotency before revision/owner checks (including a lost response).
 if cmd['id'] not in b['seen']:
  if b['revision']-slot['base_revision']>=online.CAMPAIGN_MAX_ACTIONS or len(json.dumps(b))>online.MAX_STATE_BYTES:raise Rejected('本局达到会话操作或内存限制；未提交。')
  projection(b,slot['viewer'],deadline=deadline,action=a,memory=slot['memory'])
 r=execute(b,command,seconds=max(0,deadline-time.perf_counter()))
 if not r['ok']:
  timeout=any(t in r.get('error','').lower() for t in ['deadline','timed out','timeout','unresolved'])
  raise Rejected(('结算超过3秒预算' if timeout else '操作不合法或步骤已过期')+'；本次未提交，库存与骰点未改变。')
 candidate=deepcopy(slot);candidate['state']=r['state']
 extra={}
 if not r.get('duplicate'):
  entry=r['state']['journal'][-1];extra=dict(previous=b['core'],entry=entry)
  before={u['id']:u for u in b['logistics']['units']}
  after={u['id']:u for u in r['state']['logistics']['units']}
  candidate['receipt']={side:dict(settled=entry['settled'],charges=[c for c in entry['charges'] if c['side']==short],
   changes=[dict(id=id,stockBefore=before.get(id,{}).get('stock',0),stockAfter=after.get(id,{}).get('stock',0),debtBefore=before.get(id,{}).get('debt','0'),debtAfter=after.get(id,{}).get('debt','0'),debtInventoryBefore=debt_inventory(before.get(id,{}).get('debt','0'),(before.get(id) or after[id])['B']),debtInventoryAfter=debt_inventory(after.get(id,{}).get('debt','0'),(after.get(id) or before[id])['B']),removed=id not in after) for id in sorted(before.keys()|after.keys()) if (after.get(id) or before[id])['side']==short and (before.get(id,{}).get('stock'),before.get(id,{}).get('debt'))!=(after.get(id,{}).get('stock'),after.get(id,{}).get('debt'))]) for side,short in [('GERMAN','G'),('SOVIET','S')]}
 p,memory=packet(candidate,deadline=deadline,**extra)
 elapsed=time.perf_counter()-started
 if elapsed>3:raise TimeoutError()
 candidate['memory']=memory;candidate['seconds']=elapsed;p['supply']['seconds']=elapsed;p['duplicate']=bool(r.get('duplicate'))
 slot.update(candidate)
 return p

class Handler(online.Handler):
 def end_headers(self):
  # Dedicated cookie; no sandbox/production identity is read or exported.
  self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.send_header('X-Frame-Options','DENY')
  if self.new_cookie:self.send_header('Set-Cookie','ef_supply015='+self.new_cookie+'; Path=/; HttpOnly; SameSite=Strict; Max-Age=1800'+('; Secure' if online.SECURE else ''))
  super(online.Handler,self).end_headers()
 def do_GET(self):
  path=urlparse(self.path).path
  if path=='/healthz':return self.reply({'ready':True,'version':VERSION,'source':SOURCE})
  if path=='/experiment':return self.reply({'error':'使用实验入口创建对局。'},405)
  if path=='/':path='/index.html'
  target=(ROOT/'dist'/path.lstrip('/')).resolve()
  try:target.relative_to((ROOT/'dist').resolve())
  except ValueError:return self.send_error(404)
  if not target.is_file():return self.send_error(404)
  data=target.read_bytes()
  self.send_response(200);self.send_header('Content-Type',mimetypes.guess_type(target)[0] or 'application/octet-stream');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
 def do_POST(self):
  if urlparse(self.path).path!='/experiment':return self.send_error(404)
  if self.headers.get('Origin')!=(online.ORIGIN or 'http://'+self.headers.get('Host','')) or self.headers.get('Content-Type','').split(';')[0]!='application/json':return self.reply({'error':'来源或格式无效。'},403)
  try:n=int(self.headers.get('Content-Length','0'))
  except ValueError:return self.reply({'error':'长度无效。'},400)
  if not 0<n<=20000:return self.reply({'error':'请求过大或为空。'},413)
  if not GATE.acquire(False):return self.reply({'error':'服务忙碌；本次未提交，请稍后重试。'},503)
  try:
   cmd=json.loads(self.rfile.read(n));now=time.monotonic()
   if not isinstance(cmd,dict) or cmd.get('version')!=VERSION:raise Rejected('实验版本不兼容；未提交。')
   fields={'open':{'mode'},'close':set(),'query':{'revision','id','draft'},'switch':{'viewer'},'action':{'revision','id','action'}}
   if cmd.get('op') not in fields or set(cmd)-({'op','version'}|fields[cmd['op']]):raise Rejected('请求字段无效；未提交。')
   for token in list(SESSIONS):
    if now-SESSIONS[token]['touched']>online.TTL:del SESSIONS[token]
   cookie=SimpleCookie();cookie.load(self.headers.get('Cookie',''));token=cookie.get('ef_supply015');token=token.value if token else None
   if token not in SESSIONS:
    if cmd.get('op')=='close':return self.reply({'closed':True})
    if cmd.get('op')!='open':return self.reply({'error':'会话已过期或服务重启；无法恢复本局。请返回入口创建新局。'},409)
    if cmd.get('mode') not in ['new','old']:raise Rejected('创建时必须指定补给版本。')
    CREATIONS[:]=[t for t in CREATIONS if now-t<60]
    if len(SESSIONS)>=4 or len(CREATIONS)>=8:return self.reply({'error':'实验席位已满，请稍后重试。'},503)
    b=create_campaign(cmd['mode']);slot=dict(state=b,viewer='SOVIET',memory={'GERMAN':[],'SOVIET':[]},receipt={},seconds=None,base_revision=0,touched=now)
    p,m=packet(slot);slot['memory']=m;token=secrets.token_urlsafe(32);SESSIONS[token]=slot;CREATIONS.append(now);self.new_cookie=token
    return self.reply(p)
   slot=SESSIONS[token];slot['touched']=now
   if cmd.get('op')=='close':del SESSIONS[token];return self.reply({'closed':True})
   if 'mode' in cmd and cmd['mode']!=slot['state']['mode']:raise Rejected('本局补给版本已锁定，不能中途切换。')
   if cmd['op']=='action':return self.reply(transact(slot,cmd))
   if cmd['op']=='switch':
    if cmd.get('viewer') not in ['GERMAN','SOVIET']:raise Rejected('观察方无效。')
    candidate=deepcopy(slot);candidate['viewer']=cmd['viewer'];p,m=packet(candidate);candidate['memory']=m;slot.update(candidate);return self.reply(p)
   if cmd['op'] not in ['query','open']:raise Rejected('操作无效。')
   if cmd['op']=='query' and cmd.get('revision')!=slot['state']['revision']:return self.reply({'error':'界面已过期，请重新同步。'},409)
   p,m=packet(slot,draft=cmd.get('draft'));slot['memory']=m;return self.reply(p)
  except Rejected as e:return self.reply({'error':str(e)},422)
  except (TimeoutError,subprocess.TimeoutExpired):return self.reply({'error':'超过3秒预算；本次未提交，库存与骰点未改变。'},503)
  except Exception as e:
   print('experiment request failed:',type(e).__name__,flush=True)
   return self.reply({'error':'请求无效或结算失败；未提交。'},422)
  finally:GATE.release()
if __name__=='__main__':
 if online.SECURE and not online.ORIGIN:raise SystemExit('PUBLIC_ORIGIN required for HTTPS')
 warm_start();host=os.environ.get('BIND_HOST','127.0.0.1');port=int(os.environ.get('PORT','8765'))
 print('SUPPLY-INTEGRATE-015 ready',host,port,flush=True)
 online.Service((host,port),Handler).serve_forever()

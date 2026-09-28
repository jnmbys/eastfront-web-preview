from http.server import HTTPServer,BaseHTTPRequestHandler
from urllib.parse import urlparse,parse_qs
from live import *
from display import player_display
from bounded import warm_start
from realmap import MAP
COORD={n['id']:n['coord'] for n in MAP['nodes']}
ACTIVE={'GERMAN':'G','SOVIET':'S'}
state=None;initial=None;error=None

def load(clip,mode):
 d=json.loads((ROOT/'data/playable'/f'{clip}-{mode}.json').read_text());return d['state'],d['initial']
def public(viewer):
 s=player_display(state['logistics'],viewer)
 for n in s['nodes']:n['coord']=COORD[n['id']]
 # Own Core flags are authorized. No enemy identities or combat solver context.
 for u in s['units']:
  core=state['core']['units'][u['id']];u.update(hasMoved=core['hasMoved'],hasAttacked=core['hasAttacked'],supplyState=core['supplyState'],effect=effects(state['logistics'])[u['id']])
 s.update(active=ACTIVE[state['core']['activeSide']],revision=state['revision'],mode=state['mode'],clip=state['clip'])
 s['hash']=digest(s)
 # Only an initiating side sees its own completed combat receipt; no raw context/hidden defenders.
 s['combat_receipt']=[]
 for j in state['journal'][-1:]:
  a=j['command']['action']
  controller=state['core']['controllers'].get(a['controllerId'])
  if a['type']=='ATTACK' and controller and ACTIVE[controller['side']]==viewer:
   for e in j['events']:
    if e['type'] in ['CRTResolved','DiceRolled']:s['combat_receipt'].append({k:v for k,v in e.items() if k in ['type','dice','die1','die2','roll','total','result','crtResult','finalCRTColumnLabel']})
 return dict(state=s,error=error,notice='独立规则实验：真实 Core 行动；战斗后续按固定合法策略处理。未平衡、未有人试玩。')
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def reply(self,obj,status=200):
  data=json.dumps(obj,ensure_ascii=False).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
 def do_GET(self):
  u=urlparse(self.path);q=parse_qs(u.query);viewer=q.get('viewer',['G'])[0]
  if viewer not in ['G','S']:return self.reply({'error':'bad viewer'},400)
  if u.path=='/':
   data=(ROOT/'sandbox.html').read_bytes();self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.end_headers();self.wfile.write(data)
  elif u.path.startswith('/fonts/'):
   target=(ROOT/u.path.lstrip('/')).resolve()
   try:target.relative_to((ROOT/'fonts').resolve())
   except ValueError:return self.send_error(404)
   if not target.is_file() or target.suffix not in ['.css','.woff','.woff2']:return self.send_error(404)
   self.send_response(200);self.send_header('Content-Type','text/css' if target.suffix=='.css' else 'font/woff2');self.end_headers();self.wfile.write(target.read_bytes())
  elif u.path=='/api':self.reply(public(viewer))
  elif u.path=='/options':
   try:r=node(state['core'],state['mode'],state['logistics'],'options',side=viewer,unit=q.get('unit',[''])[0]);self.reply({'options':r['options'],'notice':'仅1–2步候选；未知路径为条件，不读取隐藏敌军'})
   except Exception:self.reply({'options':[],'error':'候选未解'})
  elif u.path=='/replay' and q.get('debug',['0'])[0]=='1':self.reply({'initial':initial,'state':state,'warning':'全知研究回放，勿用于玩家接口'})
  else:self.send_error(404)
 def do_POST(self):
  global state,initial,error
  try:
   n=int(self.headers.get('Content-Length','0'))
   if n>20000:raise ValueError('large')
   cmd=json.loads(self.rfile.read(n));viewer=cmd.get('viewer','G')
   if viewer not in ['G','S']:raise ValueError('viewer')
   if cmd['op']=='reset':
    if cmd['clip'] not in CLIPS or cmd['mode'] not in ['new','old']:raise ValueError('config')
    state,initial=load(cmd['clip'],cmd['mode']);error=None
   elif cmd['op']=='action':
    action=cmd['action'];action['controllerId']=next(x['id'] for x in state['core']['controllers'].values() if ACTIVE[x['side']]==viewer)
    if 'paperPath' in action:action['path']=[COORD[k.upper()] for k in action.pop('paperPath').split()]
    if 'repairPair' in action:
     pair=set(action.pop('repairPair').upper().split());action['edgeKeys']=[next(e['core']['key'] for e in MAP['edges'] if {e['a'],e['b']}==pair and e['core'])]
    if 'paperTarget' in action:action['target']=COORD[action.pop('paperTarget').upper()]
    r=execute(state,{'id':cmd['id'],'revision':cmd['revision'],'action':action},seconds=min(3,max(.001,float(cmd.get('budget',3)))))
    if r['ok']:state=r['state'];error=None
    else:error='未提交：行动不合法、版本过期或整次事务未解；原状态与资源保留。'
   else:raise ValueError('operation')
   self.reply(public(viewer))
  except Exception:self.reply({'error':'请求未提交；检查本方、阶段、路径和版本。'},422)
if __name__=='__main__':
 warm_start();state,initial=load('prepare','new');print('EXP005 http://127.0.0.1:8765',flush=True);HTTPServer(('127.0.0.1',8765),Handler).serve_forever()

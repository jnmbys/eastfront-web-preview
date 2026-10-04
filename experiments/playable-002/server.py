"""One 018 owner, same Core bundle for main map and all seven industry operations.
No runtime injection route. Legacy games remain isolated Workers chosen at creation.
"""
import sys,json,time,subprocess,mimetypes,threading,gzip,os
from pathlib import Path
from copy import deepcopy
from urllib.parse import urlsplit
ROOT=Path(__file__).resolve().parents[2];BACK=ROOT/'experiments/industry-integrate-018'
sys.path.insert(0,str(BACK))
from loader import load,digest
mods=load()
from session import Session,ProtocolError
from compat017.local_http import Handler as BaseHandler,LocalServer
from stage016.adapter import audit_root
OUT=ROOT/'evidence/playable-002';OUT.mkdir(exist_ok=True)

def required_chain_step(v):
 if v['phase']!='GERMAN_RECOVERY':return None
 i=v['extensions']['industry018']
 if v['turn']==5 and not i['order']:return '先完成原授权拨款与装备下单'
 if v['turn']==7 and not (i.get('personnel') or {}).get('application'):return '先启用后备人员并申请接驳'
 if v['turn']==8 and (v.get('care') or {}).get('endEpoch')!=9:return '先支付照管，才能继续当前018链路'
 return None

class Game(Session):
 def __init__(self):
  self.sequence=0;self.accepted=0;self.rejected=0;self.history=[];self.ai_count=0;self.ai_stopped=False;self.trace=[];self.trace_key=None;self.trace_path=OUT/('integrated-'+str(time.time_ns())+'.jsonl.gz')
  super().__init__()
 def project(self,draft=None,viewer='GERMAN',**extra):
  b=self.tx.snapshot()['bundle'];raw=json.dumps(dict(core=b['core'],draft=draft,viewer=viewer,matchId=self.instance_id,**extra))
  p=subprocess.run(['node',str(ROOT/'experiments/playable-002/projection.mjs')],input=raw,text=True,encoding='utf8',capture_output=True,timeout=3,cwd=ROOT)
  if p.returncode:raise RuntimeError(p.stderr[-1000:])
  return json.loads(p.stdout)
 def save_trace(self):
  h=self.tx.head();key=(h['version'],self.accepted,self.rejected,self.ai_count)
  if key==self.trace_key:return
  record=dict(head=h,accepted=self.accepted,rejected=self.rejected,aiCount=self.ai_count,history=self.history,records=self.records)
  with gzip.open(self.trace_path,'at',encoding='utf8')as f:f.write(json.dumps(record,ensure_ascii=False)+'\n')
  self.trace_key=key
 def _state(self):
  value=super()._state()
  requirement=required_chain_step(value)
  if requirement:value['operations']['NEXT']=dict(enabled=False,label=requirement)
  try:self.save_trace()
  except OSError:pass # Evidence I/O must never relabel an already committed transaction.
  return value
 def state(self):
  with self.lock:
   v=super().state();r=self.tx.snapshot();b=r['bundle'];c=b['core'];self.sequence+=1
   from display import player_display
   sp=player_display(b['logistics'],'G')
   p=self.project();restricted=c['turn']<9 or c['turn']>9
   owner=c['pendingDecision']['side'] if c['pendingDecision'] else c['activeSide']
   if restricted:p['model']['readOnly']=True;p['canAct']=False;p['forcedAction']=None
   order=dict(matchId=self.instance_id,matchRevision=v['version'],serverSequence=self.sequence)
   payload=dict(**order,revision=v['version'],format='snapshot-v1',resync=True,**p)
   v['game']=dict(message=dict(messageType='PLAYER_VIEW_SNAPSHOT',payload=payload),meta=dict(humanSide='GERMAN',ownerSide=owner,paused=False,manual=True,reason=None,accepted=self.accepted+sum(x['status']=='COMMITTED' for x in self.records.values()),rejected=self.rejected+sum(x['status']=='REJECTED' for x in self.records.values())))
   v['supply']=dict(units=sp['units'],sources=sp['sources'],hubs=sp['hubs'],ledger=sp['ledger'][-1:],transition=sp['transition'],epoch=sp['epoch'])
   v['playableScope']='T5–T8 固定018阶段链；T9开放原Core行动；T10停止。AI仅T9苏军移动/战斗，后勤由人类接管。'
   if c['turn']==9 and not c['pendingDecision']:
    v['operations']['NEXT']['enabled']=True
    if not v['operations']['NEXT']['label'].startswith('执行原场景增援'):v['operations']['NEXT']['label']='结束当前'+v['phaseLabel']+'阶段'
   if c['turn']>9:
    for op in v['operations'].values():op['enabled']=False
   return v
 def action(self,body):
  with self.lock:
   if not isinstance(body,dict) or set(body)!={'id','version','action'} or type(body['version'])is not int or not isinstance(body['action'],dict):raise ProtocolError(400,'INVALID_FIELDS')
   if not isinstance(body['id'],str) or not 8<=len(body['id'])<=80:raise ProtocolError(400,'INVALID_ID')
   prior=getattr(self,'action_replies',{}).get(body['id'])
   if prior:
    if prior[0]!=body:raise ProtocolError(409,'ID_CONFLICT')
    return prior[1]
   old=self.tx.head();r=old['root'];b=r['bundle'];a=body['action'];start=time.perf_counter()
   try:
    assert body['version']==old['version'],'STALE_VERSION'
    assert b['core']['turn']==9,'FIXED_018_CHAIN_T5_T8_OR_END_T10'
    assert a.get('type') not in ['END_PHASE','READY_FOR_PHASE_END','END_SIDE','REPAIR_UNIT'],'USE_ORIGINAL_INDUSTRY_PHASE_OR_RECOVERY'
    self.project(action=a)
    controller=next(c['id']for c in b['core']['controllers'].values()if c['side']=='GERMAN')
    reply=self.apply_game_action(old,dict(type=a['type'],controllerId=controller,**{k:v for k,v in a.items()if k!='type'}),body['id'],start)
   except Exception as e:
    self.rejected+=1;self.last_private_error=str(e);reply=dict(ok=False,error='CORE_OR_TRANSACTION_REJECTED_UNCHANGED')
   if not hasattr(self,'action_replies'):self.action_replies={}
   self.action_replies[body['id']]=(deepcopy(body),reply);return reply
 def apply_game_action(self,old,a,id,start):
  live,_=mods['016'].runtime();r=old['root'];n=deepcopy(old)
  result=live.execute(r['bundle'],dict(id='playable-'+id,revision=r['bundle']['revision'],action=a),seconds=max(0,3-(time.perf_counter()-start)))
  assert result['ok'],result.get('error');assert not result.get('duplicate')
  n['root']['bundle']=result['state'];n['root']['bundleJSON']=mods['016'].serialized(result['state']);n['root']['revision']+=1;n['version']+=1
  audit_root(n['root'],self.tx.contexts['016'].base)
  assert time.perf_counter()-start<3,'TOTAL_3_SECOND_BUDGET'
  assert self.tx.head()==old,'CONCURRENT_CHANGE'
  self.tx._head=n;self.accepted+=1
  # The commit is final. A display/evidence failure must not report rollback.
  try:self.public=self._state()
  except Exception:self.public={**self.public,'readError':'VIEW_UNRESOLVED_QUERY_RECEIPT'}
  return dict(ok=True,version=n['version'],seconds=time.perf_counter()-start)
 def submit(self,body):
  # Original 018 admission/ID binding/queue, including canonical phase commands.
  with self.lock:
   r=self.tx.snapshot();c=r['bundle']['core']
   if c['turn']>9 and body.get('requestId')not in self.records:raise ProtocolError(409,'END_OF_VERIFIED_T9_WINDOW')
   if c['turn']==9 and not c['pendingDecision'] and body.get('operation')=='NEXT':
    self.public['operations']['NEXT']['enabled']=True
   return super().submit(body)
 def _worker(self):
  super()._worker()
 def tick_ai(self):
  with self.lock:
   old=self.tx.head();c=old['root']['bundle']['core'];owner=c['pendingDecision']['side']if c['pendingDecision']else c['activeSide']
   if c['turn']!=9 or owner!='SOVIET' or (not c['pendingDecision']and c['phase']not in ['SOVIET_MOVEMENT','SOVIET_COMBAT']):return dict(ok=False,error='HUMAN_LOGISTICS_OR_FIXED_WINDOW')
   if self.ai_stopped:return dict(ok=False,error='AI_STOPPED')
   start=time.perf_counter();p=self.project(viewer='SOVIET',ai=True,history=self.history,decisionIndex=self.ai_count);self.ai_count+=1
   d=p['decision'];a=d.get('intent');ok=False
   if not a or a['type'] in ['READY_FOR_PHASE_END','END_PHASE']:
    self.save_trace();return dict(ok=False,error='AI_PHASE_COMPLETE_USE_NEXT')
   controller=next(x['id']for x in c['controllers'].values()if x['side']=='SOVIET')
   try:reply=self.apply_game_action(old,{**a,'controllerId':controller},'ai-'+str(self.ai_count),start);ok=True
   except Exception as e:
    self.rejected+=1;self.last_private_error=str(e);reply=dict(ok=False,error='CORE_OR_TRANSACTION_REJECTED_UNCHANGED')
   self.history=(self.history+[dict(observationKey=p['observationKey'],intent=a,outcome='ACCEPTED'if ok else'REJECTED')])[-16:]
   self.save_trace()
   if len(self.history)>=8 and all(h['outcome']=='REJECTED'for h in self.history[-8:]):self.ai_stopped=True
   return reply

class Handler(BaseHandler):
 def send(self,status,data,content_type='application/json; charset=utf-8'):
  raw=data if isinstance(data,bytes)else json.dumps(data,ensure_ascii=False).encode();self.send_response(status)
  for k,v in {'Content-Type':content_type,'Content-Length':str(len(raw)),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin','Content-Security-Policy':"connect-src 'self'; object-src 'none'; frame-ancestors 'none'",'Connection':'close'}.items():self.send_header(k,v)
  self.end_headers();self.wfile.write(raw);self.close_connection=True
 def do_GET(self):
  path=urlsplit(self.path).path
  try:
   self.check(api=path.startswith('/api/'))
   if path=='/play/connect':return self.send(200,dict(token=self.server.token))
   if path.startswith('/api/'):
    if self.server.session is None:raise ProtocolError(409,'CREATE_GAME_FIRST')
    return super().do_GET()
   dest=(ROOT/'.ai003-preview'/('index.html'if path=='/'else path.lstrip('/'))).resolve();dest.relative_to((ROOT/'.ai003-preview').resolve())
   if not dest.is_file():raise ProtocolError(404,'NOT_FOUND')
   return self.send(200,dest.read_bytes(),mimetypes.guess_type(dest)[0]or'application/octet-stream')
  except ProtocolError as e:self.send(e.status,dict(error=e.code))
  except Exception:self.send(404,dict(error='NOT_FOUND'))
 def do_POST(self):
  if self.path=='/api/operations':return super().do_POST()
  try:
   self.check(api=True,write=True)
   assert not self.headers.get('Transfer-Encoding') and len(self.headers.get_all('Content-Length',[]))==1
   n=int(self.headers.get('Content-Length','0'));assert 0<n<32768 and self.headers.get('Content-Type')=='application/json'
   body=json.loads(self.rfile.read(n))
   with self.server.creation_lock:
    if self.path=='/play/create':
     assert body=={'mode':'industry018','side':'GERMAN'},'SUPPORTED_START_T5_GERMAN_ONLY'
     if self.server.session is None:self.server.session=Game()
     return self.send(200,self.server.session.state())
   g=self.server.session
   if g is None:raise ProtocolError(409,'CREATE_GAME_FIRST')
   if self.path=='/play/action':return self.send(200,g.action(body))
   if self.path=='/play/ai':return self.send(200,g.tick_ai())
   if self.path=='/play/query':
    with g.lock:
     assert body['version']==g.tx.head()['version'],'STALE_VERSION'
     p=g.project(body['draft']);g.sequence+=1
     return self.send(200,dict(messageType='MATCH_QUERY',requestId=body['id'],payload=dict(matchId=g.instance_id,matchRevision=g.tx.head()['version'],serverSequence=g.sequence,model=p['model'],forcedAction=None)))
   raise ProtocolError(404,'NOT_FOUND')
  except ProtocolError as e:self.send(e.status,dict(error=e.code))
  except Exception as e:self.send(409,dict(error=str(e)))

if __name__=='__main__':
 port=int(sys.argv[1])if len(sys.argv)>1 else 4185;s=LocalServer(port,None);s.RequestHandlerClass=Handler;s.creation_lock=threading.RLock()
 (ROOT/'playable002-process.json').write_text(json.dumps(dict(pid=os.getpid(),port=port)),encoding='utf8')
 print('PLAYABLE-002 http://127.0.0.1:'+str(port)+' (loopback only)',flush=True)
 try:s.serve_forever(poll_interval=.2)
 except KeyboardInterrupt:pass
 finally:
  s.server_close()
  if s.session:s.session.save_trace();s.session.close()

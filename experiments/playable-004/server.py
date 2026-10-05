"""Continuous single owner for Core, supply and the retained industry services.
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
from continuous import Transactions
from view import state as continuous_state
from types import SimpleNamespace
import queue,uuid
from officers import Officers
OUT=ROOT/'evidence/officer-001';OUT.mkdir(exist_ok=True)

class Game(Session):
 def __init__(self):
  self.officers=Officers();self.sequence=0;self.accepted=0;self.rejected=0;self.history=[];self.ai_count=0;self.ai_stopped=False;self.trace=[];self.trace_key=None;self.trace_path=OUT/('integrated-'+str(time.time_ns())+'.jsonl.gz')
  self.tx=Transactions();self.adapter=SimpleNamespace(query=mods['016'].query,digest=digest,runtime=mods['016'].runtime)
  self.instance_id=str(uuid.uuid4());self.lock=threading.RLock();self.records={};self.queue=queue.Queue();self.closed=False
  self.public=self._state();self.worker=threading.Thread(target=self._worker,name='continuous-owner',daemon=True);self.worker.start()
 def project(self,draft=None,viewer='GERMAN',**extra):
  b=self.tx.snapshot()['bundle'];raw=json.dumps(dict(core=b['core'],draft=draft,viewer=viewer,matchId=self.instance_id,**extra))
  p=subprocess.run(['node',str(ROOT/'experiments/playable-004/projection.mjs')],input=raw,text=True,encoding='utf8',capture_output=True,timeout=3,cwd=ROOT)
  if p.returncode:raise RuntimeError(p.stderr[-1000:])
  return json.loads(p.stdout)
 def save_trace(self):
  h=self.tx.head();key=(h['version'],self.accepted,self.rejected,self.ai_count,self.officers.revision,len(self.officers.reports))
  if key==self.trace_key:return
  record=dict(head=h,accepted=self.accepted,rejected=self.rejected,aiCount=self.ai_count,history=self.history,records=self.records,officers=dict(enabled=self.officers.enabled,groups=self.officers.groups,reports=self.officers.reports))
  with gzip.open(self.trace_path,'at',encoding='utf8')as f:f.write(json.dumps(record,ensure_ascii=False)+'\n')
  self.trace_key=key
 def _state(self):
  value=continuous_state(self)
  try:self.save_trace()
  except OSError:pass # Evidence I/O must never relabel an already committed transaction.
  return value
 def state(self):
  with self.lock:
   v=super().state();r=self.tx.snapshot();b=r['bundle'];c=b['core'];self.sequence+=1
   from display import player_display
   sp=player_display(b['logistics'],'G')
   p=self.project()
   owner=c['pendingDecision']['side'] if c['pendingDecision'] else c['activeSide']
   order=dict(matchId=self.instance_id,matchRevision=v['version'],serverSequence=self.sequence)
   payload=dict(**order,revision=v['version'],format='snapshot-v1',resync=True,**p)
   v['game']=dict(message=dict(messageType='PLAYER_VIEW_SNAPSHOT',payload=payload),meta=dict(humanSide='GERMAN',ownerSide=owner,paused=False,manual=True,reason=None,accepted=self.accepted+sum(x['status']=='COMMITTED' for x in self.records.values()),rejected=self.rejected+sum(x['status']=='REJECTED' for x in self.records.values())))
   v['officers']=self.officers.public(p['view'])
   if v['officers'] is not None:v['officers']['battleInProgress']=bool(c['pendingDecision']and self.officers.battles.get(c['pendingDecision']['battleId'])in [g['id']for g in self.officers.active()])
   v['supply']=dict(units=sp['units'],sources=sp['sources'],hubs=sp['hubs'],ledger=sp['ledger'][-1:],transition=sp['transition'],epoch=sp['epoch'])
   v['freightPlanning']=dict(enabled=(c['turn'],c['phase'])==(8,'SOVIET_ENTRENCHMENT')and not c['pendingDecision']and not r['forward']['shipment'], applied=r['forward'].get('dynamicPlan'))
   v['playableScope']='动态运输实验004。固定真实T5起点，可自由作战并持续至原规则终局。AI苏军作战单步运行；双方后勤由人类接管。工业仅一次T5订单、T7人员、T8照管、E8预览并确认前送、T9 C10的G-I-01材料恢复；可跳过。'
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
    assert a.get('type') not in ['END_PHASE','READY_FOR_PHASE_END','END_SIDE'],'USE_ORIGINAL_INDUSTRY_PHASE_OR_RECOVERY'
    projected=self.project()
    assert self.officers.manual(a,projected['view']),'UNIT_DELEGATED_PAUSE_OR_RECALL_FIRST'
    self.project(action=a)
    controller=next(c['id']for c in b['core']['controllers'].values()if c['side']=='GERMAN')
    reply=self.apply_game_action(old,dict(type=a['type'],controllerId=controller,**{k:v for k,v in a.items()if k!='type'}),body['id'],start)
   except Exception as e:
    self.rejected+=1;self.last_private_error=str(e);reply=dict(ok=False,error='CORE_OR_TRANSACTION_REJECTED_UNCHANGED')
   if not hasattr(self,'action_replies'):self.action_replies={}
   self.action_replies[body['id']]=(deepcopy(body),reply);return reply
 def apply_game_action(self,old,a,id,start):
  reply=self.tx.submit(dict(id=id,operation='ACTION',version=old['version'],action=a),action=a,started=start)
  assert reply['ok'],reply.get('detail',reply.get('error'))
  self.accepted+=1;n=self.tx.head()
  # The commit is final. A display/evidence failure must not report rollback.
  try:self.public=self._state()
  except Exception:self.public={**self.public,'readError':'VIEW_UNRESOLVED_QUERY_RECEIPT'}
  return dict(ok=True,version=n['version'],seconds=time.perf_counter()-start)
 def _worker(self):
  super()._worker()
 def submit(self,body):
  # Keep the original receipt-first four-field envelope and recovery endpoint.
  if not isinstance(body,dict) or not isinstance(body.get('operation'),str) or not body['operation'].startswith('FREIGHT_'):return super().submit(body)
  import re
  if set(body)!={'requestId','instanceId','expectedVersion','operation'} or not re.fullmatch(r'[A-Za-z0-9_-]{8,80}',str(body['requestId'])) or type(body['expectedVersion'])is not int:raise ProtocolError(400,'INVALID_FIELDS')
  with self.lock:
   if self.closed:raise ProtocolError(503,'SESSION_CLOSING')
   if body['instanceId']!=self.instance_id:raise ProtocolError(409,'INSTANCE_CHANGED_DO_NOT_REPLAY')
   id=body['requestId'];prior=self.records.get(id)
   if prior:
    if prior['body']!=body:raise ProtocolError(409,'REQUEST_ID_CONTENT_CONFLICT')
    return self._result(prior)
   rec=dict(**deepcopy(body),body=deepcopy(body),internal=None,status='PENDING',code=None,resultVersion=None,gameRevision=None);self.records[id]=rec
   if body['expectedVersion']!=self.tx.head()['version']:rec.update(status='REJECTED',code='STALE_PLAN_REPREVIEW_REQUIRED')
   elif body['operation'][8:]not in self.tx.plans:rec.update(status='REJECTED',code='UNKNOWN_PLAN')
   else:
    rec['internal']=self.tx.request(id,body['operation']);rec['internalHash']=digest(rec['internal']);self.queue.put(id)
   return self._result(rec)
 def tick_ai(self):
  with self.lock:
   old=self.tx.head();c=old['root']['bundle']['core'];owner=c['pendingDecision']['side']if c['pendingDecision']else c['activeSide']
   if owner!='SOVIET' or (not c['pendingDecision']and c['phase']not in ['SOVIET_MOVEMENT','SOVIET_COMBAT']):return dict(ok=False,error='HUMAN_LOGISTICS_REQUIRED')
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
   if self.path=='/play/freight-preview':
    with g.lock:
     assert set(body)=={'version','choices'},'INVALID_FIELDS'
     return self.send(200,g.tx.preview(body['version'],body['choices']))
   if self.path=='/play/ai':return self.send(200,g.tick_ai())
   if self.path=='/play/officers/config':
    with g.lock:return self.send(200,g.officers.config(body,g.project()['view']))
   if self.path=='/play/officers/tick':
    with g.lock:return self.send(200,g.officers.tick(g,body))
   if self.path=='/play/query':
    with g.lock:
     assert body['version']==g.tx.head()['version'],'STALE_VERSION'
     p=g.project(body['draft']);g.sequence+=1
     return self.send(200,dict(messageType='MATCH_QUERY',requestId=body['id'],payload=dict(matchId=g.instance_id,matchRevision=g.tx.head()['version'],serverSequence=g.sequence,model=p['model'],forcedAction=None)))
   raise ProtocolError(404,'NOT_FOUND')
  except ProtocolError as e:self.send(e.status,dict(error=e.code))
  except Exception as e:self.send(409,dict(error=str(e)))

if __name__=='__main__':
 port=int(sys.argv[1])if len(sys.argv)>1 else 4186;s=LocalServer(port,None);s.RequestHandlerClass=Handler;s.creation_lock=threading.RLock()
 (ROOT/'officer001-process.json').write_text(json.dumps(dict(pid=os.getpid(),port=port)),encoding='utf8')
 print('OFFICER-001 http://127.0.0.1:'+str(port)+' (loopback only)',flush=True)
 try:s.serve_forever(poll_interval=.2)
 except KeyboardInterrupt:pass
 finally:
  s.server_close()
  if s.session:s.session.save_trace();s.session.close()

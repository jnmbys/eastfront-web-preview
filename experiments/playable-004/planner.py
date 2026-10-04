"""Exact, bounded planning over authorized information; never publishes a state."""
import sys,os,json,time,subprocess,multiprocessing as mp,atexit
from pathlib import Path
from copy import deepcopy
HERE=Path(__file__).resolve().parent
RUNTIME=HERE.parent/'industry-integrate-018/.runtime'
os.environ['OPENBLAS_NUM_THREADS']='1'
for path in [RUNTIME/'live',RUNTIME/'audit']:sys.path.append(str(path))
CONFIG=json.loads((HERE/'experiment.json').read_text())

def public_input(s):
 from legalmap import KEYS,key,SIDES
 # No enemy stock, historical ledger, hidden graph attributes or hashes cross this seam.
 v=s['legal_view']['G']
 z=json.loads(subprocess.run(['node',str(HERE/'visibility.mjs')],input=json.dumps(v),text=True,capture_output=True,check=True,timeout=1).stdout)
 out={k:deepcopy(s[k])for k in ['clock','variant','T','use_t','policy','order','tick','epoch','rotation','solver','allocator','reserve_setting']}
 out.update(legal_state=True,pending=False,game_over=False,hidden={})
 known={KEYS[k]for k in v['identifiedHexKeys']};hexes={key(h['coord']):h for h in v['hexes']}
 ids={KEYS[k]:k for k in hexes};out['nodes']=[]
 for n in s['nodes']:
  h=hexes[ids[n['id']]];a={k:deepcopy(n[k])for k in ['id','x','y','terrain']if k in n}
  a.update(control=SIDES.get(h['control']),core_control=h['control'],known=n['id']in known,occupants=[],zoc_by=[side for side,keys in z.items()if ids[n['id']]in keys]);out['nodes'].append(a)
 ns={n['id']:n for n in out['nodes']}
 for u in v['units']:
  if u.get('visibility')=='IDENTIFIED':ns[KEYS[key(u['hex'])]]['occupants'].append(SIDES[u['side']])
 edges={tuple(sorted([KEYS[key(e['a'])],KEYS[key(e['b'])]])):e for e in v['edges']};out['edges']=[]
 for e in s['edges']:
  a={k:deepcopy(e[k])for k in ['id','a','b','modes','cost','cost_ab','cost_ba','rail_cost','cap','bridge_cap']if k in e}
  observed=edges.get(tuple(sorted([e['a'],e['b']])))
  a.update(cut=False,bridge=deepcopy(observed['bridge'])if observed else None,core_railway=deepcopy(observed['railway'])if observed else None);out['edges'].append(a)
 for k in ['units','sources','hubs']:out[k]=[deepcopy(x)for x in s[k]if x['side']=='G']
 return out

def public_service(root,s):
 """Known service failures only; authoritative route_check is reserved for commit."""
 from stage016.adapter import material
 from stage016.config import REAR
 p,e=material(root);f=root['forward'];c=root['bundle']['core']
 if (c['turn'],c['phase'])!=(8,'SOVIET_ENTRENCHMENT'):return '服务窗口：仅E8苏军筑垒结束前可确认，T9可用'
 if c['pendingDecision']:return '先处理当前待决动作'
 if f['shipment']:return '本次前送已使用'
 if not f['care']or f['care']['status']!='PAID_ACTIVE':return '缺少T8已支付照管'
 if not p or not e or p['quantityP']!=1 or e['quantityE2']!=2 or any(x['owner']!=REAR or x['custody']!='REAR_AVAILABLE'for x in [p,e]):return '需要后方可用的1P＋2E2'
 target=next((u for u in s['units']if u['id']=='G-I-01'and u['strength']>0),None)
 if not target or target['node']!='C10':return '服务资格失效：G-I-01必须在C10；分配运力不能解除此限制'
 ns={n['id']:n for n in s['nodes']};es={e['id']:e for e in s['edges']}
 if any(ns[k]['control']not in [None,'G']or 'S'in ns[k]['occupants']or 'S'in ns[k]['zoc_by']for k in ['A10','B10','C10']):return '授权态势显示服务路线受阻'
 for k in ['A10~B10','B10~C10']:
  e=es[k]
  if e['core_railway']!={'present':True,'destroyed':False,'repairedBy':'GERMAN'}or e['bridge']is not None:return '公开铁路不满足原服务合同'
 if not any(h['id']=='GH2'and h['node']=='C10'and not h.get('inactive')for h in s['hubs']):return '原接收枢纽不可用'
 return None

def solve(s,choices,deadline):
 import model,cargo_network,optimize004
 from reference009 import project_unit,audit_flows
 from stage016.config import CARGO
 model.DEADLINE=deadline;model.PROFILE.clear()
 original=deepcopy(s);before=model.solve(original,'G')
 refs=[project_unit(u,before['deliveries'][u['id']],s)for u in s['units']if u['strength']>0]
 s=deepcopy(s);s['player_reductions']=choices['reductions']
 for u in s['units']:u['priority']=choices['priorities'].get(u['id'],u.get('priority',1))
 # A timeout is unknown, never a proof of infeasibility.
 try:g=cargo_network.solve_network(s,refs,CARGO,'G')
 except Exception:
  status='NO_CAPACITY'if model.PROFILE and model.PROFILE[-1].get('status')==2 else 'UNRESOLVED'
  return dict(status=status,kit=0,reference=refs,capacity=[dict(id=x['id'],originalCap=x['cap'],spUsed=x['used'],cargo=CARGO.get(x['id'],0),remaining=x['cap']-x['used']-CARGO.get(x['id'],0))for x in before['constraints']],profile=deepcopy(model.PROFILE))
 rows=audit_flows(s,g,CARGO);comparison=[]
 from live import effects
 for u,ref in zip([u for u in s['units']if u['strength']>0],refs):
  alt=project_unit(u,g['deliveries'][u['id']],s)
  def effect(row):return effects({'units':[dict(u,stock=row['after'],debt=row['debt'])]},dict(type='ATTACK',attackerUnitIds=[u['id']]))[u['id']]
  comparison.append(dict(id=u['id'],reference=ref,alternative=alt,referenceCombat=effect(ref),alternativeCombat=effect(alt)))
 return dict(status='FEASIBLE',kit=1,candidate=g,capacity=rows,comparison=comparison,profile=deepcopy(model.PROFILE),optimal=bool(optimize004.STATE['complete']),hubs=[dict(id=h['id'],before=h['stock'],reference=before['hubs'][h['id']],alternative=g['hubs'][h['id']])for h in s['hubs']])

def worker(conn):
 import model,cargo_network
 # Stage016 constants without invoking Transactions or warm-starting another process.
 sys.path.insert(0,str(HERE.parent/'industry-integrate-018'))
 from loader import load
 load()
 conn.send(True)
 while True:
  try:s,choices,deadline=conn.recv()
  except EOFError:return
  try:conn.send(solve(s,choices,deadline))
  except Exception as e:conn.send(dict(status='UNRESOLVED',kit=0,error=str(e)))

class Planner:
 def __init__(self):
  self.proc=None;self.conn=None;self.warm()
 def warm(self):
  ctx=mp.get_context('spawn');self.conn,child=ctx.Pipe();self.proc=ctx.Process(target=worker,args=(child,),daemon=True);self.proc.start();child.close()
  if not self.conn.poll(15)or not self.conn.recv():self.close();raise RuntimeError('PLANNER_STARTUP')
 def close(self):
  if self.proc:
   self.proc.terminate();self.proc.join(timeout=.2)
   if self.proc.is_alive():self.proc.kill();self.proc.join()
   self.proc=None;self.conn.close()
 def calculate(self,s,choices,seconds):
  if not self.proc or not self.proc.is_alive():return dict(status='UNRESOLVED',kit=0,error='重启本地服务以恢复已超时的规划器；对局仍可继续')
  deadline=time.perf_counter()+seconds;self.conn.send((s,choices,deadline))
  if not self.conn.poll(max(0,deadline-time.perf_counter())):self.close();return dict(status='UNRESOLVED',kit=0,error='3秒预算耗尽；没有证明无解')
  return self.conn.recv()

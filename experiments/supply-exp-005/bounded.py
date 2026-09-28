"""One deadline for the complete two-army transaction; disposable warm worker.
Warm startup is explicit service setup, never hidden inside reported solve time.
The parent alone commits. A killed/failed worker cannot mutate its input object.
"""
import multiprocessing as mp,time,atexit
_WORKER=None

def _worker(conn):
 import model
 conn.send({'ready':True})
 while True:
  try:job=conn.recv()
  except EOFError:break
  s,op,deadline=job;model.DEADLINE=deadline;model.PROFILE.clear()
  try:
   if op=='settle':out,result,retry=model.settle(s,s['epoch'])
   elif op=='next':
    out=s;old=s['tick']
    while out['tick']==old:out=model.advance(out,'bounded-'+str(out['half']))
    result=out['ledger'];retry=False
   elif op=='half':out=model.advance(s,'bounded-'+str(s['half']));result=out.get('ledger',[]);retry=False
   else:raise ValueError('unsupported transaction')
   model.check_budget();conn.send(dict(ok=True,state=out,result=result,retry=retry,profile=list(model.PROFILE)))
  except Exception as e:conn.send(dict(ok=False,error=str(e),profile=list(model.PROFILE)))
 conn.close()

def close_worker():
 global _WORKER
 if _WORKER is None:return
 proc,conn,ready=_WORKER;_WORKER=None
 if proc.is_alive():proc.terminate()
 proc.join(timeout=.15)
 if proc.is_alive():proc.kill();proc.join()
 conn.close()
atexit.register(close_worker)

def _ensure(deadline):
 global _WORKER
 if _WORKER is None:
  ctx=mp.get_context('spawn');parent,child=ctx.Pipe();proc=ctx.Process(target=_worker,args=(child,),daemon=True);proc.start();child.close();_WORKER=[proc,parent,False]
 if not _WORKER[2]:
  if not _WORKER[1].poll(max(0,deadline-time.perf_counter())):raise TimeoutError('worker startup budget')
  if not _WORKER[1].recv().get('ready'):raise RuntimeError('invalid worker handshake')
  _WORKER[2]=True
 return _WORKER

def warm_start(seconds=10):
 began=time.perf_counter()
 try:_ensure(began+seconds);return time.perf_counter()-began
 except Exception:close_worker();raise

def transaction(s,op='next',seconds=3):
 began=time.perf_counter();deadline=began+seconds
 try:
  if seconds<=0:raise TimeoutError('zero budget')
  proc,conn,ready=_ensure(deadline);conn.send((s,op,deadline))
  if not conn.poll(max(0,deadline-time.perf_counter())):raise TimeoutError('transaction deadline')
  result=conn.recv()
  if time.perf_counter()>deadline:raise TimeoutError('completed after deadline')
 except (TimeoutError,EOFError,BrokenPipeError,OSError):
  close_worker();result=dict(ok=False,error='总时间预算耗尽或进程不可用；未解，原状态保留')
 result['seconds']=time.perf_counter()-began
 if not result['ok']:result['state']=s
 return result

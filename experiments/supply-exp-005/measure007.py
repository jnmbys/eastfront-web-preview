import os,subprocess,time,threading,json,urllib.request,http.cookiejar
from pathlib import Path
if __name__=='__main__':
 started=time.perf_counter();p=subprocess.Popen(['python3','online.py'],env={**os.environ,'PORT':'8768','COOKIE_SECURE':'0','PUBLIC_ORIGIN':'http://127.0.0.1:8768'},stdout=subprocess.PIPE,text=True);peak=[0];stop=threading.Event()
 def monitor():
  while not stop.is_set():
   try:
    stats={}
    for entry in Path('/proc').glob('[0-9]*/status'):
     try:
      fields=dict(line.split(':',1) for line in entry.read_text().splitlines());stats[int(entry.parent.name)]=(int(fields['PPid']),int(fields.get('VmRSS','0 kB').split()[0])*1024)
     except (OSError,ValueError,KeyError):pass
    descendants={p.pid}
    for _ in range(8):descendants|={pid for pid,(parent,rss) in stats.items() if parent in descendants}
    peak[0]=max(peak[0],sum(stats.get(pid,(0,0))[1] for pid in descendants))
   except OSError:pass
   stop.wait(.05)
 t=threading.Thread(target=monitor);t.start();results=[]
 try:
  assert 'ready' in p.stdout.readline();ready=time.perf_counter()-started
  for clip in ['prepare','isolation','restore','prepare']:
   c=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
   def request(cmd=None):
    time.sleep(.17);began=time.perf_counter();q=urllib.request.Request('http://127.0.0.1:8768/api',data=json.dumps(cmd).encode() if cmd else None,headers={'Content-Type':'application/json','Origin':'http://127.0.0.1:8768'})
    with c.open(q) as r:v=json.load(r)
    return v,time.perf_counter()-began
   request();r,_=request(dict(op='reset',clip=clip,mode='new',viewer='G'))
   for i in range(2):
    s=r['state'];r,elapsed=request(dict(op='action',id=clip+str(i),revision=s['revision'],viewer=s['decision_side'],action={'type':'END_SIDE'}));results.append(dict(clip=clip,seconds=elapsed,committed=not r['error']))
  Path('evidence/resources007.json').write_text(json.dumps(dict(ready_seconds=ready,peak_process_tree_rss_mib=peak[0]/1024**2 if peak[0] else None,rss_note='unavailable when null; proc namespace did not expose matching process tree',sessions=4,actions=results,platform='local Linux; not Render sizing proof'),indent=2))
 finally:stop.set();t.join();p.terminate();p.wait()

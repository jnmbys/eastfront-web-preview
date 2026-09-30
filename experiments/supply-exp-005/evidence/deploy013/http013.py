"""Target Render HTTPS: replay existing deployment prefix, one settlement per clip.
No omniscient state injection into the public service; normal 3s transactions.
"""
import urllib.request,urllib.error,http.cookiejar,time,json,gzip,hashlib,traceback,os,socket
from pathlib import Path
url='https://eastfront-supply-sandbox.onrender.com';jar=http.cookiejar.CookieJar();client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
r={'source_sha':os.getenv('RENDER_GIT_COMMIT'),'host':socket.gethostname(),'url':url,'budget':3,'deployment':[],'clips':[],'passed':False}
def call(cmd=None,path='/api?viewer=S'):
 time.sleep(.16);t=time.perf_counter();req=urllib.request.Request(url+path,data=json.dumps(cmd).encode() if cmd else None,headers={'Content-Type':'application/json','Origin':url})
 try:
  with client.open(req,timeout=20) as resp:code=resp.status;raw=resp.read();headers=dict(resp.headers)
 except urllib.error.HTTPError as e:code=e.code;raw=e.read();headers={}
 return code,json.loads(raw),time.perf_counter()-t,headers
try:
 code,b,_,_=call(path='/healthz');assert code==200 and b['ready'];r['https_health']=True
 code,b,_,headers=call();assert code==200 and b['state']['clip']=='campaign';s=b['state']
 cookie=headers.get('Set-Cookie','');r['cookie_flags']={flag:flag in cookie for flag in ['Secure','HttpOnly','SameSite=Strict','Max-Age=1800']};assert all(r['cookie_flags'].values())
 records=json.loads(gzip.decompress(Path('evidence/campaign011/run.json.gz').read_bytes()))['records'][:60]
 for row in records:
  cmd=row['command'];viewer='G' if cmd['action']['controllerId'].startswith('G-') else 'S'
  code,b,dt,_=call(dict(op='action',viewer=viewer,budget=3,**cmd),'/api');ok=code==200 and not b.get('error') and b['state']['revision']==cmd['revision']+1
  r['deployment'].append(dict(rev=cmd['revision']+1,seconds=dt,ok=ok,error=b.get('error')));assert ok,(code,b.get('error'));s=b['state']
 r['deployment_final']={k:s[k] for k in ['revision','core_phase','core_turn','clip']};assert s['core_phase']=='GERMAN_SUPPLY_RAIL'
 for clip in ['prepare','isolation','restore']:
  code,b,_,_=call(dict(op='reset',viewer='G',clip=clip,mode='new'),'/api');assert code==200 and not b['error'];s=b['state'];tick=s['tick'];entry={'clip':clip,'requests':[]};r['clips'].append(entry)
  plan=([{'type':'RAIL_REPAIR','repairPair':'C10 D10'}] if clip=='restore' else [])+[{'type':'END_SIDE'}]*2
  for a in plan:
   code,b,dt,_=call(dict(op='action',id='deploy013-'+clip+'-'+str(s['revision']),revision=s['revision'],viewer=s['decision_side'],budget=3,action=a),'/api')
   ok=code==200 and not b.get('error');entry['requests'].append(dict(action=a['type'],seconds=dt,ok=ok,error=b.get('error')));assert ok,(code,b.get('error'));s=b['state']
  entry['settled']=s['tick']==tick+1 and bool(s['feedback']['settled']);assert entry['settled']
 code,b,_,_=call(dict(op='reset',viewer='G',clip='prepare',mode='old'),'/api');assert code==200 and not b['error'] and b['state']['mode']=='old';r['old_clip_reset']=True
 code,b,_,_=call(dict(op='reset',viewer='S',clip='campaign',mode='new'),'/api');assert code==200 and not b['error'] and b['state']['revision']==0;r['final_campaign_reset']=True;r['passed']=True
except Exception:r['failure']=traceback.format_exc()
finally:
 r['cgroup']={k:Path('/sys/fs/cgroup/'+k).read_text().strip() for k in ['cpu.max','memory.max','memory.peak','memory.events']};Path('/tmp/http013.json').write_text(json.dumps(r,indent=2,ensure_ascii=False));print('DEPLOY013_HTTP '+json.dumps(r,ensure_ascii=False),flush=True)
 with open('/proc/1/fd/1','w') as log:print('DEPLOY013_HTTP '+json.dumps(r,ensure_ascii=False),file=log,flush=True)

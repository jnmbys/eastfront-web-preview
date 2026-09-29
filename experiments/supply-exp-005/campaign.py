"""Isolated full-campaign lifecycle; Core/solver/formulas remain frozen."""
from live import *
from display import player_display
CONFIG=json.loads((ROOT/'campaign-config.json').read_text())
def metadata(core,viewer='G',op='metadata',seed=17):
 if viewer not in ['G','S']:raise ValueError('viewer')
 p=subprocess.run(['node',str(ROOT/'campaign-bridge.mjs')],input=json.dumps(dict(op=op,state=core,viewer=viewer,seed=seed)),text=True,capture_output=True,check=True,cwd=ROOT,timeout=10)
 return json.loads(p.stdout)
def create_campaign(mode='new',seed=17):
 if mode not in ['new','old']:raise ValueError('mode')
 core=metadata(None,op='init',seed=seed)
 # Frame adapter needs only the initial public map and empty deployment roster.
 f=node(core,'old',{'units':[]})['frame'];fid='__campaign_initial__';FRAMES[fid]=f
 try:s=start(fid,reserve=CONFIG['reserve_B'],delivery_range=CONFIG['delivery_range'],clock=CONFIG['clock'],variant=CONFIG['variant'],policy=CONFIG['policy'],use_t=CONFIG['use_t'],order=CONFIG['order'])
 finally:del FRAMES[fid]
 s.update(campaign_config=deepcopy(CONFIG),experimental_profile=CONFIG['id'],ruleset=CONFIG['id'],scenario='campaign',name='完整战役（实验配置，未平衡）',action_spent=0,action_ledger=[],sources=deepcopy(CONFIG['sources']),T=CONFIG['T'])
 s['hubs']=[dict(id=side+'H'+str(i+1),side=side,node=n,range=CONFIG['delivery_range'],**CONFIG['hub']) for side,nodes in CONFIG['hub_nodes'].items() for i,n in enumerate(nodes)]
 for e in s['edges']:e.update(cap=CONFIG['edge_capacity'],bridge_cap=CONFIG['bridge_capacity'] if e['bridge'] else None)
 s['continuity']['initial']=material(s)
 r=node(core,mode,s);s=sync(s,r['frame'])
 return dict(core=r['frame']['state'],logistics=s,mode=mode,clip='campaign',revision=0,seen={},journal=[])
def campaign_view(b,viewer):
 out=player_display(b['logistics'],viewer);out['campaign']=metadata(b['core'],viewer);out['pending']=deepcopy(b['logistics']['legal_view'][viewer]['pendingDecision']);return out
if __name__=='__main__':
 import argparse
 from bounded import warm_start
 p=argparse.ArgumentParser();p.add_argument('op',choices=['new','apply','view','replay']);p.add_argument('file');p.add_argument('--mode',default='new',choices=['new','old']);p.add_argument('--viewer',default='G',choices=['G','S']);p.add_argument('--seed',type=int,default=17);a=p.parse_args();path=Path(a.file)
 if a.op=='new':
  b=create_campaign(a.mode,a.seed);path.write_text(json.dumps(dict(initial=b,state=b)));print('Created campaign; omniscient research file, never a player response.')
 else:
  d=json.loads(path.read_text())
  if 'records' in d:
   if a.op!='replay':raise ValueError('compact evidence supports replay only')
   if d['profile']!=CONFIG:raise ValueError('profile differs from recorded campaign')
   warm_start();b=create_campaign(d['mode'],d['seed']);assert hash_bundle(b)==d['initial_hash']
   for j in d['records']:
    r=execute(b,j['command']);assert r['ok'],r.get('error');b=r['state'];assert hash_bundle(b)==j['hash']
   assert hash_bundle(b)==d['final_hash'];print('Replay equal:',b['revision'],b['core']['victory']);raise SystemExit(0)
  b=d['state']
  if a.op=='view':print(json.dumps(campaign_view(b,a.viewer),ensure_ascii=False))
  elif a.op=='apply':
   import sys
   warm_start();r=execute(b,json.load(sys.stdin))
   if r['ok']:d['state']=r['state'];path.write_text(json.dumps(d))
   print(json.dumps({k:v for k,v in r.items() if k!='state'}))
  else:
   warm_start();b=d['initial']
   for j in d['state']['journal']:
    r=execute(b,j['command']);assert r['ok'],r.get('error');b=r['state'];assert hash_bundle(b)==j['hash']
   assert hash_bundle(b)==hash_bundle(d['state']);print('Replay equal:',b['revision'],b['core']['victory'])

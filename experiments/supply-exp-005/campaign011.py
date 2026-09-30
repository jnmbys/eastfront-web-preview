"""Fixed human-authored integration recipe. Not a player policy or AI.
Every state change goes through live.execute (3 s); checkpoint resumes the SAME game.
"""
from campaign import *
from bounded import warm_start,close_worker
import os,threading,platform,resource,statistics,sys,gzip
OUT=ROOT/'evidence/campaign011';OUT.mkdir(exist_ok=True)
CHECK=ROOT/'data/campaign011-checkpoint.json.gz'
COORD={n['id']:n['coord'] for n in __import__('realmap').MAP['nodes']}
EDGE={frozenset((e['a'],e['b'])):e['core']['key'] for e in __import__('realmap').MAP['edges'] if e['core']}
SEED=17
class Memory:
 def __init__(self):self.peak=0;self.samples=0;self.stopped=False;self.thread=threading.Thread(target=self.watch,daemon=True)
 def watch(self):
  root=int(os.readlink('/proc/self'));page=os.sysconf('SC_PAGE_SIZE')
  while not self.stopped:
   procs={}
   for path in Path('/proc').iterdir():
    if not path.name.isdigit():continue
    try:
     # /proc children is unavailable here; derive our descendant tree by PPid.
     fields=(path/'stat').read_text().rsplit(')',1)[1].split()
     procs[int(path.name)]=(int(fields[1]),int(fields[21])*page)
    except (OSError,ValueError,IndexError):pass
   descendants={root};changed=True
   while changed:
    new={pid for pid,(parent,_) in procs.items() if parent in descendants}-descendants
    changed=bool(new);descendants.update(new)
   rss=sum(procs[pid][1] for pid in descendants if pid in procs)
   self.peak=max(self.peak,rss);self.samples+=1;time.sleep(.1)
 def start(self):self.thread.start()
 def finish(self):self.stopped=True;self.thread.join();return {'peak_sampled_process_tree_rss_bytes':self.peak,'samples':self.samples,'interval_seconds':.1,'method':'sum RSS of harness + live descendants from host PPid tree sampled every100ms; shared pages may double count, short peaks may be missed; NOT cgroup/cloud peak'}

def main():
 memory=Memory();memory.start();warm_start()
 if CHECK.exists():d=json.loads(gzip.decompress(CHECK.read_bytes()));b=d['state'];assert d['config']==CONFIG;print('RESUME',b['revision'],b['core']['turn'],b['core']['phase'],flush=True)
 else:b=create_campaign('new',SEED);d=dict(state=b,config=deepcopy(CONFIG),seed=SEED,initial_hash=hash_bundle(b),records=[],labels=[],failures=[],runs=[])
 began=time.perf_counter();labels=set(d['labels']);current='startup'
 def save():
  d['state']=b;d['labels']=sorted(labels);tmp=CHECK.with_suffix('.tmp');tmp.write_bytes(gzip.compress(json.dumps(d).encode()));tmp.replace(CHECK)
 def run(label,action,optional=False):
  nonlocal b,current
  current=label
  if label in labels:return True
  before=b;cmd=auto_command(b);cmd['action'].update(action);r=execute(b,cmd,seconds=3)
  if not r['ok']:
   assert r['state']==before
   failure=dict(label=label,turn=b['core']['turn'],phase=b['core']['phase'],action=action,error=r.get('error'),seconds=r['seconds'],unchanged=True);d['failures'].append(failure);save();print('REJECT',json.dumps(failure),flush=True)
   if optional:return False
   raise RuntimeError(failure)
  b=r['state'];j=b['journal'][-1];assert audit(b['logistics']);assert b['logistics']['tick']==before['logistics']['tick']+int(j['settled'])
  old={u['id']:u for u in before['logistics']['units']};new={u['id']:u for u in b['logistics']['units']};changes=[]
  for uid in sorted(set(old)|set(new)):
   def fields(x):return {k:x[k] for k in ['node','stock','debt','strength']} if x else None
   a,z=fields(old.get(uid)),fields(new.get(uid))
   if a!=z:changes.append(dict(unit=uid,before=a,after=z))
  for uid in set(new)-set(old):
   assert new[uid]['stock']==(new[uid]['B']*3 if action['type']=='DEPLOY_INITIAL_UNIT' else 0)
  assert {u['id'] for u in b['logistics']['units']}=={u['id'] for u in b['core']['units'].values() if u['alive']}
  for u in b['logistics']['units']:assert u['strength']==node_capacity(b['core']['units'][u['id']])
  from verify_campaign011 import check_losses
  check_losses(before,b,j)
  dup=execute(b,cmd,seconds=3);assert dup['ok'] and dup['duplicate'] and dup['state']==b
  rec=dict(label=label,turn_before=before['core']['turn'],phase_before=before['core']['phase'],command=cmd,hash=hash_bundle(b),seconds=r['seconds'],settled=j['settled'],epoch_before=before['logistics']['epoch'],epoch_after=b['logistics']['epoch'],charges=j['charges'],events=j['events'],supply_events=j['supply_events'],changes=changes,audit=audit(b['logistics']),pending=b['core']['pendingDecision']['kind'] if b['core']['pendingDecision'] else None)
  if j['settled']:rec['ledger']=deepcopy(b['logistics']['ledger']);print('SETTLE',b['core']['turn'],b['revision'],round(r['seconds'],3),'debts',[(u['id'],u['debt']) for u in b['logistics']['units'] if u['id'] in ['G-PZ-01','G-PZ-02','G-I-01']],flush=True)
  d['records'].append(rec);labels.add(label);save();return True
 # Core max damage capacities are fixed from the checked-in rules, not guessed per template.
 capacities=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {defaultRules as r} from './core/dist/index.js'; console.log(JSON.stringify(Object.fromEntries(Object.entries(r.unitTemplates).map(([k,v])=>[k,v.maxDamageSteps]))))"],cwd=ROOT))
 def node_capacity(u):return capacities[u['templateId']]-u['step']
 try:
  for side in ['S','G']:
   if b['core']['phase']!=('SOVIET_DEPLOYMENT' if side=='S' else 'GERMAN_DEPLOYMENT'):continue
   md=metadata(b['core'],side);roster=sorted(md['deployment']['roster'],key=lambda u:u['id'])
   special=({'S-I-01':'E8','S-I-02':'F9'} if side=='S' else {'G-PZ-01':'C8','G-I-01':'C7','G-PZ-02':'C10','G-PZ-03':'B10','G-MOT-01':'B9','G-ENG-01':'C9'})
   zone=md['deployment']['zone'];used={}
   for i,u in enumerate(roster):
    if u['id'] in special:h=COORD[special[u['id']]]
    else:
     h=next(h for h in zone if used.get(str(h),0)<2 and h not in [COORD[v] for v in special.values()])
    used[str(h)]=used.get(str(h),0)+1
    run('deploy-'+u['id'],dict(type='DEPLOY_INITIAL_UNIT',deploymentUnitId=u['id'],hex=h))
   run('ready-'+side,dict(type='READY_FOR_PHASE_END'))
  while b['core']['phase']!='GAME_OVER' and b['revision']<400:
   t=b['core']['turn'];phase=b['core']['phase'];prefix=f'T{t}-{phase}'
   p=b['core']['pendingDecision']
   if p:
    # Existing authoritative fixture helper only selects a legal forced continuation for this fixed test.
    blocked=execute(b,auto_command(b,'END_PHASE'));assert not blocked['ok'] and blocked['state']==b
    opts=json.loads(subprocess.check_output(['node',str(ROOT/'choice-probe.mjs')],input=json.dumps(b['core']).encode()));assert opts
    choices=[a for a in opts if a['type'] in ['ALLOCATE_LOSSES','RETREAT','PASS_REACTION','PASS_ADVANCE','PASS_BREAKTHROUGH','PASS_SCHWERPUNKT']]
    run(prefix+'-choice-'+str(b['revision']),(choices or opts)[0]);continue
   if phase=='GERMAN_MOVEMENT' and t==1:
    run(prefix+'-pz-move',dict(type='MOVE',unitId='G-PZ-01',path=[COORD['D8']]))
    run(prefix+'-inf-move',dict(type='MOVE',unitId='G-I-01',path=[COORD['D7']]))
   if phase=='GERMAN_COMBAT' and t==1:
    run(prefix+'-attack',dict(type='ATTACK',attackerUnitIds=['G-PZ-01','G-I-01'],target=COORD['E8']))
    if b['core']['pendingDecision']:continue
   if phase=='GERMAN_SUPPLY_RAIL' and t==6:
    run(prefix+'-rail-repair',dict(type='RAIL_REPAIR',edgeKeys=[EDGE[frozenset(['A10','B10'])],EDGE[frozenset(['B10','C10'])]]))
   if phase=='SOVIET_REINFORCEMENT_SUPPLY':
    md=metadata(b['core'],'S')
    for slot in md['reinforcements']:
     for i,h in enumerate(md['entry_hexes']):
      if run(prefix+'-reinforce-'+slot['id'],dict(type='DEPLOY_REINFORCEMENT',reinforcementId=slot['id'],entryHex=h),optional=True):break
   run(prefix+'-end',dict(type='END_PHASE'))
  assert b['core']['phase']=='GAME_OVER'
  assert not execute(b,auto_command(b,'END_PHASE'))['ok']
  d['completed']=True
 except Exception as e:
  d['completed']=False;d['stop']=dict(label=current,turn=b['core']['turn'],phase=b['core']['phase'],revision=b['revision'],error=str(e));print('STOP',d['stop'],flush=True)
 finally:
  close_worker();mem=memory.finish();d['runs'].append(dict(wall_seconds=time.perf_counter()-began,**mem));save()
  # Research artifact contains canonical actions/real ledgers, no pasted fixture game state.
  export={k:v for k,v in d.items() if k not in ['state','labels']};export.update(final_hash=hash_bundle(b),final_turn=b['core']['turn'],final_phase=b['core']['phase'],victory=b['core']['victory'],audit=audit(b['logistics']),initial_and_live_inventory=b['logistics']['continuity'])
  (OUT/'run.json').write_text(json.dumps(export,ensure_ascii=False,indent=2));print('RESULT',export['completed'],export['final_phase'],mem,flush=True)
 if not d['completed']:sys.exit(1)
if __name__=='__main__':main()

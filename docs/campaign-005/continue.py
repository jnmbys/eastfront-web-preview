"""Short fixed-policy continuation through unchanged original live.execute only."""
import sys,os,subprocess,re
from copy import deepcopy
from common import *
os.environ['OPENBLAS_NUM_THREADS']='1'
sys.path.insert(0,str(original()))
import live,bounded

def coord(label):
 m=re.fullmatch(r'([A-Z]+)(\d+)',label);q=0
 for ch in m[1]:q=q*26+ord(ch)-64
 q-=1;return dict(q=q,r=int(m[2])-1-q//2)

def main():
 arm=sys.argv[1];assert arm in 'ABC';pol=policy()
 assert 'INDUSTRY007_PAYMENT_MODE' not in os.environ,'Payment override forbidden for continuation'
 root=read(DATA/('HANDOFF-'+arm+'.json.gz'));b=root['bundle'];sidecar={k:v for k,v in root.items() if k not in ['bundle','bundleJSON']}
 sidehash=digest(sidecar);initial=deepcopy(b)
 trace=dict(arm=arm,policyHash=read(HERE/'POLICY_LOCK.json')['sha256'],originalRuntime=str(original().relative_to(HERE)),initial=initial,
  frozenSidecar=sidecar,frozenSidecarHash=sidehash,actions=[],selection=[],checkpoints={},status='RUNNING')
 bounded.warm_start()
 def query(op,action=None):
  req=dict(coreFile=str(original()/'core/dist/index.js'),state=b['core'],effects=live.effects(b['logistics'],action),op=op,action=action,priority=pol['german_T7_combat']['attacker_priority'])
  r=subprocess.run(['node',str(HERE/'query.mjs')],input=json.dumps(req),text=True,encoding='utf8',capture_output=True,check=True)
  return json.loads(r.stdout)
 def checkpoint(label):trace['checkpoints'][label]=dict(bundle=deepcopy(b),audit=live.audit(b['logistics']),inspection=query('inspect'))
 def submit(action,mandatory=False,diagnostic=None):
  nonlocal b
  before=deepcopy(b);cmd=dict(id='005-'+arm+'-'+str(len(trace['actions'])),revision=b['revision'],action=action)
  r=live.execute(b,cmd);b=r['state']
  if not r['ok']:assert b==before,'REJECT_MUTATED_STATE'
  trace['actions'].append(dict(command=cmd,accepted=r['ok'],error=r.get('error'),seconds=r['seconds'],diagnostic=diagnostic,
   before=before,after=deepcopy(b),journal=deepcopy(b['journal'][-1]) if r['ok'] else None,audit=live.audit(b['logistics'])))
  print(arm,b['core']['turn'],before['core']['phase'],action['type'],r['ok'],r.get('error',''),flush=True)
  if mandatory and not r['ok']:raise RuntimeError('MANDATORY_ACTION_REJECTED:'+r['error'])
  return r['ok']
 def end():submit(live.auto_command(b,'END_PHASE')['action'],True)
 def pending():
  guard=0
  while b['core']['pendingDecision']:
   guard+=1;assert guard<=100,'PENDING_LOOP'
   choice=query('pending');submit(choice['action'],True,choice)
 try:
  checkpoint('T6_AFTER_CHOICE')
  guard=0;entrench=False
  while not (b['core']['turn']==7 and b['core']['phase']=='GERMAN_MOVEMENT'):
   guard+=1;assert guard<=30,'PHASE_LOOP'
   if b['core']['phase']=='GAME_OVER':raise RuntimeError('EARLY_GAME_OVER')
   pending()
   if b['core']['turn']==6 and b['core']['phase']=='SOVIET_ENTRENCHMENT' and not entrench:
    entrench=True;submit(dict(type='ENTRENCH',controllerId=b['core']['units']['S-I-01']['controllerId'],unitId='S-I-01'))
   oldturn=b['core']['turn'];end()
   if b['core']['turn']!=oldturn:checkpoint('POST_E6')
  checkpoint('T7_BEFORE_MOVE')
  for move in pol['german_T7_moves']:
   action=dict(type='MOVE',controllerId='G-HUMAN-1',unitId=move['unitId'],path=[coord(x) for x in move['path']])
   submit(action,diagnostic=query('move',action))
  end();assert b['core']['phase']=='GERMAN_COMBAT'
  checkpoint('T7_BEFORE_ATTACK')
  target=coord(pol['german_T7_combat']['target']);ids=[]
  for uid in pol['german_T7_combat']['attacker_priority']:
   action=dict(type='ATTACK',controllerId='G-HUMAN-1',attackerUnitIds=[uid],target=target)
   diag=query('attack',action);u=b['core']['units'].get(uid)
   adjacent=bool(u and u['alive'] and max(abs(u['hex']['q']-target['q']),abs(u['hex']['r']-target['r']),abs(u['hex']['q']+u['hex']['r']-target['q']-target['r']))==1)
   selected=adjacent and not diag['issues']
   trace['selection'].append(dict(unitId=uid,adjacentAlive=adjacent,selected=selected,diagnostic=diag))
   if selected:ids.append(uid)
  if ids:
   action=dict(type='ATTACK',controllerId='G-HUMAN-1',attackerUnitIds=ids,target=target)
   submit(action,diagnostic=query('attack',action));pending()
  else:trace['scenarioLimitation']='NO_LEGAL_ELIGIBLE_ATTACKER'
  checkpoint('T7_AFTER_PENDING');end()
  assert b['core']['turn']==7 and b['core']['phase']=='GERMAN_RECOVERY' and b['core']['pendingDecision'] is None
  trace['status']='COMPLETED_T7_GERMAN_COMBAT'
 except Exception as ex:
  trace['status']='STOPPED';trace['stopReason']=repr(ex)
 finally:
  trace['final']=b;trace['finalAudit']=live.audit(b['logistics']);trace['materialTerminal']=deepcopy(sidecar)
  assert digest(trace['materialTerminal'])==sidehash
  save(DATA/('RUN-'+arm+'.json.gz'),trace);bounded.close_worker()
 print(arm,trace['status'],trace.get('stopReason',''),flush=True)
 if trace['status']=='STOPPED':sys.exit(2)
if __name__=='__main__':main()

from live import *
from bounded import warm_start,close_worker
from legalmap import KEYS,key

def run(b,a,seconds=3):
 cmd=auto_command(b);cmd['action']=dict(a,controllerId=cmd['action']['controllerId']);r=execute(b,cmd,seconds);assert r['ok'],r.get('error');return r['state']
def cell(id):return next(n['coord'] for n in __import__('realmap').MAP['nodes'] if n['id']==id)
if __name__=='__main__':
 warm_start();report={}
 # Actual attack pair on the same opening physical state and RNG.
 candidates=[]
 for mode in ['new','old']:
  b=json.loads((ROOT/'data/playable'/f'isolation-{mode}.json').read_text())['state'];b=run(b,{'type':'END_PHASE'});xs=node(b['core'],mode,b['logistics'],'attacks')['attacks'];candidates.append((b,xs))
 for aa in candidates[0][1]:
  match=next((x for x in candidates[1][1] if x['action']==aa['action']),None)
  if match and aa['context']['attackStrength']!=match['context']['attackStrength']:
   outputs=[]
   for b,x in [(candidates[0][0],aa),(candidates[1][0],match)]:
    end=run(b,x['action']);outputs.append(dict(mode=b['mode'],before_rng=b['core']['random'],after_rng=end['core']['random'],context=next(q['context'] for q in node(b['core'],b['mode'],b['logistics'],'attacks',action=x['action'])['attacks'] if q['action']==x['action']),journal=end['journal'][-1],audit=audit(end['logistics'])))
   report['combat']=outputs;(ROOT/'data/combat-example.json').write_text(json.dumps(aa['action']));break
 # Restore the experimental D10 hub by an actual Core rail repair.
 b=json.loads((ROOT/'data/playable/restore-new.json').read_text())['state'];rows=[]
 edge=next(e['core']['key'] for e in __import__('realmap').MAP['edges'] if {e['a'],e['b']}=={'C10','D10'})
 b=run(b,{'type':'RAIL_REPAIR','edgeKeys':[edge]})
 for i in range(2):
  b=run(b,{'type':'END_SIDE'});b=run(b,{'type':'END_SIDE'});rows.append(dict(turn=b['core']['turn'],units=[dict(id=u['id'],debt=u['debt'],stock=u['stock']) for u in b['logistics']['units']],audit=audit(b['logistics']),ledger=b['logistics']['ledger']))
  if i==0:recovered=deepcopy(b)
 report['restore']=rows;
 b=recovered;
 (ROOT/'data/recovered-before-attack.json').write_text(json.dumps(b))
 b=run(run(b,{'type':'END_PHASE'}),{'type':'END_PHASE'})
 attacks=node(b['core'],'new',b['logistics'],'attacks')['attacks'];chosen=next(x for x in attacks if all(next(u for u in b['logistics']['units'] if u['id']==uid)['stock']>=4 for uid in x['action']['attackerUnitIds']))
 b=run(b,chosen['action']);report['recovered_attack']=dict(context=chosen['context'],journal=b['journal'][-1]);
 (ROOT/'evidence/exercise.json').write_text(json.dumps(report,indent=2));(ROOT/'data/restored-state.json').write_text(json.dumps(b));print('combat pair',bool(report.get('combat')),'restored turns',[x['turn'] for x in rows]);close_worker()

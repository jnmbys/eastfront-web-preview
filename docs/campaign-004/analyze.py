"""Read saved authority evidence; aggregate accounting and existing graph queries only.
No game progression, new logistics algorithm, or simulated industrial resources.
"""
import sys,json,gzip,hashlib
from pathlib import Path
from collections import Counter,deque
HERE=Path(__file__).resolve().parent
EXP=HERE/'.runtime/experiments/supply-exp-005'
sys.path.insert(0,str(EXP))
from model import adjacency,usable

def load(name):
 data=(HERE/name).read_bytes()
 return json.loads(gzip.decompress(data) if name.endswith('.gz') else data)

def save(name,obj):
 (HERE/name).write_bytes((json.dumps(obj,ensure_ascii=False,indent=2)+'\n').encode())

def main():
 cp=load('CHECKPOINTS.json.gz');qs=load('QUERIES.json.gz');acts=load('ACTIONS.json.gz');sets=load('SETTLEMENTS.json.gz')
 initial=cp['full_roster_T1'];s=initial['logistics'];army={}
 for side in ['G','S']:
  units=[u for u in s['units'] if u['side']==side];sources=[a for a in s['sources'] if a['side']==side]
  demand=sum(u['B'] for u in units);cap=sum(a['cap'] for a in sources)
  army[side]=dict(count=len(units),maintenance_q=demand,maintenance_SP=demand/4,source_cap_q=cap,source_cap_SP=cap/4,
   unavoidable_source_gap_q=max(0,demand-cap),unavoidable_source_gap_SP=max(0,demand-cap)/4,
   starting_carried_q=sum(u['stock'] for u in units),starting_hub_q=sum(h['stock'] for h in s['hubs'] if h['side']==side),
   unit_types=dict(Counter(u['core_type'] for u in units)),units=[{k:u[k] for k in ['id','node','core_type','B','stock','cap','target','debt']} for u in units],sources=sources)
 mapdata=json.loads((EXP/'data/core-map.json').read_text());coords={n['id']:n['coord'] for n in mapdata['nodes']}
 # Connectivity certificate uses ONLY the actual model.adjacency eligibility filter.
 # It is not a flow allocator, capacity reservation, or industrial delivery receipt.
 def rail_path(state,side,start,end):
  graph=adjacency(state,'rail',side)
  if not usable(state,start,side) or not usable(state,end,side):return None
  queue=deque([(start,[])]);seen={start}
  while queue:
   n,path=queue.popleft()
   if n==end:return path
   for other,e in graph[n]:
    if other not in seen:seen.add(other);queue.append((other,path+[e['id']]))
  return None
 topology={}
 for label in ['full_roster_T1','after_rail_opening']:
  ls=cp[label]['logistics'];q=qs[label];per={}
  for side in ['G','S']:
   railadj=adjacency(ls,'rail',side);roadadj=adjacency(ls,'road',side)
   per[side]=dict(recovery_bases=q['bases']['GERMAN' if side=='G' else 'SOVIET'],
    source_to_hub=[dict(source=a['id'],hub=h['id'],edges=rail_path(ls,side,a['node'],h['node'])) for a in ls['sources'] if a['side']==side for h in ls['hubs'] if h['side']==side],
    reserved_site_loading_edges=[dict(facility=a,loading=b,
       rail=[e for other,e in railadj[a] if other==b],
       last_mile=[e for other,e in roadadj[a] if other==b]) for a,b in [('J7','J6'),('M14','M15'),('R9','R10'),('AD9','AD10')]])
  topology[label]=dict(bases=q['bases'],siteFacts=q['siteFacts'],pairs=q['pairs'],model_graph=per,
   scope='Connectivity only; road means permitted infantry-cost last mile, not necessarily a physical road. No industrial receiver/cargo/transfer capability follows.')
 settlement_summary=[]
 for ep in sets:
  for r in ep['ledger']:
   us=r['units'];side=r['side']
   settlement_summary.append(dict(boundary='T'+str(ep['turn_after']-1)+' SOVIET_ENTRENCHMENT -> T'+str(ep['turn_after'])+' GERMAN_SUPPLY_RAIL',side=side,
    source_used_q=r['source_used'],received_q=sum(u['received'] for u in us),due_q=sum(u['due'] for u in us),paid_q=sum(u['maintenance'] for u in us),
    shortage_q=sum(u['due']-u['maintenance'] for u in us),stock_after_q=sum(u['after'] for u in us),
    damaged_target=next((u for u in us if u['id']=='G-I-01'),None),
    target_delivery_flows=[f for f in r['flows'] if f.get('unit')=='G-I-01'],rail_flows=[f for f in r['flows'] if f['kind']=='rail'],
    saturated_constraints=[x for x in r['constraints'] if x['saturated']]))
 selected=[r for r in acts if r['label'] in ['real_infantry_attack','damaged_supplied_without_base_rejected','open_actual_rail_A10_C10','actual_RP_repair','duplicate_repair_rejected','repaired_unit_subsequent_move','existing_soviet_entry','existing_reinforcement_same_turn_move'] or not r['accepted']]
 metrics={}
 for r in selected:
  target=r['command']['action'].get('unitId')
  metrics.setdefault(r['label'],[]).append(dict(command=r['command'],accepted=r['accepted'],error=r['error'],
   before_phase=r['before']['phase'],after_phase=r['after']['phase'],turn=r['before']['turn'],
   rp_before=r['before']['rp'],rp_after=r['after']['rp'],before_hash=r['before_hash'],after_hash=r['after_hash'],
   target_before=next((u for u in r['before']['units'] if u['id']==target),None),target_after=next((u for u in r['after']['units'] if u['id']==target),None),
   stock_before=next((u for u in r['before']['stock'] if u['id']==target),None),stock_after=next((u for u in r['after']['stock'] if u['id']==target),None),
   charges=r.get('receipt',{}).get('charges'),events=r.get('receipt',{}).get('events')))
 slots=qs['full_roster_T1']['slots'];mobile={'PANZER','TANK','HEAVY_TANK','MOTORIZED'}
 facts=dict(scope='ACTUAL_RUNTIME_SEAMS_ONLY_NOT_INTEGRATION_APPROVAL',source=load('PROVENANCE.json')['runtime_source_commit'],
  map=dict(hex_count=len(mapdata['nodes']),map_sha256=mapdata['sourceMapSHA256'],layout_map_sha256=load('layout-source.json')['mapSHA256'],
    derived_map_sha256=hashlib.sha256((EXP/'data/core-map.json').read_bytes()).hexdigest(),nodes_with_null_initial_control=sum(h['control'] is None for h in initial['core']['hexes'].values())),
  army=army,scheduled_soviet_reinforcement=dict(slots=slots,count=len(slots),additional_maintenance_SP=sum(2 if x['type'] in mobile else 1 for x in slots),note='Potential full surviving scheduled roster; not actual deployment or industrial slots.'),
  fixed_transport=dict(profile=initial['logistics']['campaign_config'],hubs=s['hubs'],actual_allocator=s.get('allocator'),solver=s['solver'],policy=s['policy']),
  topology=topology,settlements=settlement_summary,actions=metrics,
  final_audit=acts[-1]['after']['audit'],run_status=load('RUN_STATUS.json'))
 assert facts['map']['map_sha256']==facts['map']['layout_map_sha256']
 save('FACTS.json',facts)
 print(json.dumps({'army':{k:{x:v for x,v in a.items() if x in ['count','maintenance_SP','source_cap_SP','unavoidable_source_gap_SP']} for k,a in army.items()},'status':facts['run_status']},ensure_ascii=False))

if __name__=='__main__':main()

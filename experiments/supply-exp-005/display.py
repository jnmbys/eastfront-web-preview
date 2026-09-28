"""Player DTO is produced AFTER authoritative settlement, never by re-solving fog."""
from copy import deepcopy
from model import digest
from legalmap import KEYS,key

def player_display(s,side='G'):
 v=s['legal_view'][side];known={KEYS[k] for k in v['identifiedHexKeys']};pvhex={KEYS[key(h['coord'])]:h for h in v['hexes']}
 out={k:deepcopy(s[k]) for k in ['name','scenario','ruleset','clock','variant','use_t','policy','tick','half','epoch','order','core_phase','core_turn','source_commit']}
 out.update(view='player',viewer=side,nodes=[dict(id=n['id'],x=n['x'],y=n['y'],terrain=n['terrain'],control=pvhex[n['id']]['control'],known=n['id'] in known) for n in s['nodes']],edges=[{k:deepcopy(e[k]) for k in ['id','a','b','modes','physical_road','river','bridge','core_railway'] if k in e} for e in s['edges']],units=[deepcopy(u) for u in s['units'] if u['side']==side],hubs=[deepcopy(h) for h in s['hubs'] if h['side']==side],sources=[deepcopy(a) for a in s['sources'] if a['side']==side],contacts=[dict(node=KEYS[key(u['hex'])],visibility=u['visibility']) for u in [*v['units'],*v['contacts']] if u['side']!=('GERMAN' if side=='G' else 'SOVIET')])
 out['experimental_profile']=s.get('experimental_profile','EXP003 default experimental hubs/capacities')
 out['transition']=[deepcopy(e) for entry in s.get('continuity',{}).get('events',[])[-1:] for e in entry['events'] if e.get('side')==side]
 out['ledger']=[]
 for r in s.get('ledger',[]):
  if r['side']!=side:continue
  safe=dict(side=side,units=deepcopy(r['units']),hubs=deepcopy(r['hubs']),deliveries=deepcopy(r['deliveries']),flows=[],route_details='Only fully identified routes disclosed; no pre-settlement route verdict')
  edge={e['id']:e for e in s['edges']}
  for f in r['flows']:
   # Full paths may traverse hidden nodes; withhold rather than reveal their geometry.
   if not f.get('delivery') or not f.get('unit'):continue
   unit=next((u for u in s['units'] if u['id']==f['unit']),None);hub=next((h for h in s['hubs'] if h['id']==f['hub']),None)
   if not unit or not hub:continue
   ns={unit['node'],hub['node']}|{edge[eid][a] for eid in f['edges'] for a in ['a','b']}
   if ns<=known:safe['flows'].append({k:deepcopy(f[k]) for k in ['hub','unit','edges','q','cost']})
  for u in safe['units']:
   u['reason']='维护已满足' if u['maintenance']==u['due'] else '实际维护不足；来源、运力或未公开通路条件可能限制供应，不能据此定位敌军'
  out['ledger'].append(safe)
 out['prediction']=dict(status='NOT_EVALUATED',message='未知区域不判通、不判断；本页只显示已提交的本方实收账本')
 out['hash']=digest(out)
 return out

def snapshot(s,viewer='G',debug=False,error=None):
 if debug:return dict(state=deepcopy(s),debug=True,error=error,notice='全知调试，不能作为公平玩家/AI 输入')
 return dict(state=player_display(s,viewer),debug=False,error=('未解：本次未取得完整且通过校验的结算，原状态和资源未改变。' if error else None),notice='合法 Core 状态的冻结后勤实验；不改写 Core；枢纽、容量、储备仍是实验参数')

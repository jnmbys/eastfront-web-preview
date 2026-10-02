"""Research-only audit and annotation. No production map/code writes.
Run with --capture once to pin external evidence; subsequent runs use saved inputs.
Requires Pillow only for the static annotation, not for map/space analysis.
"""
import csv, hashlib, json, math, subprocess, sys
from pathlib import Path
from collections import defaultdict, deque
OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[1]
BASE='69eb6b3369fcf47ba51891dd0ad9dc08c35e54a0'
MAP_PATH='candidate/vendor/eastfront-digital-core/reference/strategic-reset-f-map.json'
MAP_HASH='150ed628f53e9d1d3b2663157ec9a02678c0e09a840c03e404469a1a850ce0d3'
def sha(b): return hashlib.sha256(b).hexdigest()
def read(p): return json.loads(Path(p).read_text(encoding='utf-8'))
def write(name,obj): (OUT/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
def git(repo,*args): return subprocess.check_output(['git','-C',str(repo),*args])
def hd(a,b): return max(abs(a['q']-b['q']),abs(a['r']-b['r']),abs(a['q']+a['r']-b['q']-b['r']))
def ek(a,b): return '~'.join(sorted([a,b]))
art=read(ROOT/'evidence/ART-MAP-015/semantic-map.json')
cells={c['label']:c for c in art['cells']}
edges={ek(e['a'],e['b']):e for e in art['edges']}
def normalize_edge(e):
 a,b=sorted([e['a'],e['b']]);return dict(a=a,b=b,**{k:e.get(k) for k in ['road','rail','river','bridge']})
def xy(c):
 q,r=c['q'],c['r']; return (42*math.sqrt(3)*(q+r/2),63*r)
def center(p): return xy(cells[p]['coord'])
def neighbors(p): return [q for q in cells if hd(cells[p]['coord'],cells[q]['coord'])==1]
if '--capture' in sys.argv:
 sources=[]
 for folder,commit in [('work/rule-campaign-001','7c747c1b427faf18e811a3c1e9905b8615e3433c'),('work/rule-campaign-002','7c747c1b427faf18e811a3c1e9905b8615e3433c'),('supply-ux-020','a06737e95e40acdb79580e6b2fe32a9aaba2d2e4'),('campaign-001','64566985664fff7652fb5a510477ce25d2b05018')]:
  repo=ROOT.parent/folder
  for p in ['vendor/eastfront-digital-core/reference/strategic-reset-f-map.json','core/source/reference/strategic-reset-f-map.json']:
   b=git(repo,'show',commit+':'+p)
   raw=json.loads(b)
   baseline=read(ROOT/MAP_PATH)
   sources.append(dict(context=folder,commit=commit,path=p,blob=git(repo,'rev-parse',commit+':'+p).decode().strip(),sha256=sha(b),identicalBytes=sha(b)==MAP_HASH,changedTopLevelFields=[k for k in set(raw)|set(baseline) if raw.get(k)!=baseline.get(k)]))
 supply=ROOT.parent/'supply-ux-020'; p='experiments/supply-exp-005/data/core-map.json'
 b=(supply/p).read_bytes(); s=json.loads(b)
 normalized={'metadata':{k:v for k,v in s.items() if k not in ['nodes','edges']},'observedFileSHA256':sha(b),'trackedInPinnedCommit':False,'file':p,'allAdjacencyEdges':len(s['edges']),
  'nodes':[{k:n[k] for k in ['id','coord','terrain']} for n in s['nodes']],
  'featureEdges':[dict(a=e['a'],b=e['b'],road=bool(e['core']['road']),rail=bool(e['core']['railway'] and e['core']['railway']['present']),river=e['core']['river'],bridge=e['core']['bridge']) for e in s['edges'] if e['core']]}
 write('supply-map-snapshot.json',normalized)
 cfgp='experiments/supply-exp-005/campaign-config.json'; cb=git(supply,'show','a06737e95e40acdb79580e6b2fe32a9aaba2d2e4:'+cfgp)
 cfg=json.loads(cb)
 write('source-manifest.json',dict(date='2026-10-02 Asia/Shanghai',artBase=BASE,sources=sources,supplyConfiguration={'commit':'a06737e95e40acdb79580e6b2fe32a9aaba2d2e4','path':cfgp,'sha256':sha(cb),'sources':cfg['sources'],'hub_nodes':cfg['hub_nodes']},campaignLedger={'commit':'64566985664fff7652fb5a510477ce25d2b05018','path':'docs/campaign-001/METHOD.md','mapping':'Abstract 0..8 chain; no real coordinates; no automatic mapping to the seven art city groups.'},ruleCampaign002={'referenceBase':'7c747c1b427faf18e811a3c1e9905b8615e3433c','status':'In progress at audit; audit pins base, does not claim final contract review.'}))
manifest=read(OUT/'source-manifest.json'); supply=read(OUT/'supply-map-snapshot.json')
if '--capture' in sys.argv:
 ip='docs/industry-integration-003/METHOD.md'; ic='5cac9bd81a9776b8a2e2837f33818c0c72561ba4'
 ib=git(ROOT.parent/'industry-integration-003','show',ic+':'+ip)
 write('industry-reference.json',dict(commit=ic,path=ip,sha256=sha(ib),currentModel='地图外工业＋抽象战区接收点',sourceStatement='工业区域在地图外，战区通过抽象接收点拿货，未把工厂塞入640格或改地图。',boundary='No on-map production sites defined; provisional settlement method, not unified runtime contract.'))
sn={n['id']:n for n in supply['nodes']}; se={ek(e['a'],e['b']):e for e in supply['featureEdges']}
cd=[dict(paper=p,art= {'coord':c['coord'],'terrain':c['terrain']},supply=sn.get(p)) for p,c in cells.items() if p not in sn or c['coord']!=sn[p]['coord'] or c['terrain']!=sn[p]['terrain']]
ed=[dict(key=k,art=normalize_edge(edges[k]) if k in edges else None,supply=se.get(k)) for k in set(edges)|set(se) if k not in edges or k not in se or normalize_edge(edges[k])!=normalize_edge(se[k])]
ordering=[dict(edge=k,artOrder=[e['a'],e['b']],supplyOrder=[se[k]['a'],se[k]['b']]) for k,e in edges.items() if k in se and e['a']!=se[k]['a']]
assert len(cells)==640 and len(edges)==257 and not cd and not ed
assert sha((ROOT/MAP_PATH).read_bytes())==MAP_HASH
assert all(s['identicalBytes'] for s in manifest['sources'])
write('map-version-audit.json',dict(base=BASE,formalMapSHA256=MAP_HASH,sources=manifest['sources'],cellDifferences=cd,featureEdgeDifferences=ed,endpointOrderingDifferences=ordering,coordinateConvention='q=paperColumn-1; r=paperRow-1-floor(q/2); odd-q offset, labels A1..AF20',counts={'cells':640,'artFeatureEdges':257,'supplyFeatureEdges':len(se),'supplyAllNeighborEdges':supply['allAdjacencyEdges'],'nonFeatureAdjacencies':supply['allAdjacencyEdges']-len(se)},semanticDifferences=['Eight feature edges reverse serialized endpoint order; undirected semantics match.','Supply all-neighbor graph has ground-traversal edges, not additional physical roads.','Supply experimental sources/hubs differ from art defaultScenario and are not this candidate warehouse list.','Campaign ledger nodes 0..8 have no actual coordinates.','Generated supply map is a locally observed untracked file, normalized snapshot preserved here.','Rule campaign 002 still in progress; fixed base only.'],status='GEOMETRY_MATCH; ROLE/REPRESENTATION_DIFFERENCES_RECORDED; NO_MIGRATION'))
with (OUT/'coordinate-correspondence.csv').open('w',newline='',encoding='utf-8') as f:
 w=csv.writer(f,lineterminator='\n');w.writerow(['paper','art_q','art_r','supply_q','supply_r','terrain','match'])
 for p,c in cells.items(): w.writerow([p,c['coord']['q'],c['coord']['r'],sn[p]['coord']['q'],sn[p]['coord']['r'],c['terrain'],True])
rail={p:set() for p in cells}
for e in edges.values():
 if e['rail']: rail[e['a']].add(e['b']);rail[e['b']].add(e['a'])
def path(a,b,omit=None):
 q=deque([a]);prev={a:None}
 while q:
  x=q.popleft()
  if x==b:
   out=[]
   while x is not None: out.append(x);x=prev[x]
   return out[::-1]
  for y in sorted(rail[x]):
   if ek(x,y)!=omit and y not in prev:prev[y]=x;q.append(y)
 return None
bridges=[]
for k,e in edges.items():
 if e['bridge']:
  detour=path(e['a'],e['b'],k)
  bridges.append(dict(edge=k,endpoints=[e['a'],e['b']],kind=e['bridge']['kind'],alternativeRailPath=detour,alternativeRailEdges=len(detour)-1 if detour else None,soleRailConnection=detour is None))
route=path('D10','R10')
cuts=[ek(a,b) for a,b in zip(route,route[1:]) if path(a,b,ek(a,b)) is None]
write('network-risks.json',dict(d10ToNextCity={'to':'R10','railEdges':len(route)-1,'path':route,'singlePathEdges':cuts},crossings=bridges,note='Intact undirected static railway only; no wartime supply or movement acceptance.'))

# Geometry follows the existing art envelope method, with actual transport and river segments.
lanes=[]
for k,e in edges.items():
 if e['road'] or e['rail']:lanes.append((k,'transport',e['roadLine'],7))
 if e['river']:lanes.append((k,'river',e['riverLine'],9 if e['river']=='MAJOR' else 7))
def pt(v):return (v['x'],v['y'])
def point_segment(p,a,b):
 dx,dy=b[0]-a[0],b[1]-a[1];t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)))
 return math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)
def rect_seg(x,y,w,h,a,b):
 lo,hi=0,1
 for start,delta,mn,mx in [(a[0],b[0]-a[0],x-w/2,x+w/2),(a[1],b[1]-a[1],y-h/2,y+h/2)]:
  if abs(delta)<1e-10:
   if start<mn or start>mx:lo=2;break
  else:
   t0,t1=(mn-start)/delta,(mx-start)/delta;lo=max(lo,min(t0,t1));hi=min(hi,max(t0,t1))
 if lo<=hi:return 0
 ds=[math.hypot(max(abs(p[0]-x)-w/2,0),max(abs(p[1]-y)-h/2,0)) for p in [a,b]]
 ds += [point_segment((x+dx*w/2,y+dy*h/2),a,b) for dx in [-1,1] for dy in [-1,1]]
 return min(ds)
def inside(p,poly):
 cs=[(b['x']-a['x'])*(p[1]-a['y'])-(b['y']-a['y'])*(p[0]-a['x']) for a,b in zip(poly,poly[1:]+poly[:1])]
 return min(cs)>=-1e-6 or max(cs)<=1e-6
def overlap(a,b): return abs(a[0]-b[0])<(a[2]+b[2])/2 and abs(a[1]-b[1])<(a[3]+b[3])/2
def unit_box(p):x,y=center(p);return (x,y,68,68)
occupied=defaultdict(list)
for u in art['fixtures']:
 p=next(p for p,c in cells.items() if c['coord']==u['hex']);occupied[p].append(u['id'])
def fit(p):
 cx,cy=center(p); candidates=[]
 local=[l for l in lanes if point_segment((cx,cy),pt(l[2][0]),pt(l[2][1]))<90]
 for dy in range(-28,19):
  for dx in range(-24,25):
   x,y=cx+dx,cy+dy;box=(x,y,42,24)
   if not all(inside((x+sx*21,y+sy*12),cells[p]['polygon']) for sx in [-1,1] for sy in [-1,1]):continue
   if any(overlap(box,(center(q)[0],center(q)[1]+29,20,10)) for q in [p]+neighbors(p)):continue
   if any(rect_seg(x,y,42,24,pt(l[2][0]),pt(l[2][1]))<l[3] for l in local):continue
   candidates.append((dx*dx+(dy+5)**2,x,y))
 if not candidates:return None
 _,x,y=min(candidates)
 return dict(centerWorld=[x,y],contentSize=[38,20],paddingEachSide=2,envelope=[x-21,y-12,42,24],offset=[round(x-cx,2),round(y-cy,2)],minimumTransportDistance=min([rect_seg(x,y,42,24,pt(l[2][0]),pt(l[2][1])) for l in local if l[1]=='transport'] or [999]),labelRect=[cx-10,cy+24,20,10])
specs=[
 ('N01','D10',['D10'],['VP','STATION','FRONT_LOADING'],None,['C11','E11'],'前沿装卸候选，解释14边长段；不列生产工业或新增供给源。'),
 ('N02','J6',['J6'],['FACILITY_VISUAL_RESERVE','STATION','WAREHOUSE'],('J7','J6','I7'),['I7','K7'],'北部铁路分流，装卸/仓储视觉预留放邻近平原J7；本轮不分配VP，不赋予生产。'),
 ('N03','M15',['M15'],['VP','FACILITY_VISUAL_RESERVE','STATION'],('M14','M15','N15'),['N14','N15'],'南部接收/维修空间候选，设施退至M14；M16跨无桥河段不采用；L15已有单位，不作为新增屋顶用地。'),
 ('N04','R10',['R10'],['VP','FACILITY_VISUAL_RESERVE','STATION','WAREHOUSE'],('R9','R10','S10'),['R11','S10'],'中央四向铁路，装卸/仓储或维修空间退至R9；多角色共享需分层，Q11已有单位。'),
 ('N05','V5',['V5'],['VP','BRIDGE_GATE'],None,['V6','U6'],'北部双桥门户；保持铁路交汇，不再配置功能站场/工业，避免桥头拥挤。'),
 ('N06','X14',['X14'],['VP','STATION'],None,['W15','X15'],'保留认可视觉对照；X13双牌、Y14单牌使工业共格风险高，本候选不放工业。'),
 ('N07','AC10',['AC10','AC11','AD10'],['VP','FACILITY_VISUAL_RESERVE','STATION','WAREHOUSE'],('AD9','AD10','AE10'),['AD11','AE10'],'首都三格为一个目标群；战区接收/仓储空间退至AD9，不挤占AC10单位；既有补给源与接收设施分开记录。')]
nodes=[]
for nid,anchor,city,roles,ind,ops,reason in specs:
 reserve=list(ind) if ind else []
 involved=sorted(set(city+reserve))
 entry=[dict(edge=k,**normalize_edge(e)) for k,e in edges.items() if e['rail'] and (e['a'] in involved or e['b'] in involved)]
 industrial=None
 if ind:
  facility,loading,staging=ind;f=fit(facility);assert f is not None,(nid,facility,'No envelope fit')
  assert len(set(ind))==3 and hd(cells[facility]['coord'],cells[loading]['coord'])==1 and hd(cells[staging]['coord'],cells[loading]['coord'])==1
  boundary=edges.get(ek(facility,loading))
  assert not boundary or not boundary['river'],(nid,'Facility/loading separated by river; reject rather than invent crossing')
  bx,by,w,h=f['envelope'];box=(bx+w/2,by+h/2,w,h)
  existingConflicts=[p for p in occupied if overlap(box,unit_box(p))]
  traffic=[dict(edge=k,kind=kind,distance=round(rect_seg(box[0],box[1],w,h,pt(line[0]),pt(line[1])),3),required=radius) for k,kind,line,radius in lanes if point_segment((box[0],box[1]),pt(line[0]),pt(line[1]))<100]
  industrial=dict(reservationCells=reserve,facilityCell=facility,loadingCell=loading,operationCell=staging,facilityType=None,output=None,inMapProductionCandidate={'status':'UNDEFINED_NOT_APPROVED','productionCells':[],'output':None},receptionRoleCandidates={'N02':['loading','warehouse'],'N03':['loading','repair'],'N04':['loading','warehouse','repair'],'N07':['theater_receiving','warehouse']}[nid],roleClass='theater_reception_visual_reserve_no_function',facilityToLoading={'pair':[facility,loading],'distanceHex':1,'riverBoundary':None,'physicalTransportEdge':bool(boundary and (boundary['road'] or boundary['rail'])),'transferPermission':'UNDEFINED'},dimensionsStatus='38x20 content + 2 padding per side; world units only; unapproved receiving/repair facility type/size, not a factory specification',geometry=f,trafficClearance=traffic,existingFixtureConflicts=existingConflicts,
   occupancyChecks={'emptyFacility':'ENVELOPE_FITS_NOT_ART_ACCEPTANCE','oneUnitOnFacility':'CONFLICT_68x68_CLEARANCE','twoUnitsOnFacility':'CONFLICT_68x68_CLEARANCE_AND_STACK_OPERATION','unitsOnLoadingAndOperationCells':{p:('CONFLICT' if overlap(box,unit_box(p)) else 'FACILITY_ENVELOPE_CLEAR_ONLY') for p in [loading,staging]},'touchAcceptance':'NOT_TESTED'},
   railAccessStatus='Loading cell has real incident rail edges; adjacent facility has NO added siding and NO approved logistics transfer link',rejectedNearbySite={'cell':'M16','reason':'M16~M15 and M16~N15 river boundaries have no bridges; empty envelope fit is insufficient'} if nid=='N03' else None)
  assert not existingConflicts
  assert all(t['distance']+0.001>=t['required'] for t in traffic)
  assert overlap(box,unit_box(facility))
 nodes.append(dict(id=nid,cityGroupId='CITY-'+anchor,anchor={'paper':anchor,'axial':cells[anchor]['coord']},cityCells=city,candidateRoles=roles,involvedCells=[dict(paper=p,axial=cells[p]['coord'],terrain=cells[p]['terrain'],displayFixtures=occupied[p]) for p in involved],railAccessEdges=entry,adjacentOperationSpace=[dict(paper=p,axial=cells[p]['coord'],terrain=cells[p]['terrain'],adjacentTo=[q for q in involved if hd(cells[p]['coord'],cells[q]['coord'])==1],displayFixtures=occupied[p],legalMovement='NOT_EVALUATED') for p in ops],industrial=industrial,sharedRoleConflicts=['Roles share a location, not a center footprint or VP credit.','Ownership, VP weight, capture predicate, production, supply qualification and station throughput UNASSIGNED.']+(['Occupied facility needs approved reduced display/inspection policy; cannot move units to preserve roof.'] if ind else [])+(['AC10 F-49 hides roof; unselected recognition issue remains.'] if nid=='N07' else []),reason=reason,vpWeight=None,initialOwner=None,captureCondition=None))
counts={r:sum(r in n['candidateRoles'] for n in nodes) for r in ['VP','FACILITY_VISUAL_RESERVE','STATION','WAREHOUSE']}
assert counts=={'VP':6,'FACILITY_VISUAL_RESERVE':4,'STATION':6,'WAREHOUSE':3}
assert set(p for n in nodes for p in n['cityCells'])==set(p for p,c in cells.items() if 'CITY' in c['terrain'])
write('candidate-nodes.json',dict(schema='ART-LAYOUT-020-candidate-v1',mapSHA256=MAP_HASH,status='SPATIAL_CANDIDATE_ONLY',industrial003={'commit':'5cac9bd81a9776b8a2e2837f33818c0c72561ba4','currentModel':'OFF_MAP_INDUSTRY_AND_ABSTRACT_THEATER_RECEIVING','mapProductionCentersApproved':0,'note':'Four former industrial visual budget groups are receiving/warehouse/repair space candidates. No mapping from industry003 abstract receiver has been approved.'},counts=counts,nodes=nodes))
write('validation.json',dict(status='PASS_WITH_EXPLICIT_CONFLICTS',checks={'mapAndConnectionsUnchanged':True,'paperAxialCorrespondence640':not cd,'supplyFeatureEdges257':not ed,'uniqueCityGroups':7,'capitalOneVPGroup':True,'facilityThreeCellGroups':4,'emptyFacilityEnvelopesFit':4,'existingFixtureEnvelopeConflicts':0,'occupiedFacilityConflicts':4,'noRiverBetweenFacilityAndLoading':True,'realRailAccessOnly':True,'roleCounts':counts},runtimeIncrement={'assetsBytes':0,'canvasBytes':0,'domElements':0},notTested=['Actual facility artwork/recognition','Legal movements or wartime supply','Browser selection and stack disambiguation','Startup/GPU/Huawei/physical touch'],scope='Only research/ART-LAYOUT-020; no implementation'))

def render():
 from PIL import Image,ImageDraw,ImageFont
 W,H=3400,2420;im=Image.new('RGB',(W,H),'#f6f3e9');d=ImageDraw.Draw(im)
 fontpath=Path('C:/Windows/Fonts/msyh.ttc')
 def font(s):return ImageFont.truetype(str(fontpath),s)
 def txt(p,t,s=23,fill='#263a38'):d.text(p,t,font=font(s),fill=fill)
 txt((70,30),'ART-LAYOUT-020  ·  640格战略节点候选落点',42)
 txt((70,93),'真实格位规划标注图 · 非游戏实机 · 无规则功能 · 不改变地形、河路或桥位',25)
 pts=[p for c in cells.values() for p in c['polygon']]; minx,miny=min(p['x'] for p in pts),min(p['y'] for p in pts)
 scale=.91
 def px(p):return (75+(p[0]-minx)*scale,170+(p[1]-miny)*scale)
 colors={'PLAIN':'#e4e2c1','FOREST':'#9cad8b','HILL':'#bfb59b','MARSH':'#bbccbb','ROUGH':'#c8bcab','LAKE':'#98bac6','CITY':'#d6af87','MAIN_CITY':'#ce956f','OUTER_CITY':'#d3b297'}
 for p,c in cells.items():d.polygon([px(pt(v)) for v in c['polygon']],fill=colors[c['terrain']],outline='#b0b39c')
 for e in edges.values():
  if e['river']:d.line([px(pt(v)) for v in e['riverLine']],fill='#448fae',width=6 if e['river']=='MAJOR' else 4)
  if e['road'] or e['rail']:
   line=[px(pt(v)) for v in e['roadLine']]
   if e['road']:d.line(line,fill='#ad7844',width=7)
   if e['rail']:d.line(line,fill='#364447',width=3)
 for a,b in zip(route,route[1:]):d.line([px(center(a)),px(center(b))],fill='#cb613c',width=7)
 for p in cells:
  x,y=px(center(p));txt((x-16,y+14),p,14,'#47534d')
 for source in manifest['supplyConfiguration']['sources']:
  x,y=px(center(source['node']));d.ellipse((x-32,y-32,x-15,y-15),fill='#f6f3e9',outline='#287d87',width=2);txt((x-29,y-34),'S',14,'#287d87')
 for n in nodes:
  if n['industrial']:
   for p in n['industrial']['reservationCells']:d.line([px(pt(v)) for v in cells[p]['polygon']+[cells[p]['polygon'][0]]],fill='#a655a6',width=5)
   x,y,w,h=n['industrial']['geometry']['envelope'];d.rectangle([px((x,y)),px((x+w,y+h))],fill='#bb80b6',outline='#613065',width=2)
  for p in n['cityCells']:
   d.line([px(pt(v)) for v in cells[p]['polygon']+[cells[p]['polygon'][0]]],fill='#af5b37',width=4)
  x,y=px(center(n['anchor']['paper']));d.ellipse((x-22,y-22,x+22,y+22),fill='#faf7eb',outline='#263f43',width=3);txt((x-19,y-17),n['id'][-2:],24)
  if 'VP' in n['candidateRoles']:d.polygon([(x,y-40),(x+8,y-31),(x,y-22),(x-8,y-31)],fill='#af3832')
  if 'STATION' in n['candidateRoles']:d.rectangle((x+24,y-14,x+36,y-2),fill='#246183')
  if 'WAREHOUSE' in n['candidateRoles']:d.polygon([(x+29,y+4),(x+38,y+19),(x+20,y+19)],fill='#b98326')
 for b in bridges:
  e=edges[b['edge']];line=e['riverLine'];x,y=px(((line[0]['x']+line[1]['x'])/2,(line[0]['y']+line[1]['y'])/2));d.rectangle((x-7,y-7,x+7,y+7),outline='#a33232' if b['soleRailConnection'] else '#216477',width=3)
 # Right review panel: short lines, consistent keys, no marker implies a working facility.
 x=2410;d.line((x-28,155,x-28,H-100),fill='#b9b9aa',width=2)
 txt((x,160),'一个低密度候选',34)
 txt((x,214),'7城市群 / 6 VP / 4设施视觉预留',25)
 txt((x,253),'6站场 / 3仓储转运',25)
 txt((x,310),'◆ VP候选   ■ 站场   ▲ 仓储候选',24)
 txt((x,350),'紫框：3格接收设施预留；不代表生产中心',22)
 txt((x,387),'红线：D10→R10，真实铁路14边',22)
 txt((x,424),'桥框红色：单路径；蓝色：存在静态绕行',22)
 txt((x,461),'青色圈S：既有补给实验来源（非新设施）',20)
 y=490
 names=['D10｜前沿装卸 / VP','J6｜接收 / 站场 / 仓储（不设VP）','M15｜接收维修 / 站场 / VP','R10｜接收维修 / 站场 / 仓储 / VP','V5｜桥头 / VP（不加设施站场）','X14｜站场 / VP（保留视觉对照）','首都群｜AC10 + AC11 + AD10']
 for n,title in zip(nodes,names):
  txt((x,y),n['id']+'  '+title,24);y+=40
  if n['industrial']:
   a=n['industrial'];txt((x+18,y),f"设施 {a['facilityCell']}  接轨 {a['loadingCell']}  操作 {a['operationCell']}",22);y+=35
  else:txt((x+18,y),'邻接操作候选：'+' / '.join(p['paper'] for p in n['adjacentOperationSpace']),22);y+=35
  y+=30
 txt((x,y+10),'四组空置框可避让交通与标签。',25)
 txt((x,y+53),'设施格放1或2枚单位：四组均冲突。',25,'#a33232')
 txt((x,y+98),'首都只计一个候选群；AC10辨识欠项保留。',22)
 txt((x,y+140),'铁路在装卸格接入，未新增工厂支线。',22)
 txt((x,y+182),'地图外工业保留；地图内生产尚未定义。',22)
 txt((x,y+235),'地形底色为真实类型，非新增美术素材。',22)
 txt((x,y+277),'单位未绘出；已按015夹具校验净空。',22)
 txt((x,y+319),'静态连通 ≠ 战时供给；几何 ≠ 触控验收。',22)
 txt((70,H-86),'地图：Strategic Reset F  ·  640格 / 132铁路边 / 6处交通跨河  ·  2026-10-02',23)
 txt((70,H-48),'底图与供应实验特征一致；抽象战役链不自动对应坐标。完整坐标、边和冲突见 candidate-nodes.json。',20)
 im.save(OUT/'annotated-map.png',optimize=True)
render()
print(json.dumps({'checks':'PASS_WITH_EXPLICIT_CONFLICTS','roles':counts,'industrial':[(n['id'],n['industrial']['facilityCell'],n['industrial']['geometry']['offset']) for n in nodes if n['industrial']],'D10SinglePathEdges':len(cuts),'bridgeDetours':[(b['edge'],b['alternativeRailEdges']) for b in bridges]},ensure_ascii=False))

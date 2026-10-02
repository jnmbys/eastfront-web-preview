"""Worker-side audit of the *current* original solve. Never a request certificate."""
import hashlib,json,math,time
from pathlib import Path
from copy import deepcopy
from collections import defaultdict

PROGRAMS={}
CARGO={}
CURRENT_INPUT=None
FLOW_AUDITS={}

def configure(s,context):
    global CARGO,CURRENT_INPUT
    PROGRAMS.clear();FLOW_AUDITS.clear();CARGO={};CURRENT_INPUT=s
    assert context is not None and set(context)=={'shipRequested','testFault'}
    assert digest(s)=='dbce10dbbcdbb06e04737dd2d771f8892c1bb5f83dcc073a2c5b906138e0541d','E5_INPUT_DIFFERS_FROM_010'
    d=Path(__file__).parent
    raw=(d/'POLICY010.json').read_bytes()
    assert hashlib.sha256(raw).hexdigest()=='959157110a5b90ea2dca9fe1bc7aa6178f9a1102468f43338be5f963526c395f'
    rule=(d/'rule006.json').read_bytes()
    assert hashlib.sha256(rule).hexdigest()=='4fe43573896d7e7d3a4e5b0c320f822fe7ea7517fa283584408d56d71dca2eed'
    assert json.loads(rule)['charges']['rows']==json.loads((d/'candidate008.json').read_bytes())['capacity']['rows']
    if context['shipRequested']:CARGO=json.loads(raw)['cargoReservation']

def reservation(side):return deepcopy(CARGO) if side=='G' else {}
def digest(value):return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
def allocate(rows,requested):
    """Pure all-or-zero arithmetic; never an authority certificate or publication."""
    rows=deepcopy(rows)
    fits=all(r['cap']-r['spUsed']-r['otherHolds']-r['alreadyCommitted']>=r['perKit'] for r in rows)
    ship=bool(requested and fits)
    for r in rows:
        r['privateReservation']=r['perKit'] if ship else 0
        r['reservation']=0;r['freight']=r['privateReservation']
        r['remaining']=r['cap']-r['spUsed']-r['otherHolds']-r['alreadyCommitted']-r['freight']
        assert r['remaining']>=0
    return rows,fits,ship
def capture_program(side,p,x,r,arcs):
    from audit009 import capture
    from reference009 import audit_flows
    assert side not in PROGRAMS,'SIDE_SOLVED_MORE_THAN_ONCE'
    certificate=capture(p,x)
    witness=deepcopy(r);witness['certificate']=certificate
    witness['flows']=[{k:v for k,v in a.items() if k!='i'}|{'q':int(x[a['i']]),'variable':p.names[a['i']]} for a in arcs if x[a['i']]>0]
    FLOW_AUDITS[side]=dict(rows=audit_flows(CURRENT_INPUT,witness,reservation(side)),certificate=certificate,flows=witness['flows'])
    rows=[]
    for (a,lo,hi),label in zip(p.rows,p.labels):
        used=sum(float(x[i])*v for i,v in a.items())
        assert lo-1e-5<=used<=hi+1e-5,('FULL_ROW_AUDIT_FAILED',label)
        rows.append(dict(label=label,used=used,lo=lo if math.isfinite(lo) else None,hi=hi if math.isfinite(hi) else None))
    for i,v in enumerate(x):
        assert p.lo[i]-1e-5<=v<=p.hi[i]+1e-5
        assert not p.integer[i] or abs(v-round(v))<1e-5
    PROGRAMS[side]=dict(rows=rows,variables=len(x),solutionDigest=digest([float(v) for v in x]),
        matrixDigest=digest([[[[i,v] for i,v in sorted(a.items())],None if not math.isfinite(lo) else lo,None if not math.isfinite(hi) else hi] for a,lo,hi in p.rows]),
        allRowsBoundsIntegrality=True)

def inspect(s,out,results,context,deadline):
    from model import adjacency,budget,check_budget
    from legalmap import KEYS,MAP
    check_budget()
    raw=(Path(__file__).parent/'candidate008.json').read_bytes()
    assert hashlib.sha256(raw).hexdigest()=='65cb3f2a20262c82fdc7cd9a44f5c2d93a81c46c806e05e9524c0dc72060cef5'
    c=json.loads(raw)
    assert context is not None and set(context)=={'shipRequested','testFault'},'MISSING_OWNER_CONTEXT'
    if context['testFault']=='unknown_route':raise ValueError('SYNTHETIC_UNKNOWN_ROUTE')
    if context['testFault']=='timeout':raise TimeoutError('SYNTHETIC_TOTAL_BUDGET_EXPIRED')
    assert s['epoch']=='L4' and s['tick']==4 and s['core_turn']==6 and not s['pending'] and not s['game_over'],'NOT_CURRENT_E5_INPUT'
    assert s['core_phase']=='GERMAN_SUPPLY_RAIL',s['core_phase']
    assert s['solver']=='signature' and s['allocator']=='progressive' and s['variant']=='A' and s['use_t'] and s['clock']=='full'
    assert {r['side'] for r in results}=={'G','S'}
    assert all(r['exact'] and not r['conditional'] and r['solver']=='exact-signature' for r in results)
    assert all(r['side'] in PROGRAMS for r in results),'MISSING_FULL_CONSTRAINT_AUDIT'
    if context['testFault']=='missing_audit':raise ValueError('SYNTHETIC_MISSING_AUDIT')
    nodes={n['id']:n for n in s['nodes']};edges={e['id']:e for e in s['edges']}
    rail=adjacency(s,'rail','G');route=c['route'];route_nodes=[];route_edges=[]
    for label,key in zip(route['nodes'],route['coreKeys']):
        assert KEYS[key]==label
        n=nodes[label];assert n['control'] is None and n['core_control'] is None
        assert not any(o!='G' for o in n['occupants']) and not any(z!='G' for z in n['zoc_by']),'HOSTILE_MATERIAL_ROUTE'
        route_nodes.append(deepcopy(n))
    original_edges={e['id']:e for e in MAP['edges']}
    for a,b,eid,key in zip(route['nodes'],route['nodes'][1:],route['edges'],route['coreEdges']):
        e=edges[eid];assert original_edges[eid]['core']['key']==key
        assert any(n==b and x['id']==eid for n,x in rail[a]),'ORIGINAL_RAIL_ADJACENCY_REJECTED'
        assert not e['cut'] and e['core_railway']['present'] and not e['core_railway']['destroyed'] and e['core_railway']['repairedBy']=='GERMAN'
        assert e['bridge'] is None and e['bridge_cap'] is None and e['rail_cost']==1,'ROUTE_TOPOLOGY_CHANGED'
        route_edges.append(deepcopy(e))
    hubs={h['id']:h for h in s['hubs']}
    assert hubs['GH2']['node']=='C10' and hubs['GH2']['side']=='G' and not hubs['GH2']['inactive']
    load=sum(q*c['cargo']['rates'][material] for material,q in c['cargo']['kit'].items())
    assert load==c['cargo']['kitLoadLQ']
    cargo_rows={**{'rail:'+e:load for e in route['edges']},'T':sum(e['rail_cost']*load for e in route_edges),
        'W:GH2':load*route['handling']['costLQPerLoadLQ']}
    g=next(r for r in results if r['side']=='G');constraints={r['id']:r for r in g['constraints']}
    rail_use=defaultdict(int);work=0;local_work=0;w=0;recomputed={}
    for f in g['flows']:
        assert f['q']>0 and isinstance(f['q'],int)
        if f['kind']=='rail':
            # Includes normal rail, source depart AND zero-edge localrail work.
            assert f['cost']==(sum(edges[e]['rail_cost'] for e in f['edges']) if f['edges'] else 1)
            work+=f['q']*f['cost']
            if not f['edges']:local_work+=f['q']*f['cost']
            for e in f['edges']:rail_use[e]+=f['q']
        elif f['kind']=='last':
            if f['hub']=='GH2':w+=f['q']*f['cost']
        else:raise ValueError('UNKNOWN_ARC_KIND')
    recomputed.update({'rail:'+e:rail_use[e] for e in route['edges']});recomputed.update(T=work,**{'W:GH2':w})
    rows=[]
    for spec in c['capacity']['rows']:
        k=spec['id'];r=constraints[k]
        cap=budget(s['T'],s) if k=='T' else budget(hubs['GH2']['W'],s) if k=='W:GH2' else budget(edges[k[5:]]['cap'],s)
        assert cap==r['cap']+CARGO.get(k,0)==spec['capAtT5'] and recomputed[k]==r['used'],('ARC_ROW_MISMATCH',k)
        assert cargo_rows[k]==spec['perKit'],'CARGO_ROW_COST_MISMATCH'
        assert r['used']<=cap
        rows.append(dict(id=k,cap=cap,spUsed=recomputed[k],otherHolds=0,alreadyCommitted=0,
                         reservation=0,freight=0,perKit=spec['perKit'],remaining=cap-recomputed[k]))
    rows,fits,ship=allocate(rows,context['shipRequested'])
    assert not context['shipRequested'] or (fits and ship),'PRIORITY_RESERVED_BUT_NO_DELIVERY_ROLLBACK'
    units=[]
    for result in results:
        for u in result['units']:
            paid=min(u['due'],u['before']+u['received'])
            assert paid==u['maintenance']
            units.append(dict(side=result['side'],**u,net=max(0,paid-min(u['due'],u['before']))))
    check_budget();assert time.perf_counter()<deadline
    return dict(epoch='L4',endingTurn=5,arrivalEpoch=5,availableFromTurn=6,
        inputSnapshot=deepcopy(s),inputHash=digest(s),settledSPHash=digest(out),spResults=deepcopy(results),
        fullProgramAudit={side:deepcopy(PROGRAMS[side]) for side in ['G','S']},routeNodes=route_nodes,routeEdges=route_edges,
        routeHash=digest(dict(nodes=route_nodes,edges=route_edges)),rows=rows,localRailWorkIncludedInT=local_work,
        fits=fits,ship=ship,reason='ONE_KIT' if ship else 'NO_MATERIAL_CONTROL' if not context['shipRequested'] else 'INSUFFICIENT_RESIDUAL_CAPACITY',
        maintenance=units,solveCount=2,extraSolveForCargo=0,priorityReservation=deepcopy(CARGO),
        fullFlowAudit=deepcopy(FLOW_AUDITS),
        solverProfile=[{k:v for k,v in p.items() if k!='ms' and not k.endswith('_ms')} for p in __import__('model').PROFILE],
        serviceKind='RECEIVE_STORE_AND_PREPARE_FOR_ONE_SAME_HEX_TARGET')

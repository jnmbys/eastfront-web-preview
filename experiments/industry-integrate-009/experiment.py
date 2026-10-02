"""One offline alternative on the saved E5 input. No settlement or game execution."""
import os
os.environ['OPENBLAS_NUM_THREADS']='1'
import gzip,hashlib,json,multiprocessing as mp,sys,time
from copy import deepcopy
from fractions import Fraction
from pathlib import Path
HERE=Path(__file__).resolve().parent
OUT=HERE/'.runtime'
def sha(raw):return hashlib.sha256(raw).hexdigest()
def digest(value):return sha(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode())
def classify_failure(profile,expired):
    status=profile[-1].get('status') if profile else None
    return 'TIMEOUT' if expired or status==1 else 'INFEASIBLE' if status==2 else 'UNRESOLVED_ERROR'
def load():
    manifest=json.loads((HERE/'INPUTS.json').read_bytes())
    assert manifest['base']=='96bf1d7307063ecb6331fc44b28a832bb2aceac6'
    for path,expected in manifest['files'].items():assert sha((OUT/path).read_bytes())==expected,path
    raw=gzip.decompress((OUT/'TRACE.json.gz').read_bytes());old=json.loads((OUT/'EVIDENCE.json').read_bytes())
    assert sha(raw)==old['audit']['traceSha256']
    trace=json.loads(raw);candidate=json.loads((OUT/'candidate.json').read_bytes());w=trace['E5']['boundary']
    assert digest(w['inputSnapshot'])==w['inputHash']
    assert digest(dict(core=w['coreSnapshot'],logistics=w['inputSnapshot']))==w['jointSPInputHash']
    assert w['epoch']=='L4' and w['endingTurn']==5 and w['extraSolveForCargo']==0
    return manifest,trace,candidate

def route_and_cargo(trace,c):
    import model
    w=trace['E5']['boundary'];s=w['inputSnapshot'];core=w['coreSnapshot'];route=c['route']
    assert s['tick']==4 and s['epoch']=='L4' and s['core_turn']==6 and core['turn']==6
    assert s['solver']=='signature' and s['allocator']=='progressive' and s['variant']=='A' and s['policy']=='last' and s['clock']=='full' and s['use_t']
    assert not s['pending'] and not s['game_over'] and core['pendingDecision'] is None
    nodes={n['id']:n for n in s['nodes']};edges={e['id']:e for e in s['edges']};adj=model.adjacency(s,'rail','G')
    for name,key in zip(route['nodes'],route['coreKeys']):
        n=nodes[name];h=core['hexes'][key]
        assert n['core_control'] is None and h['control'] is None
        assert not any(o!='G' for o in n['occupants']) and not any(z!='G' for z in n['zoc_by'])
    for a,b,eid,key in zip(route['nodes'],route['nodes'][1:],route['edges'],route['coreEdges']):
        e=edges[eid];assert any(dest==b and edge['id']==eid for dest,edge in adj[a])
        assert e['core_railway']==core['edges'][key]['railway']
        assert e['core_railway']['present'] and not e['core_railway']['destroyed'] and e['core_railway']['repairedBy']=='GERMAN'
        assert not e['cut'] and e['bridge'] is None and core['edges'][key]['bridge'] is None and e['rail_cost']==1
        ka,kb=key.split('|');qa,ra=map(int,ka.split(','));qb,rb=map(int,kb.split(','))
        assert (abs(qa-qb)+abs(ra-rb)+abs(qa+ra-qb-rb))//2==1
    pre=trace['preE5']['materials'];lots=list(pre['lots'].values())
    assert len(lots)==2 and {x['owner'] for x in lots}=={c['services']['source']['id']}
    assert all(x['status']=='SOURCE_AVAILABLE' and x['quantity']==c['cargo']['kit'][x['material']] for x in lots)
    assert {x['material']:x['quantity'] for x in lots}==c['cargo']['kit']
    assert all(q<=c['services'][service]['capacity'][material] for service in ['source','receiver'] for material,q in c['cargo']['kit'].items())
    load=sum(c['cargo']['rates'][m]*q for m,q in c['cargo']['kit'].items())
    assert load==8==c['cargo']['kitLoadLQ']
    cargo={**{'rail:'+e:load for e in route['edges']},'T':sum(edges[e]['rail_cost']*load for e in route['edges']),'W:GH2':load*route['handling']['costLQPerLoadLQ']}
    assert cargo=={x['id']:x['perKit'] for x in c['capacity']['rows']}
    return cargo

def project_unit(u,delivery,s):
    """Read-only arithmetic from original model.settle; never call settle or publish."""
    import model
    b=model.budget(u['B'],s);paid=min(b,u['stock']+delivery);dt=Fraction(1)
    debt=Fraction(u['debt']);debt=max(Fraction(0),debt-dt) if paid==b else min(Fraction(3),debt+dt*Fraction(b-paid,b))
    attrition=Fraction(u.get('attrition','0'))
    if debt==3 and paid<b:attrition+=dt
    loss=int(attrition);attrition-=loss
    return dict(id=u['id'],before=u['stock'],received=delivery,due=b,maintenance=paid,net=max(0,paid-min(b,u['stock'])),
        after=u['stock']+delivery-paid,debt=str(debt),loss=loss,attrition=str(attrition),strength=max(0,u['strength']-loss))

def audit_flows(s,r,cargo):
    from collections import defaultdict
    import model
    side=r['side'];edges={e['id']:e for e in s['edges']};hubs={h['id']:h for h in s['hubs'] if h['side']==side and not h.get('inactive')}
    sources={a['id']:a for a in s['sources'] if a['side']==side};units={u['id']:u for u in s['units'] if u['side']==side and u['strength']>0}
    rail=model.adjacency(s,'rail',side);road=model.adjacency(s,'road',side)
    used=defaultdict(int);received=defaultdict(int);hub_out=defaultdict(int);local=defaultdict(int);balance=defaultdict(int)
    columns={x['name']:x['value'] for x in r['certificate']['columns']}
    for f in r['flows']:
        q=f['q'];assert isinstance(q,int) and q>0 and columns[f['variable']]==q
        if f['kind']=='rail':
            used['T']+=q*f['cost']
            if f['edges']:
                assert len(f['edges'])==1
                e=edges[f['edges'][0]]
                assert any(n==f['hub'] and a['id']==e['id'] for n,a in rail[f['source']])
                assert f['cost']==e['rail_cost']
                used['rail:'+e['id']]+=q;balance[f['hub']]+=q
                if f['variable'].startswith('depart:'):balance['@source:'+f['source']]-=q
                else:assert f['variable'].startswith('rail:');balance[f['source']]-=q
            else:
                assert f['variable'].startswith('localrail:') and f['cost']==1
                assert sources[f['source']]['node']==hubs[f['hub']]['node']
                local[f['hub']]+=q
        elif f['kind']=='last':
            h=hubs[f['hub']];node=h['node'];cost=0
            for eid in f['edges']:
                dest,e=next((n,e) for n,e in road[node] if e['id']==eid)
                cost+=e.get('cost_ab' if node==e['a'] else 'cost_ba',e.get('cost',1));node=dest
                if e.get('bridge_cap') is not None:used['bridge:'+eid]+=q
            assert node==units[f['unit']]['node'] and cost<=h['range'] and f['cost']==max(1,cost)
            received[f['unit']]+=q;hub_out[h['id']]+=q;used['W:'+h['id']]+=q*f['cost']
        else:raise AssertionError('UNKNOWN_FLOW_KIND')
    for name,a in sources.items():
        source=columns['source:'+name];balance['@source:'+a['node']]+=source
        actual=source+sum(f['q'] for f in r['flows'] if f['kind']=='rail' and not f['edges'] and f['source']==name)
        assert actual==r['source_used'][name]<=model.budget(a['cap'],s);used['source:'+name]=actual
    for name,h in hubs.items():
        unloaded=columns['unload:'+name];balance[h['node']]-=unloaded
        assert unloaded+local[name]==r['hub_unload'][name]
        assert r['hubs'][name]==h['stock']+r['hub_unload'][name]-hub_out[name]
        assert 0<=r['hubs'][name]<=h['cap']
    assert all(abs(v)<1e-5 for v in balance.values()),dict(balance)
    for name,u in units.items():
        assert received[name]==r['deliveries'][name]<=max(0,min(u['cap'],u['target'])-u['stock'])
        used['unit:'+name]=received[name]
    rows=[]
    for row in r['constraints']:
        key=row['id'];assert row['used']==used[key],(key,row['used'],used[key])
        freight=cargo.get(key,0);rawcap=row['cap']+freight
        if key=='T':expected=model.budget(s['T'],s)
        elif key.startswith('rail:'):expected=model.budget(edges[key[5:]]['cap'],s)
        elif key.startswith('W:'):expected=model.budget(hubs[key[2:]]['W'],s)
        elif key.startswith('source:'):expected=model.budget(sources[key[7:]]['cap'],s)
        elif key.startswith('bridge:'):expected=model.budget(edges[key[7:]]['bridge_cap'],s)
        else:
            assert key.startswith('unit:');u=units[key[5:]];expected=max(0,min(u['cap'],u['target'])-u['stock'])
        assert rawcap==expected and used[key]+freight<=rawcap
        rows.append(dict(id=key,originalCap=rawcap,spUsed=used[key],cargo=freight,remaining=rawcap-used[key]-freight))
    assert sum(r['source_used'].values())+sum(h['stock'] for h in hubs.values())==sum(r['deliveries'].values())+sum(r['hubs'].values())
    return rows

def solve_one(trace,c,deadline):
    import model,signature_model,solver_audit
    model.DEADLINE=deadline;model.PROFILE.clear();solver_audit.CURRENT=None
    before=digest(trace);w=trace['E5']['boundary'];s=w['inputSnapshot'];cargo=route_and_cargo(trace,c)
    oldG=next(r for r in w['spResults'] if r['side']=='G');oldS=next(r for r in w['spResults'] if r['side']=='S')
    try:
        # Single candidate. The original transport-work objective picks a lean
        # witness; this is not minimum reserve loss or a new gameplay policy.
        r=signature_model.solve_network(s,oldG['units'],cargo,'G')
        rows=audit_flows(s,r,cargo);comparison=[]
        actual_end={u['id']:u for u in trace['E5']['bundle']['logistics']['units']}
        for u in s['units']:
            if u['strength']<=0:continue
            ref=next(x for x in (oldG if u['side']=='G' else oldS)['units'] if x['id']==u['id'])
            alternative=project_unit(u,r['deliveries'][u['id']] if u['side']=='G' else ref['received'],s)
            reference=project_unit(u,ref['received'],s)
            for key in ['maintenance','net','debt','loss','attrition','strength']:
                assert alternative[key]==reference[key],(u['id'],key)
            for key in ['maintenance','after','debt','loss']:assert reference[key]==ref[key]
            if u['id'] in actual_end:assert reference['attrition']==actual_end[u['id']]['attrition']
            comparison.append(dict(side=u['side'],id=u['id'],reference=reference,alternative=alternative,
                deliveryDelta=alternative['received']-reference['received'],inventoryDelta=alternative['after']-reference['after']))
        hub_comparison=[dict(id=h['id'],before=h['stock'],reference=oldG['hubs'][h['id']],alternative=r['hubs'][h['id']],delta=r['hubs'][h['id']]-oldG['hubs'][h['id']]) for h in s['hubs'] if h['side']=='G']
        from collections import Counter
        def flows_key(f):return json.dumps({k:v for k,v in f.items() if k not in ['q','variable']},sort_keys=True)
        def flows_counter(flows):
            out=Counter()
            for f in flows:out[flows_key(f)]+=f['q']
            return out
        a,b=flows_counter(oldG['flows']),flows_counter(r['flows'])
        differences=[dict(arc=json.loads(k),reference=a[k],alternative=b[k],delta=b[k]-a[k]) for k in sorted(a.keys()|b.keys()) if a[k]!=b[k]]
        model.check_budget();assert digest(trace)==before
        return dict(status='FEASIBLE',candidateCount=1,cargo=cargo,capacity=[x for x in rows if x['id'] in cargo],allCapacityRows=rows,
            germanAlternative=r,sovietFrozen=deepcopy(oldS),sovietResultHash=digest(oldS),unitComparison=comparison,hubComparison=hub_comparison,
            sourceComparison=[dict(id=k,reference=oldG['source_used'][k],alternative=v,delta=v-oldG['source_used'][k]) for k,v in r['source_used'].items()],arcDifferences=differences,
            inputUnchanged=True,inputHash=w['inputHash'],jointSPInputHash=w['jointSPInputHash'],published=False,materialTransportExecuted=False,
            globalBlockersClosed=0,globalBlockersRetained=35,profile=deepcopy(model.PROFILE))
    except Exception as e:
        assert digest(trace)==before
        status=classify_failure(model.PROFILE,time.perf_counter()>=deadline)
        certificate=solver_audit.capture(solver_audit.CURRENT) if solver_audit.CURRENT else None
        proof=solver_audit.infeasibility_witness(certificate) if status=='INFEASIBLE' else None
        model.check_budget()
        return dict(status=status,error=str(e),candidateCount=1,inputUnchanged=True,published=False,profile=deepcopy(model.PROFILE),
            certificate=certificate,infeasibilityProof=proof,solverRetries=deepcopy(solver_audit.CURRENT.solver_retries) if solver_audit.CURRENT else [],
            cargo=cargo,inputHash=w['inputHash'],jointSPInputHash=w['jointSPInputHash'],
            capacity=[dict(id=x['id'],originalCap=x['cap'],referenceSP=x['spUsed'],candidateCargo=cargo[x['id']],candidateSPCap=x['cap']-cargo[x['id']],alternativeSP=None) for x in w['rows']],
            maintenanceLocks=deepcopy(w['maintenance']),germanReference=deepcopy(oldG),sovietFrozen=deepcopy(oldS),sovietResultHash=digest(oldS),
            referenceInventory=[dict(side=u['side'],id=u['id'],stockBefore=u['stock'],referenceDelivery=next(x for x in (oldG if u['side']=='G' else oldS)['units'] if x['id']==u['id'])['received'],
                referenceAfter=next(x for x in (oldG if u['side']=='G' else oldS)['units'] if x['id']==u['id'])['after'],alternativeAfter=None,inventoryDelta=None) for u in s['units'] if u['strength']>0],
            referenceHubs=[dict(id=h['id'],before=h['stock'],referenceAfter=(oldG if h['side']=='G' else oldS)['hubs'][h['id']],alternativeAfter=None,inventoryDelta=None) for h in s['hubs']],
            globalBlockersClosed=0,globalBlockersRetained=35)

def worker(conn):
    sys.path.insert(0,str(OUT/'solver'))
    import model,signature_model
    conn.send('READY')
    trace,c,deadline=conn.recv()
    try:result=solve_one(trace,c,deadline)
    except Exception as e:result=dict(status='TIMEOUT' if time.perf_counter()>=deadline else 'UNRESOLVED_ERROR',error=str(e),published=False)
    result['completedBeforeDeadline']=time.perf_counter()<deadline
    conn.send(result);conn.close()

def run(trace,c,seconds=3):
    assert seconds==3,'FIXED_BUDGET_ONLY'
    ctx=mp.get_context('spawn');parent,child=ctx.Pipe();proc=ctx.Process(target=worker,args=(child,),daemon=True);proc.start();child.close()
    try:
        if not parent.poll(15) or parent.recv()!='READY':raise RuntimeError('SOLVER_STARTUP_FAILED')
        began=time.perf_counter();deadline=began+3;parent.send((trace,c,deadline))
        if not parent.poll(max(0,deadline-time.perf_counter())):return dict(status='TIMEOUT',candidateCount=1,published=False,budgetSeconds=3,error='TOTAL_BUDGET_EXHAUSTED_NO_CONCLUSION')
        result=parent.recv();elapsed=time.perf_counter()-began
        if elapsed>=3 or not result.get('completedBeforeDeadline'):return dict(status='TIMEOUT',candidateCount=1,published=False,budgetSeconds=3,seconds=elapsed,error='COMPLETED_AFTER_DEADLINE_NO_CONCLUSION')
        result.update(seconds=elapsed,budgetSeconds=3,startupExcluded='Original solver module import; no solve, route enumeration or model build during startup')
        return result
    finally:
        if proc.is_alive():proc.terminate()
        proc.join(timeout=.2)
        if proc.is_alive():proc.kill();proc.join()
        parent.close()

def main():
    manifest,trace,c=load();before=digest(trace);result=run(trace,c);assert digest(trace)==before
    result['provenance']=dict(base=manifest['base'],traceSha256=sha(gzip.decompress((OUT/'TRACE.json.gz').read_bytes())),candidateSha256=sha((OUT/'candidate.json').read_bytes()),inputSnapshotHash=trace['E5']['boundary']['inputHash'])
    (HERE/'RESULT.json').write_bytes((json.dumps(result,ensure_ascii=False,indent=2)+'\n').encode())
    print(json.dumps({k:result[k] for k in ['status','seconds','capacity'] if k in result},ensure_ascii=False))
if __name__=='__main__':main()

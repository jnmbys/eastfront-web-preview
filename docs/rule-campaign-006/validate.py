"""Static arithmetic over pinned 008/009 evidence. No Core/solver imports or execution."""
import argparse
import copy
import gzip
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parent


class Rejected(ValueError): pass


def need(ok,reason):
    if not ok: raise Rejected(reason)


def read(name): return json.loads((ROOT/name).read_bytes())
def digest(value): return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()


def load():
    manifest=read('SOURCES.json');raw={}
    for x in manifest['inputs']:
        need(x['commit']==manifest['refs'][x['ref']],'REF_MISMATCH')
        b=subprocess.check_output(['git','show',x['commit']+':'+x['path']],cwd=ROOT)
        need(hashlib.sha256(b).hexdigest()==x['sha256'],'FIXED_INPUT_CHANGED:'+x['path']);raw[x['path']]=b
    tbytes=gzip.decompress(raw['experiments/industry-integrate-008/TRACE.json.gz'])
    evidence=json.loads(raw['experiments/industry-integrate-008/EVIDENCE.json'])
    need(hashlib.sha256(tbytes).hexdigest()==evidence['audit']['traceSha256'],'008_TRACE_HASH')
    trace=json.loads(tbytes);nine=json.loads(raw['experiments/industry-integrate-009/RESULT.json'])
    w=trace['E5']['boundary']
    need(digest(w['inputSnapshot'])==w['inputHash']==nine['inputHash'],'E5_INPUT_IDENTITY')
    need(digest({'core':w['coreSnapshot'],'logistics':w['inputSnapshot']})==w['jointSPInputHash']==nine['jointSPInputHash'],
         'E5_JOINT_IDENTITY')
    return manifest,raw,trace,nine


def proof(certificate, reference, source_cap):
    """Re-derive inequality from matrix coefficients, not from published 96/88 constants."""
    cols=certificate['columns'];rows=certificate['rows'];names={x['name']:i for i,x in enumerate(cols)}
    need(len(names)==len(cols) and all(x['value'] is None for x in cols),'NO_FEASIBLE_SOLUTION_CLAIM')
    def row(label): return next(r for r in rows if r['label']==label)
    unload,local=names['unload:GH1'],names['localrail:G-A5:GH1']
    rail=row('rail balance:A5')
    need(rail['lo']==rail['hi']==0 and rail['coefficients']==[[unload,-1]],'GH1_NO_OTHER_RAIL_INPUT_NOT_PROVEN')
    source=next(r for r in rows if r['label']=='source:G-A5' and [local,1] in r['coefficients'])
    need(source['hi']==source_cap and all(v>=0 and cols[i]['lo']>=0 for i,v in source['coefficients']), 'GH1_SOURCE_CAP')
    hub=row('hub:GH1');a=dict(hub['coefficients']);routes={i for i,v in a.items() if v==-1}
    need(hub['lo']==0 and a[unload]==a[local]==1 and set(a)==routes|{unload,local}
         and all(cols[i]['name'].startswith('route:GH1:') for i in routes),'GH1_HUB_BOUND')
    w=row('W:GH2');costs=dict(w['coefficients'])
    need(all(v>=0 and cols[i]['lo']>=0 for i,v in costs.items()),'NEGATIVE_WORK_OR_FLOW')
    units=[]
    reference={u['id']:u for u in reference['units']}
    for r in rows:
        if not r['label'].startswith('fixed net maintenance:') or r['lo']<=0: continue
        uid=r['label'].split(':',1)[1];u=reference[uid]
        net=max(0,u['maintenance']-min(u['due'],u['before']))
        need(r['lo']==r['hi']==net and u['maintenance']<u['due'],'NET_MAINTENANCE_LOCK_CHANGED')
        ids=[i for i,v in r['coefficients']]
        need(ids and all(v==1 for i,v in r['coefficients']) and all(i in routes or i in costs for i in ids),
             'THIRD_HUB_OR_CHANGED_ROUTES')
        values=[costs[i] for i in ids if i in costs]
        units.append({'unit':uid,'net':net,'GH2MinimumCost':min(values) if values else None})
    required=sum(u['net'] for u in units);minimum=required-source['hi'];pivot=5
    discount=sum((pivot-u['GH2MinimumCost'])*u['net'] for u in units if u['GH2MinimumCost'] is not None and u['GH2MinimumCost']<pivot)
    lower=pivot*minimum-discount
    need(lower>w['hi'],'NO_INFEASIBILITY_CONTRADICTION')
    return {'requiredUnits':units,'requiredNet':required,'GH1Maximum':source['hi'],'GH2MinimumDelivery':minimum,
            'discountUpperBound':discount,'GH2WorkLowerBound':lower,'GH2SPCapWithCargo':w['hi'],'contradiction':lower-w['hi']}


def inspect(c,inputs):
    manifest,raw,t,n=inputs
    old=json.loads(raw['docs/rule-campaign-005/candidate.json']);w=t['E5']['boundary'];s=w['inputSnapshot']
    g=next(x for x in w['spResults'] if x['side']=='G')
    need(c['refs']==manifest['refs'],'CANDIDATE_REFS')
    need(c['runtimeEnabled'] is False and c['approval']=={'decisionRef':None,'inherits005or008':False},'NEW_REVIEW_REQUIRED')
    need(c['recommendation']=='RETAIN_SHARED_W_AS_BUNDLED_SAME_HEX_TERMINAL_SERVICE','RECOMMENDATION_CHANGED')
    need(c['charges']['rows']==old['capacity']['rows'] and c['charges']['ratesLQ']==old['cargo']['rates']
         and c['charges']['kit']==old['cargo']['kit'],'NO_RATE_OR_CAPACITY_CHANGE')
    terminal=c['charges']['terminalBundle'];pickup=c['charges']['sameHexPickupRecovery']
    need(terminal['feePerKit']==8 and terminal['costPerLQ']==1 and terminal['chargeEpoch']=='E5'
         and terminal['independentUnloadOnlyAllowed'] is False and terminal['separateStationCapacityH'] is None,
         'NO_FREE_OR_UNBOUNDED_UNLOAD')
    need(pickup['extraW']==0 and pickup['receiptRequired'] is True and pickup['originalCoreEligibilityRequired'] is True,
         'PICKUP_REQUIRES_PREPAID_SERVICE_AND_CORE')
    need(c['charges']['differentHexDelivery']['allowed'] is False and c['charges']['differentHexDelivery']['cost'] is None,
         'CROSS_HEX_UNDEFINED_NOT_FREE')
    need(c['alternativeNotSelected']['H'] is None and c['alternativeNotSelected']['approved'] is False,'NO_INVENTED_STATION_CAPACITY')
    need(c['admission']['deadlineSeconds']==3 and c['admission']['noCapacityIncrease'] is True,'BUDGET_CHANGED')
    blockers=json.loads(raw['docs/rule-campaign-003/VALIDATION.json'])['blockers']
    need(len(blockers)==35 and [r['blocker'] for r in old['blockerReview']['rows']]==blockers,'BLOCKER_DRIFT')
    need(c['unchanged']['globalBlockerCount']==35 and c['unchanged']['globalBlockersClosed']==0
         and c['unchanged']['baselineGermanGapSP']==9 and c['unchanged']['baselineSovietGapSP']==14
         and c['unchanged']['industrial22SPAdded'] is False,'GAPS_OR_BLOCKERS_CHANGED')
    need(n['status']=='INFEASIBLE' and n['published'] is False and n['germanReference']==g,'009_SAME_REFERENCE')
    used={r['id']:0 for r in c['charges']['rows']};local=0;railwork=0;out=0
    for f in g['flows']:
        if f['kind']=='rail':
            used['T']+=f['q']*f['cost']
            if f['edges']: railwork+=f['q']*f['cost']
            else: local+=f['q']*f['cost']
            for eid in f['edges']:
                if 'rail:'+eid in used: used['rail:'+eid]+=f['q']
        elif f['kind']=='last' and f['hub']=='GH2':
            used['W:GH2']+=f['q']*f['cost'];out+=f['q']
    rows=[]
    for r in c['charges']['rows']:
        reported=next(x for x in g['constraints'] if x['id']==r['id'])
        need(reported['used']==used[r['id']] and reported['cap']==r['capAtT5'],'008_ARC_ROW_MISMATCH')
        rows.append({'id':r['id'],'cap':reported['cap'],'SP':reported['used'],'candidateCargo':r['perKit'],
                     'remainingAfterProposedCargo':reported['cap']-reported['used']-r['perKit']})
    hub=next(h for h in s['hubs'] if h['id']=='GH2')
    need(hub['stock']+g['hub_unload']['GH2']-out==g['hubs']['GH2']<=hub['cap'],'HUB_INVENTORY_BALANCE')
    source=next(a for a in s['sources'] if a['id']=='G-A5')
    p=proof(n['certificate'],g,source['cap']);saved=n['infeasibilityProof']
    need(p['GH2WorkLowerBound']==saved['GH2WorkLowerBound'] and p['contradiction']==saved['contradiction']
         and p['requiredNet']==saved['requiredNetDelivery'],'009_PUBLISHED_PROOF_MISMATCH')
    need(p['GH2SPCapWithCargo']==hub['W']-c['charges']['terminalBundle']['feePerKit'],'CARGO_WORK_CAP')
    counterfactual=[{'id':r['id'],'remaining':r['cap']-r['SP']-(0 if r['id']=='W:GH2' else r['candidateCargo'])} for r in rows]
    return {'reviewStatus':'VALID_CANDIDATE_ONLY','runtimeDecision':'REJECT','staticCapacity':rows,
       'railWork':railwork,'localRailWork':local,'GH2':{'openingStock':hub['stock'],'unloaded':g['hub_unload']['GH2'],
       'outgoingQ':out,'endingStock':g['hubs']['GH2'],'stockCap':hub['cap'],'lastMileWork':used['W:GH2']},
       '009ProofRecomputed':p,'sameConstraintsAs005':True,'actualNewTransportExecuted':False,
       'unchangedE5Verdict':'ZERO_CARGO; preserved-maintenance model also infeasible for +8W',
       'counterfactualRemove8W':{'selectedRowsArithmeticFits':all(r['remaining']>=0 for r in counterfactual),
         'rows':counterfactual,'WExtra':0,'newHDefined':False,
         'permission':'REJECT_UNDEFINED_TERMINAL_SERVICE; arithmetic is not transport success'},
       'originalGlobalBlockers':blockers,'closed':0,'baselineGapsSP':{'G':9,'S':14}}


def pickup_boundary(c,request,receipt,core_eligible):
    need(receipt is not None,'NO_PAID_TERMINAL_SERVICE_RECEIPT')
    for key,value in c['terminalReceipt']['minimumBinding'].items():
        need(receipt.get(key)==value,'SERVICE_RECEIPT_SCOPE:'+key)
    need(request['unit']=='G-I-01' and request['side']=='G' and request['node']=='C10' and request['key']=='2,8',
         'CROSS_HEX_OR_RETARGET_NOT_AUTHORIZED')
    need(request['turn']==6 and request['phase']=='GERMAN_RECOVERY','NOT_T6_RECOVERY')
    need(request['lots']==receipt['lots'] and request['shipmentId']==receipt['shipmentId'],'WRONG_LOTS_OR_SHIPMENT')
    need(receipt['committed'] is True and not receipt['spent'],'UNCOMMITTED_OR_SPENT_RECEIPT')
    need(core_eligible is True,'CORE_ELIGIBILITY_STILL_REQUIRED')
    need(request['extraW']==0,'DOUBLE_CHARGE_PREPAID_TERMINAL_SERVICE')
    return {'conditionalOnly':True,'executable':False,'newW':0,'mutations':0}


def tests(c,inputs):
    rows=[]
    def check(name,fn,reason=None):
        try: value=fn()
        except Rejected as e:
            need(str(e)==reason,'TEST_WRONG_REJECTION:'+name+':'+str(e));value={'rejected':str(e)}
        else: need(reason is None,'NEGATIVE_PASSED:'+name)
        rows.append({'name':name,'basis':'SYNTHETIC_STATIC_NEGATIVE_OR_GIVEN_RECEIPT; not a real service grant','result':value})
    receipt={**c['terminalReceipt']['minimumBinding'],'lots':['TEST-P','TEST-E2'],'shipmentId':'TEST-SHIP','committed':True,'spent':False}
    req={'unit':'G-I-01','side':'G','node':'C10','key':'2,8','turn':6,'phase':'GERMAN_RECOVERY',
         'lots':['TEST-P','TEST-E2'],'shipmentId':'TEST-SHIP','extraW':0}
    check('conditional prepaid pickup, no debit executed',lambda:pickup_boundary(c,req,receipt,True))
    check('no receipt is not free pickup',lambda:pickup_boundary(c,req,None,True),'NO_PAID_TERMINAL_SERVICE_RECEIPT')
    for field,value,reason in [('paidW',0,'SERVICE_RECEIPT_SCOPE:paidW'),('paidEpoch',4,'SERVICE_RECEIPT_SCOPE:paidEpoch'),
                             ('committed',False,'UNCOMMITTED_OR_SPENT_RECEIPT'),('spent',True,'UNCOMMITTED_OR_SPENT_RECEIPT')]:
        r=copy.deepcopy(receipt);r[field]=value;check(field+' invalid',lambda r=r:pickup_boundary(c,req,r,True),reason)
    for field,value,reason in [('node','B10','CROSS_HEX_OR_RETARGET_NOT_AUTHORIZED'),('unit','G-I-02','CROSS_HEX_OR_RETARGET_NOT_AUTHORIZED'),
        ('turn',5,'NOT_T6_RECOVERY'),('lots',['OTHER'],'WRONG_LOTS_OR_SHIPMENT'),('extraW',8,'DOUBLE_CHARGE_PREPAID_TERMINAL_SERVICE')]:
        q=copy.deepcopy(req);q[field]=value;check(field+' invalid',lambda q=q:pickup_boundary(c,q,receipt,True),reason)
    check('actual Core qualification not waived',lambda:pickup_boundary(c,req,receipt,False),'CORE_ELIGIBILITY_STILL_REQUIRED')
    for name,mutate,reason in [('unload-only bypass',lambda x:x['charges']['terminalBundle'].__setitem__('independentUnloadOnlyAllowed',True),'NO_FREE_OR_UNBOUNDED_UNLOAD'),
        ('invent H to fit cargo',lambda x:x['alternativeNotSelected'].__setitem__('H',8),'NO_INVENTED_STATION_CAPACITY'),
        ('waive material W',lambda x:x['charges']['rows'][3].__setitem__('perKit',0),'NO_RATE_OR_CAPACITY_CHANGE')]:
        x=copy.deepcopy(c);mutate(x);check(name,lambda x=x:inspect(x,inputs),reason)
    certificate=copy.deepcopy(inputs[3]['certificate'])
    # A more direct corruption of the GH1 bound must fail rather than reproducing 96 by constants.
    rail=next(r for r in certificate['rows'] if r['label']=='rail balance:A5');rail['coefficients']=[]
    check('matrix bound corruption rejected',lambda:proof(certificate,inputs[3]['germanReference'],32),'GH1_NO_OTHER_RAIL_INPUT_NOT_PROVEN')
    return rows


def main():
    a=argparse.ArgumentParser(description=__doc__);a.add_argument('--self-test',action='store_true');a.add_argument('--runtime-gate',action='store_true')
    args=a.parse_args();inputs=load();c=read('candidate.json');before=digest(inputs[2])
    result=inspect(c,inputs);result['checks']=tests(c,inputs) if args.self_test else []
    need(digest(inputs[2])==before,'TRACE_CHANGED')
    result.update(candidateSha256=hashlib.sha256((ROOT/'candidate.json').read_bytes()).hexdigest(),
                  validatorSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                  noSolverExecuted=True,noGameExecuted=True,noOldEvidenceWritten=True,
                  notProven=['physical station throughput','new paid-service receipt implementation','transport under an alternative H model',
                             'new runtime authorization or actual successful shipment'])
    print(json.dumps(result,ensure_ascii=False,indent=2));return 2 if args.runtime_gate else 0


if __name__=='__main__':
    try: sys.exit(main())
    except (Rejected,ValueError,TypeError,KeyError) as e:
        print(json.dumps({'reviewStatus':'REJECT','error':str(e)}));sys.exit(1)

"""CAMPAIGN-003: frozen CAMPAIGN-001 B proxy, one freight-order intervention.

Standard library only. No Core imports, RNG, new contract, sweep or extra policy.
python docs/campaign-003/replay.py --control-only  # exact replay gate only
python docs/campaign-003/replay.py                 # gate, then ONE experiment
All writes are confined to this directory. Input 001/002 files are never written.
"""
import argparse
import copy
import hashlib
import json
import math
import subprocess
from fractions import Fraction as Q
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
BASE = '3ad1ef8b4e2b4f89cac441dfc545230da38ba806'


def encode(x):
    if isinstance(x, Q):
        return {'exact': str(x), 'value': round(float(x), 4)}
    if isinstance(x, dict):
        return {k: encode(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [encode(v) for v in x]
    return x


def decode(x):
    if isinstance(x, dict) and set(x) == {'exact', 'value'}:
        return Q(x['exact'])
    if isinstance(x, dict):
        return {k: decode(v) for k, v in x.items()}
    if isinstance(x, list):
        return [decode(v) for v in x]
    return x


def dump(name, obj, compact=False):
    text = json.dumps(encode(obj), ensure_ascii=False, indent=None if compact else 2,
                      separators=(',', ':') if compact else None) + '\n'
    (HERE / name).write_bytes(text.encode('utf8'))


def digest(obj):
    return hashlib.sha256(json.dumps(encode(obj), sort_keys=True, ensure_ascii=False,
                                     separators=(',', ':')).encode('utf8')).hexdigest()


def differences(a, b, path=''):
    """Compare every saved field, including exact fractions and display values."""
    if isinstance(a, dict) and isinstance(b, dict):
        out = []
        for key in sorted(set(a) | set(b)):
            if key not in a or key not in b:
                out.append(dict(path=path+'/'+key, issue='missing key'))
            else:
                out.extend(differences(a[key], b[key], path+'/'+key))
        return out
    if isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            return [dict(path=path, issue='list length', expected=len(a), actual=len(b))]
        return [d for i,(x,y) in enumerate(zip(a,b)) for d in differences(x,y,path+'/'+str(i))]
    if a != b or type(a) != type(b):
        return [dict(path=path, expected=a, actual=b)]
    return []


def leaves(x):
    if isinstance(x, dict): return sum(map(leaves,x.values()))
    if isinstance(x, list): return sum(map(leaves,x))
    return 1


def load_inputs():
    hashes = {}
    # Verify every original 001/002 artifact, not just the two numerical inputs.
    names = subprocess.check_output(['git','ls-tree','-r','--name-only',BASE,'--',
             'docs/campaign-001','docs/campaign-002'],cwd=ROOT,text=True).splitlines()
    for name in names:
        content = (ROOT/name).read_bytes()
        original = subprocess.check_output(['git','show',BASE+':'+name],cwd=ROOT)
        if content != original:
            raise RuntimeError('Original input differs from pinned commit: '+name)
        hashes[name] = hashlib.sha256(content).hexdigest()
    source = json.loads((ROOT/'docs/campaign-001/LEDGER_DATA.json').read_text(encoding='utf8'))
    matches = [r for r in source['main'] if r['route']=='B' and r['variant']=='main']
    assert len(matches)==1
    raw = matches[0]
    params = json.loads((ROOT/'docs/campaign-001/PARAMETERS.json').read_text(encoding='utf8'))
    # Derive only hidden confirmation counters from the saved E1-E4 prefix.
    streak=[2]*9
    prev=['G']*3+['S']*6
    for r in raw['records'][:4]:
        streak=[streak[i]+1 if owner==prev[i] else 1 for i,owner in enumerate(r['owners'])]
        prev=r['owners'][:]
    e4=decode(raw['records'][3])
    checkpoint=dict(label='001旧代理实验参数；完整双方E4末，不是新契约状态',baseline=BASE,
        source_pointer='/main/1/records/3',next_turn=5,route='B',variant='main',limit=24,
        states={s:copy.deepcopy(e4['sides'][s]['end']) for s in ['G','S']},
        owners=e4['owners'],previous_owners=prev,confirmation_streak=streak,
        confirmed=e4['confirmed'],progress=e4['progress'],
        hold_sum={s:e4['sides'][s]['holdSum'] for s in ['G','S']},
        fixed_project_schedule=params['projects'],parameters=params,
        source_E4=raw['records'][3],prefix_E1_E4=raw['records'][:4],input_sha256=hashes,
        reconstruction_note='confirmation_streak从初始已确认计数2及保存E1-E4归属复算；没有读取T5以后的状态来补起点。工业/运输/回收生效时点由固定项目表和当前T决定，无随机状态。')
    # Keep a persisted full checkpoint. Reruns must match it rather than replace it silently.
    target=HERE/'START_E4.json'
    if target.exists():
        existing=json.loads(target.read_text(encoding='utf8'))
        mismatch=differences(encode(checkpoint),existing)
        if mismatch: raise RuntimeError('Persisted checkpoint differs: '+json.dumps(mismatch[:3],ensure_ascii=False))
    else:
        dump('START_E4.json',checkpoint)
    return decode(json.loads(target.read_text(encoding='utf8'))),raw,hashes


def simulate(checkpoint, reserve_first=False):
    """Only two allowed arms. Future original records are not an argument/input."""
    cp=copy.deepcopy(checkpoint)
    params=cp['parameters'];types=params['units'];nodes=params['nodes']
    states=cp['states'];owners=cp['owners'];prev=cp['previous_owners']
    streak=cp['confirmation_streak'];confirmed=cp['confirmed']
    progress=cp['progress'];cs=cp['hold_sum'];limit=cp['limit']
    records=[];traces=[];victory=None
    def live(s):return [u for u in s['units'] if not u['dead']]
    def strength(u,key):
        k=types[u['kind']]
        return Q(k[key]*(k['steps']-u['damage']),k['steps'])
    def debtfactor(u):return Q(1) if u['debt']<1 else Q(3,4) if u['debt']<2 else Q(1,2)
    for t in range(cp['next_turn'],limit+1):
        details={};acts={};attacks={};defenses={};trace={'t':t,'sides':{}}
        boundary=max([i for i,x in enumerate(owners) if x=='G'],default=-1)
        for side,s in states.items():
            arrivals=[]
            for kind in s['pending']:
                u=dict(id=f'{side}{len(s["units"])+1:02}',kind=kind,damage=0,stock=0,
                       debt=Q(0),chronic=0,dead=False)
                s['units'].append(u);arrivals.append(u['id'])
            s['pending']=[]
            before=copy.deepcopy(s);us=live(s)
            repair=next((u for u in sorted(us,key=lambda u:(-u['damage'],u['id']))
                if u['damage'] and u['debt']<2 and s['front']>=1 and s['P']>=1),None) if t<limit else None
            avgDebt=sum((u['debt'] for u in us),Q(0))/len(us) if us else Q(3)
            full=sum(u['stock']>=4 and u['debt']<1 for u in us)/max(1,len(us))
            if side=='S':
                mode='守备' if t<=6 else ('恢复' if t<=12 else ('反攻' if full>=0.50 and avgDebt<1 else '整补'))
            else:
                mode='建设' if t<=4 else '突击'
                if t>4 and (full<0.50 or avgDebt>=1):mode='整补'
            assault=mode in ['突击','反攻'];power=Q(0);consumed=0;fullN=0;reducedN=0
            moveQ=attackQ=0;payments=[]
            for u in us:
                if u is repair or not assault:continue
                k=types[u['kind']];movement=0
                if k['mobile']:
                    movement=min(4,u['stock']);u['stock']-=movement;consumed+=movement;moveQ+=movement
                pay=min(4,u['stock']);u['stock']-=pay;consumed+=pay;attackQ+=pay
                factor=min(Q(1,2)+Q(pay,8),debtfactor(u))
                contribution=math.ceil(strength(u,'a')*factor);power+=contribution
                if factor==1:fullN+=1
                else:reducedN+=1
                payments.append(dict(id=u['id'],moveQ=movement,attackQ=pay,factor=factor,attack=contribution))
            defense=sum((strength(u,'d') for u in us),Q(0))
            if repair:defense-=strength(repair,'d')/2
            attacks[side]=power;defenses[side]=defense;acts[side]=assault
            details[side]=dict(mode=mode,start=before,arrivals=arrivals,repairID=repair['id'] if repair else None,
                actionQ=consumed,full=fullN,reduced=reducedN,attack=power,defense=defense,
                loss=0,combatLoss=0,supplyLoss=0,repair=0,new=None)
            trace['sides'][side]=dict(moveQ=moveQ,attackQ=attackQ,payments=payments,
                ready=sum(u['stock']>=4 and u['debt']<1 for u in before['units'] if not u['dead']),
                start_after_arrivals=copy.deepcopy(before),after_action=copy.deepcopy(s))
        margins={side:max(Q(0),attacks[side]-Q(21,20)*defenses['S' if side=='G' else 'G'])
                 if acts[side] else Q(0) for side in states}
        winner=None
        if margins['G']>margins['S']:winner='G'
        if margins['S']>margins['G']:winner='S'
        event='无易手'
        for side in states:
            if side==winner:progress[side]+=margins[side]-margins['S' if side=='G' else 'G']
            else:progress[side]=max(Q(0),progress[side]-10)
        if winner and progress[winner]>=40:
            target=boundary+1 if winner=='G' else boundary
            if 0<=target<9:
                owners[target]=winner;event=f'{winner}夺取{nodes[target]["name"]}';progress[winner]=Q(0)
        trace['before_freight_global']=dict(owners=owners[:],progress=copy.deepcopy(progress),margins=margins,event=event)
        for side,s in states.items():
            d=details[side];opp='S' if side=='G' else 'G';us=live(s)
            count=(1+int(acts[side] and t%3==0)+int(margins[opp]>20 and t%3==1)) if any(acts.values()) else 0
            def damage(u,supply=False):
                if u['dead']:return
                k=types[u['kind']];u['damage']+=1;s['wreck']+=Q(1,2);d['loss']+=1
                d['supplyLoss' if supply else 'combatLoss']+=1
                if u['damage']>=k['steps']:
                    u['dead']=True;s['cum']['destroySP']+=u['stock'];u['stock']=0;s['cum']['death']+=1
            candidates=[u for u in us if u['id']!=d['repairID']]
            for j in range(min(count,len(candidates))):damage(candidates[(t-1+j)%len(candidates)])
            repair=next((u for u in live(s) if u['id']==d['repairID']),None)
            if repair:
                repair['damage']-=1;s['front']-=1;s['P']-=1;d['repair']=1;s['cum']['repair']+=1
            newtype='GI' if side=='G' else ('ST' if t%2==0 else 'SI')
            cost=types[newtype]['cost']
            source=params['initial'][side]['sourceSP'];cap=params['initial'][side]['transport']
            transport=(1 if side=='G' else 2) if t>=3 else 0
            if side=='G':
                depth=max(0,boundary-2)
                if d['mode'] in ['建设','整补']:s['rail']=min(depth,s['rail']+1)
                distance=max(0,depth-s['rail'])*2
            else:distance=0
            cap=max(0,cap+transport-distance)
            railLoss=2 if owners[2 if side=='G' else 4]!=side else 0
            cap=max(0,cap-railLoss)
            if owners[0 if side=='G' else 7]!=side:cap=cap/2
            newmaint=sum(types[u['kind']]['m']/4 for u in live(s))+types[newtype]['m']/4
            if t<limit and (side=='G' or t>=7) and newmaint<=min(source,cap)-2 and s['front']>=cost and s['P']>=cost:
                s['front']-=cost;s['P']-=cost;s['pending']=[newtype];d['new']=newtype
                s['cum']['new']+=1;s['cum']['newcost']+=cost
            localOK=owners[1 if side=='G' else 5]==side
            offered=Q(1+int(localOK))+(Q(2) if t>=4 else Q(0))
            output=min(offered,24-s['rear']);s['rear']+=output;s['cum']['production']+=output
            rate=Q(1,4) if side=='G' else Q(0)
            recycled=min(rate if t>=3 else Q(0),s['wreck'],24-s['front'])
            s['wreck']-=recycled;s['front']+=recycled;s['cum']['recycle']+=recycled
            us=live(s);maintenanceQ=sum(types[u['kind']]['m'] for u in us)
            netMaintQ=sum(max(0,types[u['kind']]['m']-u['stock']) for u in us)
            stockTargetQ=sum(types[u['kind']]['cap']-u['stock'] for u in us)
            capQ=int(cap*4);sourceQ=source*4
            spReserved=min(netMaintQ,capQ,sourceQ)
            trace['sides'][side]['pre_freight']=copy.deepcopy(s)
            trace['sides'][side]['freight_inputs']=dict(capQ=capQ,sourceQ=sourceQ,netMaintQ=netMaintQ,
                stockTargetQ=stockTargetQ,spReserved=spReserved)
            # THE ONLY INTERVENTION: which cargo gets capacity after net maintenance.
            if reserve_first and side=='G':
                shipQ=min(stockTargetQ,sourceQ,capQ)
                equip=min(Q(4),s['rear'],24-s['front'],Q(max(0,capQ-shipQ),4))
            else:
                equip=min(Q(4),s['rear'],24-s['front'],Q(max(0,capQ-spReserved),4))
                shipQ=min(stockTargetQ,sourceQ,capQ-int(equip*4))
            s['rear']-=equip;s['front']+=equip
            # Identical unit distribution in both arms and for both sides.
            remaining=shipQ
            for maintenanceOnly in [True,False]:
                while remaining:
                    changed=False
                    for u in us:
                        target=types[u['kind']]['m'] if maintenanceOnly else types[u['kind']]['cap']
                        if u['stock']<target and remaining:u['stock']+=1;remaining-=1;changed=True
                    if not changed:break
            assert remaining==0
            paidQ=0;chronicW=0;aliveW=sum(types[u['kind']]['w'] for u in us)
            for u in us:
                k=types[u['kind']];paid=min(k['m'],u['stock']);u['stock']-=paid;paidQ+=paid
                u['debt']=max(Q(0),u['debt']-1) if paid==k['m'] else min(Q(3),u['debt']+Q(k['m']-paid,k['m']))
                u['chronic']=u['chronic']+1 if paid<k['m'] and u['debt']>=1 else 0
                if u['chronic']>=3:chronicW+=k['w']
            target=Q(30*chronicW,aliveW) if aliveW else Q(0)
            s['S']=min(target,s['S']+5) if target>s['S'] else max(target,s['S']-5)
            for u in us:
                if u['debt']>=3 and u['chronic']>0:damage(u,True)
            s['cum']['sp']+=shipQ;s['cum']['maint']+=paidQ;s['cum']['action']+=d['actionQ'];s['cum']['loss']+=d['loss']
            d.update(output=output,blockedOutput=offered-output,recycle=recycled,shipE=equip,shipSP=Q(shipQ,4),
                maintenance=Q(paidQ,4),due=Q(maintenanceQ,4),shortage=Q(maintenanceQ-paidQ,4),capacity=cap,
                used=Q(shipQ,4)+equip,desired=Q(stockTargetQ,4)+min(Q(4),s['rear']+equip),source=source,
                railPenalty=distance,railLoss=railLoss,cut=False)
        for i,owner in enumerate(owners):
            streak[i]=streak[i]+1 if owner==prev[i] else 1;prev[i]=owner
            confirmed[i]=owner if streak[i]>=2 else None
        for side,s in states.items():
            d=details[side]
            C=sum(n['vp'] for n,o in zip(nodes,confirmed) if o==side);cs[side]+=C
            P=min(30,sum((8 if n['role']=='capital' else 4) for n,o in zip(nodes,confirmed)
                        if n['home']==side and o not in [side,None]))
            R=sum(types[u['kind']]['w'] for u in s['units'])
            L=sum((Q(types[u['kind']]['w']*u['damage'],types[u['kind']]['steps']) for u in s['units']),Q(0))
            F=40*L/R;W=max(Q(0),100-P-F-s['S'])
            eligible=W<=20 and sum([P>=8,F>=20,s['S']>=15])>=2
            s['collapse']=s['collapse']+1 if eligible else 0
            d.update(C=C,holdSum=cs[side],Ppressure=P,Fpressure=F,Spressure=s['S'],W=W,collapse=s['collapse'],R=R,L=L,
                end=copy.deepcopy(s),live=len(live(s)),dead=sum(u['dead'] for u in s['units']),
                endSP=Q(sum(u['stock'] for u in live(s)),4),damage=sum(u['damage'] for u in live(s)),
                maxDebt=max([u['debt'] for u in live(s)],default=Q(0)),construction='投产')
        records.append(dict(t=t,owners=owners[:],confirmed=confirmed[:],event=event,
                            progress=copy.deepcopy(progress),margins=margins,sides=details))
        traces.append(trace)
        collapsed=[side for side,s in states.items() if s['collapse']>=2]
        if collapsed:
            victory='双方崩溃平局' if len(collapsed)==2 else ('S' if collapsed[0]=='G' else 'G')+'提前胜'
            break
    final={side:Q(7,10)*records[-1]['sides'][side]['C']+Q(3,10)*cs[side]/limit for side in states}
    delta=final['G']-final['S']
    if not victory:
        victory='德决定胜' if delta>=30 else '德有限胜' if delta>=10 else '苏决定胜' if delta<=-30 else '苏有限胜' if delta<=-10 else '平局'
    return dict(route='B',variant='reserve_first' if reserve_first else 'main',limit=limit,
                records=records,final=final,delta=delta,result=victory),traces


def audit(run,traces,checkpoint):
    """Accounting and legality-of-this-proxy checks; no output-fed resimulation."""
    checks=0;types=checkpoint['parameters']['units']
    def test(cond):
        nonlocal checks
        assert cond
        checks+=1
    test([r['t'] for r in run['records']]==list(range(5,25)))
    for row,trace in zip(run['records'],traces):
        for side,d in row['sides'].items():
            s=d['end'];c=s['cum'];p=checkpoint['parameters']['initial'][side]
            test(Q(2)+c['production']+c['recycle']==s['front']+s['rear']+c['repair']+c['newcost'])
            test(p['P']==s['P']+c['repair']+c['newcost'])
            test(Q(c['loss'],2)==s['wreck']+c['recycle'])
            initialQ=sum(n*3*types[k]['m'] for k,n in p['roster'].items())
            test(initialQ+c['sp']==sum(u['stock'] for u in s['units'])+c['maint']+c['action']+c['destroySP'])
            test(c['loss']-c['repair']==sum(u['damage'] for u in s['units']))
            test(d['used']==d['shipE']+d['shipSP'] and d['used']<=d['capacity'])
            test(d['shipSP']<=d['source'] and 0<=d['shipE']<=4)
            test(d['maintenance']+d['shortage']==d['due'])
            test(0<=s['front']<=24 and 0<=s['rear']<=24 and s['P']>=0 and s['wreck']>=0)
            test(trace['sides'][side]['moveQ']+trace['sides'][side]['attackQ']==d['actionQ'])
            test(len(s['units'])==sum(p['roster'].values())+c['new']-len(s['pending']))
            test(d['collapse']<2)
            for u in s['units']:
                k=types[u['kind']]
                test(0<=u['stock']<=k['cap'] and 0<=u['debt']<=3 and 0<=u['damage']<=k['steps'])
                if u['dead']:test(u['stock']==0 and u['damage']==k['steps'])
            if row['t']==24:test(d['repair']==0 and d['new'] is None and not s['pending'])
    return checks


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--control-only',action='store_true')
    args=parser.parse_args()
    checkpoint,original,hashes=load_inputs()
    control,ct=simulate(checkpoint,False)
    expected={**original,'records':original['records'][4:]}
    mismatches=differences(expected,encode(control))
    gate=dict(status='PASS' if not mismatches else 'STOP',baseline=BASE,
              compared_turns=list(range(5,25)),compared_scalar_fields=leaves(expected),
              mismatches=mismatches,experiment_executed=False,input_sha256=hashes)
    dump('CONTROL_GATE.json',gate)
    dump('CONTROL.json',control,compact=True)
    if mismatches:
        print(json.dumps({'status':'STOP','experiment_executed':False,'mismatches':mismatches[:10]},ensure_ascii=False))
        raise SystemExit(2)  # Never approximate, calibrate or launch an experimental arm after gate failure.
    gate['conservation_assertions']=audit(control,ct,checkpoint)
    dump('CONTROL_GATE.json',gate)
    print('Exact control replay PASS:',gate['compared_scalar_fields'],'scalar fields;',gate['conservation_assertions'],'checks')
    if args.control_only:return
    experiment,et=simulate(checkpoint,True)  # Exactly ONE experimental arm, after the hard gate.
    ac=audit(experiment,et,checkpoint)
    # Whole upstream T5 records must be equal before the only intervention.
    assert ct[0]['before_freight_global']==et[0]['before_freight_global']
    for side in ['G','S']:
        for key in ['moveQ','attackQ','payments','start_after_arrivals','after_action','pre_freight','freight_inputs']:
            assert ct[0]['sides'][side][key]==et[0]['sides'][side][key],(side,key)
    assert control['records'][0]['sides']['S']==experiment['records'][0]['sides']['S']
    cg=control['records'][0]['sides']['G'];eg=experiment['records'][0]['sides']['G']
    assert eg['shipE']<cg['shipE'] and eg['shipSP']>cg['shipSP']
    def primary(ts,key):return Q(sum(r['sides']['G'][key] for r in ts if 6<=r['t']<=12),4)
    actual=primary(ct,'attackQ');changed=primary(et,'attackQ')
    assert actual==24
    verdict='SUPPORTED_IN_OLD_PROXY' if changed>actual else 'NOT_SUPPORTED_IN_OLD_PROXY'
    summary=dict(label='001旧代理单因素诊断；所有游戏数值为实验参数，不是新契约验证',
        verdict=verdict,primary_control_SP=actual,primary_experiment_SP=changed,primary_delta_SP=changed-actual,
        movement_control_SP=primary(ct,'moveQ'),movement_experiment_SP=primary(et,'moveQ'),
        E5_common_prefreight_hash=digest(ct[0]),
        E5_control=dict(equipment=cg['shipE'],SP=cg['shipSP'],maintenance=cg['maintenance'],stock=cg['endSP']),
        E5_experiment=dict(equipment=eg['shipE'],SP=eg['shipSP'],maintenance=eg['maintenance'],stock=eg['endSP']),
        final_control=control['final'],final_experiment=experiment['final'],
        control_result=control['result'],experiment_result=experiment['result'])
    dump('EXPERIMENT.json',experiment,compact=True)
    dump('TRACES.json',dict(control=ct,experiment=et),compact=True)
    dump('SUMMARY.json',summary)
    dump('VALIDATION.json',dict(status='PASS',baseline=BASE,control_gate='CONTROL_GATE.json',
        control_scalar_fields=gate['compared_scalar_fields'],control_mismatches=0,
        conservation_assertions_control=gate['conservation_assertions'],conservation_assertions_experiment=ac,
        control_runs=1,experiment_runs=1,parameter_scans=0,T5_upstream_identical=True,
        first_difference='E5 German freight allocation',S_E5_record_identical=True,primary_control_SP=24,
        input_sha256=hashes,script_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        outputs_sha256={n:hashlib.sha256((HERE/n).read_bytes()).hexdigest() for n in
            ['START_E4.json','CONTROL_GATE.json','CONTROL.json','EXPERIMENT.json','TRACES.json','SUMMARY.json']}))
    print(json.dumps(encode(summary),ensure_ascii=False))


if __name__=='__main__':main()

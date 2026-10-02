"""Independent read-only arithmetic audit/export; never runs a campaign.

python docs/campaign-003/verify_saved.py
Writes AUDIT.json and LEDGERS.md only in this directory.
"""
import hashlib
import json
import math
import subprocess
from fractions import Fraction as Q
from pathlib import Path

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
BASE='3ad1ef8b4e2b4f89cac441dfc545230da38ba806'
def decode(x):
    if isinstance(x,dict) and set(x)=={'exact','value'}:return Q(x['exact'])
    if isinstance(x,dict):return {k:decode(v) for k,v in x.items()}
    if isinstance(x,list):return [decode(v) for v in x]
    return x
def read(name):return decode(json.loads((HERE/name).read_text(encoding='utf8')))
def live(units):return [u for u in units if not u['dead']]
def fmt(x):
    if isinstance(x,Q):return str(x.numerator) if x.denominator==1 else f'{float(x):.3f}'.rstrip('0').rstrip('.')
    return str(x)
checks=0
def check(ok):
    global checks
    assert ok
    checks+=1

cp=read('START_E4.json');control=read('CONTROL.json');experiment=read('EXPERIMENT.json')
traces=read('TRACES.json');validation=read('VALIDATION.json');summary=read('SUMMARY.json')
params=cp['parameters'];types=params['units'];nodes=params['nodes']
original=json.loads((ROOT/'docs/campaign-001/LEDGER_DATA.json').read_text(encoding='utf8'))['main'][1]
expected={**original,'records':original['records'][4:]}
check(json.loads((HERE/'CONTROL.json').read_text(encoding='utf8'))==expected)
for name,sha in validation['input_sha256'].items():
    content=(ROOT/name).read_bytes()
    check(hashlib.sha256(content).hexdigest()==sha)
    check(content==subprocess.check_output(['git','show',BASE+':'+name],cwd=ROOT))
for name,sha in validation['outputs_sha256'].items():
    check(hashlib.sha256((HERE/name).read_bytes()).hexdigest()==sha)
check(hashlib.sha256((HERE/'replay.py').read_bytes()).hexdigest()==validation['script_sha256'])
check(traces['control'][0]==traces['experiment'][0])
check(control['records'][0]['sides']['S']==experiment['records'][0]['sides']['S'])

def stren(u,key):
    k=types[u['kind']];return Q(k[key]*(k['steps']-u['damage']),k['steps'])

for arm,run in [('control',control),('experiment',experiment)]:
    previous=cp['source_E4'];hold=cp['hold_sum'].copy()
    check([r['t'] for r in run['records']]==list(range(5,25)))
    for row,trace in zip(run['records'],traces[arm]):
        for side,d in row['sides'].items():
            st=d['start'];end=d['end'];c=end['cum'];initial=params['initial'][side]
            prev=previous['sides'][side]['end']
            check(st['units'][:len(prev['units'])]==prev['units'])
            check(len(st['units'])-len(prev['units'])==len(prev['pending']))
            check([u['kind'] for u in st['units'][len(prev['units']):]]==prev['pending'])
            for u in st['units'][len(prev['units']):]:check(u['stock']==0 and u['damage']==0 and u['debt']==0)
            for key in prev:
                if key not in ['units','pending']:check(st[key]==prev[key])
            check(st['pending']==[])
            check(2+c['production']+c['recycle']==end['front']+end['rear']+c['repair']+c['newcost'])
            check(initial['P']==end['P']+c['repair']+c['newcost'])
            check(Q(c['loss'],2)==end['wreck']+c['recycle'])
            initQ=sum(n*3*types[k]['m'] for k,n in initial['roster'].items())
            check(initQ+c['sp']==sum(u['stock'] for u in end['units'])+c['maint']+c['action']+c['destroySP'])
            check(c['loss']-c['repair']==sum(u['damage'] for u in end['units']))
            check(d['endSP']==Q(sum(u['stock'] for u in end['units']),4))
            check(d['maintenance']+d['shortage']==d['due'])
            check(d['used']==d['shipE']+d['shipSP'] and d['used']<=d['capacity'])
            check(d['shipSP']<=d['source'] and 0<=d['shipE']<=4)
            check(0<=end['front']<=24 and 0<=end['rear']<=24)
            # Unit payment, effective attack and defense independently reconstructed.
            totalA=0;moveQ=attackQ=0
            for u in live(st['units']):
                if d['mode'] not in ['突击','反攻'] or u['id']==d['repairID']:continue
                k=types[u['kind']];stock=u['stock']
                m=min(4,stock) if k['mobile'] else 0;stock-=m
                a=min(4,stock);moveQ+=m;attackQ+=a
                df=Q(1) if u['debt']<1 else Q(3,4) if u['debt']<2 else Q(1,2)
                totalA+=math.ceil(stren(u,'a')*min(Q(1,2)+Q(a,8),df))
            defense=sum((stren(u,'d')*(Q(1,2) if u['id']==d['repairID'] else 1) for u in live(st['units'])),Q(0))
            check(totalA==d['attack'] and defense==d['defense'])
            check(moveQ==trace['sides'][side]['moveQ'] and attackQ==trace['sides'][side]['attackQ'])
            check(moveQ+attackQ==d['actionQ'])
            # Verify priority effect from logged SAME inputs, without evolving states.
            fi=trace['sides'][side]['freight_inputs'];pre=trace['sides'][side]['pre_freight']
            available=Q(min(fi['capQ'],fi['sourceQ'],fi['stockTargetQ']),4)
            if arm=='experiment' and side=='G':
                check(d['shipSP']==available)
                check(d['shipE']==min(Q(4),pre['rear'],24-pre['front'],Q(fi['capQ'],4)-available))
            else:
                equipment=min(Q(4),pre['rear'],24-pre['front'],Q(fi['capQ']-fi['spReserved'],4))
                check(d['shipE']==equipment)
                check(d['shipSP']==min(available,Q(fi['capQ'],4)-equipment))
            # Loss/F and current W, without assuming that damage or policy stays on the old path.
            R=sum(types[u['kind']]['w'] for u in end['units'])
            L=sum((Q(types[u['kind']]['w']*u['damage'],types[u['kind']]['steps']) for u in end['units']),Q(0))
            check(d['R']==R and d['L']==L and d['Fpressure']==40*L/R)
            P=min(30,sum((8 if n['role']=='capital' else 4) for n,o in zip(nodes,row['confirmed'])
                        if n['home']==side and o not in [None,side]))
            check(d['Ppressure']==P and d['W']==max(0,100-P-d['Fpressure']-d['Spressure']))
            check(d['shortage']==0 and d['supplyLoss']==0 and d['Spressure']==0 and d['collapse']==0)
            for u in end['units']:
                k=types[u['kind']]
                check(0<=u['stock']<=k['cap'] and u['debt']==0 and u['chronic']==0 and 0<=u['damage']<=k['steps'])
            C=sum(n['vp'] for n,o in zip(nodes,row['confirmed']) if o==side);hold[side]+=C
            check(C==d['C'] and hold[side]==d['holdSum'])
            if row['t']==24:check(d['repair']==0 and d['new'] is None and end['pending']==[])
        margins={s:max(Q(0),row['sides'][s]['attack']-Q(21,20)*row['sides']['S' if s=='G' else 'G']['defense']) for s in ['G','S']}
        check(margins==row['margins'])
        winner='G' if margins['G']>margins['S'] else 'S' if margins['S']>margins['G'] else None
        owners=previous['owners'][:];border=max((i for i,o in enumerate(owners) if o=='G'),default=-1)
        for side in ['G','S']:
            prog=previous['progress'][side]+margins[side]-margins['S' if side=='G' else 'G'] if side==winner else max(Q(0),previous['progress'][side]-10)
            target=border+1 if side=='G' else border
            if side==winner and prog>=40 and 0<=target<9:owners[target]=side;prog=Q(0)
            check(prog==row['progress'][side])
        check(owners==row['owners'])
        check(row['confirmed']==[o if previous['owners'][i]==o else None for i,o in enumerate(owners)])
        previous=row
    for s in ['G','S']:check(run['final'][s]==Q(56*previous['sides'][s]['C']+hold[s],80))
    check(run['delta']==run['final']['G']-run['final']['S'])

def measure(arm,field):return Q(sum(t['sides']['G'][field] for t in traces[arm] if 6<=t['t']<=12),4)
check(measure('control','attackQ')==24)
check(measure('experiment','attackQ')==Q(153,4))
check(summary['primary_control_SP']==measure('control','attackQ'))
check(summary['primary_experiment_SP']==measure('experiment','attackQ'))
check(summary['movement_control_SP']==measure('control','moveQ'))
check(summary['movement_experiment_SP']==measure('experiment','moveQ'))

lines=['# CAMPAIGN-003 双方逐轮账本','',
       '以下所有游戏数量为001旧代理实验参数及本轮推演结果，不是新契约验证。T1—E4完整共同前缀与双方E4末状态保存在 START_E4.json；本表列独立续算的T5—E24。每个T含双方行动和唯一E结算。',
       '', '实际攻击SP与机动SP分别列出。本E到货在本T行动之后，最早供下一T使用；不要用本E到账解释本T已经发生的进攻。精确分数、完整单位期初/期末见 CONTROL.json / EXPERIMENT.json；逐单位实际支付和货运前状态见 TRACES.json。',
       '', '## 主指标窗口','',
       '|T|对照攻击SP|实验攻击SP|攻击差|对照机动SP|实验机动SP|对照/实验行动|',
       '|---|---|---|---|---|---|---|']
for i in range(1,8):
    a=traces['control'][i]['sides']['G'];b=traces['experiment'][i]['sides']['G']
    lines.append('|'+ '|'.join(map(fmt,[i+5,Q(a['attackQ'],4),Q(b['attackQ'],4),Q(b['attackQ']-a['attackQ'],4),Q(a['moveQ'],4),Q(b['moveQ'],4),control['records'][i]['sides']['G']['mode']+'/'+experiment['records'][i]['sides']['G']['mode']]))+'|')
lines+=['|合计|24|38.25|14.25|6|8.25|—|']
for arm,run,title in [('control',control,'原对照'),('experiment',experiment,'SP储备优先实验')]:
    lines+=['',f'## {title} 战略层','',
        '|T|G/S策略|G/S攻值|G/S净压|G/S推进末|G/S确认VP|G/S累计持有|G/S战争意志|易手|',
        '|---|---|---|---|---|---|---|---|---|']
    for r in run['records']:
        g=r['sides']['G'];s=r['sides']['S'];pair=lambda k:fmt(g[k])+'/'+fmt(s[k])
        lines.append('|'+ '|'.join([str(r['t']),pair('mode'),pair('attack'),fmt(r['margins']['G'])+'/'+fmt(r['margins']['S']),fmt(r['progress']['G'])+'/'+fmt(r['progress']['S']),pair('C'),pair('holdSum'),pair('W'),r['event']])+'|')
    for side,label in [('G','德军'),('S','苏军')]:
        lines+=['',f'### {label} 资源与军事','',
            '|T|期初SP|机动/攻击SP|本E到E/SP|维护实付/应付|E末SP|运量/容量|产出/回收E|前/后E|存活|新到/新订|战损/缺供损耗/恢复|现存伤阶|P余|',
            '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|']
        for r,tr in zip(run['records'],traces[arm]):
            d=r['sides'][side];s=d['end'];a=tr['sides'][side]
            lines.append('|'+ '|'.join(map(fmt,[r['t'],Q(sum(u['stock'] for u in d['start']['units']),4),fmt(Q(a['moveQ'],4))+'/'+fmt(Q(a['attackQ'],4)),fmt(d['shipE'])+'/'+fmt(d['shipSP']),fmt(d['maintenance'])+'/'+fmt(d['due']),d['endSP'],fmt(d['used'])+'/'+fmt(d['capacity']),fmt(d['output'])+'/'+fmt(d['recycle']),fmt(s['front'])+'/'+fmt(s['rear']),d['live'],str(len(d['arrivals']))+'/'+str(d['new'] or '-'),str(d['combatLoss'])+'/'+str(d['supplyLoss'])+'/'+str(d['repair']),d['damage'],s['P']]))+'|')
(HERE/'LEDGERS.md').write_bytes(('\n'.join(lines)+'\n').encode('utf8'))
audit=dict(status='PASS',assertions=checks,scope='独立读取输出验证；本脚本没有运行任何对局或策略分支',
    source_files_unchanged=len(validation['input_sha256']),E5_entire_prefreight_trace_equal=True,
    checks=['所有原始001/002文件与指定Git提交逐字节相同','控制逐字段一致','前E到下一T入场与状态连续',
            'E/P/残骸/SP守恒与边界','实际机动/攻击支付和攻防值','按固定货运输入复核两种货运顺序',
            '保存推进/归属/确认/VP与F/W复核','两组均无维护欠额或缺供损耗','主指标独立重算'],
    primary_control_SP=24,primary_experiment_SP=38.25,primary_delta_SP=14.25,
    ledger_sha256=hashlib.sha256((HERE/'LEDGERS.md').read_bytes()).hexdigest(),
    script_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest())
(HERE/'AUDIT.json').write_bytes((json.dumps(audit,ensure_ascii=False,indent=2)+'\n').encode('utf8'))
print(json.dumps({k:audit[k] for k in ['status','assertions','source_files_unchanged','primary_control_SP','primary_experiment_SP']},ensure_ascii=False))

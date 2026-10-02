"""Read-only audit of saved CAMPAIGN-001 states. No simulation or parameter changes.

Run: python docs/campaign-002/extract_evidence.py
Writes only EVIDENCE.json, TABLES.md, VALIDATION.json beside this file.
"""
import hashlib
import json
import math
import subprocess
from fractions import Fraction as Q
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
BASE = '64566985664fff7652fb5a510477ce25d2b05018'
checks = 0


def verify(ok):
    global checks
    assert ok
    checks += 1


def decode(x):
    if isinstance(x, dict) and set(x) == {'exact', 'value'}:
        return Q(x['exact'])
    if isinstance(x, dict):
        return {k: decode(v) for k, v in x.items()}
    if isinstance(x, list):
        return [decode(v) for v in x]
    return x


def encode(x):
    if isinstance(x, Q):
        return {'exact': str(x), 'display': round(float(x), 4)}
    if isinstance(x, dict):
        return {k: encode(v) for k, v in x.items()}
    if isinstance(x, list):
        return [encode(v) for v in x]
    return x


def write(name, data):
    (HERE / name).write_bytes(data.encode('utf8'))


sources = {}
for name in ['LEDGER_DATA.json', 'PARAMETERS.json', 'METHOD.md', 'REPORT.md', 'SUMMARY.json']:
    relative = 'docs/campaign-001/' + name
    content = (ROOT / relative).read_bytes()
    original = subprocess.check_output(['git', 'show', f'{BASE}:{relative}'], cwd=ROOT)
    verify(content == original)
    sources[name] = hashlib.sha256(content).hexdigest()

raw = json.loads((ROOT / 'docs/campaign-001/LEDGER_DATA.json').read_text(encoding='utf8'))
data = decode(raw)
types = json.loads((ROOT / 'docs/campaign-001/PARAMETERS.json').read_text(encoding='utf8'))['units']


def locate(route, variant):
    matches = [(r, f'/{section}/{i}') for section in ['main', 'controls']
               for i, r in enumerate(data[section]) if r['route'] == route and r['variant'] == variant]
    verify(len(matches) == 1)
    return matches[0]


def state_hash(obj):
    canonical = json.dumps(encode(obj), sort_keys=True, ensure_ascii=False, separators=(',', ':'))
    return hashlib.sha256(canonical.encode('utf8')).hexdigest()


def extract(route, variant, turns, side):
    run, pointer = locate(route, variant)
    result = []
    for t in turns:
        row = run['records'][t - 1]
        prior = run['records'][t - 2] if t > 1 else None
        d = row['sides'][side]
        other = 'S' if side == 'G' else 'G'
        enemy = row['sides'][other]
        active = d['mode'] in ['突击', '反攻']
        unit_details = []
        move = attackpay = actual = upper = 0
        count = ready = 0
        debt_sum = Q(0)
        for u in d['start']['units']:
            if u['dead']:
                continue
            count += 1
            ready += u['stock'] >= 4 and u['debt'] < 1
            debt_sum += u['debt']
            k = types[u['kind']]
            if u['id'] == d['repairID']:
                continue
            a = Q(k['a'] * (k['steps'] - u['damage']), k['steps'])
            df = Q(1) if u['debt'] < 1 else Q(3, 4) if u['debt'] < 2 else Q(1, 2)
            ub = math.ceil(a * df)  # Full payment only; retains debt and saved damage.
            upper += ub
            m = min(4, u['stock']) if active and k['mobile'] else 0
            p = min(4, u['stock'] - m) if active else 0
            factor = min(Q(1, 2) + Q(p, 8), df) if active else Q(0)
            contribution = math.ceil(a * factor) if active else 0
            actual += contribution
            move += m
            attackpay += p
            unit_details.append(dict(id=u['id'],kind=u['kind'],damage=u['damage'],debt=u['debt'],
                startSP=Q(u['stock'],4),moveSP=Q(m,4),attackSP=Q(p,4),effectiveAttack=contribution,
                fullPaymentUpper=ub))
        verify(actual == d['attack'] and move + attackpay == d['actionQ'])
        threshold = Q(21,20) * enemy['defense']
        margin = max(Q(0), actual - threshold) if active else Q(0)
        verify(margin == row['margins'][side])
        start_sp = Q(sum(u['stock'] for u in d['start']['units']),4)
        lost_sp = Q(d['end']['cum']['destroySP'] - d['start']['cum']['destroySP'],4)
        verify(start_sp - Q(move + attackpay,4) + d['shipSP'] - d['maintenance'] - lost_sp == d['endSP'])
        if prior:
            verify(prior['sides'][side]['endSP'] == start_sp)  # New saved arrivals carry zero SP.
        progress_start = prior['progress'][side] if prior else Q(0)
        progress_end = row['progress'][side]
        opposing_margin = row['margins'][other]
        gain = margin - opposing_margin if margin > opposing_margin else Q(0)
        expected_progress = progress_start + gain if margin > opposing_margin else max(Q(0), progress_start - 10)
        before_owners = prior['owners'] if prior else ['G']*3+['S']*6
        border = max((i for i,o in enumerate(before_owners) if o=='G'),default=-1)
        target = border+1 if side=='G' else border
        if margin > opposing_margin and expected_progress >= 40 and 0 <= target < 9:
            verify(row['owners'][target] == side)
            expected_progress = Q(0)
        verify(progress_end == expected_progress)
        verify(row['confirmed'] == [o if o==before_owners[i] else None for i,o in enumerate(row['owners'])])
        if not active:
            diagnosis = '策略未选择行动'
        elif margin == 0:
            diagnosis = '不能形成净压'
        elif margin <= opposing_margin:
            diagnosis = '有净压但不胜对方净压'
        elif progress_start + gain < 40:
            diagnosis = '能形成净压但累计不足'
        elif row['owners'] != row['confirmed']:
            diagnosis = '已易手待确认（不等于终局截断）'
        else:
            diagnosis = '已达推进门槛'
        r = dict(t=t,side=side,source_pointer=f'{pointer}/records/{t-1}',mode=d['mode'],
            previousE_SP=prior['sides'][side]['shipSP'] if prior else None,
            previousE_E=prior['sides'][side]['shipE'] if prior else None,
            previousE_maintenance=prior['sides'][side]['maintenance'] if prior else None,
            startSP=start_sp,moveSP=Q(move,4),attackSP=Q(attackpay,4),afterActionSP=start_sp-Q(move+attackpay,4),
            output=d['output'],recycle=d['recycle'],shipE=d['shipE'],shipSP=d['shipSP'],
            maintenance=d['maintenance'],due=d['due'],shortage=d['shortage'],endSP=d['endSP'],
            capacity=d['capacity'],used=d['used'],sourceSP=d['source'],
            unusedSource=d['source']-d['shipSP'],unusedCapacity=d['capacity']-d['used'],
            frontE=d['end']['front'],rearE=d['end']['rear'],personnel=d['end']['P'],I=d['end']['I'],
            repairID=d['repairID'],repair=d['repair'],newOrder=d['new'],arrivals=d['arrivals'],
            ready=ready,total=count,averageDebt=debt_sum/count,live=d['live'],combatLoss=d['combatLoss'],
            supplyLoss=d['supplyLoss'],netDamage=d['damage'],
            actualAttack=actual,opponentDefense=enemy['defense'],defenseThreshold=threshold,
            signedActualGap=actual-threshold,fullPaymentUpper=upper,upperSignedGap=upper-threshold,
            upperMargin=max(Q(0),upper-threshold),ownDefense=d['defense'],
            margin=margin,opponentMargin=opposing_margin,progressStart=progress_start,
            actualProgressGain=gain,progressEnd=progress_end,thresholdToCapture=40,
            owners=row['owners'],confirmed=row['confirmed'],C=d['C'],H=d['holdSum'],W=d['W'],
            event=row['event'],diagnosis=diagnosis,unitPayment=unit_details)
        result.append(r)
    return result


bmain, _ = locate('B','main')
bnone, _ = locate('B','no_industry')
chold, _ = locate('C','late_hold')
cpush, _ = locate('C','late_push')
verify(chold['records'][:20] == cpush['records'][:20])
for side in ['G','S']:
    verify(chold['records'][20]['sides'][side]['start'] == cpush['records'][20]['sides'][side]['start'])
verify([r['owners'] for r in bmain['records']] == [r['owners'] for r in bnone['records']])
verify([r['confirmed'] for r in bmain['records']] == [r['confirmed'] for r in bnone['records']])
for run in [bmain,bnone,chold,cpush]:
    for side in ['G','S']:
        h = sum(r['sides'][side]['C'] for r in run['records'])
        verify(h == run['records'][-1]['sides'][side]['holdSum'])
        verify(Q(56*run['records'][-1]['sides'][side]['C']+h,80) == run['final'][side])

evidence = dict(label='只读提取既存001数据；全部游戏数值仍为001实验参数。满支付上界是冻结快照诊断，不生成对局。',
    baseline=BASE,reference='5cac9bd81a9776b8a2e2837f33818c0c72561ba4',sources=sources,
    identity=dict(first20RecordsEqual=True,E20Hash=state_hash(chold['records'][19]),
                  first20Hashes={name:state_hash(r['records'][:20]) for name,r in [('hold',chold),('push',cpush)]},
                  T20StartHashes={s:state_hash(chold['records'][19]['sides'][s]['start']) for s in ['G','S']},
                  T21StartHashes={s:state_hash(chold['records'][20]['sides'][s]['start']) for s in ['G','S']}),
    windows=dict(B_main=extract('B','main',range(1,25),'G'),B_no_industry=extract('B','no_industry',range(1,25),'G'),
                 S_counterattack_in_B=extract('B','main',range(13,17),'S'),
                 C_late_push_G=extract('C','late_push',range(20,25),'G'),
                 C_late_hold_G=extract('C','late_hold',range(20,25),'G'),
                 C_late_push_S=extract('C','late_push',range(20,25),'S'),
                 C_late_hold_S=extract('C','late_hold',range(20,25),'S')),
    finals={k:dict(final=r['final'],delta=r['delta'],result=r['result']) for k,r in
            [('B_main',bmain),('B_no_industry',bnone),('C_late_hold',chold),('C_late_push',cpush)]})

# Check the report's attribution claims directly against saved/derived evidence.
w = evidence['windows']
m,n = w['B_main'],w['B_no_industry']
verify(m[3]['shipE']-n[3]['shipE']==2 and m[3]['shipSP']==n[3]['shipSP'])
verify(m[4]['shipE']-n[4]['shipE']==2 and n[4]['shipSP']-m[4]['shipSP']==2)
verify(m[4]['startSP']==n[4]['startSP'] and m[4]['actualAttack']==n[4]['actualAttack'])
verify(m[4]['maintenance']==n[4]['maintenance'] and m[4]['capacity']==n[4]['capacity'])
verify(m[9]['mode']=='整补' and n[9]['mode']=='突击' and n[9]['progressEnd']==Q(65,2))
verify(m[13]['unusedCapacity']>0 and m[13]['unusedSource']==0)
verify(all(r['upperSignedGap']<0 for r in w['S_counterattack_in_B']))
verify([r['actualAttack'] for r in w['S_counterattack_in_B']]==[142,128,116,0])
p,h = w['C_late_push_G'],w['C_late_hold_G']
verify([r['progressEnd'] for r in p[1:]]==[Q(131,5),Q(81,5),Q(31,5),Q(0)])
verify(all(r['upperSignedGap']>0 for r in p[1:]))
verify(sum(r['moveSP']+r['attackSP'] for r in p[1:])==23)
verify(h[-1]['endSP']-p[-1]['endSP']==23)
verify(sum(r['combatLoss'] for r in p[1:])==6 and sum(r['repair'] for r in p[1:])==2)
verify(all(r['unusedSource']==0 and r['unusedCapacity']==2 for r in p[1:]+h[1:]))
verify(all(r['event']=='无易手' for key,rows in w.items() if key.startswith('C_late') for r in rows))
verify(all(r['shortage']==0 and r['supplyLoss']==0 and r['averageDebt']==0 for rows in w.values() for r in rows))
verify(sum(r['attackSP'] for r in m[5:12])==24)


def f(x):
    if x is None: return '—'
    if isinstance(x,Q):
        return str(x.numerator) if x.denominator==1 else f'{float(x):.3f}'.rstrip('0').rstrip('.')
    return str(x)


lines=['# CAMPAIGN-002 保存状态追踪表','',
       '以下游戏数值均为001实验参数的保存值或诊断算术。精确分数、逐单位实际支付、数据JSON指针见 [EVIDENCE.json](EVIDENCE.json)。不含新对局。',
       '', '时间方向：上一E到账与维护 → 本T期初库存 → 本T机动/攻击支付 → 本T战力与推进 → 本E补给与维护 → 下一T。不能把本E到账用于解释已结束的本T攻击。',
       '', 'U为同一名册/伤阶/债务、同一恢复排除下的满支付攻值上界；保持原取整和敌防御，未行动轮U也只是诊断。U−1.05D为有符号差，负值表示满支付仍不能形成净压。没有累计这些假想上界来生成另一条战线。']
for key,rows in evidence['windows'].items():
    lines+=['',f'## {key}','',
            '|T|策略|上E到SP/E|上E维护|T初SP|机动/攻击实付SP|行动后SP|本E产出/回收E|本E运E/SP|本E维护实付/应付|E末SP|运力用/上限|来源未用|前/后E|',
            '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|']
    for r in rows:
        pair=lambda a,b:f'{f(r[a])}/{f(r[b])}'
        lines.append('|'+ '|'.join(map(f,[r['t'],r['mode'],pair('previousE_SP','previousE_E'),r['previousE_maintenance'],r['startSP'],pair('moveSP','attackSP'),r['afterActionSP'],pair('output','recycle'),pair('shipE','shipSP'),pair('maintenance','due'),r['endSP'],pair('used','capacity'),r['unusedSource'],pair('frontE','rearE')]))+'|')
    lines+=['','|T|可支付门槛人数|攻击A|敌防御D|1.05D|实际净压/敌净压|U|U−1.05D|推进前→后|确认C/累计H|分类|',
            '|---|---|---|---|---|---|---|---|---|---|---|']
    for r in rows:
        lines.append('|'+ '|'.join(map(f,[r['t'],f"{r['ready']}/{r['total']}",r['actualAttack'],r['opponentDefense'],r['defenseThreshold'],f"{f(r['margin'])}/{f(r['opponentMargin'])}",r['fullPaymentUpper'],r['upperSignedGap'],f"{f(r['progressStart'])}→{f(r['progressEnd'])}",f"{r['C']}/{r['H']}",r['diagnosis']]))+'|')
    lines+=['','|T|存活|新到/新订|恢复ID/阶|战损/缺供损伤|E末现存伤阶|E末人员P|E末W|易手|',
            '|---|---|---|---|---|---|---|---|---|']
    for r in rows:
        lines.append('|'+ '|'.join(map(f,[r['t'],r['live'],f"{len(r['arrivals'])}/{r['newOrder'] or '-'}",f"{r['repairID'] or '-'}/{r['repair']}",f"{r['combatLoss']}/{r['supplyLoss']}",r['netDamage'],r['personnel'],r['W'],r['event']]))+'|')

write('EVIDENCE.json',json.dumps(encode(evidence),ensure_ascii=False,indent=2)+'\n')
write('TABLES.md','\n'.join(lines)+'\n')
validation=dict(status='PASS',baseline=BASE,sourceHashes=sources,sourceMatchesGitBaseline=True,
    savedRowsExtracted=sum(map(len,evidence['windows'].values())),assertions=checks,
    scope=['source byte equality','saved actual payment and attack reconstruction','saved net margin',
           'saved progress and confirmation arithmetic','B full owner and confirmation histories equal','final score reconstruction',
           'SP flow identity','previous E stock to current T stock','C first 20 records and T21 starting states equal',
           'specific report claims: crowding onset, source saturation, upper bounds, late losses and identical VP path'],
    generatedGames=0,parameterScans=0,limits=['No game replay, no new state transition or outcome simulation','Upper bound retains saved damage, debt and recovery choice; no legality claim'],
    outputHashes={n:hashlib.sha256((HERE/n).read_bytes()).hexdigest() for n in ['EVIDENCE.json','TABLES.md']})
write('VALIDATION.json',json.dumps(validation,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:validation[k] for k in ['status','savedRowsExtracted','assertions','generatedGames','parameterScans']},ensure_ascii=False))

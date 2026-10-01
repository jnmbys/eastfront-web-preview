"""Short private checkpoint tests; no public injection, rule edits or full campaign."""
import sys,json,gzip,subprocess,time,math
from pathlib import Path
from copy import deepcopy
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'experiments/supply-integrate-015'))
import service as s
from live import execute,hash_bundle,audit
from bounded import close_worker
OUT=Path(__file__).parent/'evidence'
def read(p):
    data=json.load(gzip.open(s.EXP/'evidence'/p,'rt',encoding='utf-8'))
    if 'state' in data: assert hash_bundle(data['state'])==data['hash']
    return data
DRAFT=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {createPresentationState} from './dist/app/state/presentation.js';import {queryDraft} from './dist/app/multiplayer/gameplayProtocol.js';console.log(JSON.stringify(queryDraft(createPresentationState())))"],cwd=ROOT,text=True))
def draft(**kw):return dict(deepcopy(DRAFT),**kw)
def slot(b,viewer='GERMAN'):return dict(state=deepcopy(b),viewer=viewer,memory={'GERMAN':[],'SOVIET':[]},receipt={},base_revision=0,seconds=None,touched=time.monotonic())
def apply(b,a):
    controller=b['core']['pendingDecision']['decisionOwnerControllerId'] if b['core']['pendingDecision'] else next(c['id'] for c in b['core']['controllers'].values() if c['side']==b['core']['activeSide'])
    a={k:v for k,v in a.items() if k!='controllerId'}
    cmd={'id':'020-'+str(b['revision'])+'-'+a['type'],'revision':b['revision'],'action':{'type':a.pop('type'),'controllerId':controller,**a}}
    r=execute(b,cmd);assert r['ok'],r.get('error');return r['state']
report={'source':'813b4072568352e95d0726fe5fe04060c889c554','rules_reference':'b4a30a7c6958db1246a8c031850c4f936d1ceb61','scope':'local private fixture/authority checks, not deployed-image acceptance','checks':[]}
fixtures={}
def quote(b,d):
    sl=slot(b);before=deepcopy(sl)
    p,_=s.packet(sl,draft=d)
    assert sl==before,'query changed full bundle/RNG/seen/journal/receipt/memory'
    again,_=s.packet(sl,draft=d);assert p==again and sl==before
    assert set(r['id'] for r in p['supply']['preview']['rows'])<=set(u['id'] for u in p['supply']['units'])
    return p

def compare(name,b,d,a,expected,fixture='legal checkpoint branch'):
    p=quote(b,d);rows=p['supply']['preview']['rows'];assert len(rows)==len(expected),(name,rows,p['model']['combat']['attackDraft'] if p['model']['combat'] else p['model']['movement'])
    assert [(x['id'],x['cost'],x['after'],x['attackFactor']) for x in rows]==expected,(name,rows)
    before=deepcopy(b);sl=slot(b);cmd={'id':'020-'+name,'revision':b['revision'],'action':a}
    result=s.transact(sl,cmd);assert b==before
    charges={c['unit']:c['cost'] for c in sl['state']['journal'][-1]['charges']}
    after={u['id']:u for u in sl['state']['logistics']['units']}
    for row in rows:
        assert charges.get(row['id'],0)==row['cost']
        assert after[row['id']]['stock']==row['after']
    strength=None
    if a['type']=='ATTACK':
        tx=list(sl['state']['core']['combatTransactions'].values())[-1]
        strength=tx['context']['attackStrength']
        assert strength==p['model']['combat']['attackDraft']['preview']['attackStrength'],(strength,p['model']['combat']['attackDraft']['preview'])
        expected_strength=sum(math.ceil((5 if r['id']=='G-I-01' else 8 if r['id']=='G-PZ-01' else 6)*r['attackFactor']) for r in rows)
        assert strength==expected_strength,(name,strength,expected_strength)
    report['checks'].append(dict(name=name,passed=True,fixture=fixture,before_hash=hash_bundle(b),after_hash=hash_bundle(sl['state']),preview=rows,charges=charges,attackStrength=strength,seconds=result['supply']['seconds'],query_repeat_identical=True,entire_slot_unchanged_by_queries=True))
    fixtures[name]=dict(draft=d,packet={k:p[k] for k in ('supply','matchRevision')},after={k:result[k] for k in ('supply','matchRevision')})
    print('PASS',name,flush=True)
    return sl['state']

if __name__=='__main__':
 s.warm_start()
 try:
    cp75=read('campaign011-final/checkpoint-75.json.gz')['state'];records=read('campaign011-final/reserve-recovery-repeat.json.gz')['records'];b=deepcopy(cp75)
    for row in records[:3]:b=apply(b,row['command']['action']);assert hash_bundle(b)==row['hash']
    attack=dict(type='ATTACK',attackerUnitIds=['G-I-01'],target={'q':5,'r':5})
    d=draft(selectedUnitId='G-I-01',primaryAttackerId='G-I-01',interactionMode='ATTACK',attackUnitIds=['G-I-01'],attackTarget=attack['target'])
    compare('funded-legal',b,d,attack,[('G-I-01',4,8,1)])
    for name,n,debt,factor in [('full-cap',16,'0',1),('partial-075',3,'0',.875),('partial-050',2,'0',.75),('partial-025',1,'0',.625),('empty',0,'1',.5),('debt-limits-full',16,'1',.75),('severe-debt',16,'2',.5)]:
        case=deepcopy(b);u=next(u for u in case['logistics']['units'] if u['id']=='G-I-01')
        case['logistics']['continuity']['initial']+=n-u['stock'];u.update(stock=n,debt=debt);audit(case['logistics'])
        compare(name,case,d,attack,[('G-I-01',min(4,n),max(0,n-4),factor)],'private inventory/debt boundary fixture on legal revision78 geometry; not claimed as campaign-derived')
    movement=apply(cp75,{'type':'END_PHASE'})
    md=draft(selectedUnitId='G-PZ-01',interactionMode='MOVE_PATH',pathDraft=[{'q':4,'r':5}])
    compare('armor-move',movement,md,dict(type='MOVE',unitId='G-PZ-01',path=md['pathDraft']),[('G-PZ-01',4,4,None)])
    md=draft(selectedUnitId='G-I-01',interactionMode='MOVE_PATH',pathDraft=[{'q':4,'r':5}])
    compare('infantry-move',movement,md,dict(type='MOVE',unitId='G-I-01',path=md['pathDraft']),[('G-I-01',0,12,None)])
    # Reuse actual 019 recovered-but-empty case and its recorded approach.
    clear=read('campaign011-close/checkpoint-128.json.gz')['state']
    rr=read('campaign011-close/recovered-unit-attack.json.gz')['records']
    for row in rr:
        if row['command']['action']['type']=='ATTACK':
            aa={k:v for k,v in row['command']['action'].items() if k!='controllerId'};break
        clear=apply(clear,row['command']['action']);assert hash_bundle(clear)==row['hash']
    dd=draft(selectedUnitId='G-MOT-01',primaryAttackerId='G-MOT-01',interactionMode='ATTACK',attackUnitIds=aa['attackerUnitIds'],attackTarget=aa['target'])
    assert next(u for u in clear['logistics']['units'] if u['id']=='G-MOT-01')['debt']=='0'
    compare('cleared-debt-empty-legal',clear,dd,aa,[('G-MOT-01',0,0,.5)])
    joint=apply(movement,dict(type='MOVE',unitId='G-PZ-01',path=[{'q':4,'r':6}]))
    joint=apply(joint,dict(type='MOVE',unitId='G-I-01',path=[{'q':4,'r':5}]))
    joint=apply(joint,dict(type='END_PHASE'))
    ja=dict(type='ATTACK',attackerUnitIds=['G-I-01','G-PZ-01'],target={'q':5,'r':5})
    jd=draft(selectedUnitId='G-I-01',primaryAttackerId='G-I-01',interactionMode='ATTACK',attackUnitIds=ja['attackerUnitIds'],attackTarget=ja['target'])
    compare('joint-legal',joint,jd,ja,[('G-I-01',4,8,1),('G-PZ-01',4,0,1)])
    partial=deepcopy(joint);pz=next(u for u in partial['logistics']['units'] if u['id']=='G-PZ-01');partial['logistics']['continuity']['initial']-=3;pz['stock']=1
    compare('joint-mixed-payment',partial,jd,ja,[('G-I-01',4,8,1),('G-PZ-01',1,0,.625)],'private quarter-stock boundary fixture on legal joint geometry')
    # Authorization and unknown-draft boundaries; no hidden IDs or route verdicts.
    for name,bd in [('no-target',draft(selectedUnitId='G-I-01',interactionMode='ATTACK',attackUnitIds=['G-I-01'])),('enemy-only',draft(selectedUnitId='S-I-01',interactionMode='ATTACK',attackUnitIds=['S-I-01'],attackTarget={'q':5,'r':5})),('no-path',draft(selectedUnitId='G-PZ-01',interactionMode='MOVE_PATH'))]:
        pp=quote(b if name!='no-path' else movement,bd);assert not pp['supply']['preview']['rows'];report['checks'].append(dict(name=name,passed=True))
    other=slot(b,'SOVIET');pp,_=s.packet(other,draft=d);assert not pp['supply']['preview']['rows'];assert all(u['id'].startswith('S-') for u in pp['supply']['units']);report['checks'].append(dict(name='other-seat-filtered',passed=True))
    old=deepcopy(b);old['mode']='old'
    pp=quote(old,d);assert not pp['supply']['preview']['rows'];report['checks'].append(dict(name='old-no-new-preview',passed=True))
    fixtures['old-mode']=dict(draft=d,packet={k:pp[k] for k in ('supply','matchRevision')})
    report['passed']=True
 except Exception:
    import traceback;report['passed']=False;report['failure']=traceback.format_exc();print(report['failure'],flush=True)
 finally:
    close_worker();OUT.mkdir(exist_ok=True)
    for name,content in [('verification.json',report),('panel-fixtures.json',fixtures)]:
        (OUT/name).write_text(json.dumps(content,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
 raise SystemExit(0 if report['passed'] else 1)

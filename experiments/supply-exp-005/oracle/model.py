"""Isolated exact small-graph supply reference. All quantities are integer quarter-SP.
Enumerates ALL simple rail paths and all simple last-mile paths within range.
No capped subset is ever silently accepted. SciPy/HiGHS MILP must prove optimal.
"""
from copy import deepcopy
from fractions import Fraction
import hashlib,json,time
import numpy as np
from scipy.optimize import milp, Bounds, LinearConstraint
from scipy.sparse import csc_matrix
Q=4
VERSION='supply-exp-001-a1'
class UnsupportedGraph(ValueError): pass

def digest(x): return hashlib.sha256(json.dumps(x,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
def fraction(x): return Fraction(str(x))
def budget(n,s):
    # Exact totals for odd integer budgets across half ticks: floor(prefix difference).
    if s['clock']=='full': return n
    k=s['tick'];return (n*(k+1)//2)-(n*k//2)

def project(s,side='G'):
    """Allowlist projection. No hidden occupancy, zoc, damage or private enemy fields."""
    out={k:deepcopy(s[k]) for k in ('name','scenario','nodes','edges','sources','hubs','units','clock','tick','half','order','variant','use_t','T','policy','rotation','pending','game_over','repairs','epoch','ledger') if k in s}
    out['ruleset']=s['ruleset']
    out['nodes']=[{k:n[k] for k in ('id','x','y','terrain','known','control','guard') if k in n} for n in out['nodes']]
    out['sources']=[x for x in out['sources'] if x['side']==side]
    out['hubs']=[x for x in out['hubs'] if x['side']==side]
    out['units']=[x for x in out['units'] if x['side']==side]
    out['repairs']=[x for x in out['repairs'] if x.get('side')==side]
    out['ledger']=[x for x in out.get('ledger',[]) if x.get('side')==side]
    # Edges expose public damage only. Unknown route eligibility remains conditional.
    out['view']='player';out['viewer']=side
    return out

def usable(s,node,side):
    n=next(n for n in s['nodes'] if n['id']==node)
    if n.get('control',side) not in (side,'both','unknown'): return False
    if s.get('view')!='player':
        private=s.get('hidden',{}).get(node,{})
        if private.get('occupied') or (private.get('zoc') and not n.get('guard')): return False
    return True

def adjacency(s,kind,side):
    allowed={n['id']:usable(s,n['id'],side) for n in s['nodes']}
    adj={n['id']:[] for n in s['nodes']}
    for e in sorted(s['edges'],key=lambda x:x['id']):
        if kind not in e['modes'] or e.get('cut'): continue
        if not allowed[e['a']] or not allowed[e['b']]: continue
        adj[e['a']].append((e['b'],e));adj[e['b']].append((e['a'],e))
    return adj

def paths(s,start,end,kind,side,limit=None,adj=None):
    adj=adj if adj is not None else adjacency(s,kind,side)
    if not usable(s,start,side) or not usable(s,end,side): return []
    out=[];visits=0
    def walk(n,seen,es,cost):
        nonlocal visits
        visits+=1
        if visits>200000: raise UnsupportedGraph('完整路径枚举超过安全门槛；未返回近似瓶颈/配送。')
        if n==end:
            out.append((tuple(es),max(1,cost)))
            if len(out)>10000:raise UnsupportedGraph('完整路径数量超过安全门槛；未截断返回。')
            return
        for other,e in adj[n]:
            c=cost+e.get('rail_cost' if kind=='rail' else 'cost',1)
            if other not in seen and (limit is None or c<=limit):walk(other,seen|{other},es+[e['id']],c)
    walk(start,{start},[],0)
    return out

class Program:
    def __init__(self): self.names=[];self.lo=[];self.hi=[];self.integer=[];self.rows=[];self.labels=[]
    def var(self,name,hi,integer=True):
        i=len(self.names);self.names.append(name);self.lo.append(0);self.hi.append(hi);self.integer.append(int(integer));return i
    def row(self,a,lo=-np.inf,hi=np.inf,label=''):
        self.rows.append((dict(a),lo,hi));self.labels.append(label)
    def solve(self,obj,maximize=True,freeze=False):
        n=len(self.names);c=np.zeros(n)
        for i,v in obj.items():c[i]=(-1 if maximize else 1)*v
        rr=[];cc=[];dd=[]
        for j,(a,l,h) in enumerate(self.rows):
            for i,v in a.items():rr.append(j);cc.append(i);dd.append(v)
        A=csc_matrix((dd,(rr,cc)),shape=(len(self.rows),n))
        ans=milp(c,integrality=np.array(self.integer),bounds=Bounds(self.lo,self.hi),constraints=LinearConstraint(A,[x[1] for x in self.rows],[x[2] for x in self.rows]),options={'time_limit':20,'mip_rel_gap':0.0})
        if ans.status!=0:raise UnsupportedGraph('求解未证明最优，不输出供应结论：'+ans.message)
        x=ans.x.copy()
        for i,isint in enumerate(self.integer):
            if isint:
                if abs(x[i]-round(x[i]))>1e-5:raise AssertionError('nonintegral')
                x[i]=round(x[i])
        for a,l,h in self.rows:
            v=sum(x[i]*k for i,k in a.items());assert l-1e-5<=v<=h+1e-5,(l,v,h)
        val=sum(x[i]*v for i,v in obj.items())
        if freeze:
            eps=1e-7 if any(not self.integer[i] for i in obj) else 0
            self.row(obj,val-eps,val+eps)
        return x,val

def solve(s,side='G'):
    began=time.perf_counter();p=Program();units=sorted([u for u in s['units'] if u['side']==side and u.get('strength',3)>0],key=lambda u:u['id'])
    hubs=sorted([h for h in s['hubs'] if h['side']==side and not h.get('inactive')],key=lambda h:h['id'])
    sources=sorted([a for a in s['sources'] if a['side']==side],key=lambda a:a['id'])
    edges={e['id']:e for e in s['edges']};rails=[];last=[];allgroups={}
    graphs={kind:adjacency(s,kind,side) for kind in ['rail','road']}
    for a in sources:
        for h in hubs:
            for es,c in paths(s,a['node'],h['node'],'rail',side,adj=graphs['rail']):
                i=p.var('rail:'+a['id']+':'+h['id']+':'+','.join(es),budget(a['cap'],s));rails.append(dict(i=i,source=a['id'],hub=h['id'],edges=es,cost=c))
    for h in hubs:
        for u in units:
            for es,c in paths(s,h['node'],u['node'],'road',side,h['range'],adj=graphs['road']):
                i=p.var('last:'+h['id']+':'+u['id']+':'+','.join(es),max(0,u['cap']-u['stock']));last.append(dict(i=i,hub=h['id'],unit=u['id'],edges=es,cost=c))
    delivery={u['id']:{r['i']:1 for r in last if r['unit']==u['id']} for u in units}
    def constrain(a,hi,label):p.row(a,hi=hi,label=label);allgroups[label]=(a,hi)
    for a in sources:constrain({r['i']:1 for r in rails if r['source']==a['id']},budget(a['cap'],s),'source:'+a['id'])
    for eid,e in edges.items():
        if 'rail' in e['modes']:constrain({r['i']:1 for r in rails if eid in r['edges']},budget(e['cap'],s),'rail:'+eid)
        if e.get('bridge_cap') is not None:constrain({r['i']:1 for r in last if eid in r['edges']},budget(e['bridge_cap'],s),'bridge:'+eid)
    if s['use_t']:constrain({r['i']:r['cost'] for r in rails},budget(s['T'],s),'T')
    hub_end={};floors={}
    for h in hubs:
        incoming={r['i']:1 for r in rails if r['hub']==h['id']};outgoing={r['i']:1 for r in last if r['hub']==h['id']}
        balance=incoming|{i:-v for i,v in outgoing.items()};hub_end[h['id']]=balance
        stock=h['stock'] if s['variant']=='A' else 0
        cap=h['cap'] if s['variant']=='A' else 0
        p.row(balance,-stock,cap-stock,'hub:'+h['id'])
        constrain({r['i']:r['cost'] if s['variant']=='A' else 1 for r in last if r['hub']==h['id']},budget(h['W'] if s['variant']=='A' else h['quota'],s),'W:'+h['id'])
        f=p.var('floor:'+h['id'],h.get('floor',0) if s['variant']=='A' else 0);floors[f]=1
        p.row({f:1,**{i:-v for i,v in balance.items()}},hi=stock)
    ys={};lam=p.var('maintenance_min_ratio',1,False)
    for u in units:
        d=delivery[u['id']];constrain(d,max(0,min(u['cap'],u['target'])-u['stock']),'unit:'+u['id'])
        b=budget(u['B'],s);y=p.var('maintenance:'+u['id'],b);ys[y]=1
        p.row({y:1,**{i:-v for i,v in d.items()}},hi=u['stock'])
        p.row({lam:b,y:-1},hi=0)
    objectives=[]
    def stage(name,obj,maximize=True):
        nonlocal x
        x,val=p.solve(obj,maximize,True);objectives.append([name,round(val,8)])
    x=None
    stage('maintenance_min_ratio',{lam:1});stage('maintenance_total',ys)
    if s['policy']=='floor':stage('bounded_hub_floor',floors)
    # Explicit weighted throughput for reserve refills, not full lexicographic max-min.
    weighted={r['i']:next(u.get('priority',1) for u in units if u['id']==r['unit']) for r in last}
    stage('priority_delivery',weighted)
    totalhub={r['i']:1 for r in rails}
    for r in last:totalhub[r['i']]=-1
    stage('remaining_hub_stock',totalhub)
    # Rotate deterministic tie-breaking over units; rotation is stored, not wall-clock/RNG.
    ids=[u['id'] for u in units];offset=s.get('rotation',0)%max(1,len(ids));ids=ids[offset:]+ids[:offset]
    stage('rotating_remainder',{r['i']:len(ids)-ids.index(r['unit']) for r in last})
    cost={r['i']:r['cost'] for r in rails+last};stage('transport_work',cost,False)
    # Stable solver/ordered columns resolve equal physical routes. Cross-version path identity not promised.
    flows=[{**{k:list(v) if isinstance(v,tuple) else v for k,v in r.items() if k!='i'},'q':int(x[r['i']]),'kind':kind} for kind,rs in [('rail',rails),('last',last)] for r in rs if x[r['i']]>0]
    result={'side':side,'deliveries':{u['id']:int(sum(x[i] for i in delivery[u['id']])) for u in units},'hubs':{},'flows':flows,'constraints':[], 'objectives':objectives,'paths':len(rails)+len(last),'variables':len(p.names),'rows':len(p.rows),'exact':True,'conditional':s.get('view')=='player' and any(not n.get('known',True) for n in s['nodes'])}
    for h in hubs:result['hubs'][h['id']]=int((h['stock'] if s['variant']=='A' else 0)+sum(x[i]*v for i,v in hub_end[h['id']].items()))
    for name,(a,cap) in allgroups.items():
        value=int(sum(x[i]*v for i,v in a.items()))
        result['constraints'].append({'id':name,'used':value,'cap':cap,'saturated':bool(a) and value==cap})
    result['ms']=round((time.perf_counter()-began)*1000,3)
    return result

def settle(s,epoch):
    if epoch in s.get('done',{}):return deepcopy(s),deepcopy(s['done'][epoch]),True
    if s.get('game_over') or s.get('pending'):raise ValueError('终局或 pending 后续未完成，拒绝结算')
    if epoch!=s['epoch']:raise ValueError('旧/未来 epoch 不可结算')
    out=deepcopy(s);results=[]
    for side in sorted(set(u['side'] for u in s['units'])):
        r=solve(s,side);r.pop('ms',None)
        for h in out['hubs']:
            if h['id'] in r['hubs']:h['stock']=r['hubs'][h['id']]
        r['units']=[]
        for u in out['units']:
            if u['side']!=side or u.get('strength',3)<=0:continue
            before=u['stock'];received=r['deliveries'][u['id']];b=budget(u['B'],s)
            paid=min(b,before+received);u['stock']=before+received-paid
            dt=Fraction(1,2) if s['clock']=='half' else Fraction(1)
            d=fraction(u['debt']);d=max(Fraction(0),d-dt) if paid==b else min(Fraction(3),d+dt*Fraction(b-paid,b))
            u['debt']=str(d)
            # Attrition accumulation is half-weighted too; no twice-per-round losses.
            a=fraction(u.get('attrition','0'))
            if d==3 and paid<b:a+=dt
            loss=int(a);a-=loss;u['attrition']=str(a);u['strength']=max(0,u.get('strength',3)-loss)
            r['units'].append({'id':u['id'],'before':before,'received':received,'maintenance':paid,'due':b,'after':u['stock'],'debt':str(d),'loss':loss})
            assert before+received==paid+u['stock'] and 0<=u['stock']<=u['cap']
        results.append(r)
    out.setdefault('done',{})[epoch]=results;out['ledger']=results;out['tick']+=1;out['rotation']+=1;out['epoch']='L'+str(out['tick']);return out,results,False

def advance(s,action_id):
    if action_id in s.get('actions',[]):return deepcopy(s)
    if s.get('game_over') or s.get('pending'):raise ValueError('不能结束阶段')
    out=deepcopy(s);out.setdefault('actions',[]).append(action_id);out['half']+=1
    for job in list(out['repairs']):
        if job['due']<=out['half']:
            e=next(e for e in out['edges'] if e['id']==job['edge']);e['cut']=False;out['repairs'].remove(job)
    if out['clock']=='half' or out['half']%2==0:out,_,_=settle(out,out['epoch'])
    return out

def attack(s,side,action_id):
    if action_id in s.get('actions',[]):return deepcopy(s)
    if s.get('game_over') or s.get('pending'):raise ValueError('拒绝行动')
    if side!=s['order'][s['half']%2]:raise ValueError('不是该方行动半回合')
    out=deepcopy(s);out.setdefault('actions',[]).append(action_id);out['last_action']=[]
    turn=str(out['half'])
    for u in out['units']:
        if u['side']!=side or u.get('strength',3)<=0:continue
        if u.get('attacked')==turn:continue
        cost=Q;paid=min(cost,u['stock']);u['stock']-=paid;u['attacked']=turn
        out['last_action'].append({'unit':u['id'],'cost':paid,'attack_factor':min(.5+.5*paid/cost, .5 if fraction(u['debt'])>=2 else .75 if fraction(u['debt'])>=1 else 1)})
    return out

def capture(s,hub_id,new_side):
    out=deepcopy(s);h=next(h for h in out['hubs'] if h['id']==hub_id);lost=h['stock'];h.update(stock=0,side=new_side,inactive=True)
    out.setdefault('losses',[]).append({'hub':hub_id,'lost':lost});return out

def exits(s,unit):
    """Declared sandbox movement contract, NOT a Core legality oracle."""
    u=next(u for u in s['units'] if u['id']==unit);mp=1 if fraction(u['debt'])>=2 else u.get('MP',4)
    out=[]
    for e in s['edges']:
        if 'road' not in e['modes'] or u['node'] not in (e['a'],e['b']):continue
        n=e['b'] if u['node']==e['a'] else e['a'];reason=[]
        if e.get('cut'):reason.append('线路/桥中断')
        if not usable(s,n,u['side']):reason.append('敌占/ZOC或非友方控制')
        cost=e.get('move_cost',e.get('cost',1))
        if cost>mp:reason.append('需要 '+str(cost)+' MP，只有 '+str(mp))
        out.append({'edge':e['id'],'to':n,'cost':cost,'legal':not reason,'reasons':reason})
    return out
